import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetupNavigationPrompt(server: McpServer): void {
  server.prompt(
    'setup-navigation',
    {
      projectId: z.string().describe('프로젝트 ID'),
      formIds: z.string().describe('폼 ID 목록 (쉼표 구분)'),
    },
    ({ projectId, formIds }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `프로젝트(${projectId})에 네비게이션을 구성해주세요.

폼: ${formIds}

단계:
1. 프로젝트 상세 및 각 폼 정보 조회
2. Shell이 없으면 create_shell로 생성 (MenuStrip + StatusStrip 포함)
3. MenuStrip에 각 폼으로의 메뉴 아이템 추가
4. 메뉴 클릭 이벤트 → ctx.navigate(formId)
5. 첫 번째 폼을 startFormId로 설정
6. Shell 퍼블리시`,
          },
        },
      ],
    }),
  );
}
