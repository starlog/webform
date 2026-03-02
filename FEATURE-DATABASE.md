# FEATURE: 다중 데이터베이스 지원

## 개요

WebForm의 데이터소스 시스템을 확장하여 MongoDB 외에 PostgreSQL, MySQL, MSSQL, SQLite를 지원한다.
경량 어댑터 레지스트리 패턴을 도입하고, 공통 SQL 어댑터 베이스 클래스로 중복을 최소화한다.

## 현재 상태

### 이미 갖춰진 것

- `DataSourceAdapter` 인터페이스 (`testConnection`, `executeQuery`, `disconnect`)
- 3개 어댑터 구현: `MongoDBAdapter`, `RestApiAdapter`, `StaticAdapter`
- `DatabaseConfig.dialect`에 `mongodb | mysql | mssql | sqlite` 타입 정의 (구현은 mongodb만)
- 비시각적 커넥터 컨트롤: `MongoDBConnector`, `SwaggerConnector`
- 암호화 저장, 연결 풀링, 입력 검증 등 보안 기반
- Designer UI: 데이터소스 추가/테스트/미리보기
- Zod 기반 입력 검증 (`datasourceValidator.ts`)

### 현재 한계

- `DataSourceService.createAdapter()`에서 mongodb 외 dialect는 에러 throw
- 새 DB 추가 시 하드코딩 switch문 수정 필요
- SQL 계열 DB 공통 로직(쿼리 변환, 연결 풀링) 재사용 구조 없음
- Designer UI가 MongoDB 전용 설정 폼만 제공

## 설계

### Phase 1: AdapterRegistry 패턴 도입

`DataSourceService.createAdapter()`의 switch문을 레지스트리 기반 lookup으로 교체한다.

#### 파일: `packages/server/src/services/adapters/AdapterRegistry.ts`

```typescript
export interface AdapterFactory {
  dialect: string;
  displayName: string;
  create(config: Record<string, unknown>): DataSourceAdapter;
}

class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  register(factory: AdapterFactory): void {
    this.factories.set(factory.dialect, factory);
  }

  create(dialect: string, config: Record<string, unknown>): DataSourceAdapter {
    const factory = this.factories.get(dialect);
    if (!factory) {
      throw new AppError(`Unsupported dialect: ${dialect}`, 400);
    }
    return factory.create(config);
  }

  listDialects(): Array<{ dialect: string; displayName: string }> {
    return Array.from(this.factories.values()).map(f => ({
      dialect: f.dialect,
      displayName: f.displayName,
    }));
  }
}

export const adapterRegistry = new AdapterRegistry();
```

#### 변경: `packages/server/src/services/DataSourceService.ts`

```typescript
// Before
private createAdapter(dataSource): DataSourceAdapter {
  switch (dataSource.type) {
    case 'database':
      if (dataSource.meta.dialect !== 'mongodb') throw AppError;
      return new MongoDBAdapter(connectionString, database);
    // ...
  }
}

// After
private createAdapter(dataSource): DataSourceAdapter {
  switch (dataSource.type) {
    case 'database':
      return adapterRegistry.create(dataSource.meta.dialect, config);
    // restApi, static은 기존 유지
  }
}
```

#### 서버 초기화 시 등록

```typescript
// packages/server/src/services/adapters/index.ts
import { adapterRegistry } from './AdapterRegistry';
import { MongoDBAdapterFactory } from './MongoDBAdapter';
import { PostgreSQLAdapterFactory } from './PostgreSQLAdapter';
// ...

adapterRegistry.register(MongoDBAdapterFactory);
adapterRegistry.register(PostgreSQLAdapterFactory);
// ...

export { adapterRegistry };
```

#### 새 API 엔드포인트

```
GET /api/datasources/dialects → [{ dialect: 'mongodb', displayName: 'MongoDB' }, ...]
```

Designer가 이 API로 사용 가능한 dialect 목록을 동적으로 가져온다.

### Phase 2: SQL 공통 베이스 클래스

SQL 계열 DB의 공통 로직을 `BaseSqlAdapter`로 추출한다.

#### 파일: `packages/server/src/services/adapters/BaseSqlAdapter.ts`

```typescript
export interface SqlConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | Record<string, unknown>;
}

export abstract class BaseSqlAdapter implements DataSourceAdapter {
  protected abstract getPool(): unknown;
  protected abstract rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>;

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.rawQuery('SELECT 1');
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const { table, filter, columns, limit = 100, offset = 0 } = query;

    // 안전한 쿼리 빌드 (parameterized)
    const { sql, params } = this.buildSelectQuery({
      table: String(table),
      filter: filter as Record<string, unknown>,
      columns: columns as string[],
      limit: Math.min(Number(limit), 1000),
      offset: Number(offset),
    });

    return this.rawQuery(sql, params);
  }

  private buildSelectQuery(opts: SelectOptions): { sql: string; params: unknown[] } {
    const cols = opts.columns?.length ? opts.columns.map(c => this.escapeId(c)).join(', ') : '*';
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

  // dialect별 오버라이드
  protected abstract escapeId(identifier: string): string;
  protected abstract placeholder(index: number): string; // $1 vs ? vs @p1
  abstract disconnect(): Promise<void>;
}
```

### Phase 3: PostgreSQL 어댑터

#### 파일: `packages/server/src/services/adapters/PostgreSQLAdapter.ts`

```typescript
import { Pool } from 'pg';
import { BaseSqlAdapter } from './BaseSqlAdapter';

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
      ssl: config.ssl,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
    });
  }

  protected getPool() { return this.pool; }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  protected escapeId(id: string): string {
    return `"${id.replace(/"/g, '""')}"`;
  }

  protected placeholder(index: number): string {
    return `$${index}`;
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export const PostgreSQLAdapterFactory: AdapterFactory = {
  dialect: 'postgresql',
  displayName: 'PostgreSQL',
  create(config) { return new PostgreSQLAdapter(config as SqlConnectionOptions); },
};
```

### Phase 4: MySQL 어댑터

#### 파일: `packages/server/src/services/adapters/MySQLAdapter.ts`

```typescript
import mysql from 'mysql2/promise';
import { BaseSqlAdapter } from './BaseSqlAdapter';

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
      ssl: config.ssl ? {} : undefined,
      connectionLimit: 10,
      connectTimeout: 10000,
    });
  }

  protected getPool() { return this.pool; }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as unknown[];
  }

  protected escapeId(id: string): string {
    return `\`${id.replace(/`/g, '``')}\``;
  }

  protected placeholder(_index: number): string {
    return '?';
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export const MySQLAdapterFactory: AdapterFactory = {
  dialect: 'mysql',
  displayName: 'MySQL',
  create(config) { return new MySQLAdapter(config as SqlConnectionOptions); },
};
```

### Phase 5: MSSQL 어댑터

#### 파일: `packages/server/src/services/adapters/MSSQLAdapter.ts`

```typescript
import sql from 'mssql';
import { BaseSqlAdapter } from './BaseSqlAdapter';

export class MSSQLAdapter extends BaseSqlAdapter {
  private pool: sql.ConnectionPool;

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
        trustServerCertificate: true,
      },
      pool: { max: 10, min: 2, idleTimeoutMillis: 60000 },
      connectionTimeout: 10000,
      requestTimeout: 10000,
    });
  }

  protected getPool() { return this.pool; }

  protected async rawQuery(sql_str: string, params?: unknown[]): Promise<unknown[]> {
    await this.pool.connect();
    const request = this.pool.request();
    params?.forEach((val, i) => request.input(`p${i + 1}`, val));
    const result = await request.query(sql_str);
    return result.recordset;
  }

  protected escapeId(id: string): string {
    return `[${id.replace(/\]/g, ']]')}]`;
  }

  protected placeholder(index: number): string {
    return `@p${index}`;
  }

  async disconnect(): Promise<void> {
    await this.pool.close();
  }
}

export const MSSQLAdapterFactory: AdapterFactory = {
  dialect: 'mssql',
  displayName: 'Microsoft SQL Server',
  create(config) { return new MSSQLAdapter(config as SqlConnectionOptions); },
};
```

### Phase 6: 타입 및 검증 확장

#### 변경: `packages/common/src/types/datasource.ts`

```typescript
// Before
export interface DatabaseConfig {
  dialect: 'mongodb' | 'mysql' | 'mssql' | 'sqlite';
  connectionString: string;
  database: string;
}

// After
export type DatabaseDialect = 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';

export interface DatabaseConfig {
  dialect: DatabaseDialect;
  // MongoDB용
  connectionString?: string;
  // SQL DB 공통
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean;
}
```

#### 변경: `packages/server/src/validators/datasourceValidator.ts`

```typescript
const databaseConfigSchema = z.discriminatedUnion('dialect', [
  z.object({
    dialect: z.literal('mongodb'),
    connectionString: z.string().min(1),
    database: z.string().min(1),
  }),
  z.object({
    dialect: z.enum(['postgresql', 'mysql', 'mssql', 'sqlite']),
    host: z.string().min(1),
    port: z.number().int().positive().optional(),
    user: z.string().min(1),
    password: z.string(),
    database: z.string().min(1),
    ssl: z.boolean().optional(),
  }),
]);
```

### Phase 7: Designer UI 확장

#### 변경: `packages/designer/src/components/DataSourcePanel/DataSourcePanel.tsx`

`AddDataSourceModal`의 database 타입 선택 시:

1. `/api/datasources/dialects` API로 사용 가능한 dialect 목록 fetch
2. dialect 드롭다운 표시
3. dialect에 따라 설정 폼 전환:
   - **MongoDB**: connectionString + database (기존)
   - **SQL 계열**: host + port + user + password + database + SSL 토글

```
┌──────────────────────────────────────────────┐
│  Add Data Source                              │
├──────────────────────────────────────────────┤
│  Name: [___________________________]         │
│  Type: [Database ▼]                          │
│  Dialect: [PostgreSQL ▼]                     │
│                                              │
│  ┌─ Connection ─────────────────────────┐    │
│  │ Host:     [localhost        ]        │    │
│  │ Port:     [5432             ]        │    │
│  │ User:     [admin            ]        │    │
│  │ Password: [••••••••         ]        │    │
│  │ Database: [mydb             ]        │    │
│  │ SSL:      [✓]                        │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  [Test Connection]     [Cancel] [Create]     │
└──────────────────────────────────────────────┘
```

## 의존성 추가

```bash
# Phase 3
pnpm --filter @webform/server add pg
pnpm --filter @webform/server add -D @types/pg

# Phase 4
pnpm --filter @webform/server add mysql2

# Phase 5
pnpm --filter @webform/server add mssql
pnpm --filter @webform/server add -D @types/mssql
```

## 파일 변경 목록

### 신규 파일

| 파일 | Phase | 설명 |
|------|-------|------|
| `packages/server/src/services/adapters/AdapterRegistry.ts` | 1 | 어댑터 팩토리 레지스트리 |
| `packages/server/src/services/adapters/BaseSqlAdapter.ts` | 2 | SQL 공통 베이스 클래스 |
| `packages/server/src/services/adapters/PostgreSQLAdapter.ts` | 3 | PostgreSQL 어댑터 |
| `packages/server/src/services/adapters/MySQLAdapter.ts` | 4 | MySQL 어댑터 |
| `packages/server/src/services/adapters/MSSQLAdapter.ts` | 5 | MSSQL 어댑터 |
| `packages/server/src/services/adapters/index.ts` | 1 | 어댑터 등록 엔트리 |

### 수정 파일

| 파일 | Phase | 변경 내용 |
|------|-------|----------|
| `packages/server/src/services/DataSourceService.ts` | 1 | `createAdapter()` → 레지스트리 기반으로 교체 |
| `packages/server/src/services/adapters/MongoDBAdapter.ts` | 1 | `AdapterFactory` export 추가 |
| `packages/server/src/routes/datasources.ts` | 1 | `GET /api/datasources/dialects` 엔드포인트 추가 |
| `packages/common/src/types/datasource.ts` | 6 | `DatabaseConfig` 확장, `DatabaseDialect` 타입 |
| `packages/server/src/validators/datasourceValidator.ts` | 6 | dialect별 discriminated union 검증 |
| `packages/designer/src/components/DataSourcePanel/DataSourcePanel.tsx` | 7 | dialect 선택 UI, SQL 설정 폼 |

## 구현 순서

```
Phase 1: AdapterRegistry ──┐
                            ├── Phase 2: BaseSqlAdapter ──┬── Phase 3: PostgreSQL
                            │                             ├── Phase 4: MySQL
Phase 6: 타입/검증 ─────────┘                             └── Phase 5: MSSQL
                                                               │
Phase 7: Designer UI ──────────────────────────────────────────┘
```

- Phase 1 + 6은 병렬 진행 가능 (서버 리팩토링 + 타입 확장)
- Phase 3, 4, 5는 Phase 2 이후 독립적으로 병렬 진행 가능
- Phase 7은 모든 Phase 완료 후 진행 (또는 Phase 3 이후 점진적 추가)

## 향후 확장 가능성

- **SQLite 어댑터**: `better-sqlite3` 패키지로 로컬/프로토타입용 추가
- **커스텀 어댑터**: 사용자가 REST API로 감싼 DB를 기존 `RestApiAdapter`로 연결 (추가 개발 불필요)
- **쿼리 빌더 UI**: Designer에서 비주얼 쿼리 빌더 제공 (SQL 직접 작성 대신)
- **스키마 탐색**: 연결된 DB의 테이블/컬렉션 목록 및 스키마를 Designer에서 탐색
