/**
 * forms.ts Tool 테스트
 *
 * apiClient를 mock하여 Tool 핸들러의 입력 검증, 응답 변환, 에러 처리를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFormTools } from '../../tools/forms.js';

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
    const handler = args[args.length - 1] as ToolHandler;
    tools.set(name, handler);
    return origTool(...(args as Parameters<typeof origTool>));
  }) as typeof server.tool;

  registerFormTools(server);
  return tools;
}

function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

const VALID_ID = 'aabbccddee112233ff445566';
const VALID_PROJECT_ID = '112233445566778899aabbcc';

// --- 테스트 ---

describe('Form Tools', () => {
  let tools: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = new McpServer({ name: 'test', version: '1.0' });
    tools = collectTools(server);
  });

  describe('list_forms', () => {
    it('폼 목록을 반환한다', async () => {
      mockGet.mockResolvedValue({
        data: [
          {
            _id: 'form1',
            name: 'LoginForm',
            version: 1,
            status: 'draft',
            projectId: VALID_PROJECT_ID,
            updatedAt: '2024-01-01',
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await tools.get('list_forms')!({});
      const data = parseResult(result) as { forms: Array<{ id: string }> };

      expect(data.forms).toHaveLength(1);
      expect(data.forms[0].id).toBe('form1');
    });

    it('projectId, status, search 파라미터를 쿼리에 포함한다', async () => {
      mockGet.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });

      await tools.get('list_forms')!({
        projectId: VALID_PROJECT_ID,
        status: 'published',
        search: 'login',
      });

      const path = mockGet.mock.calls[0][0] as string;
      expect(path).toContain('projectId=');
      expect(path).toContain('status=published');
      expect(path).toContain('search=login');
    });
  });

  describe('get_form', () => {
    it('폼 전체 정의를 반환한다', async () => {
      mockGet.mockResolvedValue({
        data: {
          _id: VALID_ID,
          name: 'LoginForm',
          version: 3,
          status: 'draft',
          projectId: VALID_PROJECT_ID,
          properties: { title: 'Login' },
          controls: [{ id: 'c1' }, { id: 'c2' }],
          eventHandlers: [{ controlId: 'c1', eventName: 'Click' }],
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
      });

      const result = await tools.get('get_form')!({ formId: VALID_ID });
      const data = parseResult(result) as Record<string, unknown>;

      expect(data.id).toBe(VALID_ID);
      expect(data.version).toBe(3);
      expect(data.controlCount).toBe(2);
      expect(data.eventHandlerCount).toBe(1);
    });

    it('유효하지 않은 formId는 VALIDATION_ERROR를 반환한다', async () => {
      const result = await tools.get('get_form')!({ formId: 'bad' });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('404 에러 시 FORM_NOT_FOUND를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockGet.mockRejectedValue(new ApiError(404, 'Not Found', 'GET', `/api/forms/${VALID_ID}`));

      const result = await tools.get('get_form')!({ formId: VALID_ID });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('FORM_NOT_FOUND');
    });
  });

  describe('create_form', () => {
    it('새 폼을 생성하고 결과를 반환한다', async () => {
      mockPost.mockResolvedValue({
        data: { _id: VALID_ID, name: 'NewForm', version: 1, status: 'draft' },
      });

      const result = await tools.get('create_form')!({
        name: 'NewForm',
        projectId: VALID_PROJECT_ID,
      });
      const data = parseResult(result) as { id: string; name: string; status: string };

      expect(data.id).toBe(VALID_ID);
      expect(data.name).toBe('NewForm');
      expect(data.status).toBe('draft');
    });

    it('properties를 전달하면 body에 포함한다', async () => {
      mockPost.mockResolvedValue({
        data: { _id: VALID_ID, name: 'Form', version: 1, status: 'draft' },
      });

      await tools.get('create_form')!({
        name: 'Form',
        projectId: VALID_PROJECT_ID,
        properties: { width: 1024, height: 768, backgroundColor: '#FFFFFF' },
      });

      const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
      expect(body.properties).toMatchObject({ width: 1024, height: 768 });
    });

    it('유효하지 않은 projectId는 VALIDATION_ERROR를 반환한다', async () => {
      const result = await tools.get('create_form')!({ name: 'Form', projectId: 'bad' });

      expect(result.isError).toBe(true);
    });
  });

  describe('update_form', () => {
    it('폼을 수정하고 결과를 반환한다', async () => {
      mockPut.mockResolvedValue({
        data: { _id: VALID_ID, name: 'Updated', version: 4, status: 'draft', controls: [] },
      });

      const result = await tools.get('update_form')!({
        formId: VALID_ID,
        version: 3,
        name: 'Updated',
      });
      const data = parseResult(result) as { version: number; name: string };

      expect(data.name).toBe('Updated');
      expect(data.version).toBe(4);
    });

    it('409 에러 시 VERSION_CONFLICT를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockPut.mockRejectedValue(new ApiError(409, 'Conflict', 'PUT', `/api/forms/${VALID_ID}`));

      const result = await tools.get('update_form')!({
        formId: VALID_ID,
        version: 1,
        name: 'X',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, unknown>;
      expect(data.code).toBe('VERSION_CONFLICT');
    });

    it('version 파라미터를 body에 포함한다', async () => {
      mockPut.mockResolvedValue({
        data: { _id: VALID_ID, name: 'X', version: 2, status: 'draft', controls: [] },
      });

      await tools.get('update_form')!({ formId: VALID_ID, version: 1, name: 'X' });

      const body = mockPut.mock.calls[0][1] as Record<string, unknown>;
      expect(body.version).toBe(1);
    });
  });

  describe('delete_form', () => {
    it('폼을 삭제하고 결과를 반환한다', async () => {
      mockDelete.mockResolvedValue(undefined);

      const result = await tools.get('delete_form')!({ formId: VALID_ID });
      const data = parseResult(result) as { deleted: boolean; formId: string };

      expect(data.deleted).toBe(true);
      expect(data.formId).toBe(VALID_ID);
    });
  });

  describe('publish_form', () => {
    it('폼을 퍼블리시하고 결과를 반환한다', async () => {
      mockPost.mockResolvedValue({
        data: { _id: VALID_ID, name: 'Form', version: 2, status: 'published' },
      });

      const result = await tools.get('publish_form')!({ formId: VALID_ID });
      const data = parseResult(result) as { status: string };

      expect(data.status).toBe('published');
    });

    it('409 에러 시 ALREADY_PUBLISHED를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockPost.mockRejectedValue(
        new ApiError(409, 'Conflict', 'POST', `/api/forms/${VALID_ID}/publish`),
      );

      const result = await tools.get('publish_form')!({ formId: VALID_ID });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('ALREADY_PUBLISHED');
    });
  });

  describe('get_form_versions', () => {
    it('버전 히스토리를 반환한다', async () => {
      mockGet.mockResolvedValue({
        data: [
          { version: 1, savedAt: '2024-01-01' },
          { version: 2, savedAt: '2024-01-02', note: 'update' },
        ],
      });

      const result = await tools.get('get_form_versions')!({ formId: VALID_ID });
      const data = parseResult(result) as { versions: unknown[] };

      expect(data.versions).toHaveLength(2);
    });
  });

  describe('get_form_version_snapshot', () => {
    it('특정 버전 스냅샷을 반환한다', async () => {
      mockGet.mockResolvedValue({
        data: {
          version: 2,
          snapshot: {
            name: 'Form',
            properties: {},
            controls: [],
            eventHandlers: [],
            },
          savedAt: '2024-01-02',
        },
      });

      const result = await tools.get('get_form_version_snapshot')!({
        formId: VALID_ID,
        version: 2,
      });
      const data = parseResult(result) as { version: number; snapshot: Record<string, unknown> };

      expect(data.version).toBe(2);
      expect(data.snapshot).toHaveProperty('controls');
    });
  });
});
