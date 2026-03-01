/**
 * MongoDB ObjectId 형식 검증 (24자 hex)
 */
export function validateObjectId(id: string, fieldName: string = 'id'): void {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new Error(`유효하지 않은 ${fieldName}: "${id}" (24자 hex 문자열이어야 합니다)`);
  }
}

/**
 * 필수값 검증 — null/undefined/빈문자열 체크
 */
export function validateRequired(value: unknown, fieldName: string): void {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName}은(는) 필수 입력입니다`);
  }
}
