# PostgreSQL 어댑터 설계 계획

## 1. 현재 코드 분석

### 1.1 BaseSqlAdapter (`adapters/BaseSqlAdapter.ts`)

`BaseSqlAdapter`는 SQL 계열 DB 어댑터의 공통 추상 클래스로, 이미 구현 완료 상태:

```typescript
export abstract class BaseSqlAdapter implements DataSourceAdapter {
  async testConnection()    // SELECT 1로 연결 테스트
  async executeQuery(query) // table, filter, columns, limit, offset 기반 SELECT
  protected buildSelectQuery(opts) // SQL 문자열 + params 빌딩

  // 서브클래스가 구현해야 할 추상 메서드
  protected abstract escapeId(identifier: string): string;
  protected abstract placeholder(index: number): string;
  protected abstract rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>;
  abstract disconnect(): Promise<void>;
}
```

**SqlConnectionOptions** 인터페이스도 동일 파일에 정의됨:
```typescript
export interface SqlConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | Record<string, unknown>;
}
```

### 1.2 AdapterFactory (`AdapterRegistry.ts`)

```typescript
export interface AdapterFactory {
  dialect: string;
  displayName: string;
  create(config: Record<string, unknown>): DataSourceAdapter;
}
```

PostgreSQLAdapterFactory는 이 인터페이스를 구현하여 `adapterRegistry`에 등록한다.

### 1.3 어댑터 등록 현황 (`adapters/index.ts`)

현재 MongoDBAdapter만 등록됨:
```typescript
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
adapterRegistry.register(MongoDBAdapterFactory);
```

### 1.4 현재 의존성 (`package.json`)

`pg` 패키지가 없음. `mongodb` 7.1.0, `mongoose` 8.9.0은 있음.
`@types/pg`도 없음.

---

## 2. pg 패키지 Pool 설정 옵션

### 2.1 의존성 설치

```bash
pnpm --filter @webform/server add pg
pnpm --filter @webform/server add -D @types/pg
```

### 2.2 Pool 생성자 옵션

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: config.host,
  port: config.port,          // 기본값: 5432
  user: config.user,
  password: config.password,
  database: config.database,
  ssl: /* SSL 설정 (아래 섹션 참조) */,

  // 연결 풀 설정
  max: 10,                    // 최대 동시 연결 수
  idleTimeoutMillis: 60000,   // 유휴 연결 제거 대기 시간 (60초)
  connectionTimeoutMillis: 10000, // 새 연결 획득 타임아웃 (10초)
});
```

### 2.3 Pool 옵션 상세

| 옵션 | 값 | 설명 |
|------|-----|------|
| `max` | `10` | 최대 동시 연결 수. WebForm은 데이터소스 조회용이므로 10개로 충분 |
| `idleTimeoutMillis` | `60000` | 유휴 연결 60초 후 자동 제거. 리소스 누수 방지 |
| `connectionTimeoutMillis` | `10000` | 연결 획득 시 10초 타임아웃. 네트워크 문제 시 빠르게 실패 |

**설계 근거**:
- MongoDBAdapter의 `testConnection()`이 `connectTimeoutMS: 5000`을 사용하므로, 일반 쿼리용 풀은 10초로 여유를 줌
- `max: 10`은 pg 패키지 기본값과 동일하며, SDUI 런타임의 데이터소스 조회 빈도에 적합

---

## 3. SSL 연결 처리 방법

### 3.1 SqlConnectionOptions.ssl 타입 매핑

`SqlConnectionOptions.ssl`은 `boolean | Record<string, unknown>` 타입:

```typescript
// PostgreSQLAdapter 생성자에서의 SSL 변환 로직
private buildSslConfig(ssl?: boolean | Record<string, unknown>) {
  if (!ssl) return undefined;           // SSL 비활성화
  if (ssl === true) {
    return { rejectUnauthorized: false }; // 간편 SSL (자체 서명 인증서 허용)
  }
  return ssl;                           // 상세 SSL 객체 전달
}
```

### 3.2 SSL 시나리오별 동작

| `ssl` 값 | Pool.ssl 설정 | 사용 사례 |
|-----------|---------------|-----------|
| `undefined` / `false` | `undefined` | 로컬 개발, 내부 네트워크 |
| `true` | `{ rejectUnauthorized: false }` | 클라우드 DB (AWS RDS, Supabase 등) — 자체 서명 인증서 허용 |
| `{ rejectUnauthorized: true, ca: '...' }` | 객체 그대로 전달 | 프로덕션 — CA 인증서 검증 필요 |

### 3.3 설계 결정

- `rejectUnauthorized: false`가 기본 `true` SSL 동작인 이유: WebForm은 사용자가 직접 데이터소스를 설정하는 로우코드 플랫폼. 대부분의 클라우드 PostgreSQL은 자체 서명 인증서를 사용하므로, `true` 옵션으로 간편하게 SSL을 활성화할 수 있어야 함
- 보안이 중요한 환경에서는 `ssl` 필드에 `Record<string, unknown>` 객체를 전달하여 CA 인증서 검증 가능

---

## 4. 에러 처리 전략

### 4.1 pg 에러 코드 분류

PostgreSQL의 에러는 `pg` 패키지에서 `error.code` 필드로 분류됨:

| pg 에러 코드 | 의미 | 처리 방법 |
|-------------|------|-----------|
| `ECONNREFUSED` | 연결 거부 | `testConnection()`에서 catch → `{ success: false }` |
| `28P01` | 인증 실패 | `testConnection()`에서 catch → `{ success: false }` |
| `3D000` | 데이터베이스 없음 | `testConnection()`에서 catch → `{ success: false }` |
| `42P01` | 테이블 없음 | `rawQuery()`에서 throw → `executeQuery()` 호출자에게 전파 |
| `42703` | 컬럼 없음 | `rawQuery()`에서 throw → `executeQuery()` 호출자에게 전파 |
| `57014` | 쿼리 타임아웃 | `rawQuery()`에서 throw → 상위에서 처리 |

### 4.2 에러 처리 흐름

```
사용자 쿼리 요청
    │
    ▼
executeQuery() ← BaseSqlAdapter (table 검증, limit 제한)
    │
    ▼
buildSelectQuery() ← BaseSqlAdapter (SQL 빌딩, escapeId로 injection 방지)
    │
    ▼
rawQuery() ← PostgreSQLAdapter (pool.query 호출)
    │
    ├── 성공 → result.rows 반환
    │
    └── 실패 → Error throw
         │
         ▼
    상위 레벨에서 AppError / 500으로 변환
    (EventEngine, DataSourceService, API 라우터의 errorHandler)
```

### 4.3 PostgreSQLAdapter의 rawQuery 에러 처리

```typescript
protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
  const result = await this.pool.query(sql, params);
  return result.rows;
}
```

**설계 결정**: `rawQuery()`에서 에러를 catch하지 않고 그대로 throw한다.
- `testConnection()`은 BaseSqlAdapter에서 이미 catch하여 `{ success: false }` 반환
- `executeQuery()`의 에러는 상위 레벨(DataSourceService → API 라우터 → errorHandler)에서 처리
- 불필요한 에러 래핑을 피하고, 원본 에러 메시지를 보존

### 4.4 Pool 이벤트 처리 (선택사항)

```typescript
// 연결 풀 에러 로깅 (서버 크래시 방지)
this.pool.on('error', (err) => {
  console.error('[PostgreSQLAdapter] pool error:', err.message);
});
```

`pool.on('error')`를 등록하지 않으면, 유휴 연결에서 발생한 에러가 unhandled 이벤트로 프로세스를 종료시킬 수 있다. 이를 방지하기 위해 에러 로깅 리스너를 등록한다.

---

## 5. adapters/index.ts에 PostgreSQLAdapterFactory 등록 방법

### 5.1 수정할 파일: `adapters/index.ts`

```typescript
// 변경 전
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
adapterRegistry.register(MongoDBAdapterFactory);

// 변경 후
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
import { PostgreSQLAdapterFactory } from './PostgreSQLAdapter.js';

adapterRegistry.register(MongoDBAdapterFactory);
adapterRegistry.register(PostgreSQLAdapterFactory);
```

### 5.2 등록 후 검증

```typescript
adapterRegistry.has('postgresql');        // true
adapterRegistry.listDialects();
// [
//   { dialect: 'mongodb', displayName: 'MongoDB' },
//   { dialect: 'postgresql', displayName: 'PostgreSQL' },
// ]
```

---

## 6. PostgreSQLAdapter 전체 구현 코드

### 6.1 파일: `packages/server/src/services/adapters/PostgreSQLAdapter.ts`

```typescript
import { Pool } from 'pg';
import { BaseSqlAdapter, type SqlConnectionOptions } from './BaseSqlAdapter.js';
import type { AdapterFactory } from './AdapterRegistry.js';

export class PostgreSQLAdapter extends BaseSqlAdapter {
  private pool: Pool;

  constructor(config: SqlConnectionOptions) {
    super();
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: this.buildSslConfig(config.ssl),
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQLAdapter] pool error:', err.message);
    });
  }

  private buildSslConfig(
    ssl?: boolean | Record<string, unknown>,
  ): boolean | Record<string, unknown> | undefined {
    if (!ssl) return undefined;
    if (ssl === true) return { rejectUnauthorized: false };
    return ssl;
  }

  protected escapeId(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  protected placeholder(index: number): string {
    return `$${index}`;
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export const PostgreSQLAdapterFactory: AdapterFactory = {
  dialect: 'postgresql',
  displayName: 'PostgreSQL',
  create(config: Record<string, unknown>) {
    const host = config.host as string;
    const database = config.database as string;
    if (!host || !database) {
      throw new Error('PostgreSQL adapter requires host and database');
    }
    return new PostgreSQLAdapter({
      host,
      port: (config.port as number) || 5432,
      user: (config.user as string) || 'postgres',
      password: (config.password as string) || '',
      database,
      ssl: config.ssl as boolean | Record<string, unknown> | undefined,
    });
  },
};
```

---

## 7. 파일 변경 요약

### 7.1 신규 파일 (1개)

| 파일 | 역할 |
|------|------|
| `packages/server/src/services/adapters/PostgreSQLAdapter.ts` | PostgreSQLAdapter 클래스 + PostgreSQLAdapterFactory |

### 7.2 수정 파일 (2개)

| 파일 | 변경 내용 |
|------|-----------|
| `packages/server/src/services/adapters/index.ts` | PostgreSQLAdapterFactory import 및 등록 |
| `packages/server/package.json` | `pg` 의존성 추가, `@types/pg` devDependency 추가 |

---

## 8. 테스트 전략

### 8.1 단위 테스트

BaseSqlAdapter 테스트(`BaseSqlAdapter.test.ts`)가 이미 추상 메서드 동작을 검증하므로, PostgreSQLAdapter 테스트는 PostgreSQL 고유 동작에 집중:

| # | 테스트 | 검증 내용 |
|---|--------|-----------|
| 1 | `escapeId` | `"identifier"` 형태, 내부 `"` → `""` 이중 처리 |
| 2 | `placeholder` | `$1`, `$2`, ... 형태 |
| 3 | `PostgreSQLAdapterFactory.create()` — 정상 | config로 어댑터 생성 |
| 4 | `PostgreSQLAdapterFactory.create()` — host 누락 | Error throw |
| 5 | `PostgreSQLAdapterFactory.create()` — database 누락 | Error throw |
| 6 | `PostgreSQLAdapterFactory.create()` — port 기본값` | 5432 적용 |
| 7 | SSL 설정 — `true` | `{ rejectUnauthorized: false }` 변환 |
| 8 | SSL 설정 — `false` / 미지정 | `undefined` |
| 9 | SSL 설정 — 객체 | 그대로 전달 |

### 8.2 통합 테스트 (선택사항)

실제 PostgreSQL 연결이 필요하므로 CI 환경에서 별도 실행:

```bash
# 로컬 PostgreSQL Docker로 테스트
docker run -d --name pg-test -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:16-alpine
PGHOST=localhost PGPORT=5433 PGUSER=postgres PGPASSWORD=test PGDATABASE=postgres \
  npx vitest run src/__tests__/PostgreSQLAdapter.integration.test.ts
```

### 8.3 테스트 실행

```bash
# PostgreSQLAdapter 단위 테스트
cd packages/server && npx vitest run src/__tests__/PostgreSQLAdapter.test.ts

# 전체 서버 테스트
pnpm --filter @webform/server test

# 타입 체크
pnpm --filter @webform/server typecheck
```

---

## 9. 구현 순서

1. `pnpm --filter @webform/server add pg && pnpm --filter @webform/server add -D @types/pg`
2. `PostgreSQLAdapter.ts` 파일 생성
3. `adapters/index.ts`에 PostgreSQLAdapterFactory 등록
4. 단위 테스트 작성 및 실행
5. 타입 체크 확인

---

## 10. 설계 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| DB 드라이버 | `pg` (node-postgres) | PostgreSQL의 사실상 표준 Node.js 드라이버, 가장 넓은 생태계 |
| 연결 관리 | `Pool` (내장 풀링) | 별도 풀 라이브러리 불필요, `pg`에 내장된 Pool이 충분 |
| 풀 크기 | `max: 10` | pg 기본값, WebForm 데이터소스 조회 용도에 적합 |
| 유휴 타임아웃 | `60000ms` | 1분간 미사용 연결 자동 해제, 리소스 효율성 |
| 연결 타임아웃 | `10000ms` | 네트워크 문제 시 10초 내 실패, MongoDBAdapter의 5초보다 여유 |
| SSL 기본 | `rejectUnauthorized: false` | 클라우드 DB 호환성 (자체 서명 인증서 허용) |
| 식별자 이스케이핑 | `"identifier"` | PostgreSQL 표준 SQL 이스케이핑 |
| 플레이스홀더 | `$N` (1-based) | pg 패키지 네이티브 형식 |
| 에러 처리 | rawQuery에서 throw, 상위에서 처리 | BaseSqlAdapter/DataSourceService의 기존 패턴 준수 |
| Pool 에러 리스너 | `pool.on('error')` 등록 | 유휴 연결 에러로 인한 프로세스 크래시 방지 |
| Factory 검증 | host, database 필수 | 최소 필수 연결 정보 검증 |
| port 기본값 | 5432 | PostgreSQL 표준 포트 |
| user 기본값 | `'postgres'` | PostgreSQL 기본 슈퍼유저 |
