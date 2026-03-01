import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectTools } from './tools/index.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  // registerFormTools(server);

  // Phase 2: 컨트롤/이벤트 Tools
  // registerControlTools(server);
  // registerEventTools(server);

  // Phase 3: 데이터소스/테마/Shell Tools
  // registerDatasourceTools(server);
  // registerThemeTools(server);
  // registerShellTools(server);
}

export function registerResources(_server: McpServer): void {
  // Phase 2: 스키마/가이드 Resources
  // registerSchemaResources(server);
  // registerGuideResources(server);

  // Phase 3: 동적 Resources
  // registerDynamicResources(server);
}

export function registerPrompts(_server: McpServer): void {
  // Phase 4: Prompt 템플릿
  // registerFormWizardPrompt(server);
  // registerCrudHandlersPrompt(server);
}
