import { Types } from 'mongoose';
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
import { NotFoundError, AppError } from '../middleware/errorHandler.js';
import { FormService } from './FormService.js';
import { ShellService } from './ShellService.js';

export interface PublishAllResult {
  forms: {
    publishedCount: number;
    skippedCount: number;
    totalCount: number;
  };
  shell: {
    published: boolean;
    skipped: boolean;
  };
}

export interface ExportProjectData {
  exportVersion: '1.0';
  exportedAt: string;
  project: {
    name: string;
    description: string;
    defaultFont?: {
      family: string;
      size: number;
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strikethrough: boolean;
    };
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
  private formService = new FormService();
  private shellService = new ShellService();

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
    const { defaultFont, ...rest } = input;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      $set: { ...rest, updatedBy: userId },
    };
    if (defaultFont === null) {
      update.$unset = { defaultFont: 1 };
    } else if (defaultFont !== undefined) {
      update.$set.defaultFont = defaultFont;
    }
    const project = await Project.findOneAndUpdate(
      { _id: id, deletedAt: null },
      update,
      { new: true },
    );
    if (!project) {
      throw new NotFoundError(`Project not found: ${id}`);
    }
    return project.toObject() as ProjectDocument;
  }

  async deleteProject(id: string): Promise<void> {
    await this.getProject(id);
    const now = new Date();
    await Project.updateOne({ _id: id }, { $set: { deletedAt: now } });
    await Form.updateMany(
      { projectId: id, deletedAt: null },
      { $set: { deletedAt: now } },
    );
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
        ...(project.defaultFont ? { defaultFont: project.defaultFont } : {}),
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
    if (forms.length === 0) return 0;

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

    const bulkOps = forms.map((form) => {
      const controls = form.get('controls') as unknown as Array<Record<string, unknown>>;
      if (Array.isArray(controls)) {
        walk(controls);
      }
      return {
        updateOne: {
          filter: { _id: form._id },
          update: {
            $set: {
              'properties.font': font,
              controls: controls,
              updatedBy: userId,
            },
          },
        },
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await Form.bulkWrite(bulkOps as any);
    return result.modifiedCount;
  }

  async importProject(input: ImportProjectInput, userId: string): Promise<ProjectDocument> {
    const project = await this.createProject(
      {
        name: input.project.name,
        description: input.project.description,
        ...(input.project.defaultFont ? { defaultFont: input.project.defaultFont } : {}),
      },
      userId,
    );

    if (input.forms.length > 0) {
      const formDocs = input.forms.map((f) => {
        const formId = new Types.ObjectId();
        return {
          _id: formId,
          name: f.name,
          properties: f.properties,
          controls: f.controls,
          eventHandlers: (f.eventHandlers ?? []).map((h) => {
            const handler = h as Record<string, unknown>;
            return handler.controlId === '_form'
              ? { ...handler, controlId: formId.toString() }
              : handler;
          }),
          dataBindings: f.dataBindings,
          projectId: project._id.toString(),
          version: 1,
          status: 'draft' as const,
          versions: [],
          createdBy: userId,
          updatedBy: userId,
        };
      });
      await Form.insertMany(formDocs);
    }

    if (input.shell) {
      await this.shellService.createShell(
        project._id.toString(),
        {
          name: input.shell.name,
          properties: input.shell.properties,
          controls: input.shell.controls,
          eventHandlers: input.shell.eventHandlers,
          startFormId: input.shell.startFormId,
        },
        userId,
      );
    }

    return project;
  }

  async publishAll(projectId: string, userId: string): Promise<PublishAllResult> {
    await this.getProject(projectId);

    const formsResult = await this.formService.publishAllByProject(projectId, userId);

    let shellResult: { published: boolean; skipped: boolean };
    try {
      await this.shellService.publishShell(projectId, userId);
      shellResult = { published: true, skipped: false };
    } catch (err) {
      if (
        err instanceof NotFoundError ||
        (err instanceof AppError && err.statusCode === 409)
      ) {
        shellResult = { published: false, skipped: true };
      } else {
        throw err;
      }
    }

    return {
      forms: formsResult,
      shell: shellResult,
    };
  }
}
