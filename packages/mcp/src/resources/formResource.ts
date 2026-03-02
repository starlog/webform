import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/index.js';

export function registerFormResources(server: McpServer): void {
  // webform://forms/{formId} — 폼 정의 전체 (FormDefinition)
  server.resource(
    'form-definition',
    new ResourceTemplate('webform://forms/{formId}', { list: undefined }),
    async (uri, { formId }) => {
      const response = await apiClient.get<{ data: unknown }>(`/api/forms/${formId}`);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    },
  );

  // webform://forms/{formId}/controls — 컨트롤 목록
  server.resource(
    'form-controls',
    new ResourceTemplate('webform://forms/{formId}/controls', { list: undefined }),
    async (uri, { formId }) => {
      const response = await apiClient.get<{ data: { controls: unknown[] } }>(
        `/api/forms/${formId}`,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(response.data.controls, null, 2),
          },
        ],
      };
    },
  );

  // webform://forms/{formId}/events — 이벤트 핸들러 목록
  server.resource(
    'form-events',
    new ResourceTemplate('webform://forms/{formId}/events', { list: undefined }),
    async (uri, { formId }) => {
      const response = await apiClient.get<{ data: { eventHandlers: unknown[] } }>(
        `/api/forms/${formId}`,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(response.data.eventHandlers, null, 2),
          },
        ],
      };
    },
  );

  // webform://forms/{formId}/versions — 버전 히스토리
  server.resource(
    'form-versions',
    new ResourceTemplate('webform://forms/{formId}/versions', { list: undefined }),
    async (uri, { formId }) => {
      const response = await apiClient.get<{ data: unknown[] }>(
        `/api/forms/${formId}/versions`,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    },
  );
}
