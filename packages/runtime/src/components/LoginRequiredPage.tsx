import { useState } from 'react';
import { apiClient } from '../communication/apiClient';

interface LoginRequiredPageProps {
  loginUrl: string;
  errorMessage?: string;
  provider?: 'google' | 'password';
  projectId?: string;
  onPasswordLoginSuccess?: () => void;
}

export function LoginRequiredPage({
  loginUrl,
  errorMessage,
  provider = 'google',
  projectId,
  onPasswordLoginSuccess,
}: LoginRequiredPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'Segoe UI, sans-serif',
        backgroundColor: '#f5f5f5',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '40px 48px',
          backgroundColor: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: 400,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#333' }}>
          로그인이 필요합니다
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#666' }}>
          {provider === 'password'
            ? '이 앱에 접근하려면 아이디와 비밀번호를 입력하세요.'
            : '이 앱에 접근하려면 Google 계정으로 로그인하세요.'}
        </p>
        {errorMessage && (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d32f2f' }}>
            {errorMessage}
          </p>
        )}
        {provider === 'password' && projectId ? (
          <PasswordLoginForm
            projectId={projectId}
            onSuccess={onPasswordLoginSuccess}
          />
        ) : (
          <a
            href={loginUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              backgroundColor: '#4285f4',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path
                fill="#FFC107"
                d="M43.6 20.1H42V20H24v8h11.3C33.9 33.1 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.2-2.7-.4-3.9z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.5 15.5 18.8 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.4 0-9.9-3.5-11.5-8.3l-6.5 5C9.5 39.6 16.2 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.2-2.7-.4-3.9z"
              />
            </svg>
            Google로 로그인
          </a>
        )}
      </div>
    </div>
  );
}

function PasswordLoginForm({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess?: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('아이디와 비밀번호를 모두 입력하세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiClient.loginWithPassword(projectId, username.trim(), password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
      <div style={{ marginBottom: 12 }}>
        <label
          style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#333' }}
        >
          아이디
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label
          style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#333' }}
        >
          비밀번호
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: 14,
            boxSizing: 'border-box',
          }}
        />
      </div>
      {error && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#d32f2f' }}>{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px',
          backgroundColor: '#0078d4',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 14,
          fontWeight: 500,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
