# MySQL 어댑터 설계 계획

## 1. 현재 코드 분석

### 1.1 BaseSqlAdapter (`adapters/BaseSqlAdapter.ts`)

```typescript
export abstract class BaseSqlAdapter implements DataSourceAdapter {
  async testConnection(): Promise<{ success: boolean; message: string }>;
  async executeQuery(query: Record<string, unknown>): Promise<unknown[]>;
  protected buildSelectQuery(opts: SelectOptions): { sql: string; params: unknown[] };

  protected abstract escapeId(identifier: string): string;
  protected abstract placeholder(index: number): string;
  protected abstract rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>;
  abstract disconnect(): Promise<void>;
}
```

MySQLAdapter는 이 4개의 추상 메서드만 구현하면 된다. `testConnection()`, `executeQuery()`, `buildSelectQuery()`는 BaseSqlAdapter에서 상속받는다.

### 1.2 SqlConnectionOptions 인터페이스

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

AdapterFactory의 `create(config)`에서 `config as SqlConnectionOptions`로 캐스팅하여 MySQLAdapter 생성자에 전달한다.

### 1.3 AdapterFactory 인터페이스 (`AdapterRegistry.ts`)

```typescript
export interface AdapterFactory {
  dialect: string;
  displayName: string;
  create(config: Record<string, unknown>): DataSourceAdapter;
}
```

`MySQLAdapterFactory` 객체를 export하여 `adapters/index.ts`에서 `adapterRegistry.register()`로 등록한다.

### 1.4 현재 어댑터 등록 현황 (`adapters/index.ts`)

```typescript
import { adapterRegistry } from './AdapterRegistry.js';
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';

adapterRegistry.register(MongoDBAdapterFactory);
```

현재 MongoDB만 등록되어 있다. MySQLAdapterFactory를 추가 등록해야 한다.

### 1.5 현재 의존성 (`package.json`)

`mysql2` 패키지가 없음. 설치 필요:
```bash
pnpm --filter @webform/server add mysql2
```

`mysql2`는 TypeScript 타입을 내장하고 있으므로 `@types/mysql2`는 불필요하다.

---

## 2. mysql2/promise Pool 설정 옵션

### 2.1 createPool 주요 옵션

```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  // === 연결 옵션 (ConnectionOptions) ===
  host: config.host,              // DB 호스트 주소
  port: config.port || 3306,      // MySQL 기본 포트 3306
  user: config.user,              // 인증 사용자명
  password: config.password,      // 인증 비밀번호
  database: config.database,      // 대상 데이터베이스명
  ssl: config.ssl ? { rejectUnauthorized: false } : undefined,  // SSL 설정

  // === 풀 옵션 (PoolOptions) ===
  connectionLimit: 10,            // 풀에서 동시에 생성할 수 있는 최대 연결 수
  connectTimeout: 10_000,         // 연결 타임아웃 (ms). 기본 10초
  waitForConnections: true,       // 풀이 가득 찼을 때 대기 여부 (기본 true)
  maxIdle: 10,                    // 유휴 연결 최대 수 (기본 connectionLimit과 동일)
  idleTimeout: 60_000,            // 유휴 연결 타임아웃 (ms). 기본 60초
  queueLimit: 0,                  // 대기 큐 최대 길이 (0 = 무제한)
  enableKeepAlive: true,          // TCP KeepAlive 활성화
  keepAliveInitialDelay: 0,       // KeepAlive 초기 지연 (ms)
});
```

### 2.2 MySQLAdapter에서 사용할 설정

```typescript
{
  host: config.host,
  port: config.port || 3306,
  user: config.user,
  password: config.password,
  database: config.database,
  ssl: /* 아래 3장 참조 */,
  connectionLimit: 10,
  connectTimeout: 10_000,
}
```

**설계 결정**: `waitForConnections`, `maxIdle`, `idleTimeout`, `queueLimit`, `enableKeepAlive`는 기본값을 사용한다. 풀 크기(`connectionLimit: 10`)와 연결 타임아웃(`connectTimeout: 10_000`)만 명시적으로 설정하여 간결하게 유지한다.

---

## 3. SSL 연결 처리 방법

### 3.1 SqlConnectionOptions의 ssl 필드

```typescript
ssl?: boolean | Record<string, unknown>;
```

- `false` 또는 `undefined`: SSL 미사용
- `true`: 기본 SSL 설정 적용
- `Record<string, unknown>`: 상세 SSL 옵션 (ca, cert, key 등) 전달

### 3.2 MySQLAdapter에서의 SSL 변환

```typescript
// MySQLAdapter 생성자 내부
private buildSslConfig(ssl?: boolean | Record<string, unknown>): mysql.SslOptions | undefined {
  if (!ssl) return undefined;
  if (ssl === true) {
    // 기본 SSL: 서버 인증서 검증 비활성화 (자체 서명 인증서 허용)
    return { rejectUnauthorized: false };
  }
  // 상세 SSL 옵션 전달
  return ssl as mysql.SslOptions;
}
```

### 3.3 SSL 옵션 상세

mysql2의 SSL 옵션은 Node.js `tls.TlsOptions`를 확장한다:

| 옵션 | 타입 | 설명 |
|------|------|------|
| `rejectUnauthorized` | `boolean` | `false`면 자체 서명 인증서 허용. 기본 `true` |
| `ca` | `string \| Buffer` | CA 인증서 내용 또는 파일 경로 |
| `cert` | `string \| Buffer` | 클라이언트 인증서 |
| `key` | `string \| Buffer` | 클라이언트 개인키 |

### 3.4 설계 결정

- `ssl: true`일 때 `{ rejectUnauthorized: false }` 사용 — PostgreSQLAdapter와 동일한 패턴
- 프로덕션에서는 CA 인증서를 제공하는 것이 안전하지만, WebForm의 데이터소스 설정 UI에서는 boolean 토글로 간단히 처리
- 고급 SSL 설정이 필요한 경우 `Record<string, unknown>` 타입으로 상세 옵션 전달 가능

---

## 4. execute() vs query() 차이점

### 4.1 비교표

| 항목 | `pool.execute()` | `pool.query()` |
|------|-------------------|----------------|
| **구현 방식** | MySQL Prepared Statement (`COM_STMT_PREPARE` + `COM_STMT_EXECUTE`) | 클라이언트 측 placeholder 치환 후 `COM_QUERY` 전송 |
| **보안** | 서버 측 파라미터 바인딩 — SQL injection 완전 방지 | 클라이언트 측 이스케이핑 — 올바르게 사용 시 안전 |
| **성능** | 첫 실행 시 prepare 단계 추가. 동일 쿼리 반복 시 캐시된 prepared statement 재사용으로 빠름 | 단일 실행 시 prepare 오버헤드 없음 |
| **제약** | `IN (?)` 같은 배열 바인딩 불가. 배열은 별도 처리 필요 | 배열, 객체 등 다양한 값 타입 지원 |
| **반환값** | `[rows, fields]` 튜플 | `[rows, fields]` 튜플 |
| **캐싱** | 연결 당 prepared statement 캐시 (기본 LRU) | 캐시 없음 |
| **주의사항** | prepared statement 캐시 초과 시 `Can't create more than max_prepared_stmt_count statements` 에러 가능 | N/A |

### 4.2 설계 결정: `execute()` 사용

```typescript
protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
  const [rows] = await this.pool.execute(sql, params);
  return rows as unknown[];
}
```

**`execute()`를 선택한 이유**:
1. **보안**: 서버 측 prepared statement로 SQL injection 방지가 더 강력함
2. **성능**: BaseSqlAdapter의 쿼리 패턴은 동일한 구조의 SELECT가 반복되므로 prepared statement 캐시 효과가 큼
3. **일관성**: BaseSqlAdapter가 parameterized query(`?` placeholder)를 생성하므로 execute()와 자연스럽게 호환
4. **제약 회피**: BaseSqlAdapter의 `buildSelectQuery()`는 배열 바인딩을 사용하지 않으므로 execute()의 제약에 영향 없음

---

## 5. 구현 코드

### 5.1 MySQLAdapter 클래스

```typescript
// packages/server/src/services/adapters/MySQLAdapter.ts

import mysql from 'mysql2/promise';
import { BaseSqlAdapter, type SqlConnectionOptions } from './BaseSqlAdapter.js';
import type { AdapterFactory } from './AdapterRegistry.js';

export class MySQLAdapter extends BaseSqlAdapter {
  private pool: mysql.Pool;

  constructor(config: SqlConnectionOptions) {
    super();
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl
        ? config.ssl === true
          ? { rejectUnauthorized: false }
          : (config.ssl as mysql.SslOptions)
        : undefined,
      connectionLimit: 10,
      connectTimeout: 10_000,
    });
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as unknown[];
  }

  protected escapeId(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  protected placeholder(_index: number): string {
    return '?';
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
```

### 5.2 MySQLAdapterFactory

```typescript
export const MySQLAdapterFactory: AdapterFactory = {
  dialect: 'mysql',
  displayName: 'MySQL',
  create(config: Record<string, unknown>) {
    return new MySQLAdapter(config as SqlConnectionOptions);
  },
};
```

### 5.3 메서드별 설명

| 메서드 | 구현 | 설명 |
|--------|------|------|
| `constructor` | `mysql.createPool(...)` | 연결 풀 생성. 기본 포트 3306, connectionLimit=10, connectTimeout=10000 |
| `rawQuery` | `pool.execute(sql, params)` | Prepared statement로 쿼리 실행. `[rows, fields]` 중 rows만 반환 |
| `escapeId` | `` `\`${id}\`` `` | MySQL 스타일 backtick 이스케이핑. 내부 backtick은 `\`\`` 로 이중 처리 |
| `placeholder` | `'?'` | MySQL은 모든 위치에서 `?` 사용. index 파라미터 무시 |
| `disconnect` | `pool.end()` | 풀의 모든 연결을 정상 종료 |

---

## 6. adapters/index.ts 업데이트 방법

### 6.1 현재 코드

```typescript
export { adapterRegistry } from './AdapterRegistry.js';
export type { AdapterFactory } from './AdapterRegistry.js';
export type { DataSourceAdapter } from './types.js';

// — 어댑터 팩토리 등록 —
import { adapterRegistry } from './AdapterRegistry.js';
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';

adapterRegistry.register(MongoDBAdapterFactory);
```

### 6.2 변경 후 코드

```typescript
export { adapterRegistry } from './AdapterRegistry.js';
export type { AdapterFactory } from './AdapterRegistry.js';
export type { DataSourceAdapter } from './types.js';

// — 어댑터 팩토리 등록 —
import { adapterRegistry } from './AdapterRegistry.js';
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
import { MySQLAdapterFactory } from './MySQLAdapter.js';

adapterRegistry.register(MongoDBAdapterFactory);
adapterRegistry.register(MySQLAdapterFactory);
```

**변경 내용**:
1. `MySQLAdapterFactory` import 추가
2. `adapterRegistry.register(MySQLAdapterFactory)` 호출 추가

이 변경으로 서버 시작 시 MySQL dialect가 자동 등록되어, `GET /api/datasources/dialects` 응답에 `{ dialect: 'mysql', displayName: 'MySQL' }`이 포함된다.

---

## 7. 파일 목록

### 7.1 신규 파일 (1개)

| 파일 | 역할 |
|------|------|
| `packages/server/src/services/adapters/MySQLAdapter.ts` | MySQLAdapter 클래스 + MySQLAdapterFactory |

### 7.2 수정 파일 (2개)

| 파일 | 변경 내용 |
|------|-----------|
| `packages/server/src/services/adapters/index.ts` | MySQLAdapterFactory import 및 register 추가 |
| `packages/server/package.json` | `mysql2` 의존성 추가 |

---

## 8. 의존성 설치

```bash
pnpm --filter @webform/server add mysql2
```

- **mysql2**: MySQL/MariaDB용 Node.js 클라이언트. Promise API 내장, TypeScript 타입 내장
- 버전: 최신 stable (^3.x)
- `@types/mysql2` 불필요 (타입 내장)

---

## 9. 테스트 전략

### 9.1 Mock 전략

```typescript
// mysql2/promise의 createPool을 vi.mock()으로 모킹
vi.mock('mysql2/promise', () => {
  const mockPool = {
    execute: vi.fn().mockResolvedValue([[], []]),
    end: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: {
      createPool: vi.fn(() => mockPool),
    },
  };
});
```

### 9.2 테스트 케이스

| # | 테스트 | 검증 내용 |
|---|--------|-----------|
| 1 | constructor — createPool 설정 | host, port(3306 기본값), user, password, database, connectionLimit=10, connectTimeout=10000 |
| 2 | constructor — SSL true | `ssl: { rejectUnauthorized: false }` 전달 |
| 3 | constructor — SSL false | `ssl: undefined` 전달 |
| 4 | testConnection 성공 | `SELECT 1` 실행 → `{ success: true }` |
| 5 | testConnection 실패 | Pool 오류 시 `{ success: false, message }` |
| 6 | executeQuery — 기본 쿼리 | `SELECT * FROM \`table\` LIMIT 100 OFFSET 0` 실행 |
| 7 | executeQuery — WHERE 조건 | `WHERE \`col\` = ?` + params 배열 |
| 8 | disconnect | `pool.end()` 호출 확인 |
| 9 | escapeId — backtick 이스케이핑 | `` `name` `` → `` `name` ``, `` na`me `` → `` `na``me` `` |
| 10 | placeholder — 항상 `?` | index 무관하게 `'?'` 반환 |
| 11 | MySQLAdapterFactory — dialect/displayName | `'mysql'`, `'MySQL'` |
| 12 | MySQLAdapterFactory.create() | MySQLAdapter 인스턴스 반환 |

### 9.3 테스트 실행

```bash
# MySQL 어댑터 단위 테스트
cd packages/server && npx vitest run src/__tests__/MySQLAdapter.test.ts

# 전체 테스트 (회귀 테스트)
pnpm --filter @webform/server test

# 타입 체크
cd packages/server && npx tsc --noEmit
```

---

## 10. 설계 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| DB 클라이언트 | `mysql2/promise` | TypeScript 타입 내장, Promise API 지원, 활발한 유지보수 |
| 쿼리 실행 방식 | `pool.execute()` | Prepared statement로 SQL injection 방지 강화, 반복 쿼리 캐시 효과 |
| 식별자 이스케이핑 | Backtick (`` ` ``) | MySQL 표준 식별자 구분 문자 |
| Placeholder | `?` (순서 기반) | MySQL 표준. index 파라미터 무시 |
| 기본 포트 | 3306 | MySQL 표준 포트 |
| 연결 풀 크기 | 10 | 로우코드 플랫폼의 일반적인 동시 접속 수준에 적합 |
| 연결 타임아웃 | 10초 | 네트워크 지연 허용하되 무한 대기 방지 |
| SSL 기본 설정 | `{ rejectUnauthorized: false }` | 자체 서명 인증서 환경 호환. PostgreSQLAdapter와 동일한 패턴 |
| 풀 종료 | `pool.end()` | 모든 연결 정상 종료 (graceful shutdown) |
