import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerCrudHandlersPrompt(server: McpServer): void {
  server.prompt(
    'add-crud-handlers',
    {
      formId: z.string().describe('대상 폼 ID'),
      dataSourceId: z.string().describe('데이터소스 ID'),
      entityName: z.string().describe('엔티티 이름 (예: "사용자", "주문")'),
    },
    ({ formId, dataSourceId, entityName }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `폼(${formId})에 "${entityName}" CRUD 핸들러를 구성해주세요.

데이터소스: ${dataSourceId}

단계:
1. 폼 정의 조회 → DataGridView, 입력 컨트롤, 버튼 식별
2. "조회" 버튼 Click: 데이터소스에서 목록 로드 → DataGridView 바인딩
3. "추가" 버튼 Click: 입력 값 → 데이터소스 insert
4. "수정" 버튼 Click: 선택된 행 → 데이터소스 update
5. "삭제" 버튼 Click: 선택된 행 → 데이터소스 delete
6. DataGridView CellClick: 선택 행 → 입력 컨트롤에 채우기
7. 각 핸들러에 에러 처리 및 showMessage 포함`,
          },
        },
      ],
    }),
  );
}
