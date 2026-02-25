import { Shell } from '../models/Shell.js';
import type { ShellDocument } from '../models/Shell.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';

export interface CreateShellInput {
  name: string;
  properties: Record<string, unknown>;
  controls?: unknown[];
  eventHandlers?: unknown[];
  startFormId?: string;
}

export interface UpdateShellInput {
  name?: string;
  properties?: Record<string, unknown>;
  controls?: unknown[];
  eventHandlers?: unknown[];
  startFormId?: string | null;
}

export class ShellService {
  /**
   * 프로젝트의 Shell 조회 (soft delete 제외) — 없으면 null 반환
   */
  async findShellByProjectId(projectId: string): Promise<ShellDocument | null> {
    const shell = await Shell.findOne({ projectId, deletedAt: null });
    if (!shell) return null;
    return shell.toObject() as ShellDocument;
  }

  /**
   * 프로젝트의 Shell 조회 (soft delete 제외) — 없으면 NotFoundError
   */
  async getShellByProjectId(projectId: string): Promise<ShellDocument> {
    const shell = await Shell.findOne({ projectId, deletedAt: null });
    if (!shell) {
      throw new NotFoundError(`Shell not found for project: ${projectId}`);
    }
    return shell.toObject() as ShellDocument;
  }

  /**
   * Shell 생성 (프로젝트당 하나만 허용)
   */
  async createShell(
    projectId: string,
    data: CreateShellInput,
    userId: string,
  ): Promise<ShellDocument> {
    const existing = await Shell.findOne({ projectId, deletedAt: null });
    if (existing) {
      throw new AppError(409, `Shell already exists for project: ${projectId}`);
    }

    const shell = await Shell.create({
      ...data,
      projectId,
      version: 1,
      published: false,
      createdBy: userId,
      updatedBy: userId,
    });
    return shell.toObject() as ShellDocument;
  }

  /**
   * Shell 수정
   */
  async updateShell(
    projectId: string,
    data: UpdateShellInput,
    userId: string,
  ): Promise<ShellDocument> {
    await this.getShellByProjectId(projectId);

    const { startFormId, ...rest } = data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      $set: { ...rest, updatedBy: userId, published: false },
      $inc: { version: 1 },
    };

    if (startFormId === null) {
      update.$unset = { startFormId: 1 };
    } else if (startFormId !== undefined) {
      update.$set.startFormId = startFormId;
    }

    const shell = await Shell.findOneAndUpdate({ projectId, deletedAt: null }, update, {
      new: true,
    });

    if (!shell) {
      throw new NotFoundError(`Shell not found for project: ${projectId}`);
    }

    return shell.toObject() as ShellDocument;
  }

  /**
   * Shell 삭제 (soft delete)
   */
  async deleteShell(projectId: string): Promise<void> {
    await this.getShellByProjectId(projectId);
    await Shell.updateOne({ projectId, deletedAt: null }, { $set: { deletedAt: new Date() } });
  }

  /**
   * Shell 퍼블리시 (published = true)
   */
  async publishShell(projectId: string, userId: string): Promise<ShellDocument> {
    const existing = await this.getShellByProjectId(projectId);

    if (existing.published) {
      throw new AppError(409, 'Shell is already published');
    }

    const shell = await Shell.findOneAndUpdate(
      { projectId, deletedAt: null },
      {
        $set: {
          published: true,
          updatedBy: userId,
        },
      },
      { new: true },
    );

    if (!shell) {
      throw new NotFoundError(`Shell not found for project: ${projectId}`);
    }

    return shell.toObject() as ShellDocument;
  }

  /**
   * 퍼블리시된 Shell 조회 (Runtime용 — 없으면 null 반환)
   */
  async getPublishedShell(projectId: string): Promise<ShellDocument | null> {
    const shell = await Shell.findOne({ projectId, published: true, deletedAt: null });
    if (!shell) {
      return null;
    }
    return shell.toObject() as ShellDocument;
  }
}
