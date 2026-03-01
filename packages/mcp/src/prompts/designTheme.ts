import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerDesignThemePrompt(server: McpServer): void {
  server.prompt(
    'design-theme',
    {
      description: z.string().describe('원하는 테마 스타일 설명'),
      baseTheme: z.string().optional().describe('기반 preset 테마 ID'),
    },
    ({ description, baseTheme }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `다음 설명에 맞는 WebForm 테마를 만들어주세요:

"${description}"

${baseTheme ? `기반 테마: ${baseTheme} (이 테마를 조회하여 토큰 구조 파악)` : ''}

단계:
1. webform://schema/theme-tokens 리소스로 토큰 구조 확인
2. ${baseTheme ? '기반 테마를 조회하여 시작점 확보' : 'Preset 테마 중 가장 가까운 것 선택'}
3. 설명에 맞게 토큰 값 조정 (color, font, spacing, border-radius)
4. create_theme으로 테마 생성
5. 생성된 테마 요약 (주요 색상 팔레트, 특징)`,
          },
        },
      ],
    }),
  );
}
