import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  registerProjectTools,
  registerFormTools,
  registerControlTools,
  registerEventTools,
  registerDatasourceTools,
  registerDatabindingTools,
  registerThemeTools,
  registerShellTools,
  registerRuntimeTools,
  registerDebugTools,
  registerUtilityTools,
} from './tools/index.js';
import {
  registerProjectResources,
  registerFormResources,
  registerSchemaResources,
  registerGuideResources,
  registerThemeResources,
  registerShellResources,
} from './resources/index.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  registerProjectTools(server);
  registerFormTools(server);

  // Phase 2: 컨트롤/이벤트 Tools
  registerControlTools(server);
  registerEventTools(server);

  // Phase 3: 데이터소스/데이터 바인딩/테마/Shell Tools
  registerDatasourceTools(server);
  registerDatabindingTools(server);
  registerThemeTools(server);
  registerShellTools(server);

  // Phase 4: 런타임/디버그 Tools
  registerRuntimeTools(server);
  registerDebugTools(server);

  // Phase 5: 유틸리티 Tools
  registerUtilityTools(server);
}

export function registerResources(server: McpServer): void {
  // Phase 1: 프로젝트/폼 동적 Resources
  registerProjectResources(server);
  registerFormResources(server);

  // Phase 2: 스키마/가이드 Resources
  registerSchemaResources(server);
  registerGuideResources(server);

  // Phase 3: 테마/Shell Resources
  registerThemeResources(server);
  registerShellResources(server);
}

export { registerPrompts } from './prompts/index.js';
