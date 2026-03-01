import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../utils/index.js';

export function registerShellResources(server: McpServer): void {
  // webform://shells/{projectId} — 프로젝트 Shell 상세
  server.resource(
    'shell-detail',
    new ResourceTemplate('webform://shells/{projectId}', { list: undefined }),
    async (uri, { projectId }) => {
      const response = await apiClient.get<{ data: unknown }>(
        `/api/projects/${projectId}/shell`,
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
