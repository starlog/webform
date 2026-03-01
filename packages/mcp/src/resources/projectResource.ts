import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/index.js';

export function registerProjectResources(server: McpServer): void {
  // webform://projects/{projectId} — 프로젝트 상세 + 폼 목록
  server.resource(
    'project-detail',
    new ResourceTemplate('webform://projects/{projectId}', { list: undefined }),
    async (uri, { projectId }) => {
      const response = await apiClient.get<{ data: unknown }>(
        `/api/projects/${projectId}`,
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
