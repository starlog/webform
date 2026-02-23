import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import type { ProjectDocument } from '../models/Project.js';
import { Form } from '../models/Form.js';
import type { FormDocument } from '../models/Form.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsQuery,
  ImportProjectInput,
} from '../validators/projectValidator.js';
import { NotFoundError } from '../middleware/errorHandler.js';

export interface ExportProjectData {
  exportVersion: '1.0';
  exportedAt: string;
  project: {
    name: string;
    description: string;
  };
  forms: Array<{
    name: string;
    properties: Record<string, unknown>;
    controls: unknown[];
    eventHandlers: unknown[];
    dataBindings: unknown[];
  }>;
}

export class ProjectService {
  async createProject(input: CreateProjectInput, userId: string): Promise<ProjectDocument> {
    const project = await Project.create({
      ...input,
      createdBy: userId,
      updatedBy: userId,
    });
    return project.toObject() as ProjectDocument;
  }

  async getProject(id: string): Promise<ProjectDocument> {
    const project = await Project.findOne({ _id: id, deletedAt: null });
    if (!project) {
      throw new NotFoundError(`Project not found: ${id}`);
    }
    return project.toObject() as ProjectDocument;
  }

  async getProjectDetail(id: string): Promise<{ project: ProjectDocument; forms: FormDocument[] }> {
    const project = await this.getProject(id);
    const forms = await Form.find({ projectId: id, deletedAt: null })
      .select('-versions')
      .sort({ updatedAt: -1 })
      .lean<FormDocument[]>();
    return { project, forms };
  }

  async listProjects(query: ListProjectsQuery): Promise<{ data: ProjectDocument[]; total: number }> {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Project.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ProjectDocument[]>(),
      Project.countDocuments(filter),
    ]);

    return { data, total };
  }

  async updateProject(id: string, input: UpdateProjectInput, userId: string): Promise<ProjectDocument> {
    await this.getProject(id);
    const project = await Project.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { ...input, updatedBy: userId } },
      { new: true },
    );
    if (!project) {
      throw new NotFoundError(`Project not found: ${id}`);
    }
    return project.toObject() as ProjectDocument;
  }

  async deleteProject(id: string): Promise<void> {
    await this.getProject(id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        await Project.updateOne({ _id: id }, { $set: { deletedAt: now } }, { session });
        await Form.updateMany(
          { projectId: id, deletedAt: null },
          { $set: { deletedAt: now } },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }

  async exportProject(id: string): Promise<ExportProjectData> {
    const project = await this.getProject(id);
    const forms = await Form.find({ projectId: id, deletedAt: null })
      .select('-versions -deletedAt -createdBy -updatedBy -createdAt -updatedAt -__v -projectId')
      .lean();

    return {
      exportVersion: '1.0',
      exportedAt: new Date().toISOString(),
      project: {
        name: project.name,
        description: project.description,
      },
      forms: forms.map((f) => ({
        name: f.name,
        properties: f.properties as unknown as Record<string, unknown>,
        controls: f.controls as unknown[],
        eventHandlers: f.eventHandlers as unknown[],
        dataBindings: f.dataBindings as unknown[],
      })),
    };
  }

  async applyFontToAllForms(
    projectId: string,
    font: { family: string; size: number; bold: boolean; italic: boolean; underline: boolean; strikethrough: boolean },
    userId: string,
  ): Promise<number> {
    await this.getProject(projectId);
    const forms = await Form.find({ projectId, deletedAt: null });

    let modifiedCount = 0;
    for (const form of forms) {
      // 폼 레벨 폰트 설정
      form.set('properties.font', font);

      // 모든 컨트롤의 폰트도 설정
      const controls = form.get('controls') as unknown as Array<Record<string, unknown>>;
      if (Array.isArray(controls)) {
        const walk = (ctrls: Array<Record<string, unknown>>) => {
          for (const ctrl of ctrls) {
            const props = ctrl.properties as Record<string, unknown> | undefined;
            if (props) {
              props.font = font;
            }
            if (Array.isArray(ctrl.children)) {
              walk(ctrl.children as Array<Record<string, unknown>>);
            }
          }
        };
        walk(controls);
        form.markModified('controls');
      }

      form.set('updatedBy', userId);
      await form.save();
      modifiedCount++;
    }

    return modifiedCount;
  }

  async importProject(input: ImportProjectInput, userId: string): Promise<ProjectDocument> {
    const project = await this.createProject(
      { name: input.project.name, description: input.project.description },
      userId,
    );

    if (input.forms.length > 0) {
      const formDocs = input.forms.map((f) => ({
        name: f.name,
        properties: f.properties,
        controls: f.controls,
        eventHandlers: f.eventHandlers,
        dataBindings: f.dataBindings,
        projectId: project._id.toString(),
        version: 1,
        status: 'draft' as const,
        versions: [],
        createdBy: userId,
        updatedBy: userId,
      }));
      await Form.insertMany(formDocs);
    }

    return project;
  }
}
