import { Types } from 'mongoose';
import { Form } from '../models/Form.js';
import type { FormDocument, FormVersionSnapshot } from '../models/Form.js';
import { FormVersion } from '../models/FormVersion.js';
import type { FormVersionDocument } from '../models/FormVersion.js';
import type { CreateFormInput, UpdateFormInput, ListFormsQuery } from '../validators/formValidator.js';
import { NotFoundError } from '../middleware/errorHandler.js';

function generateNote(existing: FormDocument, input: UpdateFormInput): string {
  const parts: string[] = [];

  // 이름 변경
  if (input.name && input.name !== existing.name) {
    parts.push(`Renamed form to '${input.name}'`);
  }

  // 폼 크기 변경
  if (input.properties) {
    const oldW = existing.properties.width;
    const oldH = existing.properties.height;
    const newW = input.properties.width ?? oldW;
    const newH = input.properties.height ?? oldH;
    if (newW !== oldW || newH !== oldH) {
      parts.push(`Changed form size (${oldW}×${oldH} → ${newW}×${newH})`);
    }
  }

  // 컨트롤 추가/삭제
  if (input.controls) {
    const oldIds = new Set(existing.controls.map((c) => c.id));
    const newIds = new Set(input.controls.map((c) => c.id));

    const added = input.controls.filter((c) => !oldIds.has(c.id));
    const removed = existing.controls.filter((c) => !newIds.has(c.id));

    if (added.length > 0) {
      const types = added.map((c) => c.type).join(', ');
      parts.push(`Added ${added.length} control(s) (${types})`);
    }
    if (removed.length > 0) {
      const types = removed.map((c) => c.type).join(', ');
      parts.push(`Removed ${removed.length} control(s) (${types})`);
    }
  }

  // 이벤트 핸들러 변경
  if (input.eventHandlers) {
    const oldCount = existing.eventHandlers.length;
    const newCount = input.eventHandlers.length;
    if (oldCount !== newCount || JSON.stringify(input.eventHandlers) !== JSON.stringify(existing.eventHandlers)) {
      parts.push('Updated event handlers');
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'Auto-save';
}

export class FormService {
  async createForm(input: CreateFormInput, userId: string): Promise<FormDocument> {
    const formId = new Types.ObjectId();
    const eventHandlers = (input.eventHandlers ?? []).map((h) =>
      h.controlId === '_form' ? { ...h, controlId: formId.toString() } : h,
    );
    const form = await Form.create({
      ...input,
      _id: formId,
      eventHandlers,
      version: 1,
      status: 'draft',
      versions: [],
      createdBy: userId,
      updatedBy: userId,
    });
    return form.toObject() as FormDocument;
  }

  async getForm(id: string): Promise<FormDocument> {
    const form = await Form.findOne({ _id: id, deletedAt: null });
    if (!form) {
      throw new NotFoundError(`Form not found: ${id}`);
    }
    return form.toObject() as FormDocument;
  }

  async listForms(query: ListFormsQuery): Promise<{ data: FormDocument[]; total: number }> {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.projectId) {
      filter.projectId = query.projectId;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Form.find(filter)
        .select('-versions')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<FormDocument[]>(),
      Form.countDocuments(filter),
    ]);

    return { data, total };
  }

  async updateForm(id: string, input: UpdateFormInput, userId: string): Promise<FormDocument> {
    const existing = await this.getForm(id);

    const snapshot: FormVersionSnapshot = {
      version: existing.version,
      snapshot: {
        name: existing.name,
        properties: existing.properties,
        controls: existing.controls,
        eventHandlers: existing.eventHandlers,
        dataBindings: existing.dataBindings,
      },
      savedAt: new Date(),
    };

    // 자동 note 생성
    const note = generateNote(existing, input);

    const updateFields: Record<string, unknown> = {
      ...input,
      updatedBy: userId,
    };

    // published 상태에서 수정 시 draft로 전환
    if (existing.status === 'published') {
      updateFields.status = 'draft';
    }

    const form = await Form.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: updateFields,
        $inc: { version: 1 },
        $push: { versions: snapshot },
      },
      { new: true },
    );

    if (!form) {
      throw new NotFoundError(`Form not found: ${id}`);
    }

    const saved = form.toObject() as FormDocument;

    // FormVersion 컬렉션에 새 상태 저장 (업데이트 완료 후)
    FormVersion.create({
      formId: id,
      version: saved.version,
      note,
      snapshot: {
        name: saved.name,
        properties: saved.properties,
        controls: saved.controls,
        eventHandlers: saved.eventHandlers,
        dataBindings: saved.dataBindings,
      },
      savedAt: new Date(),
      savedBy: userId,
    }).catch((err) => {
      console.error('Failed to save FormVersion:', err);
    });

    return saved;
  }

  async deleteForm(id: string): Promise<void> {
    await this.getForm(id);
    await Form.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
  }

  async getVersions(
    id: string,
  ): Promise<Array<{ version: number; note: string; savedAt: Date }>> {
    await this.getForm(id); // 폼 존재 확인
    const versions = await FormVersion.find({ formId: id })
      .select('version note savedAt')
      .sort({ version: -1 })
      .limit(20)
      .lean<Array<{ version: number; note: string; savedAt: Date }>>();
    return versions;
  }

  async getVersionSnapshot(
    formId: string,
    version: number,
  ): Promise<FormVersionDocument> {
    const doc = await FormVersion.findOne({ formId, version }).lean<FormVersionDocument>();
    if (!doc) {
      throw new NotFoundError(`Version ${version} not found for form ${formId}`);
    }
    return doc;
  }

  async publishForm(id: string, userId: string): Promise<FormDocument> {
    const existing = await this.getForm(id);

    const form = await Form.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'published',
          publishedVersion: existing.version,
          updatedBy: userId,
        },
      },
      { new: true },
    );

    if (!form) {
      throw new NotFoundError(`Form not found: ${id}`);
    }

    return form.toObject() as FormDocument;
  }

  async publishAllByProject(
    projectId: string,
    userId: string,
  ): Promise<{ publishedCount: number; skippedCount: number; totalCount: number }> {
    const forms = await Form.find(
      { projectId, deletedAt: null },
      { _id: 1, status: 1, version: 1 },
    ).lean<Pick<FormDocument, '_id' | 'status' | 'version'>[]>();

    const draftForms = forms.filter((f) => f.status === 'draft');
    const skippedCount = forms.length - draftForms.length;

    if (draftForms.length > 0) {
      await Form.bulkWrite(
        draftForms.map((f) => ({
          updateOne: {
            filter: { _id: f._id },
            update: {
              $set: {
                status: 'published' as const,
                publishedVersion: f.version,
                updatedBy: userId,
              },
            },
          },
        })),
      );
    }

    return {
      publishedCount: draftForms.length,
      skippedCount,
      totalCount: forms.length,
    };
  }
}
