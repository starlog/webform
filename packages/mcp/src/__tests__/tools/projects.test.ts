/**
 * projects.ts Tool 테스트
 *
 * apiClient를 mock하여 Tool 핸들러의 입력 검증, 응답 변환, 에러 처리를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectTools } from '../../tools/projects.js';

// --- apiClient mock ---

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../utils/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../utils/index.js')>();
  return {
    ...original,
    apiClient: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
      put: (...args: unknown[]) => mockPut(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  };
});

// --- 헬퍼 ---

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function collectTools(server: McpServer): Map<string, ToolHandler> {
  const tools = new Map<string, ToolHandler>();
  const origTool = server.tool.bind(server);
  server.tool = ((...args: unknown[]) => {
    const name = args[0] as string;
    // 인자 구조: (name, description, schema, handler) 또는 (name, description, handler)
    const handler = args[args.length - 1] as ToolHandler;
    tools.set(name, handler);
    return origTool(...(args as Parameters<typeof origTool>));
  }) as typeof server.tool;

  registerProjectTools(server);
  return tools;
}

function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

const VALID_ID = 'aabbccddee112233ff445566';

// --- 테스트 ---

describe('Project Tools', () => {
  let tools: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = new McpServer({ name: 'test', version: '1.0' });
    tools = collectTools(server);
  });

  describe('list_projects', () => {
    it('프로젝트 목록을 반환한다', async () => {
      mockGet.mockResolvedValue({
        data: [
          { _id: '1', name: 'Project 1', description: 'desc', createdAt: '2024-01-01', updatedAt: '2024-01-02' },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await tools.get('list_projects')!({});
      const data = parseResult(result) as Record<string, unknown>;

      expect(data).toHaveProperty('projects');
      expect((data as { projects: unknown[] }).projects).toHaveLength(1);
      expect((data as { projects: Array<{ id: string }> }).projects[0].id).toBe('1');
    });

    it('검색 파라미터를 쿼리에 포함한다', async () => {
      mockGet.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });

      await tools.get('list_projects')!({ search: 'test', page: 2, limit: 10 });

      const calledPath = mockGet.mock.calls[0][0] as string;
      expect(calledPath).toContain('search=test');
      expect(calledPath).toContain('page=2');
      expect(calledPath).toContain('limit=10');
    });

    it('API 에러 시 isError=true 응답을 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockGet.mockRejectedValue(new ApiError(500, 'Server Error', 'GET', '/api/projects'));

      const result = await tools.get('list_projects')!({});

      expect(result.isError).toBe(true);
    });
  });

  describe('get_project', () => {
    it('프로젝트 상세와 폼 목록을 반환한다', async () => {
      mockGet.mockResolvedValue({
        data: {
          project: {
            _id: VALID_ID,
            name: 'Test',
            description: 'desc',
            defaultFont: null,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-02',
          },
          forms: [
            { _id: 'form1', name: 'Form1', status: 'draft', version: 1, publishedVersion: undefined },
          ],
        },
      });

      const result = await tools.get('get_project')!({ projectId: VALID_ID });
      const data = parseResult(result) as Record<string, unknown>;

      expect(data).toHaveProperty('project');
      expect(data).toHaveProperty('forms');
    });

    it('유효하지 않은 ObjectId는 VALIDATION_ERROR를 반환한다', async () => {
      const result = await tools.get('get_project')!({ projectId: 'invalid' });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('404 에러 시 PROJECT_NOT_FOUND를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockGet.mockRejectedValue(new ApiError(404, 'Not Found', 'GET', `/api/projects/${VALID_ID}`));

      const result = await tools.get('get_project')!({ projectId: VALID_ID });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('create_project', () => {
    it('새 프로젝트를 생성하고 결과를 반환한다', async () => {
      mockPost.mockResolvedValue({
        data: { _id: VALID_ID, name: 'New Project', description: 'desc', createdAt: '2024-01-01' },
      });

      const result = await tools.get('create_project')!({ name: 'New Project', description: 'desc' });
      const data = parseResult(result) as { project: { id: string; name: string } };

      expect(data.project.name).toBe('New Project');
      expect(data.project.id).toBe(VALID_ID);
    });
  });

  describe('update_project', () => {
    it('프로젝트를 수정하고 결과를 반환한다', async () => {
      mockPut.mockResolvedValue({
        data: { _id: VALID_ID, name: 'Updated', description: 'new desc', updatedAt: '2024-01-02' },
      });

      const result = await tools.get('update_project')!({
        projectId: VALID_ID,
        name: 'Updated',
      });
      const data = parseResult(result) as { project: { name: string } };

      expect(data.project.name).toBe('Updated');
    });

    it('유효하지 않은 projectId는 VALIDATION_ERROR를 반환한다', async () => {
      const result = await tools.get('update_project')!({ projectId: 'bad', name: 'X' });

      expect(result.isError).toBe(true);
    });
  });

  describe('delete_project', () => {
    it('프로젝트를 삭제하고 결과를 반환한다', async () => {
      mockDelete.mockResolvedValue(undefined);

      const result = await tools.get('delete_project')!({ projectId: VALID_ID });
      const data = parseResult(result) as { deleted: boolean; projectId: string };

      expect(data.deleted).toBe(true);
      expect(data.projectId).toBe(VALID_ID);
    });

    it('404 에러 시 PROJECT_NOT_FOUND를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockDelete.mockRejectedValue(new ApiError(404, 'Not Found', 'DELETE', `/api/projects/${VALID_ID}`));

      const result = await tools.get('delete_project')!({ projectId: VALID_ID });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('export_project', () => {
    it('프로젝트를 JSON으로 내보낸다', async () => {
      mockGet.mockResolvedValue({
        exportVersion: '1.0',
        exportedAt: '2024-01-01',
        project: { name: 'Test', description: 'desc' },
        forms: [],
      });

      const result = await tools.get('export_project')!({ projectId: VALID_ID });
      const data = parseResult(result) as { exportVersion: string };

      expect(data.exportVersion).toBe('1.0');
    });
  });

  describe('import_project', () => {
    it('JSON 데이터로 프로젝트를 가져온다', async () => {
      mockPost.mockResolvedValue({
        data: { _id: VALID_ID, name: 'Imported', description: '', createdAt: '2024-01-01' },
      });

      const result = await tools.get('import_project')!({
        data: {
          project: { name: 'Imported' },
          forms: [{ name: 'Form1' }],
        },
      });
      const data = parseResult(result) as { project: { name: string } };

      expect(data.project.name).toBe('Imported');
    });
  });

  describe('publish_all', () => {
    it('프로젝트의 모든 폼을 퍼블리시한다', async () => {
      mockPost.mockResolvedValue({
        data: {
          forms: { publishedCount: 3, skippedCount: 1, totalCount: 4 },
          shell: { published: true, skipped: false },
        },
      });

      const result = await tools.get('publish_all')!({ projectId: VALID_ID });
      const data = parseResult(result) as { forms: { publishedCount: number } };

      expect(data.forms.publishedCount).toBe(3);
    });

    it('유효하지 않은 projectId는 VALIDATION_ERROR를 반환한다', async () => {
      const result = await tools.get('publish_all')!({ projectId: 'bad' });

      expect(result.isError).toBe(true);
    });
  });
});
