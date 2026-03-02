import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerCreateFormPrompt(server: McpServer): void {
  server.prompt(
    'create-form-wizard',
    {
      projectId: z.string().describe('대상 프로젝트 ID'),
      description: z.string().describe('만들 폼에 대한 자연어 설명'),
    },
    ({ projectId, description }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `WebForm 프로젝트(${projectId})에 다음 폼을 만들어주세요:

${description}

단계:
1. 설명을 분석하여 필요한 컨트롤 목록 도출
2. create_form으로 폼 생성
3. batch_add_controls로 컨트롤 일괄 배치 (적절한 position/size 자동 계산)
4. 필요 시 이벤트 핸들러 추가 (add_event_handler)
5. 결과 폼 요약 출력`,
          },
        },
      ],
    }),
  );
}
