/** 개발 환경에서 인증 토큰을 자동 획득하여 localStorage에 저장 */
export async function ensureAuthToken(): Promise<void> {
  if (localStorage.getItem('auth_token')) return;
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
  return localStorage.getItem('auth_token');
}
