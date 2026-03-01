import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/index.js';

export function registerThemeResources(server: McpServer): void {
  // webform://themes/{themeId} — 테마 토큰 상세
  server.resource(
    'theme-detail',
    new ResourceTemplate('webform://themes/{themeId}', { list: undefined }),
    async (uri, { themeId }) => {
      const response = await apiClient.get<{ data: unknown }>(`/api/themes/${themeId}`);
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
