import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';

// --- API 응답 타입 ---

interface DataSourceSummary {
  _id: string;
  name: string;
  type: 'database' | 'restApi' | 'static';
  projectId: string;
  description: string;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ListDataSourcesResponse {
  data: DataSourceSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface DataSourceDetail extends DataSourceSummary {
  config: Record<string, unknown>;
}

interface GetDataSourceResponse {
  data: DataSourceDetail;
}

interface MutateDataSourceResponse {
  data: DataSourceSummary;
}

interface TestConnectionResponse {
  data: {
    success: boolean;
    message: string;
  };
}

interface QueryDataSourceResponse {
  data: unknown[];
}

// --- Tool 등록 ---

export function registerDatasourceTools(server: McpServer): void {
  // 1. list_datasources
  server.tool(
    'list_datasources',
    '데이터소스 목록을 조회합니다. 프로젝트, 타입 필터, 이름 검색, 페이지네이션을 지원합니다.',
    {
      projectId: z.string().optional().describe('프로젝트 ID (미지정 시 전체)'),
      type: z
        .enum(['database', 'restApi', 'static'])
        .optional()
        .describe('데이터소스 타입 필터'),
      search: z.string().optional().describe('이름 검색어'),
      page: z.number().int().positive().optional().describe('페이지 번호 (기본값: 1)'),
      limit: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('페이지당 항목 수 (기본값: 20, 최대: 100)'),
    },
    async ({ projectId, type, search, page, limit }) => {
      try {
        const params = new URLSearchParams();
        if (projectId) {
          validateObjectId(projectId, 'projectId');
          params.set('projectId', projectId);
        }
        if (type) params.set('type', type);
        if (search) params.set('search', search);
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));

        const query = params.toString();
        const url = `/api/datasources${query ? `?${query}` : ''}`;
        const res = await apiClient.get<ListDataSourcesResponse>(url);

        return toolResult({
          datasources: res.data.map((ds) => ({
            id: ds._id,
            name: ds.name,
            type: ds.type,
            projectId: ds.projectId,
            description: ds.description,
            meta: ds.meta,
            updatedAt: ds.updatedAt,
          })),
          meta: res.meta,
        });
      } catch (error) {
        if (error instanceof ApiError)
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 2. get_datasource
  server.tool(
    'get_datasource',
    '데이터소스의 상세 정보를 조회합니다. 복호화된 config 설정을 포함합니다.',
    {
      datasourceId: z.string().describe('데이터소스 ID (MongoDB ObjectId)'),
    },
    async ({ datasourceId }) => {
      try {
        validateObjectId(datasourceId, 'datasourceId');

        const res = await apiClient.get<GetDataSourceResponse>(
          `/api/datasources/${datasourceId}`,
        );
        const ds = res.data;

        return toolResult({
          id: ds._id,
          name: ds.name,
          type: ds.type,
          projectId: ds.projectId,
          description: ds.description,
          config: ds.config,
          meta: ds.meta,
          createdAt: ds.createdAt,
          updatedAt: ds.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`데이터소스를 찾을 수 없습니다 (datasourceId: ${datasourceId})`, { code: 'DATASOURCE_NOT_FOUND', details: { datasourceId }, suggestion: 'list_datasources로 유효한 데이터소스 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { datasourceId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 3. create_datasource
  server.tool(
    'create_datasource',
    `새 데이터소스를 생성합니다. type에 따라 config 구조가 다릅니다: database(MongoDB 연결), restApi(REST API 엔드포인트), static(정적 JSON 데이터).`,
    {
      name: z.string().min(1).max(200).describe('데이터소스 이름 (1~200자)'),
      type: z.enum(['database', 'restApi', 'static']).describe('데이터소스 타입'),
      projectId: z.string().describe('프로젝트 ID'),
      description: z.string().max(500).optional().describe('설명 (최대 500자)'),
      config: z
        .record(z.unknown())
        .describe(
          '데이터소스 설정. type별 구조:\n' +
            '- database: { dialect: "mongodb", connectionString: string, database: string }\n' +
            '- restApi: { baseUrl: string, headers?: Record<string,string>, auth?: { type: "bearer"|"basic"|"apiKey", token?, username?, password?, apiKey?, headerName? } }\n' +
            '- static: { data: unknown[] }',
        ),
    },
    async ({ name, type, projectId, description, config }) => {
      try {
        validateObjectId(projectId, 'projectId');

        const res = await apiClient.post<MutateDataSourceResponse>('/api/datasources', {
          name,
          type,
          projectId,
          description,
          config,
        });
        const ds = res.data;

        return toolResult({
          id: ds._id,
          name: ds.name,
          type: ds.type,
          projectId: ds.projectId,
          description: ds.description,
        });
      } catch (error) {
        if (error instanceof ApiError)
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { projectId } });
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 4. update_datasource
  server.tool(
    'update_datasource',
    '데이터소스를 수정합니다. name, description, config를 개별적으로 업데이트할 수 있습니다.',
    {
      datasourceId: z.string().describe('데이터소스 ID'),
      name: z.string().min(1).max(200).optional().describe('새 이름'),
      description: z.string().max(500).optional().describe('새 설명'),
      config: z
        .record(z.unknown())
        .optional()
        .describe(
          '수정할 설정 (기존 type에 맞는 구조):\n' +
            '- database: { connectionString: string, database: string, dialect?: string }\n' +
            '- restApi: { baseUrl: string, headers?: Record<string,string>, auth?: object }\n' +
            '- static: { data: unknown[] }',
        ),
    },
    async ({ datasourceId, name, description, config }) => {
      try {
        validateObjectId(datasourceId, 'datasourceId');

        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (config !== undefined) body.config = config;

        const res = await apiClient.put<MutateDataSourceResponse>(
          `/api/datasources/${datasourceId}`,
          body,
        );
        const ds = res.data;

        return toolResult({
          id: ds._id,
          name: ds.name,
          type: ds.type,
          projectId: ds.projectId,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`데이터소스를 찾을 수 없습니다 (datasourceId: ${datasourceId})`, { code: 'DATASOURCE_NOT_FOUND', details: { datasourceId }, suggestion: 'list_datasources로 유효한 데이터소스 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { datasourceId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 5. delete_datasource
  server.tool(
    'delete_datasource',
    '데이터소스를 삭제합니다 (soft delete).',
    {
      datasourceId: z.string().describe('삭제할 데이터소스 ID'),
    },
    async ({ datasourceId }) => {
      try {
        validateObjectId(datasourceId, 'datasourceId');

        await apiClient.delete(`/api/datasources/${datasourceId}`);

        return toolResult({
          deleted: true,
          datasourceId,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`데이터소스를 찾을 수 없습니다 (datasourceId: ${datasourceId})`, { code: 'DATASOURCE_NOT_FOUND', details: { datasourceId }, suggestion: 'list_datasources로 유효한 데이터소스 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { datasourceId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 6. test_datasource_connection
  server.tool(
    'test_datasource_connection',
    '데이터소스의 연결을 테스트합니다. database 타입은 DB 연결을, restApi 타입은 API 호출을 테스트합니다. static 타입은 항상 성공합니다.',
    {
      datasourceId: z.string().describe('테스트할 데이터소스 ID'),
    },
    async ({ datasourceId }) => {
      try {
        validateObjectId(datasourceId, 'datasourceId');

        const res = await apiClient.post<TestConnectionResponse>(
          `/api/datasources/${datasourceId}/test`,
          {},
        );

        return toolResult({
          success: res.data.success,
          message: res.data.message,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`데이터소스를 찾을 수 없습니다 (datasourceId: ${datasourceId})`, { code: 'DATASOURCE_NOT_FOUND', details: { datasourceId }, suggestion: 'list_datasources로 유효한 데이터소스 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { datasourceId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 7. query_datasource
  server.tool(
    'query_datasource',
    `데이터소스에 쿼리를 실행합니다. type별 쿼리 형식이 다릅니다: database는 MongoDB 쿼리, restApi는 HTTP 요청 설정, static은 필터 조건.`,
    {
      datasourceId: z.string().describe('데이터소스 ID'),
      query: z
        .record(z.unknown())
        .describe(
          '쿼리 객체 (type별 형식):\n' +
            '- database(mongodb): { collection: string, filter?: object, projection?: object, sort?: object, limit?: number }\n' +
            '- restApi: { method?: string, path?: string, params?: object, body?: object }\n' +
            '- static: { filter?: object, sort?: object, limit?: number }',
        ),
    },
    async ({ datasourceId, query }) => {
      try {
        validateObjectId(datasourceId, 'datasourceId');

        const res = await apiClient.post<QueryDataSourceResponse>(
          `/api/datasources/${datasourceId}/query`,
          query,
        );

        return toolResult({
          data: res.data,
          rowCount: Array.isArray(res.data) ? res.data.length : 0,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`데이터소스를 찾을 수 없습니다 (datasourceId: ${datasourceId})`, { code: 'DATASOURCE_NOT_FOUND', details: { datasourceId }, suggestion: 'list_datasources로 유효한 데이터소스 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { datasourceId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );
}
