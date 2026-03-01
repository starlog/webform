import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCreateFormPrompt } from './createForm.js';
import { registerCrudHandlersPrompt } from './crudHandlers.js';
import { registerSetupNavigationPrompt } from './setupNavigation.js';
import { registerCloneFormPrompt } from './cloneForm.js';
import { registerDesignThemePrompt } from './designTheme.js';

export function registerPrompts(server: McpServer): void {
  registerCreateFormPrompt(server);
  registerCrudHandlersPrompt(server);
  registerSetupNavigationPrompt(server);
  registerCloneFormPrompt(server);
  registerDesignThemePrompt(server);
}
