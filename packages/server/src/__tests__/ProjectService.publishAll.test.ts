import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectService } from '../services/ProjectService.js';
import { Project } from '../models/Project.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';

vi.mock('../services/FormService.js', () => ({
  FormService: vi.fn().mockImplementation(() => ({
    publishAllByProject: vi.fn(),
  })),
}));

vi.mock('../services/ShellService.js', () => ({
  ShellService: vi.fn().mockImplementation(() => ({
    publishShell: vi.fn(),
  })),
}));

describe('ProjectService.publishAll', () => {
  let service: ProjectService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPublishAllByProject: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPublishShell: any;
  const userId = 'user-001';
  let projectId: string;

  beforeEach(async () => {
    service = new ProjectService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPublishAllByProject = (service as any).formService.publishAllByProject;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPublishShell = (service as any).shellService.publishShell;

    const project = await Project.create({
      name: 'Test Project',
      description: 'Test',
      createdBy: userId,
      updatedBy: userId,
    });
    projectId = project._id.toString();
  });

  it('정상 케이스: draft 폼 + Shell draft → 폼과 Shell 모두 퍼블리시', async () => {
    mockPublishAllByProject.mockResolvedValue({
      publishedCount: 3,
      skippedCount: 0,
      totalCount: 3,
    });
    mockPublishShell.mockResolvedValue({});

    const result = await service.publishAll(projectId, userId);

    expect(result.forms.publishedCount).toBe(3);
    expect(result.forms.skippedCount).toBe(0);
    expect(result.forms.totalCount).toBe(3);
    expect(result.shell.published).toBe(true);
    expect(result.shell.skipped).toBe(false);
    expect(mockPublishAllByProject).toHaveBeenCalledWith(projectId, userId);
    expect(mockPublishShell).toHaveBeenCalledWith(projectId, userId);
  });

  it('Shell 없는 경우: 폼만 퍼블리시, shell.skipped: true', async () => {
    mockPublishAllByProject.mockResolvedValue({
      publishedCount: 2,
      skippedCount: 0,
      totalCount: 2,
    });
    mockPublishShell.mockRejectedValue(new NotFoundError('Shell not found'));

    const result = await service.publishAll(projectId, userId);

    expect(result.forms.publishedCount).toBe(2);
    expect(result.forms.totalCount).toBe(2);
    expect(result.shell.published).toBe(false);
    expect(result.shell.skipped).toBe(true);
  });

  it('Shell 이미 published: forms는 정상 처리, shell.skipped: true', async () => {
    mockPublishAllByProject.mockResolvedValue({
      publishedCount: 1,
      skippedCount: 1,
      totalCount: 2,
    });
    mockPublishShell.mockRejectedValue(new AppError(409, 'Shell is already published'));

    const result = await service.publishAll(projectId, userId);

    expect(result.forms.publishedCount).toBe(1);
    expect(result.forms.skippedCount).toBe(1);
    expect(result.forms.totalCount).toBe(2);
    expect(result.shell.published).toBe(false);
    expect(result.shell.skipped).toBe(true);
  });

  it('존재하지 않는 프로젝트: NotFoundError throw', async () => {
    const fakeId = '000000000000000000000000';

    await expect(service.publishAll(fakeId, userId)).rejects.toThrow(NotFoundError);
    expect(mockPublishAllByProject).not.toHaveBeenCalled();
    expect(mockPublishShell).not.toHaveBeenCalled();
  });
});
