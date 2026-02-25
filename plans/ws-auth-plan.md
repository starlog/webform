# WebSocket 인증 계획

## 1. 현황 분석

### 1.1 문제점

서버의 3개 WebSocket 엔드포인트에 인증이 없음:
- `/ws/designer/:formId` — 디자이너 실시간 동기화
- `/ws/runtime/:formId` — 런타임 폼 이벤트
- `/ws/runtime/app/:projectId` — 런타임 앱(셸) 이벤트

`formId`/`projectId`만 알면 누구나 연결하여 폼 데이터를 수신하거나 이벤트를 실행할 수 있는 **보안 취약점**.

### 1.2 현재 서버 WebSocket 구조

```
packages/server/src/websocket/
├── index.ts          # initWebSocket() — HTTP upgrade 핸들러, 3개 WSS 분기
├── designerSync.ts   # handleDesignerConnection() — 디자이너 동기화 (room 브로드캐스트)
├── runtimeEvents.ts  # handleRuntimeConnection() — 런타임 폼 이벤트 처리
└── appEvents.ts      # handleAppConnection() — 런타임 앱/셸 이벤트 처리
```

**`index.ts`의 upgrade 핸들러** (`server.on('upgrade', ...)`)에서 URL 패턴만 매칭하여 바로 `handleUpgrade()` 호출. 토큰 검증 없음.

### 1.3 현재 REST API 인증

- **미들웨어**: `packages/server/src/middleware/auth.ts`
- **방식**: `Authorization: Bearer <jwt>` 헤더 → `jwt.verify(token, env.JWT_SECRET)` → `req.user = { sub, role }`
- **JWT 설정**: `env.JWT_SECRET` (32자 이상), `env.JWT_EXPIRY` (기본 `7d`)
- **적용 범위**: `apiRouter`에서 `/runtime`, `/debug` 제외 나머지 라우트에 `authenticate` 미들웨어 적용
- **개발용 토큰**: `POST /auth/dev-token` → `{ sub: 'dev-designer', role: 'admin' }` JWT 발급

### 1.4 클라이언트 WebSocket 코드

**Runtime** (`packages/runtime/src/communication/wsClient.ts`):
- `WsClient` 클래스의 `connect(formId)`, `connectApp(projectId)` 메서드
- `new WebSocket(url)` 직접 생성, query string 없음
- 5초 후 자동 재연결 (`onclose` → `setTimeout(reconnect, 5000)`)
- 사용처: `App.tsx`, `AppContainer.tsx`

**Designer**:
- WebSocket 클라이언트 코드 **아직 미구현** (서버에 `handleDesignerConnection` 존재하나 클라이언트 없음)

---

## 2. 인증 전략

### 2.1 접근 방식: Query String 토큰

WebSocket은 HTTP 업그레이드 핸드셰이크 과정에서 커스텀 헤더 설정이 제한적이므로 (브라우저 `WebSocket` API는 `Authorization` 헤더 설정 불가), **query string으로 JWT 토큰을 전달**.

```
ws://host/ws/designer/:formId?token=<jwt>
ws://host/ws/runtime/:formId?token=<jwt>
ws://host/ws/runtime/app/:projectId?token=<jwt>
```

### 2.2 서버 인증 흐름

```
클라이언트 → HTTP Upgrade 요청 (?token=xxx)
    → server.on('upgrade') 핸들러
        → URL에서 token 쿼리 파라미터 추출
        → jwt.verify(token, JWT_SECRET)
        → 실패 시: socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy()
        → 성공 시: handleUpgrade() 진행, connection 핸들러에 user 정보 전달
```

### 2.3 엔드포인트별 인증 정책

| 엔드포인트 | 인증 필수 | 역할 요구사항 | 비고 |
|---|---|---|---|
| `/ws/designer/:formId` | O | `admin` 또는 `editor` | 폼 편집 권한 필요 |
| `/ws/runtime/:formId` | 조건부 | 없음 (인증된 사용자) | published 폼은 인증 사용자 모두 접근 |
| `/ws/runtime/app/:projectId` | 조건부 | 없음 (인증된 사용자) | published 앱은 인증 사용자 모두 접근 |

> **런타임 엔드포인트 참고**: 현재 REST API의 `/api/runtime/*`은 공개(인증 없이 접근 가능)로 설정됨. WebSocket에도 동일 정책을 적용할지는 프로젝트 보안 요구사항에 따라 결정. 이 계획에서는 **일관성을 위해 WebSocket에는 인증을 적용**하되, 런타임 REST API는 기존 정책 유지.

### 2.4 토큰 만료 처리

1. **연결 시 검증**: 업그레이드 핸드셰이크에서 토큰 유효성 검증
2. **연결 중 만료**: 연결 후에는 토큰이 만료되더라도 기존 연결을 즉시 끊지 않음 (이미 인증된 세션)
3. **재연결 시 갱신**: 클라이언트의 자동 재연결(5초 후) 시점에 새 토큰으로 연결 시도
4. **향후 확장**: 필요 시 서버에서 주기적으로 토큰 유효성을 체크하고 만료 시 `1008 Policy Violation`으로 강제 종료하는 로직 추가 가능

---

## 3. 수정 계획

### 3.1 서버: WebSocket 인증 미들웨어 (`packages/server`)

#### 3.1.1 `src/websocket/auth.ts` (신규)

```typescript
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import type { JwtPayload } from '../middleware/auth.js';

/**
 * WebSocket 업그레이드 요청에서 JWT 토큰을 검증한다.
 * 성공 시 JwtPayload 반환, 실패 시 소켓에 401 응답 후 null 반환.
 */
export function authenticateWsUpgrade(
  req: IncomingMessage,
  socket: Duplex,
): JwtPayload | null {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return null;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return payload;
  } catch {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return null;
  }
}
```

#### 3.1.2 `src/websocket/index.ts` (수정)

upgrade 핸들러에 인증 로직 추가:

```typescript
import { authenticateWsUpgrade } from './auth.js';

// server.on('upgrade') 내부 수정
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // JWT 토큰 검증
  const user = authenticateWsUpgrade(req, socket);
  if (!user) return; // 인증 실패 → 소켓 이미 파괴됨

  // (req as any).user = user 형태로 핸들러에 전달
  (req as any).user = user;

  if (pathname.startsWith('/ws/designer/')) {
    designerWss.handleUpgrade(req, socket, head, (ws) => {
      designerWss.emit('connection', ws, req);
    });
  } else if (pathname.startsWith('/ws/runtime/app/')) {
    appWss.handleUpgrade(req, socket, head, (ws) => {
      appWss.emit('connection', ws, req);
    });
  } else if (pathname.startsWith('/ws/runtime/')) {
    runtimeWss.handleUpgrade(req, socket, head, (ws) => {
      runtimeWss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});
```

#### 3.1.3 연결 핸들러에서 user 정보 활용 (선택적 확장)

`designerSync.ts`, `runtimeEvents.ts`, `appEvents.ts`의 `handleXxxConnection(ws, req)` 내부에서 `(req as any).user`로 사용자 정보 접근 가능. 현재 단계에서는 인증 통과 여부만 확인하고, 역할 기반 접근 제어는 향후 구현.

### 3.2 클라이언트: Runtime (`packages/runtime`)

#### 3.2.1 `src/communication/wsClient.ts` (수정)

토큰을 query string에 포함하는 기능 추가:

```typescript
class WsClient {
  private ws: WebSocket | null = null;
  private listeners: WsEventCallback[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPath: string | null = null;
  private tokenProvider: (() => string | null) | null = null;

  /** 토큰 제공 함수 설정 */
  setTokenProvider(provider: () => string | null): void {
    this.tokenProvider = provider;
  }

  connect(formId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = `/ws/runtime/${formId}`;
    this.currentPath = path;
    const url = this.buildUrl(protocol, path);
    this.setupWebSocket(url, () => this.connect(formId));
  }

  connectApp(projectId: string): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const path = `/ws/runtime/app/${projectId}`;
    this.currentPath = path;
    const url = this.buildUrl(protocol, path);
    this.setupWebSocket(url, () => this.connectApp(projectId));
  }

  private buildUrl(protocol: string, path: string): string {
    const base = `${protocol}//${window.location.host}${path}`;
    const token = this.tokenProvider?.();
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  // ... 나머지 메서드 동일
}
```

#### 3.2.2 토큰 관리

Runtime 앱 초기화 시점에서 `wsClient.setTokenProvider()` 호출:

```typescript
// App.tsx 또는 AppContainer.tsx 초기화 부분
import { wsClient } from './communication/wsClient';

// 토큰은 로컬 스토리지, URL 파라미터, 또는 별도 인증 흐름으로 확보
wsClient.setTokenProvider(() => localStorage.getItem('auth_token'));
```

### 3.3 클라이언트: Designer (`packages/designer`)

Designer에는 현재 WebSocket 클라이언트가 미구현. 향후 디자이너 실시간 동기화 구현 시 Runtime과 동일한 패턴으로 `wsClient`를 생성하되, `setTokenProvider()`로 JWT 토큰을 전달.

Designer는 REST API 호출 시 이미 `Authorization: Bearer` 헤더를 사용하고 있으므로, 동일한 토큰을 WebSocket query string에도 재사용.

---

## 4. 파일 변경 목록

| 파일 | 변경 유형 | 설명 |
|---|---|---|
| `packages/server/src/websocket/auth.ts` | 신규 | WebSocket 업그레이드 JWT 인증 함수 |
| `packages/server/src/websocket/index.ts` | 수정 | upgrade 핸들러에 인증 로직 삽입 |
| `packages/runtime/src/communication/wsClient.ts` | 수정 | `setTokenProvider()`, `buildUrl()` 추가 |
| `packages/runtime/src/App.tsx` | 수정 | `wsClient.setTokenProvider()` 호출 추가 |
| `packages/runtime/src/renderer/AppContainer.tsx` | 수정 | `wsClient.setTokenProvider()` 호출 추가 |

---

## 5. 테스트 계획

### 5.1 서버 단위 테스트

- `authenticateWsUpgrade()`: 유효한 토큰 → JwtPayload 반환
- `authenticateWsUpgrade()`: 토큰 없음 → socket.destroy() 호출, null 반환
- `authenticateWsUpgrade()`: 만료된 토큰 → socket.destroy() 호출, null 반환
- `authenticateWsUpgrade()`: 잘못된 토큰 → socket.destroy() 호출, null 반환

### 5.2 통합 테스트

- 토큰 없이 WebSocket 연결 시도 → 연결 거부 확인
- 유효한 토큰으로 WebSocket 연결 → 정상 동작 확인
- 만료된 토큰으로 재연결 시도 → 거부 확인

### 5.3 기존 테스트 영향

- Runtime의 `AppContainer.test.tsx`에서 wsClient를 모킹하고 있으므로 기존 테스트에 영향 없음
- 서버 테스트에서 WebSocket 연결 테스트가 있다면 토큰 전달 추가 필요

---

## 6. 고려사항

### 6.1 보안

- Query string의 토큰은 서버 액세스 로그에 노출될 수 있음 → 프로덕션에서 URL 로깅 시 토큰 마스킹 권장
- HTTPS(WSS) 사용 필수 → 평문 전송 시 토큰 탈취 위험

### 6.2 하위 호환성

- 런타임 REST API(`/api/runtime/*`)는 현재 공개 상태이나 WebSocket에만 인증 적용
- 개발 환경에서 `POST /auth/dev-token`으로 발급된 토큰을 WebSocket 인증에도 사용 가능

### 6.3 향후 확장

- **역할 기반 접근 제어**: 디자이너 WebSocket은 `admin`/`editor` 역할만 허용
- **연결 중 토큰 갱신**: 클라이언트에서 `refresh` 메시지로 새 토큰 전송, 서버에서 갱신
- **Rate limiting**: 동일 사용자의 과도한 연결 시도 제한
