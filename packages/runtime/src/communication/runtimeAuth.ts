const STORAGE_KEY = 'webform_runtime_auth_token';

/**
 * URL fragment (#auth_token=xxx)에서 토큰을 추출하여 localStorage에 저장한다.
 * 또한 httpOnly 쿠키가 설정된 경우(OAuth 콜백) hash가 없으므로 바로 반환한다.
 * 토큰 추출 후 hash를 제거하여 URL을 깨끗하게 유지한다.
 */
export function extractAuthTokenFromUrl(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;

  // 하위 호환: 기존 fragment 방식 지원
  const match = hash.match(/auth_token=([^&]+)/);
  if (!match) return null;

  const token = match[1];
  localStorage.setItem(STORAGE_KEY, token);

  // hash 제거 (URL 깨끗하게)
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  return token;
}

/**
 * Runtime 인증 토큰을 반환한다.
 * httpOnly 쿠키 기반 인증 시에는 null을 반환하며, 쿠키는 브라우저가 자동 전송한다.
 */
export function getRuntimeAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * 저장된 Runtime 인증 토큰을 삭제한다.
 */
export function clearRuntimeAuthToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}
