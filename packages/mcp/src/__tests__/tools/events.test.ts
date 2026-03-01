/**
 * events.ts Tool 테스트
 *
 * apiClient를 mock하여 이벤트 핸들러 CRUD, 실행 테스트, 에러 처리를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEventTools } from '../../tools/events.js';

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

  registerEventTools(server);
  return tools;
}

function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

const VALID_FORM_ID = 'aabbccddee112233ff445566';

function makeFormResponse(
  controls: Array<{ id: string; name: string; type: string }> = [],
  eventHandlers: Array<{ controlId: string; eventName: string; handlerType: string; handlerCode: string }> = [],
) {
  return {
    data: {
      _id: VALID_FORM_ID,
      name: 'TestForm',
      version: 1,
      controls,
      eventHandlers,
    },
  };
}

function makePutResponse(version = 2) {
  return {
    data: {
      _id: VALID_FORM_ID,
      name: 'TestForm',
      version,
      status: 'draft',
    },
  };
}

// --- 테스트 ---

describe('Event Tools', () => {
  let tools: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = new McpServer({ name: 'test', version: '1.0' });
    tools = collectTools(server);
  });

  describe('add_event_handler', () => {
    it('이벤트 핸들러를 추가하고 결과를 반환한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse([{ id: 'ctrl-1', name: 'btnSave', type: 'Button' }]),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('add_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
        handlerCode: 'ctx.showMessage("clicked");',
        handlerType: 'server',
      });
      const data = parseResult(result) as Record<string, unknown>;

      expect(data.controlId).toBe('ctrl-1');
      expect(data.eventName).toBe('Click');
      expect(data.totalHandlers).toBe(1);
    });

    it('_form controlId로 폼 레벨 이벤트를 등록한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('add_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: '_form',
        eventName: 'Load',
        handlerCode: 'console.log("loaded");',
      });

      expect(result.isError).toBeFalsy();
    });

    it('이미 존재하는 핸들러는 HANDLER_ALREADY_EXISTS를 반환한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse(
          [{ id: 'ctrl-1', name: 'btn', type: 'Button' }],
          [{ controlId: 'ctrl-1', eventName: 'Click', handlerType: 'server', handlerCode: 'x' }],
        ),
      );

      const result = await tools.get('add_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
        handlerCode: 'new code',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('HANDLER_ALREADY_EXISTS');
    });

    it('존재하지 않는 controlId는 CONTROL_NOT_FOUND를 반환한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());

      const result = await tools.get('add_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'nonexistent',
        eventName: 'Click',
        handlerCode: 'code',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('CONTROL_NOT_FOUND');
    });

    it('유효하지 않은 formId는 VALIDATION_ERROR를 반환한다', async () => {
      const result = await tools.get('add_event_handler')!({
        formId: 'bad',
        controlId: 'ctrl-1',
        eventName: 'Click',
        handlerCode: 'code',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('update_event_handler', () => {
    it('기존 핸들러 코드를 수정한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse(
          [{ id: 'ctrl-1', name: 'btn', type: 'Button' }],
          [{ controlId: 'ctrl-1', eventName: 'Click', handlerType: 'server', handlerCode: 'old' }],
        ),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('update_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
        handlerCode: 'new code',
      });
      const data = parseResult(result) as { updated: boolean };

      expect(data.updated).toBe(true);
    });

    it('존재하지 않는 핸들러는 HANDLER_NOT_FOUND를 반환한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse([{ id: 'ctrl-1', name: 'btn', type: 'Button' }]));

      const result = await tools.get('update_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
        handlerCode: 'code',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('HANDLER_NOT_FOUND');
    });
  });

  describe('remove_event_handler', () => {
    it('핸들러를 삭제하고 결과를 반환한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse(
          [{ id: 'ctrl-1', name: 'btn', type: 'Button' }],
          [
            { controlId: 'ctrl-1', eventName: 'Click', handlerType: 'server', handlerCode: 'a' },
            { controlId: 'ctrl-1', eventName: 'DoubleClick', handlerType: 'server', handlerCode: 'b' },
          ],
        ),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('remove_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
      });
      const data = parseResult(result) as { removed: boolean; remainingHandlers: number };

      expect(data.removed).toBe(true);
      expect(data.remainingHandlers).toBe(1);
    });

    it('존재하지 않는 핸들러는 HANDLER_NOT_FOUND를 반환한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());

      const result = await tools.get('remove_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('HANDLER_NOT_FOUND');
    });
  });

  describe('list_event_handlers', () => {
    it('폼의 모든 핸들러를 반환한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse(
          [
            { id: 'ctrl-1', name: 'btnSave', type: 'Button' },
            { id: 'ctrl-2', name: 'txtName', type: 'TextBox' },
          ],
          [
            { controlId: 'ctrl-1', eventName: 'Click', handlerType: 'server', handlerCode: 'a' },
            { controlId: '_form', eventName: 'Load', handlerType: 'server', handlerCode: 'b' },
          ],
        ),
      );

      const result = await tools.get('list_event_handlers')!({ formId: VALID_FORM_ID });
      const data = parseResult(result) as {
        handlers: Array<{ controlId: string; controlName: string; eventName: string }>;
        totalCount: number;
      };

      expect(data.totalCount).toBe(2);
      expect(data.handlers[0].controlName).toBe('btnSave');
      expect(data.handlers[1].controlName).toBe('(Form)');
    });

    it('404 에러 시 FORM_NOT_FOUND를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockGet.mockRejectedValue(new ApiError(404, 'Not Found', 'GET', '/api/forms/x'));

      const result = await tools.get('list_event_handlers')!({ formId: VALID_FORM_ID });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('FORM_NOT_FOUND');
    });
  });

  describe('list_available_events', () => {
    it('Form 이벤트 목록을 반환한다', async () => {
      const result = await tools.get('list_available_events')!({ controlType: 'Form' });
      const data = parseResult(result) as { controlType: string; events: string[] };

      expect(data.controlType).toBe('Form');
      expect(data.events).toContain('Load');
      expect(data.events).toContain('FormClosing');
    });

    it('Button 이벤트 목록에는 공통 이벤트가 포함된다', async () => {
      const result = await tools.get('list_available_events')!({ controlType: 'Button' });
      const data = parseResult(result) as {
        commonEvents: string[];
        allEvents: string[];
        totalCount: number;
      };

      expect(data.commonEvents).toContain('Click');
      expect(data.commonEvents).toContain('DoubleClick');
      expect(data.totalCount).toBeGreaterThan(0);
    });

    it('TextBox 이벤트에는 TextChanged가 포함된다', async () => {
      const result = await tools.get('list_available_events')!({ controlType: 'TextBox' });
      const data = parseResult(result) as { specificEvents: string[]; allEvents: string[] };

      expect(data.specificEvents).toContain('TextChanged');
      expect(data.allEvents).toContain('TextChanged');
    });

    it('특화 이벤트가 없는 타입은 공통 이벤트만 반환한다', async () => {
      const result = await tools.get('list_available_events')!({ controlType: 'Label' });
      const data = parseResult(result) as { specificEvents: string[]; allEvents: string[] };

      expect(data.specificEvents).toHaveLength(0);
      expect(data.allEvents.length).toBeGreaterThan(0);
    });
  });

  describe('test_event_handler', () => {
    it('이벤트 핸들러를 테스트 실행한다', async () => {
      mockPost.mockResolvedValue({
        success: true,
        patches: [{ type: 'update', target: 'ctrl-1', payload: { text: 'done' } }],
        logs: [{ level: 'info', message: 'executed' }],
      });

      const result = await tools.get('test_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
      });
      const data = parseResult(result) as {
        success: boolean;
        patches: unknown[];
        patchCount: number;
      };

      expect(data.success).toBe(true);
      expect(data.patchCount).toBe(1);
    });

    it('실행 오류 시 HANDLER_EXECUTION_ERROR를 반환한다', async () => {
      mockPost.mockResolvedValue({
        success: false,
        patches: [],
        error: 'ReferenceError: x is not defined',
        errorLine: 3,
      });

      const result = await tools.get('test_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, unknown>;
      expect(data.code).toBe('HANDLER_EXECUTION_ERROR');
      expect(data.error).toContain('line 3');
    });

    it('errorLine 없는 실행 오류도 처리한다', async () => {
      mockPost.mockResolvedValue({
        success: false,
        patches: [],
        error: 'SyntaxError',
      });

      const result = await tools.get('test_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.error).toContain('SyntaxError');
    });

    it('mockFormState를 body에 포함한다', async () => {
      mockPost.mockResolvedValue({ success: true, patches: [] });

      await tools.get('test_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
        mockFormState: { 'ctrl-1': { text: 'hello' } },
      });

      const body = mockPost.mock.calls[0][1] as Record<string, unknown>;
      expect(body.formState).toEqual({ 'ctrl-1': { text: 'hello' } });
    });

    it('404 에러 시 FORM_NOT_FOUND를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockPost.mockRejectedValue(new ApiError(404, 'Not Found', 'POST', '/api/runtime/forms/x/events'));

      const result = await tools.get('test_event_handler')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        eventName: 'Click',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('FORM_NOT_FOUND');
    });
  });
});
