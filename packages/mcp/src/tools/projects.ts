import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId } from '../utils/index.js';

// --- API 응답 타입 ---

interface ProjectDocument {
  _id: string;
  name: string;
  description: string;
  defaultFont?: {
    family: string;
    size: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
  } | null;
  shellId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListProjectsResponse {
  data: ProjectDocument[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface GetProjectResponse {
  data: {
    project: ProjectDocument;
    forms: Array<{
      _id: string;
      name: string;
      version: number;
      status: string;
      publishedVersion?: number;
    }>;
  };
}

interface MutateProjectResponse {
  data: ProjectDocument;
}

interface ExportProjectResponse {
  exportVersion: string;
  exportedAt: string;
  project: {
    name: string;
    description: string;
    defaultFont?: object | null;
  };
  forms: Array<{
    name: string;
    properties?: Record<string, unknown>;
    controls?: unknown[];
    eventHandlers?: unknown[];
    dataBindings?: unknown[];
  }>;
}

interface PublishAllResponse {
  data: {
    forms: {
      publishedCount: number;
      skippedCount: number;
      totalCount: number;
    };
    shell: {
      published: boolean;
      skipped: boolean;
    };
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

export function registerProjectTools(server: McpServer): void {
  // 1. list_projects
  server.tool(
    'list_projects',
    '프로젝트 목록을 조회합니다. 페이징과 이름 검색을 지원합니다.',
    {
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
      search: z.string().optional().describe('프로젝트명 검색어'),
    },
    async ({ page, limit, search }) => {
      try {
        const params = new URLSearchParams();
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        if (search) params.set('search', search);
        const query = params.toString();
        const path = `/api/projects${query ? `?${query}` : ''}`;

        const res = await apiClient.get<ListProjectsResponse>(path);

        return toolResult({
          projects: res.data.map((p) => ({
            id: p._id,
            name: p.name,
            description: p.description,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
          meta: res.meta,
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        throw error;
      }
    },
  );

  // 2. get_project
  server.tool(
    'get_project',
    '프로젝트 상세 정보와 소속 폼 목록을 조회합니다.',
    {
      projectId: z.string().describe('프로젝트 ID (MongoDB ObjectId)'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');
        const res = await apiClient.get<GetProjectResponse>(`/api/projects/${projectId}`);

        const { project, forms } = res.data;
        return toolResult({
          project: {
            id: project._id,
            name: project.name,
            description: project.description,
            defaultFont: project.defaultFont ?? null,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          },
          forms: forms.map((f) => ({
            id: f._id,
            name: f.name,
            status: f.status,
            version: f.version,
            publishedVersion: f.publishedVersion,
          })),
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 3. create_project
  server.tool(
    'create_project',
    '새 프로젝트를 생성합니다. 폼을 추가하려면 먼저 프로젝트를 생성해야 합니다.',
    {
      name: z.string().min(1).max(200).describe('프로젝트명'),
      description: z.string().max(1000).optional().describe('프로젝트 설명'),
    },
    async ({ name, description }) => {
      try {
        const res = await apiClient.post<MutateProjectResponse>('/api/projects', {
          name,
          description,
        });

        const p = res.data;
        return toolResult({
          project: {
            id: p._id,
            name: p.name,
            description: p.description,
            createdAt: p.createdAt,
          },
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        throw error;
      }
    },
  );

  // 4. update_project
  server.tool(
    'update_project',
    '프로젝트의 이름이나 설명을 수정합니다.',
    {
      projectId: z.string().describe('프로젝트 ID'),
      name: z.string().min(1).max(200).optional().describe('변경할 프로젝트명'),
      description: z.string().max(1000).optional().describe('변경할 프로젝트 설명'),
    },
    async ({ projectId, name, description }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const body: Record<string, string> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;

        const res = await apiClient.put<MutateProjectResponse>(
          `/api/projects/${projectId}`,
          body,
        );

        const p = res.data;
        return toolResult({
          project: {
            id: p._id,
            name: p.name,
            description: p.description,
            updatedAt: p.updatedAt,
          },
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 5. delete_project
  server.tool(
    'delete_project',
    '프로젝트를 삭제합니다. 소속된 모든 폼도 함께 삭제됩니다.',
    {
      projectId: z.string().describe('삭제할 프로젝트 ID'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');
        await apiClient.delete(`/api/projects/${projectId}`);
        return toolResult({ deleted: true, projectId });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 6. export_project
  server.tool(
    'export_project',
    '프로젝트와 모든 폼을 JSON으로 내보냅니다. import_project로 다시 가져올 수 있습니다.',
    {
      projectId: z.string().describe('내보낼 프로젝트 ID'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');
        const res = await apiClient.get<ExportProjectResponse>(
          `/api/projects/${projectId}/export`,
        );
        return toolResult(res);
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );

  // 7. import_project
  server.tool(
    'import_project',
    'export_project로 내보낸 JSON 데이터를 가져와 새 프로젝트를 생성합니다.',
    {
      data: z
        .object({
          project: z
            .object({
              name: z.string().min(1).describe('프로젝트명'),
              description: z.string().optional().describe('프로젝트 설명'),
              defaultFont: z
                .object({
                  family: z.string(),
                  size: z.number(),
                  bold: z.boolean(),
                  italic: z.boolean(),
                  underline: z.boolean(),
                  strikethrough: z.boolean(),
                })
                .optional()
                .describe('기본 폰트 설정'),
            })
            .describe('프로젝트 정보'),
          forms: z
            .array(
              z.object({
                name: z.string().min(1).describe('폼 이름'),
                properties: z.record(z.unknown()).optional().describe('폼 속성'),
                controls: z.array(z.unknown()).optional().describe('컨트롤 배열'),
                eventHandlers: z.array(z.unknown()).optional().describe('이벤트 핸들러 배열'),
                dataBindings: z.array(z.unknown()).optional().describe('데이터 바인딩 배열'),
              }),
            )
            .describe('가져올 폼 목록'),
        })
        .describe('export_project로 내보낸 JSON 데이터'),
    },
    async ({ data }) => {
      try {
        const res = await apiClient.post<MutateProjectResponse>('/api/projects/import', data);

        const p = res.data;
        return toolResult({
          project: {
            id: p._id,
            name: p.name,
            description: p.description,
            createdAt: p.createdAt,
          },
        });
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        throw error;
      }
    },
  );

  // 8. publish_all
  server.tool(
    'publish_all',
    '프로젝트의 모든 draft 폼을 한 번에 퍼블리시합니다.',
    {
      projectId: z.string().describe('전체 퍼블리시할 프로젝트 ID'),
    },
    async ({ projectId }) => {
      try {
        validateObjectId(projectId, 'projectId');
        const res = await apiClient.post<PublishAllResponse>(
          `/api/projects/${projectId}/publish-all`,
        );
        return toolResult(res.data);
      } catch (error) {
        if (error instanceof ApiError) return toolError(error.message);
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message);
        throw error;
      }
    },
  );
}
