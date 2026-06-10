/** 개발 환경에서 인증 토큰을 자동 획득하여 localStorage에 저장 */

/** JWT exp 클레임 기준으로 토큰이 아직 유효한지 확인 (만료 60초 전부터는 무효 취급) */
function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now() + 60_000;
  } catch {
    return false;
  }
}

export async function ensureAuthToken(): Promise<void> {
  const existing = localStorage.getItem('auth_token');
  if (existing && isTokenValid(existing)) return;

  // 만료되었거나 손상된 토큰은 제거 후 재발급 (만료 토큰으로 WS가 무한 401 재시도하는 문제 방지)
  localStorage.removeItem('auth_token');
  try {
    const res = await fetch('/auth/dev-token', { method: 'POST' });
    if (res.ok) {
      const { token } = await res.json();
      localStorage.setItem('auth_token', token);
    }
  } catch {
    // 프로덕션 환경에서는 외부 인증 흐름으로 토큰 제공
  }
}

export function getAuthToken(): string | null {
  const token = localStorage.getItem('auth_token');
  if (token && !isTokenValid(token)) {
    localStorage.removeItem('auth_token');
    return null;
  }
  return token;
}
