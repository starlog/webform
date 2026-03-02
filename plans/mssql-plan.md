# MSSQL 어댑터 설계 계획

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

MSSQL 어댑터는 이 추상 클래스를 상속하며, MSSQL 고유 문법에 맞게 `buildSelectQuery()`를 override한다.

### 1.2 현재 `buildSelectQuery()`의 LIMIT/OFFSET 문제

BaseSqlAdapter의 기본 구현:
```sql
SELECT * FROM "users" LIMIT 100 OFFSET 0
```

MSSQL은 `LIMIT` 키워드를 지원하지 않는다. 대신 `OFFSET ... ROWS FETCH NEXT ... ROWS ONLY` 구문을 사용해야 한다:
```sql
SELECT * FROM [users] ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY
```

### 1.3 AdapterRegistry 등록 현황 (`adapters/index.ts`)

현재 MongoDB만 등록되어 있다:
```typescript
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
adapterRegistry.register(MongoDBAdapterFactory);
```

MSSQL 어댑터 구현 후 `MSSQLAdapterFactory`를 여기에 등록한다.

### 1.4 현재 의존성 (`package.json`)

SQL 관련 패키지가 아직 없다. `mssql` 및 `@types/mssql` 패키지를 추가해야 한다.

### 1.5 DatabaseConfig 타입 (`datasource.ts`)

```typescript
export type DatabaseDialect = 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';
```

`mssql` dialect은 이미 타입에 정의되어 있다. `DatabaseConfig`에서 `host`, `port`, `user`, `password`, `database`, `ssl` 필드를 사용한다.

---

## 2. mssql ConnectionPool 설정

### 2.1 mssql 패키지 개요

`mssql` 패키지는 `ConnectionPool`을 통해 연결을 관리한다. 다른 SQL 드라이버(`pg`, `mysql2`)와 달리 **명시적 `connect()` 호출이 필요**하다.

### 2.2 ConnectionPool 설정 구조

```typescript
import sql from 'mssql';

const pool = new sql.ConnectionPool({
  server: config.host,       // 'host'가 아닌 'server' 키 사용
  port: config.port || 1433,
  user: config.user,
  password: config.password,
  database: config.database,
  options: {
    encrypt: config.ssl ? true : false,
    trustServerCertificate: !config.ssl,  // 로컬 개발 시 true
  },
  connectionTimeout: 10_000,
  requestTimeout: 10_000,
});
```

### 2.3 SqlConnectionOptions → mssql 설정 매핑

| SqlConnectionOptions | mssql config | 변환 규칙 |
|---------------------|--------------|-----------|
| `host` | `server` | 키 이름 변경 (mssql은 `server` 사용) |
| `port` | `port` | 기본값 1433 |
| `user` | `user` | 그대로 |
| `password` | `password` | 그대로 |
| `database` | `database` | 그대로 |
| `ssl: true` | `options.encrypt: true` | SSL 활성화 시 encrypt 켜기 |
| `ssl: false/undefined` | `options.trustServerCertificate: true` | 로컬 개발 환경 대응 |

### 2.4 명시적 connect() 호출 전략

```typescript
export class MSSQLAdapter extends BaseSqlAdapter {
  private pool: sql.ConnectionPool;
  private connected = false;

  constructor(config: SqlConnectionOptions) {
    super();
    this.pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port || 1433,
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt: !!config.ssl,
        trustServerCertificate: !config.ssl,
      },
      connectionTimeout: 10_000,
      requestTimeout: 10_000,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.pool.connect();
      this.connected = true;
    }
  }
}
```

**설계 결정**: lazy connect 패턴을 사용한다. `rawQuery()` 또는 `testConnection()` 호출 시 `ensureConnected()`로 최초 1회 연결. 생성자에서 connect하지 않는 이유:
- 생성자는 async가 될 수 없음
- AdapterFactory.create()는 동기 반환

---

## 3. LIMIT/OFFSET 문법 차이 처리 — buildSelectQuery() Override

### 3.1 MSSQL 페이징 문법

MSSQL은 SQL Server 2012+에서 `OFFSET ... FETCH NEXT` 구문을 지원한다:

```sql
SELECT [col1], [col2]
FROM [table_name]
WHERE [col1] = @p1
ORDER BY (SELECT NULL)
OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY
```

**`ORDER BY` 필수**: `OFFSET ... FETCH NEXT`는 `ORDER BY` 절이 반드시 있어야 한다. 사용자가 정렬을 지정하지 않은 경우 `ORDER BY (SELECT NULL)`을 사용하여 정렬 순서를 미지정으로 처리한다.

### 3.2 buildSelectQuery() Override 구현

```typescript
protected buildSelectQuery(opts: SelectOptions): { sql: string; params: unknown[] } {
  const cols = opts.columns?.length
    ? opts.columns.map((c) => this.escapeId(c)).join(', ')
    : '*';

  let sql = `SELECT ${cols} FROM ${this.escapeId(opts.table)}`;
  const params: unknown[] = [];

  if (opts.filter && Object.keys(opts.filter).length > 0) {
    const conditions = Object.entries(opts.filter).map(([key, value], i) => {
      params.push(value);
      return `${this.escapeId(key)} = ${this.placeholder(i + 1)}`;
    });
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // MSSQL: ORDER BY 필수 + OFFSET FETCH 문법
  sql += ` ORDER BY (SELECT NULL) OFFSET ${opts.offset} ROWS FETCH NEXT ${opts.limit} ROWS ONLY`;

  return { sql, params };
}
```

### 3.3 SelectOptions 타입 접근

`SelectOptions`는 `BaseSqlAdapter.ts`에서 모듈 스코프에 `interface`로 정의되어 있으며 export되지 않는다. MSSQLAdapter에서 `buildSelectQuery()`를 override하려면 이 타입이 필요하다.

**해결 방법**: `SelectOptions`를 export하도록 `BaseSqlAdapter.ts`를 수정한다.

```typescript
// BaseSqlAdapter.ts 변경
export interface SelectOptions {  // interface → export interface
  table: string;
  filter?: Record<string, unknown>;
  columns?: string[];
  limit: number;
  offset: number;
}
```

---

## 4. 파라미터 바인딩 — @p1, request.input()

### 4.1 placeholder() 구현

```typescript
protected placeholder(index: number): string {
  return `@p${index}`;
}
```

생성되는 SQL 예시:
```sql
SELECT * FROM [users] WHERE [name] = @p1 AND [age] = @p2
```

### 4.2 rawQuery()에서 request.input() 바인딩

mssql 패키지는 **named parameter** 방식을 사용한다. `request.input(name, value)`로 각 파라미터를 바인딩한 후 `request.query(sql)`을 호출한다.

```typescript
protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
  await this.ensureConnected();
  const request = this.pool.request();

  if (params) {
    params.forEach((value, i) => {
      request.input(`p${i + 1}`, value);
    });
  }

  const result = await request.query(sql);
  return result.recordset;
}
```

### 4.3 파라미터 바인딩 흐름

```
buildSelectQuery()                    rawQuery()
─────────────────                    ───────────
params = ['Alice', 30]               request.input('p1', 'Alice')
sql = "... @p1 ... @p2 ..."          request.input('p2', 30)
                                     request.query(sql)
                                     → result.recordset
```

**핵심**: `placeholder()`에서 생성하는 `@p1`, `@p2`와 `rawQuery()`에서 `input()`에 전달하는 `p1`, `p2`의 인덱스가 일치해야 한다. 둘 다 1-based 인덱스를 사용하므로 `params.forEach((value, i) => request.input(`p${i + 1}`, value))`로 매칭된다.

### 4.4 타입 자동 감지

mssql 패키지는 JavaScript 값의 타입을 자동으로 감지하여 SQL 타입으로 매핑한다:
- `string` → `NVarChar`
- `number` (정수) → `Int`
- `number` (소수) → `Float`
- `boolean` → `Bit`
- `Date` → `DateTime`
- `null` → `NVarChar(1)` (NULL)

명시적 타입 지정(`sql.NVarChar`, `sql.Int` 등)도 가능하지만, `DataSourceAdapter`의 generic한 `Record<string, unknown>` 기반 인터페이스에서는 자동 감지로 충분하다.

---

## 5. Encrypt / TrustServerCertificate 옵션 처리

### 5.1 MSSQL 연결 보안 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `encrypt` | TLS 암호화 사용 여부 | `true` (Azure SQL 필수) |
| `trustServerCertificate` | 자체 서명 인증서 허용 | `false` |

### 5.2 ssl 필드에 따른 매핑 전략

```typescript
// SqlConnectionOptions.ssl 값에 따른 mssql options 매핑

ssl: undefined/false
  → encrypt: false, trustServerCertificate: true
  → 로컬 개발, 사내 네트워크 (암호화 불필요)

ssl: true
  → encrypt: true, trustServerCertificate: false
  → 프로덕션, Azure SQL (CA 인증서 검증)

ssl: { trustServerCertificate: true }
  → encrypt: true, trustServerCertificate: true
  → 자체 서명 인증서 환경 (개발/스테이징)
```

### 5.3 구현 코드

```typescript
constructor(config: SqlConnectionOptions) {
  super();

  let encrypt = false;
  let trustServerCertificate = true;

  if (config.ssl === true) {
    encrypt = true;
    trustServerCertificate = false;
  } else if (typeof config.ssl === 'object' && config.ssl !== null) {
    encrypt = true;
    trustServerCertificate = !!(config.ssl as Record<string, unknown>).trustServerCertificate;
  }

  this.pool = new sql.ConnectionPool({
    server: config.host,
    port: config.port || 1433,
    user: config.user,
    password: config.password,
    database: config.database,
    options: {
      encrypt,
      trustServerCertificate,
    },
    connectionTimeout: 10_000,
    requestTimeout: 10_000,
  });
}
```

### 5.4 시나리오별 동작

| 환경 | ssl 설정 | encrypt | trustServerCert | 설명 |
|------|----------|---------|-----------------|------|
| 로컬 개발 | `undefined` | `false` | `true` | 암호화 없이 연결 |
| Azure SQL | `true` | `true` | `false` | 정규 TLS, CA 검증 |
| 사내 서버 | `{ trustServerCertificate: true }` | `true` | `true` | TLS 사용, 자체 서명 허용 |

---

## 6. escapeId() 구현

```typescript
protected escapeId(identifier: string): string {
  return `[${identifier.replace(/\]/g, ']]')}]`;
}
```

MSSQL은 대괄호(`[]`)로 식별자를 감싼다. 내부에 `]`가 포함된 경우 `]]`로 이중 처리한다.

| 입력 | 출력 |
|------|------|
| `users` | `[users]` |
| `user name` | `[user name]` |
| `col]umn` | `[col]]umn]` |

---

## 7. disconnect() 구현

```typescript
async disconnect(): Promise<void> {
  if (this.connected) {
    await this.pool.close();
    this.connected = false;
  }
}
```

`pool.close()`는 모든 활성 연결을 정리하고 풀을 종료한다. `connected` 플래그를 확인하여 미연결 상태에서 close() 호출을 방지한다.

---

## 8. 파일 구조

### 8.1 신규 파일 (1개)

| 파일 | 역할 |
|------|------|
| `packages/server/src/services/adapters/MSSQLAdapter.ts` | MSSQLAdapter 클래스 + MSSQLAdapterFactory export |

### 8.2 수정 파일 (2개)

| 파일 | 변경 내용 |
|------|-----------|
| `packages/server/src/services/adapters/BaseSqlAdapter.ts` | `SelectOptions` 인터페이스를 `export`로 변경 |
| `packages/server/src/services/adapters/index.ts` | `MSSQLAdapterFactory` import 및 등록 추가 |

### 8.3 의존성 설치

```bash
pnpm --filter @webform/server add mssql
pnpm --filter @webform/server add -D @types/mssql
```

---

## 9. 구현 코드 전체

```typescript
// packages/server/src/services/adapters/MSSQLAdapter.ts

import sql from 'mssql';
import { BaseSqlAdapter, type SqlConnectionOptions } from './BaseSqlAdapter.js';
import type { AdapterFactory } from './AdapterRegistry.js';

interface SelectOptions {
  table: string;
  filter?: Record<string, unknown>;
  columns?: string[];
  limit: number;
  offset: number;
}

export class MSSQLAdapter extends BaseSqlAdapter {
  private pool: sql.ConnectionPool;
  private connected = false;

  constructor(config: SqlConnectionOptions) {
    super();

    let encrypt = false;
    let trustServerCertificate = true;

    if (config.ssl === true) {
      encrypt = true;
      trustServerCertificate = false;
    } else if (typeof config.ssl === 'object' && config.ssl !== null) {
      encrypt = true;
      trustServerCertificate = !!(config.ssl as Record<string, unknown>).trustServerCertificate;
    }

    this.pool = new sql.ConnectionPool({
      server: config.host,
      port: config.port || 1433,
      user: config.user,
      password: config.password,
      database: config.database,
      options: {
        encrypt,
        trustServerCertificate,
      },
      connectionTimeout: 10_000,
      requestTimeout: 10_000,
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.pool.connect();
      this.connected = true;
    }
  }

  protected escapeId(identifier: string): string {
    return `[${identifier.replace(/\]/g, ']]')}]`;
  }

  protected placeholder(index: number): string {
    return `@p${index}`;
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    await this.ensureConnected();
    const request = this.pool.request();

    if (params) {
      params.forEach((value, i) => {
        request.input(`p${i + 1}`, value);
      });
    }

    const result = await request.query(sql);
    return result.recordset;
  }

  protected buildSelectQuery(opts: SelectOptions): { sql: string; params: unknown[] } {
    const cols = opts.columns?.length
      ? opts.columns.map((c) => this.escapeId(c)).join(', ')
      : '*';

    let sql = `SELECT ${cols} FROM ${this.escapeId(opts.table)}`;
    const params: unknown[] = [];

    if (opts.filter && Object.keys(opts.filter).length > 0) {
      const conditions = Object.entries(opts.filter).map(([key, value], i) => {
        params.push(value);
        return `${this.escapeId(key)} = ${this.placeholder(i + 1)}`;
      });
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    // MSSQL: OFFSET ... FETCH NEXT ... (ORDER BY 필수)
    sql += ` ORDER BY (SELECT NULL) OFFSET ${opts.offset} ROWS FETCH NEXT ${opts.limit} ROWS ONLY`;

    return { sql, params };
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.pool.close();
      this.connected = false;
    }
  }
}

export const MSSQLAdapterFactory: AdapterFactory = {
  dialect: 'mssql',
  displayName: 'Microsoft SQL Server',
  create(config: Record<string, unknown>) {
    const host = config.host as string;
    const database = config.database as string;
    if (!host || !database) {
      throw new Error('MSSQL adapter requires host and database');
    }
    return new MSSQLAdapter({
      host,
      port: (config.port as number) || 1433,
      user: (config.user as string) || '',
      password: (config.password as string) || '',
      database,
      ssl: config.ssl as boolean | Record<string, unknown> | undefined,
    });
  },
};
```

---

## 10. index.ts 수정

```typescript
// packages/server/src/services/adapters/index.ts

export { adapterRegistry } from './AdapterRegistry.js';
export type { AdapterFactory } from './AdapterRegistry.js';
export type { DataSourceAdapter } from './types.js';

// — 어댑터 팩토리 등록 —
import { adapterRegistry } from './AdapterRegistry.js';
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
import { MSSQLAdapterFactory } from './MSSQLAdapter.js';       // 추가

adapterRegistry.register(MongoDBAdapterFactory);
adapterRegistry.register(MSSQLAdapterFactory);                  // 추가
```

---

## 11. BaseSqlAdapter.ts 수정 (SelectOptions export)

```diff
-interface SelectOptions {
+export interface SelectOptions {
   table: string;
   filter?: Record<string, unknown>;
   columns?: string[];
   limit: number;
   offset: number;
 }
```

이 변경으로 MSSQLAdapter에서 `SelectOptions`를 import하여 `buildSelectQuery()` override 시 타입 안전성을 확보할 수 있다.

단, MSSQLAdapter 내부에서 `SelectOptions`를 로컬로 재정의하는 방법도 가능하다. 위 구현 코드(섹션 9)에서는 로컬 재정의 방식을 사용했다. **권장**: BaseSqlAdapter에서 export하여 import하는 방식이 타입 일관성 면에서 더 안전하다.

---

## 12. 테스트 전략

### 12.1 단위 테스트 (mssql mock)

실제 MSSQL 서버 없이 테스트하기 위해 `mssql` 패키지를 mock한다:

```typescript
// packages/server/src/__tests__/MSSQLAdapter.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';

// mssql 모듈 mock
vi.mock('mssql', () => {
  const mockRequest = {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockResolvedValue({ recordset: [] }),
  };
  const mockPool = {
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    request: vi.fn(() => mockRequest),
  };
  return {
    default: {
      ConnectionPool: vi.fn(() => mockPool),
    },
  };
});
```

### 12.2 테스트 케이스

| # | 테스트 | 검증 내용 |
|---|--------|-----------|
| 1 | escapeId — 기본 | `users` → `[users]` |
| 2 | escapeId — 특수문자 | `col]umn` → `[col]]umn]` |
| 3 | placeholder | `@p1`, `@p2`, `@p3` |
| 4 | buildSelectQuery — 기본 | `ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY` |
| 5 | buildSelectQuery — WHERE 포함 | `WHERE [name] = @p1` + OFFSET FETCH |
| 6 | buildSelectQuery — columns 지정 | `SELECT [name], [email] FROM [users]` |
| 7 | rawQuery — input() 호출 확인 | `request.input('p1', 'Alice')` 호출됨 |
| 8 | rawQuery — ensureConnected 최초 1회 | connect() 1번만 호출 |
| 9 | testConnection — 성공 | `{ success: true }` |
| 10 | testConnection — 실패 | `{ success: false, message }` |
| 11 | disconnect — pool.close() 호출 | close() 1번 호출 |
| 12 | disconnect — 미연결 시 no-op | close() 미호출 |
| 13 | Factory — host/database 필수 | 누락 시 에러 throw |
| 14 | Factory — 기본 포트 1433 | port 미지정 시 1433 적용 |
| 15 | SSL — ssl:true → encrypt:true, trustCert:false | ConnectionPool 옵션 검증 |
| 16 | SSL — ssl:undefined → encrypt:false, trustCert:true | ConnectionPool 옵션 검증 |
| 17 | SSL — ssl:object → encrypt:true, trustCert 전달 | ConnectionPool 옵션 검증 |

### 12.3 테스트 실행

```bash
cd packages/server && npx vitest run src/__tests__/MSSQLAdapter.test.ts
pnpm --filter @webform/server test      # 전체 회귀 테스트
cd packages/server && npx tsc --noEmit   # 타입 체크
```

---

## 13. 설계 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| 연결 방식 | lazy connect (`ensureConnected()`) | 생성자는 async 불가, AdapterFactory.create()는 동기 반환 |
| 페이징 문법 | `OFFSET ... FETCH NEXT` + `ORDER BY (SELECT NULL)` | MSSQL 2012+ 표준, TOP N 대비 offset 지원 |
| ssl 매핑 | `ssl` → `encrypt` + `trustServerCertificate` | Azure SQL, 로컬 개발, 자체 서명 인증서 3가지 시나리오 대응 |
| 파라미터 바인딩 | `request.input('p1', value)` + `@p1` | mssql 패키지의 named parameter 방식에 맞춤 |
| 타입 감지 | 자동 감지 (명시적 타입 지정 안 함) | generic `Record<string, unknown>` 인터페이스에서 충분 |
| `buildSelectQuery` override | `SelectOptions` 로컬 재정의 또는 BaseSqlAdapter에서 export | override 시 타입 안전성 필요 |
| ConnectionPool 옵션 | `connectionTimeout: 10_000`, `requestTimeout: 10_000` | 합리적인 타임아웃, 무한 대기 방지 |
| displayName | `'Microsoft SQL Server'` | 사용자에게 표시되는 이름, 공식 제품명 사용 |

---

## 14. 구현 순서

1. `pnpm --filter @webform/server add mssql && pnpm --filter @webform/server add -D @types/mssql`
2. `BaseSqlAdapter.ts` — `SelectOptions` export 변경
3. `MSSQLAdapter.ts` 신규 파일 생성
4. `adapters/index.ts` — MSSQLAdapterFactory 등록
5. `MSSQLAdapter.test.ts` 테스트 작성 및 실행
6. 타입 체크 (`tsc --noEmit`)
7. 전체 테스트 실행 (`pnpm --filter @webform/server test`)
