interface LoginRequiredPageProps {
  loginUrl: string;
  errorMessage?: string;
}

export function LoginRequiredPage({ loginUrl, errorMessage }: LoginRequiredPageProps) {
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
          이 앱에 접근하려면 Google 계정으로 로그인하세요.
        </p>
        {errorMessage && (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#d32f2f' }}>
            {errorMessage}
          </p>
        )}
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
      </div>
    </div>
  );
}
