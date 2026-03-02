# SQL 공통 베이스 클래스(BaseSqlAdapter) 설계 계획

## 1. 현재 코드 분석

### 1.1 DataSourceAdapter 인터페이스 (`adapters/types.ts`)

```typescript
export interface DataSourceAdapter {
  testConnection(): Promise<{ success: boolean; message: string }>;
  executeQuery(query: Record<string, unknown>): Promise<unknown[]>;
  disconnect(): Promise<void>;
}
```

3개의 메서드만 정의된 간결한 인터페이스. SQL 어댑터는 이 인터페이스를 구현하되, 공통 로직(쿼리 빌딩, 파라미터 바인딩, 보안)은 BaseSqlAdapter에서 처리한다.

### 1.2 AdapterRegistry 패턴 (`AdapterRegistry.ts`)

```typescript
export interface AdapterFactory {
  dialect: string;
  displayName: string;
  create(config: Record<string, unknown>): DataSourceAdapter;
}
```

각 SQL 어댑터는 `BaseSqlAdapter`를 상속하고, 별도의 `AdapterFactory` 객체를 export하여 `adapterRegistry`에 등록한다.

### 1.3 DatabaseConfig 타입 (`datasource.ts`)

```typescript
export type DatabaseDialect = 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';

export interface DatabaseConfig {
  dialect: DatabaseDialect;
  connectionString?: string;  // MongoDB용
  host?: string;              // SQL DB 공통
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean;
}
```

SQL DB(postgresql, mysql, mssql)는 `host`, `port`, `user`, `password`, `database`, `ssl` 필드를 사용한다. SQLite는 `database`(파일 경로)만 사용하므로 BaseSqlAdapter와 별도로 구현할 수 있으나, 기본 쿼리 빌딩 로직은 공유한다.

### 1.4 MongoDBAdapter 참고 사항

MongoDBAdapter는 NoSQL이므로 BaseSqlAdapter를 상속하지 않는다. 다만 패턴 참고:
- `testConnection()`: 별도 클라이언트로 ping 테스트
- `executeQuery()`: `query` 객체에서 `collection`, `filter`, `projection`, `limit`, `skip` 추출
- `disconnect()`: 풀 관리는 외부에 위임 (no-op)
- `limit` 최대 1000 제한 (`Math.min(limit, 1000)`)

---

## 2. SqlConnectionOptions 인터페이스 설계

```typescript
// packages/server/src/services/adapters/BaseSqlAdapter.ts

export interface SqlConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | Record<string, unknown>;
}
```

### 설계 결정

| 필드 | 타입 | 설명 |
|------|------|------|
| `host` | `string` | 필수. DB 호스트 주소 |
| `port` | `number` | 필수. AdapterFactory의 `create()`에서 dialect별 기본값(5432, 3306, 1433) 적용 |
| `user` | `string` | 필수. 인증 사용자명 |
| `password` | `string` | 필수. 인증 비밀번호 |
| `database` | `string` | 필수. 대상 데이터베이스명 |
| `ssl` | `boolean \| Record<string, unknown>` | 선택. `true`이면 어댑터별 기본 SSL 설정 적용. 객체면 상세 SSL 옵션 전달 |

**`ssl` 타입이 `boolean | Record<string, unknown>`인 이유**: DatabaseConfig에서는 `boolean`으로 전달되지만, 실제 DB 클라이언트(pg, mysql2 등)는 SSL 객체 설정이 필요할 수 있다. 각 어댑터의 생성자에서 `boolean`을 적절한 객체로 변환한다.

---

## 3. BaseSqlAdapter 메서드별 구현 전략

### 3.1 클래스 전체 구조

```typescript
export abstract class BaseSqlAdapter implements DataSourceAdapter {
  // 공통 구현 (DataSourceAdapter 인터페이스)
  async testConnection(): Promise<{ success: boolean; message: string }>;
  async executeQuery(query: Record<string, unknown>): Promise<unknown[]>;

  // 쿼리 빌딩 (protected — 서브클래스에서 override 가능)
  protected buildSelectQuery(opts: SelectOptions): { sql: string; params: unknown[] };

  // 추상 메서드 — 각 dialect에서 구현
  protected abstract escapeId(identifier: string): string;
  protected abstract placeholder(index: number): string;
  protected abstract rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>;
  abstract disconnect(): Promise<void>;
}
```

### 3.2 `testConnection()` — 연결 테스트

```typescript
async testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await this.rawQuery('SELECT 1');
    return { success: true, message: '연결 성공' };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
```

**설계 결정**:
- `SELECT 1`은 모든 SQL DB에서 지원하는 가장 가벼운 연결 테스트 쿼리
- 에러 시 throw하지 않고 `{ success: false, message }` 반환 — MongoDBAdapter와 동일한 패턴
- MSSQL에서도 `SELECT 1`은 정상 동작함 (`SELECT 1 AS result`)

### 3.3 `executeQuery()` — 쿼리 실행

```typescript
interface SelectOptions {
  table: string;
  filter?: Record<string, unknown>;
  columns?: string[];
  limit: number;
  offset: number;
}

async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
  const table = query.table;
  if (!table || typeof table !== 'string') {
    throw new AppError(400, 'table is required');
  }

  const opts: SelectOptions = {
    table: String(table),
    filter: query.filter as Record<string, unknown> | undefined,
    columns: query.columns as string[] | undefined,
    limit: Math.min(Number(query.limit) || 100, 1000),
    offset: Number(query.offset) || 0,
  };

  const { sql, params } = this.buildSelectQuery(opts);
  return this.rawQuery(sql, params);
}
```

**설계 결정**:
- MongoDBAdapter가 `collection` 필드를 사용하는 것처럼, SQL 어댑터는 `table` 필드를 사용
- `limit` 기본값 100, 최대 1000 — MongoDBAdapter와 동일한 안전 제한
- `offset` 기본값 0
- `table` 검증: 필수 값이며 문자열이어야 함 (AppError로 처리)

### 3.4 `buildSelectQuery()` — SQL 쿼리 빌딩

```typescript
protected buildSelectQuery(opts: SelectOptions): { sql: string; params: unknown[] } {
  // 1. SELECT 절
  const cols = opts.columns?.length
    ? opts.columns.map((c) => this.escapeId(c)).join(', ')
    : '*';

  // 2. FROM 절
  let sql = `SELECT ${cols} FROM ${this.escapeId(opts.table)}`;
  const params: unknown[] = [];

  // 3. WHERE 절 (parameterized)
  if (opts.filter && Object.keys(opts.filter).length > 0) {
    const conditions = Object.entries(opts.filter).map(([key, value], i) => {
      params.push(value);
      return `${this.escapeId(key)} = ${this.placeholder(i + 1)}`;
    });
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  // 4. LIMIT / OFFSET
  sql += ` LIMIT ${opts.limit} OFFSET ${opts.offset}`;

  return { sql, params };
}
```

**설계 결정**:
- `protected`로 선언하여 서브클래스에서 override 가능
- **MSSQL 호환성**: MSSQL은 `LIMIT` 구문을 지원하지 않음. MSSQLAdapter에서 `buildSelectQuery()`를 override하여 `OFFSET x ROWS FETCH NEXT y ROWS ONLY` 문법을 사용
- 모든 식별자(테이블명, 컬럼명)는 `escapeId()`를 통해 이스케이핑
- WHERE 값은 parameterized query로 전달 — SQL injection 방지의 핵심

### 3.5 추상 메서드

#### `escapeId(identifier: string): string`
dialect별 식별자 이스케이핑:

| Dialect | 이스케이핑 | 예시 |
|---------|-----------|------|
| PostgreSQL | `"identifier"` | `"user_name"` |
| MySQL | `` `identifier` `` | `` `user_name` `` |
| MSSQL | `[identifier]` | `[user_name]` |
| SQLite | `"identifier"` | `"user_name"` |

#### `placeholder(index: number): string`
dialect별 파라미터 플레이스홀더:

| Dialect | 형식 | 예시 |
|---------|------|------|
| PostgreSQL | `$N` | `$1`, `$2`, `$3` |
| MySQL | `?` | `?`, `?`, `?` |
| MSSQL | `@pN` | `@p1`, `@p2`, `@p3` |
| SQLite | `?` | `?`, `?`, `?` |

**참고**: MySQL과 SQLite는 순서에 상관없이 `?`를 사용하므로 `index` 파라미터를 무시한다.

#### `rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>`
실제 DB 클라이언트를 통한 쿼리 실행. 각 어댑터가 구현:
- PostgreSQL: `pool.query(sql, params).then(r => r.rows)`
- MySQL: `pool.execute(sql, params).then(([rows]) => rows as unknown[])`
- MSSQL: `pool.request().input(...).query(sql).then(r => r.recordset)`
- SQLite: `db.all(sql, params)`

#### `disconnect(): Promise<void>`
연결 풀 종료. 각 어댑터가 구현:
- PostgreSQL: `pool.end()`
- MySQL: `pool.end()`
- MSSQL: `pool.close()`
- SQLite: `db.close()`

---

## 4. SQL Injection 방지 방법

### 4.1 3단계 방어

```
┌─────────────────────────────────────────────────┐
│ Layer 1: 식별자 이스케이핑 (escapeId)            │
│   - 테이블명, 컬럼명에 적용                       │
│   - dialect별 이스케이핑 문자로 감싸기             │
│   - 내부 이스케이핑 문자 이중 처리                 │
├─────────────────────────────────────────────────┤
│ Layer 2: Parameterized Query (placeholder)       │
│   - WHERE 절의 값은 절대 SQL 문자열에 삽입하지 않음 │
│   - placeholder를 사용하여 DB 드라이버에 위임       │
├─────────────────────────────────────────────────┤
│ Layer 3: 입력 검증 (executeQuery 레벨)            │
│   - table: 필수, string 타입 검증                 │
│   - limit: 최대 1000, 정수로 변환                 │
│   - offset: 정수로 변환                           │
│   - columns: string[] 타입 검증                   │
└─────────────────────────────────────────────────┘
```

### 4.2 escapeId 구현 상세

```typescript
// PostgreSQL / SQLite
protected escapeId(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

// MySQL
protected escapeId(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

// MSSQL
protected escapeId(identifier: string): string {
  return `[${identifier.replace(/\]/g, ']]')}]`;
}
```

**핵심**: 이스케이핑 문자가 식별자 내부에 포함된 경우 이중 처리한다.
- PostgreSQL: `"` → `""`
- MySQL: `` ` `` → ` `` `
- MSSQL: `]` → `]]`

### 4.3 LIMIT/OFFSET 안전성

```typescript
// limit, offset은 Number()로 변환 후 정수로 처리
// SQL 문자열에 직접 삽입하지만, 정수 값이므로 injection 불가
sql += ` LIMIT ${opts.limit} OFFSET ${opts.offset}`;
```

`limit`과 `offset`은 `Number()` 변환 후 `Math.min()`으로 범위를 제한하므로, 항상 안전한 숫자 값이 SQL에 삽입된다.

---

## 5. 각 Dialect의 Placeholder 차이점

### 5.1 비교표

| Dialect | Placeholder | 인덱싱 | 예시 쿼리 |
|---------|-------------|--------|-----------|
| **PostgreSQL** | `$N` | 1-based | `SELECT * FROM "users" WHERE "name" = $1 AND "age" = $2` |
| **MySQL** | `?` | 순서 기반 | ``SELECT * FROM `users` WHERE `name` = ? AND `age` = ?`` |
| **MSSQL** | `@pN` | 1-based | `SELECT * FROM [users] WHERE [name] = @p1 AND [age] = @p2` |
| **SQLite** | `?` | 순서 기반 | `SELECT * FROM "users" WHERE "name" = ? AND "age" = ?` |

### 5.2 placeholder() 구현

```typescript
// PostgreSQL
protected placeholder(index: number): string {
  return `$${index}`;
}

// MySQL
protected placeholder(_index: number): string {
  return '?';
}

// MSSQL
protected placeholder(index: number): string {
  return `@p${index}`;
}

// SQLite
protected placeholder(_index: number): string {
  return '?';
}
```

### 5.3 MSSQL의 LIMIT/OFFSET 차이

MSSQL은 `LIMIT` 구문을 지원하지 않는다. 대신:

```sql
-- 표준 (PostgreSQL, MySQL, SQLite)
SELECT * FROM "users" LIMIT 10 OFFSET 20

-- MSSQL
SELECT * FROM [users] ORDER BY (SELECT NULL) OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY
```

MSSQLAdapter에서는 `buildSelectQuery()`를 override:

```typescript
// MSSQLAdapter
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
```

---

## 6. 파일 구조

### 6.1 신규 파일 (1개)

| 파일 | 역할 |
|------|------|
| `packages/server/src/services/adapters/BaseSqlAdapter.ts` | SqlConnectionOptions 인터페이스, SelectOptions 인터페이스, BaseSqlAdapter 추상 클래스 |

### 6.2 수정 파일 (없음)

BaseSqlAdapter는 순수한 신규 추상 클래스로, 기존 파일을 수정하지 않는다. 이후 각 dialect 어댑터(PostgreSQLAdapter, MySQLAdapter 등) 구현 시 `adapters/index.ts`에 등록한다.

---

## 7. 구현 코드 전체

```typescript
// packages/server/src/services/adapters/BaseSqlAdapter.ts

import { AppError } from '../../middleware/errorHandler.js';
import type { DataSourceAdapter } from './types.js';

export interface SqlConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | Record<string, unknown>;
}

interface SelectOptions {
  table: string;
  filter?: Record<string, unknown>;
  columns?: string[];
  limit: number;
  offset: number;
}

export abstract class BaseSqlAdapter implements DataSourceAdapter {
  /**
   * SELECT 1로 연결 테스트
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.rawQuery('SELECT 1');
      return { success: true, message: '연결 성공' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  /**
   * table, filter, columns, limit, offset 기반 SELECT 쿼리 실행
   */
  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const table = query.table;
    if (!table || typeof table !== 'string') {
      throw new AppError(400, 'table is required');
    }

    const opts: SelectOptions = {
      table: String(table),
      filter: query.filter as Record<string, unknown> | undefined,
      columns: query.columns as string[] | undefined,
      limit: Math.min(Number(query.limit) || 100, 1000),
      offset: Number(query.offset) || 0,
    };

    const { sql, params } = this.buildSelectQuery(opts);
    return this.rawQuery(sql, params);
  }

  /**
   * SELECT 쿼리 빌딩 (protected — MSSQL에서 override)
   */
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

    sql += ` LIMIT ${opts.limit} OFFSET ${opts.offset}`;

    return { sql, params };
  }

  /** dialect별 식별자 이스케이핑 (테이블명, 컬럼명) */
  protected abstract escapeId(identifier: string): string;

  /** dialect별 파라미터 플레이스홀더 ($1, ?, @p1) */
  protected abstract placeholder(index: number): string;

  /** 실제 DB 클라이언트를 통한 쿼리 실행 */
  protected abstract rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>;

  /** 연결 종료 */
  abstract disconnect(): Promise<void>;
}
```

---

## 8. 테스트 전략

### 8.1 테스트용 구체 클래스 (TestAdapter)

BaseSqlAdapter는 추상 클래스이므로 직접 인스턴스화할 수 없다. 테스트용 구체 클래스를 만들어 테스트:

```typescript
class TestAdapter extends BaseSqlAdapter {
  public queries: Array<{ sql: string; params?: unknown[] }> = [];
  public shouldFail = false;

  protected escapeId(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  protected placeholder(index: number): string {
    return `$${index}`;
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    if (this.shouldFail) {
      throw new Error('Connection failed');
    }
    this.queries.push({ sql, params });
    return [];
  }

  async disconnect(): Promise<void> {}
}
```

**설계 결정**: `TestAdapter`는 PostgreSQL 스타일 이스케이핑/플레이스홀더를 사용하되, `rawQuery()`는 실제 DB 호출 대신 쿼리를 기록한다. `shouldFail` 플래그로 에러 시나리오도 테스트 가능.

### 8.2 테스트 케이스

| # | 테스트 | 검증 내용 |
|---|--------|-----------|
| 1 | `executeQuery() — 기본 SELECT` | `SELECT * FROM "users" LIMIT 100 OFFSET 0` 생성 |
| 2 | `executeQuery() — WHERE 조건` | `WHERE "name" = $1 AND "age" = $2` + params `['Alice', 30]` |
| 3 | `executeQuery() — columns 지정` | `SELECT "name", "email" FROM "users"` |
| 4 | `executeQuery() — limit 초과 시 1000 제한` | `limit: 5000` → `LIMIT 1000` |
| 5 | `executeQuery() — limit 기본값 100` | limit 미지정 → `LIMIT 100` |
| 6 | `executeQuery() — offset 처리` | `offset: 50` → `OFFSET 50` |
| 7 | `executeQuery() — table 누락 시 에러` | `AppError(400)` throw |
| 8 | `testConnection() — 성공` | `{ success: true, message: '연결 성공' }` |
| 9 | `testConnection() — 실패` | `{ success: false, message: 'Connection failed' }` |
| 10 | `escapeId() — 특수문자 이스케이핑` | `"user""name"` (큰따옴표 이중 처리) |
| 11 | `buildSelectQuery() — 빈 filter` | WHERE 절 없이 생성 |
| 12 | `buildSelectQuery() — filter + columns 조합` | 정확한 SQL + params 생성 |

### 8.3 테스트 파일

```typescript
// packages/server/src/__tests__/BaseSqlAdapter.test.ts

import { describe, it, expect, beforeEach } from 'vitest';

// TestAdapter 클래스 정의 (위 참조)

describe('BaseSqlAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('testConnection', () => {
    it('성공 시 { success: true } 반환', async () => { ... });
    it('실패 시 { success: false, message } 반환', async () => { ... });
  });

  describe('executeQuery', () => {
    it('기본 SELECT 쿼리 생성', async () => { ... });
    it('WHERE 조건 포함 parameterized 쿼리', async () => { ... });
    it('columns 지정 시 SELECT 절', async () => { ... });
    it('limit 최대 1000 제한', async () => { ... });
    it('limit 기본값 100', async () => { ... });
    it('offset 처리', async () => { ... });
    it('table 누락 시 에러', async () => { ... });
  });

  describe('SQL injection 방지', () => {
    it('escapeId — 특수문자 이스케이핑', async () => { ... });
    it('filter 값은 parameterized query로 전달', async () => { ... });
  });
});
```

### 8.4 테스트 실행 명령

```bash
# BaseSqlAdapter 단위 테스트
cd packages/server && npx vitest run src/__tests__/BaseSqlAdapter.test.ts

# 전체 테스트 (회귀 테스트)
pnpm --filter @webform/server test

# 타입 체크
cd packages/server && npx tsc --noEmit
```

---

## 9. 향후 각 어댑터별 확장 패턴

BaseSqlAdapter를 상속하는 각 어댑터의 구현 패턴:

```typescript
// 예: PostgreSQLAdapter
export class PostgreSQLAdapter extends BaseSqlAdapter {
  private pool: Pool;

  constructor(config: SqlConnectionOptions) {
    super();
    this.pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }

  protected escapeId(id: string): string { return `"${id.replace(/"/g, '""')}"`; }
  protected placeholder(index: number): string { return `$${index}`; }
  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }
  async disconnect(): Promise<void> { await this.pool.end(); }
}

export const PostgreSQLAdapterFactory: AdapterFactory = {
  dialect: 'postgresql',
  displayName: 'PostgreSQL',
  create(config) { return new PostgreSQLAdapter(config as SqlConnectionOptions); },
};
```

---

## 10. 설계 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| 추상 클래스 vs 인터페이스 | 추상 클래스 | 공통 로직(testConnection, executeQuery, buildSelectQuery)을 한 곳에서 구현 |
| buildSelectQuery 접근 제어 | `protected` | MSSQL은 LIMIT 문법이 다르므로 override 필요 |
| limit 최대값 | 1000 | MongoDBAdapter와 동일한 안전 제한, 대량 데이터 방지 |
| limit 기본값 | 100 | MongoDBAdapter와 동일 |
| escapeId 방식 | dialect별 추상 메서드 | 이스케이핑 문자가 dialect마다 다름 |
| placeholder 방식 | dialect별 추상 메서드 | 바인딩 형식이 dialect마다 다름 |
| LIMIT/OFFSET | 기본 구현은 표준 SQL, MSSQL은 override | 대부분의 DB가 `LIMIT` 지원, MSSQL만 예외 |
| testConnection 쿼리 | `SELECT 1` | 모든 SQL DB에서 지원, 최소 비용 |
| 에러 처리 | AppError 사용 | 기존 프로젝트의 에러 처리 패턴과 일관성 |
