import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerCloneFormPrompt(server: McpServer): void {
  server.prompt(
    'clone-and-modify-form',
    {
      sourceFormId: z.string().describe('원본 폼 ID'),
      newName: z.string().describe('새 폼 이름'),
      modifications: z.string().describe('변경 사항 설명'),
    },
    ({ sourceFormId, newName, modifications }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `폼(${sourceFormId})을 "${newName}"으로 복제하고 수정해주세요.

변경 사항: ${modifications}

단계:
1. get_form으로 원본 폼 정의 조회
2. create_form으로 새 폼 생성 (같은 projectId)
3. 원본 컨트롤을 batch_add_controls로 복사
4. 원본 이벤트 핸들러 복사
5. 변경 사항 적용 (컨트롤 추가/삭제/수정, 핸들러 변경)
6. 결과 요약`,
          },
        },
      ],
    }),
  );
}
