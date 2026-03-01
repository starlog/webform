import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient, ApiError, validateObjectId, toolResult, toolError } from '../utils/index.js';

// --- API 응답 타입 ---

interface ThemeDocument {
  _id: string;
  name: string;
  basePreset?: string;
  tokens: Record<string, unknown>;
  isPreset: boolean;
  presetId?: string;
  createdBy: string;
  updatedBy: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListThemesResponse {
  data: ThemeDocument[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface GetThemeResponse {
  data: ThemeDocument;
}

interface MutateThemeResponse {
  data: ThemeDocument;
}

interface FormDocument {
  _id: string;
  name: string;
  version: number;
  properties: Record<string, unknown>;
}

interface GetFormResponse {
  data: FormDocument;
}

interface MutateFormResponse {
  data: FormDocument;
}

// --- Tool 등록 ---

export function registerThemeTools(server: McpServer): void {
  // 1. list_themes
  server.tool(
    'list_themes',
    '테마 목록을 조회합니다. 프리셋 테마와 커스텀 테마를 모두 포함하며, 프리셋 우선 정렬됩니다.',
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
        .max(200)
        .optional()
        .describe('페이지당 항목 수 (기본값: 100, 최대: 200)'),
    },
    async ({ page, limit }) => {
      try {
        const params = new URLSearchParams();
        if (page) params.set('page', String(page));
        if (limit) params.set('limit', String(limit));
        const query = params.toString();
        const path = `/api/themes${query ? `?${query}` : ''}`;

        const res = await apiClient.get<ListThemesResponse>(path);

        return toolResult({
          themes: res.data.map((t) => ({
            id: t._id,
            name: t.name,
            isPreset: t.isPreset,
            presetId: t.presetId,
            basePreset: t.basePreset,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
          meta: res.meta,
        });
      } catch (error) {
        if (error instanceof ApiError)
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        throw error;
      }
    },
  );

  // 2. get_theme
  server.tool(
    'get_theme',
    '테마의 상세 정보와 토큰 값을 조회합니다.',
    {
      themeId: z.string().describe('테마 ID (MongoDB ObjectId)'),
    },
    async ({ themeId }) => {
      try {
        validateObjectId(themeId, 'themeId');
        const res = await apiClient.get<GetThemeResponse>(`/api/themes/${themeId}`);

        const t = res.data;
        return toolResult({
          id: t._id,
          name: t.name,
          isPreset: t.isPreset,
          presetId: t.presetId,
          basePreset: t.basePreset,
          tokens: t.tokens,
          createdBy: t.createdBy,
          updatedBy: t.updatedBy,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404)
            return toolError(`테마를 찾을 수 없습니다 (themeId: ${themeId})`, { code: 'THEME_NOT_FOUND', details: { themeId }, suggestion: 'list_themes로 유효한 테마 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { themeId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 3. create_theme
  server.tool(
    'create_theme',
    '새 커스텀 테마를 생성합니다. tokens에 ThemeTokens 구조를 전달합니다.',
    {
      name: z.string().min(1).max(200).describe('테마 이름 (1~200자)'),
      tokens: z.record(z.unknown()).describe('테마 토큰 (ThemeTokens 구조)'),
      basePreset: z.string().optional().describe('기반 프리셋 테마 ID (참조용)'),
    },
    async ({ name, tokens, basePreset }) => {
      try {
        const body: Record<string, unknown> = { name, tokens };
        if (basePreset !== undefined) body.basePreset = basePreset;

        const res = await apiClient.post<MutateThemeResponse>('/api/themes', body);

        const t = res.data;
        return toolResult({
          id: t._id,
          name: t.name,
          isPreset: t.isPreset,
          createdAt: t.createdAt,
        });
      } catch (error) {
        if (error instanceof ApiError)
          return toolError(error.message, { code: `API_ERROR_${error.status}` });
        throw error;
      }
    },
  );

  // 4. update_theme
  server.tool(
    'update_theme',
    '커스텀 테마를 수정합니다. 프리셋 테마는 수정할 수 없습니다.',
    {
      themeId: z.string().describe('수정할 테마 ID'),
      name: z.string().min(1).max(200).optional().describe('변경할 테마 이름'),
      tokens: z.record(z.unknown()).optional().describe('변경할 테마 토큰'),
    },
    async ({ themeId, name, tokens }) => {
      try {
        validateObjectId(themeId, 'themeId');

        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (tokens !== undefined) body.tokens = tokens;

        const res = await apiClient.put<MutateThemeResponse>(`/api/themes/${themeId}`, body);

        const t = res.data;
        return toolResult({
          id: t._id,
          name: t.name,
          isPreset: t.isPreset,
          updatedAt: t.updatedAt,
        });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 403)
            return toolError('프리셋 테마는 수정할 수 없습니다.', { code: 'PRESET_READONLY', details: { themeId }, suggestion: '프리셋 기반 커스텀 테마를 create_theme으로 생성하세요.' });
          if (error.status === 404)
            return toolError(`테마를 찾을 수 없습니다 (themeId: ${themeId})`, { code: 'THEME_NOT_FOUND', details: { themeId }, suggestion: 'list_themes로 유효한 테마 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { themeId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 5. delete_theme
  server.tool(
    'delete_theme',
    '커스텀 테마를 삭제합니다 (소프트 삭제). 프리셋 테마는 삭제할 수 없습니다.',
    {
      themeId: z.string().describe('삭제할 테마 ID'),
    },
    async ({ themeId }) => {
      try {
        validateObjectId(themeId, 'themeId');
        await apiClient.delete(`/api/themes/${themeId}`);
        return toolResult({ deleted: true, themeId });
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 403)
            return toolError('프리셋 테마는 삭제할 수 없습니다.', { code: 'PRESET_READONLY', details: { themeId }, suggestion: '프리셋 테마는 삭제할 수 없습니다. 커스텀 테마만 삭제 가능합니다.' });
          if (error.status === 404)
            return toolError(`테마를 찾을 수 없습니다 (themeId: ${themeId})`, { code: 'THEME_NOT_FOUND', details: { themeId }, suggestion: 'list_themes로 유효한 테마 ID를 확인하세요.' });
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { themeId } });
        }
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );

  // 6. apply_theme_to_form
  server.tool(
    'apply_theme_to_form',
    '폼에 테마를 적용합니다. 폼의 properties.theme 값을 변경합니다.',
    {
      formId: z.string().describe('테마를 적용할 폼 ID'),
      themeId: z.string().describe('적용할 테마 ID'),
    },
    async ({ formId, themeId }) => {
      try {
        validateObjectId(formId, 'formId');
        validateObjectId(themeId, 'themeId');

        // 1. 테마 존재 확인
        let themeRes: GetThemeResponse;
        try {
          themeRes = await apiClient.get<GetThemeResponse>(`/api/themes/${themeId}`);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404)
            return toolError(`테마를 찾을 수 없습니다 (themeId: ${themeId})`, { code: 'THEME_NOT_FOUND', details: { themeId }, suggestion: 'list_themes로 유효한 테마 ID를 확인하세요.' });
          throw error;
        }

        // 2. 폼 조회 + 테마 적용 (409 충돌 시 1회 자동 재시도)
        const maxRetries = 1;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          let formRes: GetFormResponse;
          try {
            formRes = await apiClient.get<GetFormResponse>(`/api/forms/${formId}`);
          } catch (error) {
            if (error instanceof ApiError && error.status === 404)
              return toolError(`폼을 찾을 수 없습니다 (formId: ${formId})`, { code: 'FORM_NOT_FOUND', details: { formId }, suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.' });
            throw error;
          }

          try {
            const updateRes = await apiClient.put<MutateFormResponse>(
              `/api/forms/${formId}`,
              {
                version: formRes.data.version,
                properties: { theme: themeId },
              },
            );

            return toolResult({
              applied: true,
              formId,
              formName: updateRes.data.name,
              themeId,
              themeName: themeRes.data.name,
              version: updateRes.data.version,
            });
          } catch (error) {
            if (error instanceof ApiError && error.status === 409 && attempt < maxRetries) {
              continue;
            }
            throw error;
          }
        }

        return toolError(
          '버전 충돌: 폼이 다른 사용자에 의해 수정되었습니다. 다시 시도하세요.',
          { code: 'VERSION_CONFLICT', details: { formId, themeId }, suggestion: '폼이 다른 사용자에 의해 수정되었습니다. 잠시 후 다시 시도하세요.' },
        );
      } catch (error) {
        if (error instanceof ApiError)
          return toolError(error.message, { code: `API_ERROR_${error.status}`, details: { formId, themeId } });
        if (error instanceof Error && error.message.includes('유효하지 않은'))
          return toolError(error.message, { code: 'VALIDATION_ERROR' });
        throw error;
      }
    },
  );
}
