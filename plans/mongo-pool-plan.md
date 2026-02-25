# MongoDB 연결 풀링 수정 계획

## 1. 현재 문제 분석

### 1.1 MongoDBAdapter 현재 구현 (`packages/server/src/services/adapters/MongoDBAdapter.ts`)

모든 쿼리 메서드(`executeQuery`, `countDocuments`, `insertOne`, `updateOne`, `deleteOne`)가 동일한 안티패턴을 사용:

```ts
const client = new MongoClient(this.connectionString, { ... });
try {
  await client.connect();
  // 쿼리 실행
} finally {
  await client.close();
}
```

**문제점:**
- 매 요청마다 TCP 핸드셰이크 + TLS 협상 + MongoDB 인증이 반복됨
- MongoDB Node.js 드라이버의 내장 연결 풀이 전혀 활용되지 않음 (생성 즉시 파괴)
- `testConnection()`도 별도 클라이언트를 생성하여 테스트 후 즉시 닫음
- 클래스에 `client` 인스턴스 필드가 있으나 (`line:9`) 실제로 사용되지 않음 (dead code)

### 1.2 사용처 분석

**DataSourceService** (`packages/server/src/services/DataSourceService.ts`):
- `createAdapter()` (line:228)에서 매번 `new MongoDBAdapter(connectionString, database)` 생성
- `executeQuery()`, `testConnection()`에서 어댑터 사용 후 `adapter.disconnect()` 호출
- 어댑터가 일회성으로 생성→사용→폐기됨

**runtime.ts 라우터** (`packages/server/src/routes/runtime.ts`):
- 5개 엔드포인트(`test-connection`, `query`, `insert`, `update`, `delete`)에서 직접 `new MongoDBAdapter()` 생성
- 각 요청마다 새 인스턴스 → 새 연결 → 쿼리 → 연결 종료
- `query` 엔드포인트는 `executeQuery`와 `countDocuments`를 `Promise.all`로 병렬 실행하는데, 각각 별도 클라이언트를 생성하여 총 2개 연결이 동시에 열림

### 1.3 영향도

- 동시 사용자 증가 시 MongoDB 서버의 연결 수가 급증
- 각 요청에 연결 오버헤드 추가 (수십~수백ms)
- MongoDB Atlas 등 클라우드 환경에서 연결 수 제한에 빠르게 도달

---

## 2. 수정 설계

### 2.1 핵심 전략: 모듈 레벨 MongoClient 캐시

MongoDB Node.js 드라이버의 `MongoClient`는 내부적으로 연결 풀을 관리한다. 동일한 connectionString에 대해 하나의 `MongoClient` 인스턴스를 재사용하면 풀링이 자동으로 작동한다.

### 2.2 MongoClientPool 모듈 신규 생성

**파일:** `packages/server/src/services/adapters/MongoClientPool.ts`

```ts
import { MongoClient, type MongoClientOptions } from 'mongodb';

const DEFAULT_OPTIONS: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  maxIdleTimeMS: 60_000,
  retryWrites: true,
  retryReads: true,
};

// connectionString → MongoClient 캐시
const clientCache = new Map<string, MongoClient>();

/**
 * connectionString 기반으로 MongoClient 싱글톤을 반환한다.
 * 동일한 connectionString에 대해 항상 같은 클라이언트를 재사용한다.
 * MongoClient는 connect()를 명시적으로 호출하지 않아도 첫 쿼리 시 자동 연결된다.
 */
export function getMongoClient(connectionString: string): MongoClient {
  let client = clientCache.get(connectionString);
  if (!client) {
    client = new MongoClient(connectionString, DEFAULT_OPTIONS);
    clientCache.set(connectionString, client);
  }
  return client;
}

/**
 * 특정 connectionString의 클라이언트를 캐시에서 제거하고 연결을 닫는다.
 * 연결 오류 발생 시 해당 클라이언트를 교체하기 위해 사용.
 */
export async function evictMongoClient(connectionString: string): Promise<void> {
  const client = clientCache.get(connectionString);
  if (client) {
    clientCache.delete(connectionString);
    await client.close().catch(() => {});
  }
}

/**
 * 모든 캐시된 MongoClient를 닫고 캐시를 비운다.
 * 앱 종료(graceful shutdown) 시 호출.
 */
export async function closeAllMongoClients(): Promise<void> {
  const closePromises = Array.from(clientCache.values()).map(
    (client) => client.close().catch(() => {}),
  );
  await Promise.all(closePromises);
  clientCache.clear();
}
```

**설계 포인트:**
- `Map<connectionString, MongoClient>` 구조로 다중 데이터소스의 서로 다른 MongoDB 인스턴스 지원
- MongoDB 드라이버 4.x+에서 `client.connect()`는 명시적 호출 불필요 (첫 operation 시 자동 연결)
- `evictMongoClient()`: 특정 연결에 문제가 생겼을 때 해당 클라이언트만 교체 가능
- `closeAllMongoClients()`: graceful shutdown 시 전체 정리

### 2.3 MongoDBAdapter 수정

```ts
import { MongoClient } from 'mongodb';
import { sanitizeQueryInput } from '@webform/common';
import { AppError } from '../../middleware/errorHandler.js';
import type { DataSourceAdapter } from './types.js';
import { getMongoClient, evictMongoClient } from './MongoClientPool.js';

const QUERY_TIMEOUT_MS = 10_000;

export class MongoDBAdapter implements DataSourceAdapter {
  constructor(
    private connectionString: string,
    private database: string,
  ) {}

  private get db() {
    return getMongoClient(this.connectionString).db(this.database);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // testConnection은 일회성 클라이언트 사용 (풀 캐시에 넣지 않음)
      const client = new MongoClient(this.connectionString, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      try {
        await client.connect();
        await client.db(this.database).command({ ping: 1 });
        return { success: true, message: 'Connection successful' };
      } finally {
        await client.close();
      }
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const { collection, filter = {}, projection, limit = 100, skip = 0 } = query as { ... };
    if (!collection || typeof collection !== 'string') {
      throw new AppError(400, 'collection is required');
    }
    const sanitizedFilter = sanitizeQueryInput(filter);
    return this.db
      .collection(collection)
      .find(sanitizedFilter, { projection, maxTimeMS: QUERY_TIMEOUT_MS })
      .skip(skip)
      .limit(Math.min(limit, 1000))
      .toArray();
  }

  async countDocuments(collection: string, filter: Record<string, unknown> = {}): Promise<number> {
    const sanitizedFilter = sanitizeQueryInput(filter);
    return this.db.collection(collection).countDocuments(sanitizedFilter, {
      maxTimeMS: QUERY_TIMEOUT_MS,
    });
  }

  async insertOne(collection: string, document: Record<string, unknown>): Promise<{ insertedId: string }> {
    const result = await this.db.collection(collection).insertOne(document);
    return { insertedId: result.insertedId.toString() };
  }

  async updateOne(collection: string, filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }> {
    const result = await this.db.collection(collection).updateOne(filter, { $set: update });
    return { modifiedCount: result.modifiedCount };
  }

  async deleteOne(collection: string, filter: Record<string, unknown>): Promise<{ deletedCount: number }> {
    const result = await this.db.collection(collection).deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }

  async disconnect(): Promise<void> {
    // 풀링 방식에서는 개별 어댑터가 클라이언트를 닫지 않음 (no-op)
    // 클라이언트 생명주기는 MongoClientPool에서 관리
  }
}
```

**주요 변경점:**
1. `private client` 인스턴스 필드 제거 (dead code)
2. `private get db()` getter로 풀에서 클라이언트를 가져와 db 인스턴스 반환
3. 각 메서드에서 `new MongoClient()` → `client.connect()` → `client.close()` 패턴 제거
4. `disconnect()`는 no-op (풀 관리는 MongoClientPool이 담당)
5. `testConnection()`만 일회성 클라이언트 유지 — 연결 가능 여부만 확인하는 진단용이므로 풀에 넣을 필요 없음

### 2.4 DataSourceService 수정

**변경 없음.** `createAdapter()`에서 `new MongoDBAdapter(connectionString, database)`를 생성하는 코드는 그대로 유지. MongoDBAdapter 내부에서 풀을 사용하므로 외부 인터페이스 변경 불필요.

`disconnect()` 호출도 그대로 유지 (no-op이 되므로 해가 없음).

### 2.5 runtime.ts 라우터 수정

**변경 없음.** 동일한 이유로 인터페이스가 유지되므로 호출 코드 수정 불필요.

### 2.6 Graceful Shutdown 연동

**파일:** `packages/server/src/index.ts`

```ts
import { closeAllMongoClients } from './services/adapters/MongoClientPool.js';

// shutdown 함수 내부에 추가:
const shutdown = async (signal: string) => {
  console.log(`[server] ${signal} received, shutting down...`);
  server.close();
  await disconnectMongo();       // Mongoose 연결 (기존)
  await closeAllMongoClients();  // 데이터소스용 MongoClient 풀 (추가)
  await disconnectRedis();
  process.exit(0);
};
```

---

## 3. 연결 에러 시 재연결 전략

MongoDB Node.js 드라이버는 자체적으로 재연결을 처리한다:
- `retryWrites: true`, `retryReads: true` 옵션으로 일시적 네트워크 오류 시 자동 재시도
- 서버 선택 실패 시 `serverSelectionTimeoutMS` 동안 재시도

추가 방어 전략 (필요 시):
- `MongoServerError` 또는 `MongoNetworkError` 발생 시 `evictMongoClient(connectionString)` 호출하여 해당 클라이언트를 교체
- 다음 요청 시 `getMongoClient()`가 새 클라이언트를 자동 생성

---

## 4. 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `packages/server/src/services/adapters/MongoClientPool.ts` | **신규 생성** — 모듈 레벨 MongoClient 캐시 |
| `packages/server/src/services/adapters/MongoDBAdapter.ts` | 풀에서 클라이언트를 가져오도록 수정 |
| `packages/server/src/index.ts` | shutdown에 `closeAllMongoClients()` 추가 |
| `packages/server/src/services/DataSourceService.ts` | 변경 없음 |
| `packages/server/src/routes/runtime.ts` | 변경 없음 |

---

## 5. 테스트 계획

### 5.1 단위 테스트 (`MongoClientPool.test.ts`)
- `getMongoClient()`: 동일 connectionString에 같은 인스턴스 반환 확인
- `getMongoClient()`: 서로 다른 connectionString에 다른 인스턴스 반환 확인
- `evictMongoClient()`: 캐시에서 제거 후 새 인스턴스 반환 확인
- `closeAllMongoClients()`: 모든 클라이언트 close 호출 확인

### 5.2 기존 테스트 호환성
- `MongoDBAdapter.test.ts`: 기존 sanitizeFilter 테스트는 MongoClient를 사용하지 않으므로 영향 없음
- 기존 `disconnect()` 호출 코드가 no-op이 되므로 인터페이스 호환성 유지

### 5.3 통합 테스트 확인 사항
- 동시 다수 요청 시 연결 수가 풀 사이즈 이내로 유지되는지 확인
- 서버 종료 시 모든 연결이 정상 해제되는지 확인

---

## 6. 성능 개선 기대치

| 항목 | Before | After |
|------|--------|-------|
| 요청당 연결 | 새 TCP+TLS+Auth | 풀에서 재사용 |
| 연결 오버헤드 | 50~200ms | ~0ms (풀 재사용) |
| 동시 연결 수 | 요청 수만큼 무제한 증가 | maxPoolSize(10)로 제한 |
| MongoDB 서버 부하 | 높음 | 낮음 |

---

## 7. 구현 순서

1. `MongoClientPool.ts` 신규 생성
2. `MongoDBAdapter.ts` 수정 — 풀 사용으로 전환
3. `index.ts` 수정 — graceful shutdown에 `closeAllMongoClients()` 추가
4. `MongoClientPool.test.ts` 단위 테스트 작성
5. 기존 테스트 실행하여 호환성 확인
6. 전체 빌드 및 린트 확인
