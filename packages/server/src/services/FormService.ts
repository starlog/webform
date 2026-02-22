import { Form } from '../models/Form.js';
import type { FormDocument, FormVersionSnapshot } from '../models/Form.js';
import type { CreateFormInput, UpdateFormInput, ListFormsQuery } from '../validators/formValidator.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';

export class FormService {
  async createForm(input: CreateFormInput, userId: string): Promise<FormDocument> {
    const form = await Form.create({
      ...input,
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

    const updateFields: Record<string, unknown> = {
      ...input,
      updatedBy: userId,
      status: 'draft',
    };

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

    return form.toObject() as FormDocument;
  }

  async deleteForm(id: string): Promise<void> {
    await this.getForm(id);
    await Form.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
  }

  async getVersions(id: string): Promise<Omit<FormVersionSnapshot, 'snapshot'>[]> {
    const form = await this.getForm(id);
    return form.versions
      .map(({ version, savedAt }) => ({ version, savedAt }))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  async publishForm(id: string, userId: string): Promise<FormDocument> {
    const existing = await this.getForm(id);

    if (existing.status === 'published') {
      throw new AppError(409, 'Form is already published');
    }

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
}
