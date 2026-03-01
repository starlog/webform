import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// --- API 응답 타입 ---

interface FormDocument {
  _id: string;
  name: string;
  version: number;
  status: string;
  projectId: string;
  properties: Record<string, unknown>;
  controls: Record<string, unknown>[];
  eventHandlers: Record<string, unknown>[];
  dataBindings: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
}

interface ListFormsResponse {
  data: FormDocument[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface GetFormResponse {
  data: FormDocument;
}

interface MutateFormResponse {
  data: FormDocument;
}

interface VersionEntry {
  version: number;
  savedAt: string;
  note?: string;
}

interface GetVersionsResponse {
  data: VersionEntry[];
}

interface GetSnapshotResponse {
  data: {
    version: number;
    snapshot: {
      name: string;
      properties: Record<string, unknown>;
      controls: Record<string, unknown>[];
      eventHandlers: Record<string, unknown>[];
      dataBindings: Record<string, unknown>[];
    };
    savedAt: string;
  };
}

// --- 헬퍼 ---

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const };
}

// --- Tool 등록 ---

export function registerFormTools(server: McpServer): void {
  // 1. list_forms
  server.tool(
    'list_forms',
    '프로젝트의 폼 목록을 조회합니다. 검색, 상태 필터, 페이지네이션을 지원합니다.',
    {
      projectId: z.string().optional().describe('프로젝트 ID (미지정 시 전체 프로젝트)'),
      page: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('페이지 번호 (기본값: 1)'),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('페이지당 항목 수 (기본값: 20, 최대: 100)'),
      search: z.string().optional().describe('폼 이름 검색어'),
      status: z.enum(['draft', 'published']).optional().describe('폼 상태 필터'),
    },
    async ({ projectId, page, limit, search, status }) => {
      try {
        const params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        const query = params.toString();
        const path = `/api/forms${query ? `?${query}` : ''}`;

        const res = await apiClient.get<ListFormsResponse>(path);

        return toolResult({
          forms: res.data.map((f) => ({
            id: f._id,
            name: f.name,
            version: f.version,
            status: f.status,
            projectId: f.projectId,
            updatedAt: f.updatedAt,
          })),
          meta: res.meta,
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        throw error;
      }
    },
  );

  // 2. get_form
  server.tool(
    'get_form',
    '폼의 전체 정의(속성, 컨트롤, 이벤트 핸들러, 데이터 바인딩)를 조회합니다.',
    {
      formId: z.string().describe('폼 ID (MongoDB ObjectId)'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');
        const res = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);

        const f = res.data;
        return toolResult({
          id: f._id,
          name: f.name,
          version: f.version,
          status: f.status,
          projectId: f.projectId,
          properties: f.properties,
          controls: f.controls,
          eventHandlers: f.eventHandlers,
          dataBindings: f.dataBindings,
          controlCount: f.controls?.length ?? 0,
          eventHandlerCount: f.eventHandlers?.length ?? 0,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 3. create_form
  server.tool(
    'create_form',
    '프로젝트에 새 폼을 생성합니다. properties로 폼의 초기 설정(제목, 크기, 배경색, 테마 등)을 지정할 수 있습니다.',
    {
      name: z.string().min(1).max(200).describe('폼 이름 (1~200자)'),
      projectId: z.string().describe('프로젝트 ID'),
      properties: z
        .object({
          title: z.string().optional().describe('폼 제목 (미지정 시 name과 동일)'),
          width: z.number().positive().optional().describe('폼 너비 (기본값: 800)'),
          height: z.number().positive().optional().describe('폼 높이 (기본값: 600)'),
          backgroundColor: z.string().optional().describe('배경색 (예: #FFFFFF)'),
          theme: z.string().optional().describe('테마 ID'),
          startPosition: z
            .enum(['CenterScreen', 'Manual', 'CenterParent'])
            .optional()
            .describe('시작 위치'),
          formBorderStyle: z
            .enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable'])
            .optional()
            .describe('테두리 스타일'),
          maximizeBox: z.boolean().optional().describe('최대화 버튼 표시'),
          minimizeBox: z.boolean().optional().describe('최소화 버튼 표시'),
        })
        .optional()
        .describe('폼 속성'),
    },
    async ({ name, projectId, properties }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const body = {
          name,
          projectId,
          properties: {
            title: properties?.title || name,
            ...properties,
          },
        };

        const res = await apiClient.post<MutateFormResponse>('/api/forms', body);

        const f = res.data;
        return toolResult({
          id: f._id,
          name: f.name,
          version: f.version,
          status: f.status,
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 4. update_form (낙관적 잠금)
  server.tool(
    'update_form',
    '폼 정의를 수정합니다. 낙관적 잠금을 위해 version이 필수이며, 현재 version과 불일치 시 409 충돌 에러가 발생합니다. get_form으로 최신 version을 먼저 확인하세요.',
    {
      formId: z.string().describe('폼 ID'),
      version: z
        .number()
        .int()
        .positive()
        .describe('현재 폼 버전 (낙관적 잠금 — get_form으로 조회한 version 값)'),
      name: z.string().min(1).max(200).optional().describe('폼 이름'),
      properties: z
        .object({
          title: z.string().optional(),
          width: z.number().positive().optional(),
          height: z.number().positive().optional(),
          backgroundColor: z.string().optional(),
          theme: z.string().optional(),
          startPosition: z.enum(['CenterScreen', 'Manual', 'CenterParent']).optional(),
          formBorderStyle: z.enum(['None', 'FixedSingle', 'Fixed3D', 'Sizable']).optional(),
          maximizeBox: z.boolean().optional(),
          minimizeBox: z.boolean().optional(),
          font: z
            .object({
              family: z.string().optional(),
              size: z.number().positive().optional(),
              bold: z.boolean().optional(),
              italic: z.boolean().optional(),
            })
            .optional()
            .describe('폰트 설정'),
        })
        .optional()
        .describe('수정할 폼 속성 (부분 업데이트)'),
      controls: z
        .array(z.record(z.unknown()))
        .optional()
        .describe('전체 컨트롤 배열 (교체)'),
      eventHandlers: z
        .array(
          z.object({
            controlId: z.string(),
            eventName: z.string(),
            handlerType: z.enum(['server', 'client']),
            handlerCode: z.string(),
          }),
        )
        .optional()
        .describe('전체 이벤트 핸들러 배열 (교체)'),
      dataBindings: z
        .array(
          z.object({
            controlId: z.string(),
            controlProperty: z.string(),
            dataSourceId: z.string(),
            dataField: z.string(),
            bindingMode: z.enum(['oneWay', 'twoWay', 'oneTime']),
          }),
        )
        .optional()
        .describe('전체 데이터 바인딩 배열 (교체)'),
    },
    async ({ formId, version, name, properties, controls, eventHandlers, dataBindings }) => {
      try {
        validateObjectId(formId, 'formId');

        const body: Record<string, unknown> = { version };
        if (name !== undefined) body.name = name;
        if (properties !== undefined) body.properties = properties;
        if (controls !== undefined) body.controls = controls;
        if (eventHandlers !== undefined) body.eventHandlers = eventHandlers;
        if (dataBindings !== undefined) body.dataBindings = dataBindings;

        const res = await apiClient.put<MutateFormResponse>(`/api/forms/${formId}`, body);

        const f = res.data;
        return toolResult({
          id: f._id,
          name: f.name,
          version: f.version,
          status: f.status,
          controlCount: f.controls?.length ?? 0,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return toolError(
            `버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. get_form으로 최신 버전을 조회 후 다시 시도하세요. (요청 version: ${version})`,
          );
        }
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 5. delete_form
  server.tool(
    'delete_form',
    '폼을 삭제합니다 (soft delete).',
    {
      formId: z.string().describe('삭제할 폼 ID'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');
        await apiClient.delete(`/api/forms/${formId}`);
        return toolResult({ deleted: true, formId });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 6. publish_form
  server.tool(
    'publish_form',
    '폼을 퍼블리시합니다. 퍼블리시된 폼은 런타임에서 사용할 수 있습니다. 이미 published 상태면 409 에러가 발생합니다.',
    {
      formId: z.string().describe('퍼블리시할 폼 ID'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');
        const res = await apiClient.post<MutateFormResponse>(
          `/api/forms/${formId}/publish`,
        );

        const f = res.data;
        return toolResult({
          id: f._id,
          name: f.name,
          version: f.version,
          status: f.status,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          return toolError('이미 퍼블리시된 폼입니다.');
        }
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 7. get_form_versions
  server.tool(
    'get_form_versions',
    '폼의 버전 히스토리를 조회합니다. 각 버전의 번호, 저장 시간, 변경 노트를 확인할 수 있습니다.',
    {
      formId: z.string().describe('폼 ID'),
    },
    async ({ formId }) => {
      try {
        validateObjectId(formId, 'formId');
        const res = await apiClient.get<GetVersionsResponse>(
          `/api/forms/${formId}/versions`,
        );

        return toolResult({
          formId,
          versions: res.data,
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 8. get_form_version_snapshot
  server.tool(
    'get_form_version_snapshot',
    '특정 버전의 폼 스냅샷(전체 정의)을 조회합니다. 이전 버전의 상태를 확인하거나 복원할 때 사용합니다.',
    {
      formId: z.string().describe('폼 ID'),
      version: z.number().int().positive().describe('조회할 버전 번호'),
    },
    async ({ formId, version }) => {
      try {
        validateObjectId(formId, 'formId');
        const res = await apiClient.get<GetSnapshotResponse>(
          `/api/forms/${formId}/versions/${version}`,
        );

        return toolResult({
          formId,
          version,
          snapshot: res.data.snapshot,
          savedAt: res.data.savedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );
}
