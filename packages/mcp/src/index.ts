import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools, registerResources, registerPrompts } from './server.js';

const server = new McpServer({
  name: 'webform',
  version: '1.0.0',
  description: 'WebForm SDUI 플랫폼 — 폼/프로젝트 관리, 컨트롤 배치, 이벤트 핸들링, 데이터 바인딩',
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
