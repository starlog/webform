# @webform/server 기반 구조 계획

## 1. 개요

`@webform/server` 패키지의 기반 구조를 설계한다. Express 앱, 미들웨어 스택, MongoDB/Redis 연결, 라우터, 인증, WebSocket, 에러 핸들링 등 서버의 뼈대를 구성한다. PRD 섹션 3.1(기술 스택), 5.2(보안 요구사항)을 기반으로 한다.

## 2. 파일 구조

```
packages/server/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example                        # 환경 변수 템플릿
└── src/
    ├── index.ts                        # 진입점: 서버 시작 (listen, graceful shutdown)
    ├── app.ts                          # Express 앱 생성 + 미들웨어 + 라우터 마운트
    ├── config/
    │   └── env.ts                      # 환경 변수 로드 및 검증 (Zod)
    ├── db/
    │   ├── mongoose.ts                 # MongoDB 연결 관리
    │   └── redis.ts                    # Redis 연결 관리
    ├── middleware/
    │   ├── requestId.ts                # 요청 ID 미들웨어 (crypto.randomUUID)
    │   ├── auth.ts                     # JWT 인증 미들웨어
    │   └── errorHandler.ts             # 전역 에러 핸들러
    ├── routes/
    │   ├── index.ts                    # 라우터 통합 (/api 접두사)
    │   ├── health.ts                   # GET /health
    │   ├── forms.ts                    # /api/forms
    │   ├── runtime.ts                  # /api/runtime
    │   ├── datasources.ts              # /api/datasources
    │   └── projects.ts                 # /api/projects
    ├── websocket/
    │   ├── index.ts                    # WebSocket 서버 초기화
    │   ├── designerSync.ts             # /ws/designer/:formId
    │   └── runtimeEvents.ts            # /ws/runtime/:formId
    └── types/
        └── express.d.ts                # Express Request 타입 확장
```

## 3. 진입점 분리: `index.ts` / `app.ts`

### 3.1 `app.ts` — Express 앱 생성

Express 인스턴스를 생성하고 미들웨어와 라우터를 조립한다. 테스트에서 supertest로 직접 import할 수 있도록 앱 생성과 서버 시작을 분리한다.

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health';
import { apiRouter } from './routes/index';
import { env } from './config/env';

export function createApp() {
  const app = express();

  // --- 미들웨어 스택 (순서 중요) ---
  app.use(requestId);                                    // 1. 요청 ID 부여
  app.use(helmet());                                     // 2. 보안 헤더
  app.use(cors({
    origin: env.CORS_ORIGINS,                            // 3. CORS
    credentials: true,
  }));
  app.use(express.json({ limit: '5mb' }));               // 4. JSON 파싱 (폼 정의가 클 수 있음)
  app.use(morgan('short'));                               // 5. 요청 로깅

  // --- 라우트 ---
  app.use('/health', healthRouter);                      // 헬스체크 (인증 불필요)
  app.use('/api', apiRouter);                            // API 라우트

  // --- 에러 핸들링 (반드시 마지막) ---
  app.use(errorHandler);

  return app;
}
```

### 3.2 `index.ts` — 서버 시작 + Graceful Shutdown

```typescript
// src/index.ts
import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectMongo, disconnectMongo } from './db/mongoose';
import { connectRedis, disconnectRedis } from './db/redis';
import { initWebSocket } from './websocket/index';

async function main() {
  // 1. DB 연결
  await connectMongo();
  await connectRedis();

  // 2. HTTP 서버 생성
  const app = createApp();
  const server = http.createServer(app);

  // 3. WebSocket 서버 부착
  initWebSocket(server);

  // 4. 서버 시작
  server.listen(env.PORT, () => {
    console.log(`[server] listening on port ${env.PORT}`);
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close();
    await disconnectMongo();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
```

**설계 근거:**
- `app.ts`와 `index.ts`를 분리하여 테스트 시 `createApp()`만 import하면 supertest로 HTTP 테스트 가능
- `http.createServer(app)`으로 HTTP 서버를 직접 생성해야 같은 포트에 WebSocket을 붙일 수 있음
- Graceful shutdown으로 SIGTERM/SIGINT 수신 시 연결을 깨끗하게 정리

## 4. 환경 변수 설계

### 4.1 `config/env.ts` — Zod 기반 환경 변수 검증

```typescript
// src/config/env.ts
import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  // 서버
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  // MongoDB
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017/webform'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('7d'),

  // 암호화 (데이터소스 connectionString AES-256 암호화)
  ENCRYPTION_KEY: z.string().length(64),     // 32바이트 = 64 hex chars

  // CORS
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((v) => v.split(',')),

  // 샌드박스
  SANDBOX_TIMEOUT_MS: z.coerce.number().default(5000),
  SANDBOX_MEMORY_LIMIT_MB: z.coerce.number().default(128),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
```

### 4.2 `.env.example`

```env
# Server
NODE_ENV=development
PORT=4000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/webform

# Redis
REDIS_URL=redis://localhost:6379

# JWT (최소 32자 이상)
JWT_SECRET=change-me-to-a-secure-random-string-at-least-32-chars
JWT_EXPIRY=7d

# Encryption (32바이트 = 64자 hex 문자열, openssl rand -hex 32 로 생성)
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# CORS (콤마 구분)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Sandbox
SANDBOX_TIMEOUT_MS=5000
SANDBOX_MEMORY_LIMIT_MB=128
```

**설계 근거:**
- Zod로 서버 시작 시점에 환경 변수를 검증하여 잘못된 설정이면 즉시 실패(fail-fast)
- `JWT_SECRET`은 최소 32자 필수, `ENCRYPTION_KEY`는 정확히 64자(32바이트 hex) 필수
- `CORS_ORIGINS`는 콤마 구분 문자열을 배열로 변환하여 designer(3000), runtime(3001) 모두 허용
- 기본값이 있는 변수는 개발 환경에서 `.env` 없이도 동작 가능 (단, `JWT_SECRET`과 `ENCRYPTION_KEY`는 필수)

## 5. 미들웨어 스택

미들웨어 적용 순서는 다음과 같다. 순서가 중요하므로 변경하지 않는다.

```
요청 → requestId → helmet → cors → express.json → morgan → [라우트] → errorHandler → 응답
```

### 5.1 `middleware/requestId.ts` — 요청 ID

```typescript
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestId: RequestHandler = (req, _res, next) => {
  req.id = req.headers['x-request-id'] as string ?? randomUUID();
  next();
};
```

- 클라이언트가 `X-Request-Id` 헤더를 보내면 그 값을 사용하고, 없으면 서버에서 생성
- 로깅, 에러 추적, WebSocket 메시지 상관관계 추적에 활용

### 5.2 Helmet — 보안 HTTP 헤더

```typescript
app.use(helmet());
```

기본 설정으로 충분하다. 다음 헤더들이 자동 설정된다:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection`
- CSP (Content Security Policy)

### 5.3 CORS

```typescript
app.use(cors({
  origin: env.CORS_ORIGINS,    // ['http://localhost:3000', 'http://localhost:3001']
  credentials: true,            // JWT 쿠키/Authorization 헤더 허용
}));
```

- 개발 환경에서는 designer(3000), runtime(3001)만 허용
- 프로덕션에서는 환경 변수로 실제 도메인 지정

### 5.4 `express.json`

```typescript
app.use(express.json({ limit: '5mb' }));
```

- 폼 정의(FormDefinition)가 컨트롤 500개까지 포함할 수 있으므로 기본 100KB 대신 5MB로 설정
- PRD 5.1: 폼당 최대 500개 컨트롤 지원 요구사항 반영

### 5.5 Morgan — HTTP 요청 로깅

```typescript
app.use(morgan('short'));
```

- 개발 환경에서 간결한 요청 로그 출력
- 프로덕션에서는 필요 시 `'combined'`로 변경 가능

## 6. MongoDB 연결 관리

### 6.1 `db/mongoose.ts`

```typescript
import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectMongo(): Promise<void> {
  mongoose.connection.on('connected', () => {
    console.log('[mongo] connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('[mongo] disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, {
    // 연결 풀
    maxPoolSize: 10,               // 기본 커넥션 풀 크기
    minPoolSize: 2,                // 최소 유휴 커넥션

    // 타임아웃
    serverSelectionTimeoutMS: 5000, // 서버 선택 타임아웃
    socketTimeoutMS: 45000,         // 소켓 타임아웃

    // 재시도
    retryWrites: true,              // 쓰기 자동 재시도
    retryReads: true,               // 읽기 자동 재시도
  });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
```

**설계 근거:**
- `maxPoolSize: 10` — PRD 기준 동시 편집 100+, 동시 실행 1000+ 사용자를 고려하되, 단일 서버 인스턴스에서는 10개 풀이면 충분 (필요 시 스케일 아웃)
- `minPoolSize: 2` — 유휴 시에도 최소 2개 커넥션을 유지하여 콜드스타트 지연 방지
- `serverSelectionTimeoutMS: 5000` — MongoDB 서버가 응답하지 않을 때 5초 후 실패 (fail-fast)
- `retryWrites/retryReads: true` — 일시적 네트워크 장애 시 자동 재시도 (MongoDB 드라이버 기본 내장)
- Mongoose 이벤트 핸들러로 연결 상태 로깅

## 7. Redis 연결 관리

### 7.1 `db/redis.ts`

```typescript
import Redis from 'ioredis';
import { env } from '../config/env';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not connected. Call connectRedis() first.');
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,        // 요청당 최대 재시도
    retryStrategy(times) {
      if (times > 10) return null;  // 10회 초과 시 포기
      return Math.min(times * 200, 2000);  // 지수 백오프 (최대 2초)
    },
    lazyConnect: true,              // 명시적 connect() 호출 시 연결
  });

  redis.on('connect', () => console.log('[redis] connected'));
  redis.on('error', (err) => console.error('[redis] error:', err.message));
  redis.on('close', () => console.log('[redis] connection closed'));

  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
```

**설계 근거:**
- `lazyConnect: true` — 서버 시작 순서를 제어하기 위해 명시적 `connect()` 호출
- 지수 백오프 재시도 전략 — 200ms, 400ms, 600ms, ... 최대 2000ms로 증가, 10회 초과 시 포기
- `getRedis()` 함수로 Redis 인스턴스 접근 — 연결 전 사용 시 명확한 에러
- Redis는 현재 세션 저장, 캐시, 실시간 pub/sub에 활용 예정

## 8. 라우터 구조

### 8.1 `routes/index.ts` — 라우터 통합

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { formsRouter } from './forms';
import { runtimeRouter } from './runtime';
import { datasourcesRouter } from './datasources';
import { projectsRouter } from './projects';

export const apiRouter = Router();

// 모든 /api/* 라우트에 JWT 인증 적용
apiRouter.use(authenticate);

apiRouter.use('/forms', formsRouter);
apiRouter.use('/runtime', runtimeRouter);
apiRouter.use('/datasources', datasourcesRouter);
apiRouter.use('/projects', projectsRouter);
```

### 8.2 `routes/health.ts` — 헬스체크

```typescript
import { Router } from 'express';
import mongoose from 'mongoose';
import { getRedis } from '../db/redis';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;

  let redisOk = false;
  try {
    const pong = await getRedis().ping();
    redisOk = pong === 'PONG';
  } catch {
    redisOk = false;
  }

  const healthy = mongoOk && redisOk;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      mongo: mongoOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    },
  });
});
```

- 인증 없이 접근 가능 (로드밸런서/쿠버네티스 프로브용)
- MongoDB, Redis 연결 상태를 확인하여 `200 ok` 또는 `503 degraded` 반환

### 8.3 개별 라우터 스텁

이번 기반 구조 단계에서는 각 라우터를 빈 스텁으로만 생성한다. 실제 핸들러 구현은 후속 태스크에서 진행한다.

```typescript
// routes/forms.ts
import { Router } from 'express';

export const formsRouter = Router();

// GET    /api/forms            — 폼 목록 조회
// POST   /api/forms            — 새 폼 생성
// GET    /api/forms/:id        — 폼 정의 조회
// PUT    /api/forms/:id        — 폼 정의 수정
// DELETE /api/forms/:id        — 폼 삭제
// GET    /api/forms/:id/versions   — 버전 히스토리
// POST   /api/forms/:id/publish    — 폼 퍼블리시
```

```typescript
// routes/runtime.ts
import { Router } from 'express';

export const runtimeRouter = Router();

// GET    /api/runtime/forms/:id        — 런타임용 폼 정의 (published만)
// POST   /api/runtime/forms/:id/events — 서버 이벤트 실행
// POST   /api/runtime/forms/:id/data   — 데이터 바인딩 쿼리
```

```typescript
// routes/datasources.ts
import { Router } from 'express';

export const datasourcesRouter = Router();

// GET    /api/datasources              — 데이터소스 목록
// POST   /api/datasources              — 데이터소스 생성
// PUT    /api/datasources/:id          — 데이터소스 수정
// DELETE /api/datasources/:id          — 데이터소스 삭제
// POST   /api/datasources/:id/test     — 연결 테스트
// POST   /api/datasources/:id/query    — 쿼리 실행
```

```typescript
// routes/projects.ts
import { Router } from 'express';

export const projectsRouter = Router();

// GET    /api/projects            — 프로젝트 목록
// POST   /api/projects            — 프로젝트 생성
// GET    /api/projects/:id        — 프로젝트 상세
// DELETE /api/projects/:id        — 프로젝트 삭제
// GET    /api/projects/:id/export — 프로젝트 내보내기
// POST   /api/projects/import     — 프로젝트 가져오기
```

## 9. 전역 에러 핸들러

### 9.1 `middleware/errorHandler.ts`

```typescript
import type { ErrorRequestHandler } from 'express';

/** 비즈니스 로직에서 throw할 수 있는 커스텀 에러 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // AppError: 의도된 비즈니스 에러
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        requestId: req.id,
      },
    });
    return;
  }

  // Zod 검증 에러 (API 요청 body 검증 실패)
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.issues,
        requestId: req.id,
      },
    });
    return;
  }

  // SyntaxError: JSON 파싱 실패
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        message: 'Invalid JSON',
        requestId: req.id,
      },
    });
    return;
  }

  // 예상치 못한 에러
  console.error(`[error] requestId=${req.id}`, err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      requestId: req.id,
    },
  });
};
```

**설계 근거:**
- `AppError` 클래스로 비즈니스 에러(404 Not Found, 409 Conflict 등)를 타입 안전하게 처리
- Zod 검증 에러는 400으로 반환하되, 세부 필드 에러(`issues`)를 포함하여 클라이언트가 어떤 필드가 잘못되었는지 파악 가능
- 예상치 못한 에러는 500으로 반환하되, 내부 에러 메시지는 노출하지 않음 (보안)
- 모든 에러 응답에 `requestId`를 포함하여 디버깅 지원

## 10. JWT 인증 미들웨어

### 10.1 `middleware/auth.ts`

```typescript
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from './errorHandler';

export interface JwtPayload {
  sub: string;           // 사용자 ID
  role: string;          // 역할 (admin, editor, viewer)
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Missing or invalid Authorization header');
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
};
```

### 10.2 `types/express.d.ts` — Express Request 타입 확장

```typescript
import type { JwtPayload } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      id: string;            // requestId 미들웨어에서 설정
      user?: JwtPayload;     // auth 미들웨어에서 설정
    }
  }
}
```

**설계 근거:**
- `Bearer` 토큰 방식 — Authorization 헤더에서 JWT를 추출
- `/health` 엔드포인트는 인증 미들웨어 밖에 배치하여 인증 없이 접근 가능
- `/api/*` 라우트는 `apiRouter.use(authenticate)`로 일괄 적용
- `JwtPayload`에 `sub`(사용자 ID)와 `role`(역할)을 포함하여 RBAC 기반 권한 검사 가능
- PRD 5.2 RBAC 요구사항: 폼별 읽기/쓰기/실행 권한은 후속 구현에서 처리

## 11. WebSocket 서버 설정

### 11.1 `websocket/index.ts` — WebSocket 서버 초기화

```typescript
import type { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { handleDesignerConnection } from './designerSync';
import { handleRuntimeConnection } from './runtimeEvents';

export function initWebSocket(server: Server): void {
  // 디자이너 실시간 동기화
  const designerWss = new WebSocketServer({ noServer: true });
  designerWss.on('connection', handleDesignerConnection);

  // 런타임 이벤트 통신
  const runtimeWss = new WebSocketServer({ noServer: true });
  runtimeWss.on('connection', handleRuntimeConnection);

  // HTTP upgrade 이벤트에서 경로 기반 라우팅
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname.startsWith('/ws/designer/')) {
      designerWss.handleUpgrade(req, socket, head, (ws) => {
        designerWss.emit('connection', ws, req);
      });
    } else if (pathname.startsWith('/ws/runtime/')) {
      runtimeWss.handleUpgrade(req, socket, head, (ws) => {
        runtimeWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  console.log('[ws] WebSocket server initialized');
}
```

### 11.2 `websocket/designerSync.ts` — 디자이너 동기화 스텁

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

/** formId별 연결된 클라이언트 Map */
const rooms = new Map<string, Set<WebSocket>>();

export function handleDesignerConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  // room에 추가
  if (!rooms.has(formId)) {
    rooms.set(formId, new Set());
  }
  rooms.get(formId)!.add(ws);

  ws.on('message', (data) => {
    // 같은 room의 다른 클라이언트에게 브로드캐스트
    const clients = rooms.get(formId);
    if (!clients) return;

    for (const client of clients) {
      if (client !== ws && client.readyState === ws.OPEN) {
        client.send(data);
      }
    }
  });

  ws.on('close', () => {
    rooms.get(formId)?.delete(ws);
    if (rooms.get(formId)?.size === 0) {
      rooms.delete(formId);
    }
  });
}
```

### 11.3 `websocket/runtimeEvents.ts` — 런타임 이벤트 스텁

```typescript
import type { WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';

export function handleRuntimeConnection(ws: WebSocket, req: IncomingMessage): void {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const formId = url.pathname.split('/').pop() ?? '';

  ws.on('message', async (data) => {
    // 이벤트 핸들러 실행 로직은 후속 태스크(EventEngine)에서 구현
    // 현재는 echo로 동작
    try {
      const message = JSON.parse(data.toString());
      ws.send(JSON.stringify({
        type: 'eventResult',
        payload: {
          success: true,
          patches: [],
          _echo: message,
        },
      }));
    } catch {
      ws.send(JSON.stringify({
        type: 'error',
        payload: { code: 'INVALID_MESSAGE', message: 'Invalid JSON' },
      }));
    }
  });

  ws.on('close', () => {
    // 정리 로직
  });
}
```

**설계 근거:**
- `noServer: true` + `server.on('upgrade')` 패턴으로 하나의 HTTP 서버에서 경로 기반으로 2개의 WebSocket 서버를 분리
- 디자이너 WebSocket: `rooms` Map으로 formId별 클라이언트를 관리, 변경사항 브로드캐스트 (PRD: 다중 사용자 동시 편집)
- 런타임 WebSocket: EventRequest → EventEngine 실행 → UIPatch 반환 (후속 구현)
- `@webform/common`의 `DesignerWsMessage`, `RuntimeWsMessage` 타입을 활용하여 타입 안전한 메시지 처리

## 12. package.json 의존성

```json
{
  "name": "@webform/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --build",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@webform/common": "workspace:*",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "helmet": "^8.0.0",
    "ioredis": "^5.4.0",
    "jsonwebtoken": "^9.0.0",
    "mongoose": "^8.9.0",
    "morgan": "^1.10.0",
    "ws": "^8.18.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/morgan": "^1.9.9",
    "@types/ws": "^8.5.13",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**참고:** `isolated-vm`은 서버 이벤트 엔진(EventEngine) 구현 시 추가한다. 기반 구조 단계에서는 포함하지 않는다.

## 13. 구현 순서

| 단계 | 파일 | 설명 |
|------|------|------|
| 1 | `config/env.ts` | 환경 변수 로드/검증 (다른 모든 모듈이 의존) |
| 2 | `types/express.d.ts` | Express 타입 확장 |
| 3 | `db/mongoose.ts` | MongoDB 연결 |
| 4 | `db/redis.ts` | Redis 연결 |
| 5 | `middleware/requestId.ts` | 요청 ID 미들웨어 |
| 6 | `middleware/errorHandler.ts` | 전역 에러 핸들러 (AppError 포함) |
| 7 | `middleware/auth.ts` | JWT 인증 미들웨어 |
| 8 | `routes/health.ts` | 헬스체크 엔드포인트 |
| 9 | `routes/forms.ts`, `runtime.ts`, `datasources.ts`, `projects.ts` | 라우터 스텁 |
| 10 | `routes/index.ts` | 라우터 통합 |
| 11 | `websocket/designerSync.ts` | 디자이너 WebSocket |
| 12 | `websocket/runtimeEvents.ts` | 런타임 WebSocket |
| 13 | `websocket/index.ts` | WebSocket 서버 초기화 |
| 14 | `app.ts` | Express 앱 조립 |
| 15 | `index.ts` | 서버 시작 + Graceful Shutdown |
| 16 | `package.json`, `tsconfig.json`, `.env.example` | 패키지 설정 |
| 17 | 테스트 | health, auth, errorHandler 단위 테스트 |

## 14. 테스트 전략

### 14.1 단위 테스트 (vitest)

```
packages/server/src/__tests__/
├── config/
│   └── env.test.ts              # 환경 변수 검증 테스트
├── middleware/
│   ├── requestId.test.ts        # 요청 ID 생성/전달 테스트
│   ├── auth.test.ts             # JWT 검증 성공/실패/만료 테스트
│   └── errorHandler.test.ts     # AppError, ZodError, 500 에러 테스트
└── routes/
    └── health.test.ts           # 헬스체크 200/503 테스트
```

### 14.2 통합 테스트

```typescript
// supertest로 app.ts 직접 테스트
import { createApp } from '../app';
import request from 'supertest';

const app = createApp();

test('GET /health returns 200', async () => {
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('GET /api/forms without auth returns 401', async () => {
  const res = await request(app).get('/api/forms');
  expect(res.status).toBe(401);
});
```

## 15. 추후 확장 고려사항

이번 기반 구조에서는 다루지 않지만, 후속 태스크에서 고려할 사항들:

- **Rate Limiting**: `express-rate-limit` 미들웨어 추가 (API 남용 방지)
- **Request Validation**: Zod 스키마를 사용한 요청 body/params/query 검증 미들웨어
- **RBAC Middleware**: `req.user.role` 기반 권한 검사 미들웨어
- **WebSocket 인증**: 연결 시 JWT 토큰 검증 (query string 또는 첫 메시지)
- **Redis Pub/Sub**: 다중 서버 인스턴스 간 WebSocket 메시지 동기화
- **Logging**: 구조화된 JSON 로깅 (pino 등)
- **Metrics**: Prometheus 메트릭 엔드포인트
