/**
 * MCP Tool 응답 헬퍼
 *
 * toolResult: 정상 응답 포맷
 * toolError:  에러 응답 포맷 (에러 코드, 상세 정보, 해결 방법 포함)
 */

export interface ToolErrorOptions {
  /** 에러 코드 (예: FORM_NOT_FOUND, INVALID_CONTROL_TYPE) */
  code?: string;
  /** 컨텍스트 정보 (관련 ID, 현재 상태 등) */
  details?: Record<string, unknown>;
  /** 해결 방법 안내 */
  suggestion?: string;
}

/**
 * 정상 응답 포맷
 */
export function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * 에러 응답 포맷
 *
 * @param message - 사람이 읽을 수 있는 에러 메시지 (한국어)
 * @param opts - 에러 코드, 상세 정보, 해결 방법
 *
 * @example
 * toolError('폼을 찾을 수 없습니다', {
 *   code: 'FORM_NOT_FOUND',
 *   details: { formId: '123' },
 *   suggestion: 'list_forms로 유효한 폼 ID를 확인하세요.',
 * })
 */
export function toolError(message: string, opts?: ToolErrorOptions) {
  const errorObj: Record<string, unknown> = { error: message };
  if (opts?.code) errorObj.code = opts.code;
  if (opts?.details) errorObj.details = opts.details;
  if (opts?.suggestion) errorObj.suggestion = opts.suggestion;
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(errorObj, null, 2) }],
    isError: true as const,
  };
}
