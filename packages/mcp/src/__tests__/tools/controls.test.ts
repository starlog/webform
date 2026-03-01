/**
 * controls.ts Tool 테스트
 *
 * apiClient를 mock하여 컨트롤 CRUD, 자동 배치, 배치 추가 등을 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerControlTools } from '../../tools/controls.js';

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

vi.mock('../../utils/cache.js', () => ({
  formCache: {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    invalidate: vi.fn(),
    clear: vi.fn(),
  },
}));

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

  registerControlTools(server);
  return tools;
}

function parseResult(result: { content: Array<{ type: string; text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

const VALID_FORM_ID = 'aabbccddee112233ff445566';

function makeFormResponse(controls: unknown[] = [], eventHandlers: unknown[] = [], dataBindings: unknown[] = []) {
  return {
    data: {
      _id: VALID_FORM_ID,
      name: 'TestForm',
      version: 1,
      controls,
      eventHandlers,
      dataBindings,
      properties: {},
    },
  };
}

function makePutResponse(version = 2, controls: unknown[] = []) {
  return {
    data: {
      _id: VALID_FORM_ID,
      name: 'TestForm',
      version,
      status: 'draft',
      controls,
    },
  };
}

// --- 테스트 ---

describe('Control Tools', () => {
  let tools: Map<string, ToolHandler>;

  beforeEach(() => {
    vi.clearAllMocks();
    const server = new McpServer({ name: 'test', version: '1.0' });
    tools = collectTools(server);
  });

  describe('add_control', () => {
    it('컨트롤을 추가하고 결과를 반환한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'Button',
        name: 'btnSave',
      });
      const data = parseResult(result) as Record<string, unknown>;

      expect(data.controlName).toBe('btnSave');
      expect(data.controlType).toBe('Button');
      expect(data.controlId).toBeDefined();
      expect(data.position).toBeDefined();
      expect(data.size).toBeDefined();
      expect(data.formVersion).toBe(2);
    });

    it('유효하지 않은 컨트롤 타입은 INVALID_CONTROL_TYPE을 반환한다', async () => {
      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'InvalidType',
        name: 'ctrl1',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('INVALID_CONTROL_TYPE');
    });

    it('유효하지 않은 formId는 에러를 반환한다', async () => {
      const result = await tools.get('add_control')!({
        formId: 'bad',
        type: 'Button',
        name: 'btn',
      });

      expect(result.isError).toBe(true);
    });

    it('중복 이름은 에러를 반환한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse([
          {
            id: 'existing-id',
            type: 'Button',
            name: 'btnSave',
            properties: {},
            position: { x: 16, y: 16 },
            size: { width: 75, height: 23 },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ]),
      );

      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'Button',
        name: 'btnSave',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.error).toContain('이미 존재');
    });

    it('position 미지정 시 자동 배치한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'Button',
        name: 'btn1',
      });
      const data = parseResult(result) as { position: { x: number; y: number } };

      expect(data.position.x).toBe(16);
      expect(data.position.y).toBe(16);
    });

    it('size 미지정 시 기본 크기를 적용한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'Button',
        name: 'btn1',
      });
      const data = parseResult(result) as { size: { width: number; height: number } };

      expect(data.size).toEqual({ width: 75, height: 23 });
    });

    it('parentId를 지정하면 컨테이너 내부에 추가한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse([
          {
            id: 'panel1',
            type: 'Panel',
            name: 'panel1',
            properties: {},
            position: { x: 16, y: 16 },
            size: { width: 200, height: 100 },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
            children: [],
          },
        ]),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'Button',
        name: 'btnInPanel',
        parentId: 'panel1',
      });

      expect(result.isError).toBeFalsy();
    });

    it('404 에러 시 FORM_NOT_FOUND를 반환한다', async () => {
      const { ApiError } = await import('../../utils/apiClient.js');
      mockGet.mockRejectedValue(new ApiError(404, 'Not Found', 'GET', '/api/forms/x'));

      const result = await tools.get('add_control')!({
        formId: VALID_FORM_ID,
        type: 'Button',
        name: 'btn1',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('FORM_NOT_FOUND');
    });
  });

  describe('update_control', () => {
    it('컨트롤 속성을 수정한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse([
          {
            id: 'ctrl-1',
            type: 'Button',
            name: 'btnSave',
            properties: { text: 'Save' },
            position: { x: 16, y: 16 },
            size: { width: 75, height: 23 },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ]),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('update_control')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        properties: { text: '저장' },
      });
      const data = parseResult(result) as { controlName: string; updated: string[] };

      expect(data.controlName).toBe('btnSave');
      expect(data.updated).toContain('properties');
    });

    it('수정 내용이 없으면 MISSING_UPDATE_FIELDS를 반환한다', async () => {
      const result = await tools.get('update_control')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('MISSING_UPDATE_FIELDS');
    });

    it('존재하지 않는 controlId는 에러를 반환한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('update_control')!({
        formId: VALID_FORM_ID,
        controlId: 'nonexistent',
        properties: { text: 'X' },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('remove_control', () => {
    it('컨트롤을 삭제하고 연결된 핸들러/바인딩도 제거한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse(
          [
            {
              id: 'ctrl-1',
              type: 'Button',
              name: 'btnDelete',
              properties: {},
              position: { x: 16, y: 16 },
              size: { width: 75, height: 23 },
              anchor: { top: true, bottom: false, left: true, right: false },
              dock: 'None',
              tabIndex: 0,
              visible: true,
              enabled: true,
            },
          ],
          [{ controlId: 'ctrl-1', eventName: 'Click', handlerType: 'server', handlerCode: '' }],
          [{ controlId: 'ctrl-1', controlProperty: 'text', dataSourceId: 'ds1', dataField: 'name', bindingMode: 'oneWay' }],
        ),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('remove_control')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
      });
      const data = parseResult(result) as { removedName: string };

      expect(data.removedName).toBe('btnDelete');

      // put에 전달된 데이터에서 핸들러/바인딩 제거 확인
      const putBody = mockPut.mock.calls[0][1] as Record<string, unknown[]>;
      expect(putBody.eventHandlers).toHaveLength(0);
      expect(putBody.dataBindings).toHaveLength(0);
    });
  });

  describe('move_control', () => {
    it('컨트롤을 새 위치로 이동한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse([
          {
            id: 'ctrl-1',
            type: 'Button',
            name: 'btn',
            properties: {},
            position: { x: 16, y: 16 },
            size: { width: 75, height: 23 },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ]),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('move_control')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        position: { x: 100, y: 200 },
      });
      const data = parseResult(result) as { position: { x: number; y: number } };

      // 스냅된 좌표
      expect(data.position.x % 16).toBe(0);
      expect(data.position.y % 16).toBe(0);
    });
  });

  describe('resize_control', () => {
    it('컨트롤 크기를 변경한다', async () => {
      mockGet.mockResolvedValue(
        makeFormResponse([
          {
            id: 'ctrl-1',
            type: 'Button',
            name: 'btn',
            properties: {},
            position: { x: 16, y: 16 },
            size: { width: 75, height: 23 },
            anchor: { top: true, bottom: false, left: true, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ]),
      );
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('resize_control')!({
        formId: VALID_FORM_ID,
        controlId: 'ctrl-1',
        size: { width: 150, height: 40 },
      });
      const data = parseResult(result) as { size: { width: number; height: number } };

      expect(data.size).toEqual({ width: 150, height: 40 });
    });
  });

  describe('batch_add_controls', () => {
    it('여러 컨트롤을 일괄 추가한다', async () => {
      mockGet.mockResolvedValue(makeFormResponse());
      mockPut.mockResolvedValue(makePutResponse());

      const result = await tools.get('batch_add_controls')!({
        formId: VALID_FORM_ID,
        controls: [
          { type: 'Label', name: 'lblName' },
          { type: 'TextBox', name: 'txtName' },
          { type: 'Button', name: 'btnSubmit' },
        ],
      });
      const data = parseResult(result) as {
        addedControls: Array<{ name: string; type: string }>;
        count: number;
      };

      expect(data.count).toBe(3);
      expect(data.addedControls.map((c) => c.name)).toEqual(['lblName', 'txtName', 'btnSubmit']);
    });

    it('유효하지 않은 타입이 포함되면 에러를 반환한다', async () => {
      const result = await tools.get('batch_add_controls')!({
        formId: VALID_FORM_ID,
        controls: [
          { type: 'Button', name: 'btn1' },
          { type: 'FakeType', name: 'fake1' },
        ],
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('INVALID_CONTROL_TYPE');
    });

    it('이름 중복 시 에러를 반환한다', async () => {
      const result = await tools.get('batch_add_controls')!({
        formId: VALID_FORM_ID,
        controls: [
          { type: 'Button', name: 'btn1' },
          { type: 'Button', name: 'btn1' },
        ],
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('DUPLICATE_CONTROL_NAMES');
    });
  });

  describe('list_control_types', () => {
    it('카테고리별 컨트롤 타입 목록을 반환한다', async () => {
      const result = await tools.get('list_control_types')!({});
      const data = parseResult(result) as {
        totalTypes: number;
        categories: Record<string, unknown[]>;
      };

      expect(data.totalTypes).toBeGreaterThan(0);
      expect(Object.keys(data.categories).length).toBeGreaterThan(0);
    });
  });

  describe('get_control_schema', () => {
    it('컨트롤 타입의 스키마를 반환한다', async () => {
      const result = await tools.get('get_control_schema')!({ controlType: 'Button' });
      const data = parseResult(result) as {
        type: string;
        description: string;
        defaultSize: { width: number; height: number };
        events: string[];
      };

      expect(data.type).toBe('Button');
      expect(data.defaultSize).toEqual({ width: 75, height: 23 });
      expect(data.events).toContain('Click');
    });

    it('유효하지 않은 타입은 INVALID_CONTROL_TYPE을 반환한다', async () => {
      const result = await tools.get('get_control_schema')!({ controlType: 'FakeType' });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as Record<string, string>;
      expect(data.code).toBe('INVALID_CONTROL_TYPE');
    });
  });
});
