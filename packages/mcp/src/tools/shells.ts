import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';

// --- API 응답 타입 ---

interface ShellData {
  _id: string;
  projectId: string;
  name: string;
  version: number;
  properties: Record<string, unknown>;
  controls: Array<Record<string, unknown>>;
  eventHandlers: Array<{
    controlId: string;
    eventName: string;
    handlerType: 'server' | 'client';
    handlerCode: string;
  }>;
  startFormId?: string;
  published: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface GetShellResponse {
  data: ShellData | null;
}

interface MutateShellResponse {
  data: ShellData;
}

function handleShellToolError(error: unknown, projectId: string) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return toolError(
        `Shell을 찾을 수 없습니다 (projectId: ${projectId})`,
        { code: 'SHELL_NOT_FOUND', details: { projectId }, suggestion: 'create_shell로 먼저 생성하세요.' },
      );
    }
    if (error.status === 409) {
      return toolError(`Shell 버전 충돌: ${error.detail || error.message}`, { code: 'SHELL_CONFLICT', details: { projectId } });
    }
    return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { projectId } });
  }
  if (error instanceof Error && error.message.includes('유효하지 않은')) {
    return toolError(error.message, { code: 'VALIDATION_ERROR' });
  }
  throw error;
}

// --- Tool 등록 ---

export function registerShellTools(server: McpServer): void {
  // 1. get_shell
  server.tool(
    'get_shell',
    '프로젝트의 ApplicationShell 정의를 조회합니다. Shell이 없는 프로젝트는 data: null을 반환합니다.',
    {
      projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const res = await apiClient.get<GetShellResponse>(
          `/api/projects/${projectId}/shell`,
        );

        if (!res.data) {
          return toolResult({ projectId, shell: null });
        }

        const shell = res.data;
        return toolResult({
          projectId,
          shell: {
            id: shell._id,
            name: shell.name,
            version: shell.version,
            published: shell.published,
            properties: shell.properties,
            controls: shell.controls,
            eventHandlers: shell.eventHandlers,
            startFormId: shell.startFormId,
            createdAt: shell.createdAt,
            updatedAt: shell.updatedAt,
          },
        });
      } catch (error) {
        return handleShellToolError(error, projectId);
      }
    },
  );

  // 2. create_shell
  server.tool(
    'create_shell',
    `프로젝트에 ApplicationShell을 생성합니다. 프로젝트당 하나의 Shell만 허용됩니다.

Shell은 앱 수준의 UI 프레임(MenuStrip, ToolStrip, StatusStrip 등)을 정의합니다.
properties로 Shell 창의 크기/제목/테마 등을 설정하고, startFormId로 시작 폼을 지정합니다.`,
    {
      projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
      name: z.string().describe('Shell 이름'),
      properties: z
        .object({
          title: z.string().optional(),
          width: z.number().positive().optional(),
          height: z.number().positive().optional(),
          backgroundColor: z.string().optional(),
          showTitleBar: z.boolean().optional(),
          formBorderStyle: z
            .enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable'])
            .optional(),
          maximizeBox: z.boolean().optional(),
          minimizeBox: z.boolean().optional(),
          windowState: z.enum(['Normal', 'Maximized']).optional(),
          theme: z.string().optional(),
        })
        .optional()
        .describe('Shell 속성 (미지정 시 기본값 적용)'),
      controls: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe('Shell 컨트롤 배열 (MenuStrip, ToolStrip, StatusStrip 등)'),
      startFormId: z
        .string()
        .optional()
        .describe('시작 폼 ID (Shell 로드 시 최초 표시할 폼)'),
    },
    async ({ projectId, name, properties, controls, startFormId }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const body: Record<string, unknown> = { name };
        if (properties !== undefined) body.properties = properties;
        if (controls !== undefined) body.controls = controls;
        if (startFormId !== undefined) body.startFormId = startFormId;

        const res = await apiClient.post<MutateShellResponse>(
          `/api/projects/${projectId}/shell`,
          body,
        );
        const shell = res.data;

        return toolResult({
          projectId,
          shellId: shell._id,
          name: shell.name,
          version: shell.version,
          published: shell.published,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return toolError(
            '이 프로젝트에 이미 Shell이 존재합니다.',
            { code: 'SHELL_ALREADY_EXISTS', details: { projectId }, suggestion: 'update_shell을 사용하세요.' },
          );
        }
        return handleShellToolError(error, projectId);
      }
    },
  );

  // 3. update_shell
  server.tool(
    'update_shell',
    `프로젝트 Shell을 수정합니다. 수정 시 version이 증가하고 published가 false로 전환됩니다.
재배포하려면 publish_shell을 다시 호출하세요.`,
    {
      projectId: z.string().describe('프로젝트 ID'),
      properties: z
        .object({
          title: z.string().optional(),
          width: z.number().positive().optional(),
          height: z.number().positive().optional(),
          backgroundColor: z.string().optional(),
          showTitleBar: z.boolean().optional(),
          formBorderStyle: z
            .enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable'])
            .optional(),
          maximizeBox: z.boolean().optional(),
          minimizeBox: z.boolean().optional(),
          windowState: z.enum(['Normal', 'Maximized']).optional(),
          theme: z.string().optional(),
        })
        .optional()
        .describe('수정할 Shell 속성 (부분 업데이트)'),
      controls: z
        .array(z.record(z.string(), z.unknown()))
        .optional()
        .describe('전체 컨트롤 배열 (전체 교체)'),
      eventHandlers: z
        .array(
          z.object({
            controlId: z.string(),
            eventName: z.string(),
            handlerType: z.enum(['server', 'client']).optional().default('server'),
            handlerCode: z.string(),
          }),
        )
        .optional()
        .describe('전체 이벤트 핸들러 배열 (전체 교체)'),
      startFormId: z
        .string()
        .nullable()
        .optional()
        .describe('시작 폼 ID (null로 설정 시 해제)'),
    },
    async ({ projectId, properties, controls, eventHandlers, startFormId }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const body: Record<string, unknown> = {};
        if (properties !== undefined) body.properties = properties;
        if (controls !== undefined) body.controls = controls;
        if (eventHandlers !== undefined) body.eventHandlers = eventHandlers;
        if (startFormId !== undefined) body.startFormId = startFormId;

        const res = await apiClient.put<MutateShellResponse>(
          `/api/projects/${projectId}/shell`,
          body,
        );
        const shell = res.data;

        return toolResult({
          projectId,
          shellId: shell._id,
          name: shell.name,
          version: shell.version,
          published: shell.published,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return toolError('Shell을 찾을 수 없습니다.', { code: 'SHELL_NOT_FOUND', details: { projectId }, suggestion: 'create_shell로 먼저 생성하세요.' });
        }
        return handleShellToolError(error, projectId);
      }
    },
  );

  // 4. delete_shell
  server.tool(
    'delete_shell',
    '프로젝트의 Shell을 삭제합니다 (soft delete). 삭제 후 create_shell로 새 Shell을 생성할 수 있습니다.',
    {
      projectId: z.string().describe('프로젝트 ID'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');

        await apiClient.delete(`/api/projects/${projectId}/shell`);

        return toolResult({
          projectId,
          deleted: true,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return toolError(`Shell을 찾을 수 없습니다 (projectId: ${projectId})`, { code: 'SHELL_NOT_FOUND', details: { projectId } });
        }
        return handleShellToolError(error, projectId);
      }
    },
  );

  // 5. publish_shell
  server.tool(
    'publish_shell',
    `Shell을 퍼블리시합니다. 퍼블리시된 Shell은 런타임에서 사용 가능합니다.
이미 published 상태이면 409 에러를 반환합니다. 수정 후 재퍼블리시하려면 update_shell로 수정 후 다시 호출하세요.`,
    {
      projectId: z.string().describe('프로젝트 ID'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const res = await apiClient.post<MutateShellResponse>(
          `/api/projects/${projectId}/shell/publish`,
          {},
        );
        const shell = res.data;

        return toolResult({
          projectId,
          shellId: shell._id,
          name: shell.name,
          version: shell.version,
          published: shell.published,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return toolError('Shell이 이미 published 상태입니다.', { code: 'ALREADY_PUBLISHED', details: { projectId }, suggestion: 'update_shell로 수정 후 재퍼블리시하세요.' });
        }
        if (error instanceof ApiError && error.status === 404) {
          return toolError('Shell을 찾을 수 없습니다.', { code: 'SHELL_NOT_FOUND', details: { projectId }, suggestion: 'create_shell로 먼저 생성하세요.' });
        }
        return handleShellToolError(error, projectId);
      }
    },
  );
}
