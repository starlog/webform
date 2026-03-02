# 타입 및 검증 확장 설계 계획

> 다중 데이터베이스(PostgreSQL, MySQL, MSSQL, SQLite) 지원을 위한 공통 타입, Zod 검증 스키마, DataSourceService 변경 계획

## 1. 현재 타입 구조 분석

### 1.1 packages/common/src/types/datasource.ts

```typescript
export interface DatabaseConfig {
  dialect: 'mongodb' | 'mysql' | 'mssql' | 'sqlite';
  connectionString: string;  // MongoDB 전용 필드가 모든 dialect에 필수
  database: string;
}
```

**문제점:**
- `connectionString`이 모든 dialect에 필수로 선언되어 있으나, SQL DB들은 host/port/user/password 방식이 표준
- `postgresql` dialect가 타입에 누락되어 있음
- dialect별 필수/선택 필드 구분이 없는 flat 구조

### 1.2 packages/server/src/validators/datasourceValidator.ts

```typescript
const databaseConfigSchema = z.object({
  dialect: z.literal('mongodb'),  // MongoDB만 허용
  connectionString: z.string().min(1),
  database: z.string().min(1),
});
```

**문제점:**
- `z.literal('mongodb')`로 하드코딩되어 다른 dialect 입력 시 검증 실패
- SQL DB용 필드(host, port, user, password, ssl) 스키마 부재

### 1.3 packages/server/src/services/DataSourceService.ts

```typescript
// createDataSource()
case 'database': {
  const { dialect, connectionString, database } = input.config;
  doc.encryptedConfig = this.encryption.encrypt(
    JSON.stringify({ connectionString, database }),
  );
  doc.meta = { dialect };
  break;
}

// createAdapter()
if (dataSource.meta.dialect !== 'mongodb') {
  throw new AppError(400, `Unsupported dialect: ${dataSource.meta.dialect}`);
}
return new MongoDBAdapter(config.connectionString, config.database);
```

**문제점:**
- `createDataSource()`에서 connectionString만 암호화 — SQL DB의 host/user/password 처리 로직 없음
- `createAdapter()`에서 MongoDB 외 dialect는 에러 throw — 확장 불가

### 1.4 DataSource Mongoose 모델

```typescript
meta: {
  dialect?: 'mongodb';  // 'mongodb'만 타입 허용
  baseUrl?: string;
}
```

- meta.dialect 타입이 `'mongodb'`로 한정되어 있어 확장 필요

---

## 2. 변경할 파일 목록과 상세 변경 내용

### 2.1 packages/common/src/types/datasource.ts

**변경 사항:** DatabaseConfig를 discriminated union 기반으로 재설계

```typescript
// --- 새로운 타입 정의 ---

/** 지원 데이터베이스 방언 */
export type DatabaseDialect = 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';

/** MongoDB 전용 설정 */
export interface MongoDBConfig {
  dialect: 'mongodb';
  connectionString: string;
  database: string;
}

/** SQL DB 공통 설정 (PostgreSQL, MySQL, MSSQL) */
export interface SqlDBConfig {
  dialect: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
}

/** SQLite 설정 */
export interface SqliteConfig {
  dialect: 'sqlite';
  database: string;  // 파일 경로 또는 ':memory:'
}

/** 통합 DatabaseConfig (discriminated union) */
export type DatabaseConfig = MongoDBConfig | SqlDBConfig | SqliteConfig;
```

**하위 호환성:**
- 기존 `DatabaseConfig` 타입명을 유지하되, union으로 변경
- 기존 MongoDB 데이터는 `{ dialect: 'mongodb', connectionString, database }` 형태이므로 `MongoDBConfig`에 자연스럽게 매칭
- `DataSourceDefinition.config` 타입은 변경 없음 (`DatabaseConfig | RestApiConfig | StaticConfig`)

### 2.2 packages/server/src/validators/datasourceValidator.ts

**변경 사항:** databaseConfigSchema를 dialect별 discriminated union으로 교체

```typescript
// --- MongoDB config ---
const mongoDBConfigSchema = z.object({
  dialect: z.literal('mongodb'),
  connectionString: z.string().min(1, 'connectionString은 필수입니다'),
  database: z.string().min(1, 'database는 필수입니다'),
});

// --- SQL DB 공통 config (PostgreSQL, MySQL, MSSQL) ---
const sqlDBConfigSchema = z.object({
  dialect: z.enum(['postgresql', 'mysql', 'mssql']),
  host: z.string().min(1, 'host는 필수입니다'),
  port: z.number().int().positive().max(65535).optional(),
  user: z.string().min(1, 'user는 필수입니다'),
  password: z.string().min(1, 'password는 필수입니다'),
  database: z.string().min(1, 'database는 필수입니다'),
  ssl: z.boolean().optional(),
});

// --- SQLite config ---
const sqliteConfigSchema = z.object({
  dialect: z.literal('sqlite'),
  database: z.string().min(1, 'database 경로는 필수입니다'),
});

// --- 통합 database config (discriminated union on 'dialect') ---
const databaseConfigSchema = z.discriminatedUnion('dialect', [
  mongoDBConfigSchema,
  sqlDBConfigSchema,  // 주의: z.discriminatedUnion은 리터럴만 지원
  sqliteConfigSchema,
]);
```

**z.discriminatedUnion 제약 사항:**
- `z.discriminatedUnion`은 discriminator에 `z.enum()`을 직접 사용할 수 없음
- 해결: `sqlDBConfigSchema`를 각 dialect별로 분리하거나, `z.union()` + `superRefine()`으로 대체

**실제 구현 방안 (z.union + superRefine):**

```typescript
const databaseConfigSchema = z
  .union([mongoDBConfigSchema, postgresqlConfigSchema, mysqlConfigSchema, mssqlConfigSchema, sqliteConfigSchema])
  .superRefine((data, ctx) => {
    // 각 dialect에 대해 Zod가 자동으로 매칭된 스키마를 검증
    // superRefine은 추가 커스텀 검증이 필요할 때 사용
  });
```

**또는 각 dialect별 개별 스키마:**

```typescript
const postgresqlConfigSchema = z.object({
  dialect: z.literal('postgresql'),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).optional(),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  ssl: z.boolean().optional(),
});

const mysqlConfigSchema = z.object({
  dialect: z.literal('mysql'),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).optional(),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  ssl: z.boolean().optional(),
});

const mssqlConfigSchema = z.object({
  dialect: z.literal('mssql'),
  host: z.string().min(1),
  port: z.number().int().positive().max(65535).optional(),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  ssl: z.boolean().optional(),
});

// 각 리터럴 dialect를 사용하므로 z.discriminatedUnion 사용 가능
const databaseConfigSchema = z.discriminatedUnion('dialect', [
  mongoDBConfigSchema,
  postgresqlConfigSchema,
  mysqlConfigSchema,
  mssqlConfigSchema,
  sqliteConfigSchema,
]);
```

**권장: 각 dialect별 개별 스키마 방식** — `z.discriminatedUnion`을 정확히 활용할 수 있고, 에러 메시지가 명확함

**updateDataSourceSchema 변경:**
```typescript
export const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  config: z.union([
    databaseConfigSchema,
    restApiConfigSchema,
    staticConfigSchema,
  ]).optional(),
});
```

### 2.3 packages/server/src/services/DataSourceService.ts

**createDataSource() 변경:**

```typescript
case 'database': {
  const config = input.config;
  const { dialect } = config;

  if (dialect === 'mongodb') {
    // MongoDB: connectionString + database 암호화
    const { connectionString, database } = config;
    doc.encryptedConfig = this.encryption.encrypt(
      JSON.stringify({ connectionString, database }),
    );
  } else if (dialect === 'sqlite') {
    // SQLite: database(파일 경로)만 암호화
    const { database } = config;
    doc.encryptedConfig = this.encryption.encrypt(
      JSON.stringify({ database }),
    );
  } else {
    // SQL DB (postgresql, mysql, mssql): 민감 필드 전체 암호화
    const { host, port, user, password, database, ssl } = config;
    doc.encryptedConfig = this.encryption.encrypt(
      JSON.stringify({ host, port, user, password, database, ssl }),
    );
  }

  doc.meta = { dialect };
  break;
}
```

**updateDataSource() 변경:**

```typescript
case 'database': {
  const cfg = input.config as DatabaseConfig;
  const { dialect } = cfg;

  if (dialect === 'mongodb') {
    const { connectionString, database } = cfg as MongoDBConfig;
    update.encryptedConfig = this.encryption.encrypt(
      JSON.stringify({ connectionString, database }),
    );
  } else if (dialect === 'sqlite') {
    const { database } = cfg as SqliteConfig;
    update.encryptedConfig = this.encryption.encrypt(
      JSON.stringify({ database }),
    );
  } else {
    const { host, port, user, password, database, ssl } = cfg as SqlDBConfig;
    update.encryptedConfig = this.encryption.encrypt(
      JSON.stringify({ host, port, user, password, database, ssl }),
    );
  }

  update['meta.dialect'] = dialect;
  break;
}
```

**createAdapter() 변경 (현 단계에서는 미구현 어댑터 안내):**

```typescript
case 'database': {
  const config = dataSource.config as Record<string, unknown>;
  const dialect = dataSource.meta.dialect as DatabaseDialect;

  switch (dialect) {
    case 'mongodb':
      return new MongoDBAdapter(
        config.connectionString as string,
        config.database as string,
      );
    case 'postgresql':
    case 'mysql':
    case 'mssql':
    case 'sqlite':
      // Phase 2에서 각 어댑터 구현 예정
      throw new AppError(
        501,
        `${dialect} adapter is not yet implemented`,
      );
    default:
      throw new AppError(400, `Unsupported dialect: ${dialect}`);
  }
}
```

### 2.4 packages/server/src/models/DataSource.ts

**meta.dialect 타입 확장:**

```typescript
meta: {
  dialect?: 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';
  baseUrl?: string;
}
```

---

## 3. SQL DB config 암호화 처리 방법

### 3.1 암호화 대상

| dialect    | 암호화 필드                                    | 평문 저장 |
|------------|----------------------------------------------|----------|
| mongodb    | `connectionString`, `database`                | 없음     |
| postgresql | `host`, `port`, `user`, `password`, `database`, `ssl` | 없음     |
| mysql      | `host`, `port`, `user`, `password`, `database`, `ssl` | 없음     |
| mssql      | `host`, `port`, `user`, `password`, `database`, `ssl` | 없음     |
| sqlite     | `database` (파일 경로)                         | 없음     |

### 3.2 암호화 흐름

```
클라이언트 → POST /api/datasources
  config: { dialect: 'postgresql', host: '...', port: 5432, user: '...', password: '...', database: '...', ssl: true }
    ↓
Zod 검증 (postgresqlConfigSchema)
    ↓
DataSourceService.createDataSource()
    ↓
  dialect 분기:
    → 'mongodb':  encrypt({ connectionString, database })
    → 'sqlite':   encrypt({ database })
    → 기타 SQL:   encrypt({ host, port, user, password, database, ssl })
    ↓
  MongoDB 저장:
    encryptedConfig: "iv_hex:ciphertext_hex"  (AES-256-CBC)
    meta: { dialect: 'postgresql' }           (평문, 검색/필터용)
```

### 3.3 복호화 흐름 (기존 로직 변경 없음)

```
getDataSource(id)
    ↓
  doc.encryptedConfig → decrypt() → JSON.parse()
    ↓
  config 객체 반환 (dialect에 따라 필드 구성이 다름)
```

기존 `getDataSource()`의 복호화 로직은 변경할 필요 없음. `encryptedConfig`를 단순히 decrypt → JSON.parse하므로, 암호화 시 저장한 필드가 그대로 복원됨.

---

## 4. meta 필드에 저장할 항목

### 4.1 현재 meta 구조

```typescript
meta: {
  dialect?: 'mongodb';   // database 타입
  baseUrl?: string;       // restApi 타입
}
```

### 4.2 변경 후 meta 구조

```typescript
meta: {
  dialect?: DatabaseDialect;  // database 타입 — 항상 저장
  baseUrl?: string;            // restApi 타입
}
```

**dialect가 항상 meta에 저장되는 이유:**
1. **어댑터 선택**: `createAdapter()`에서 `meta.dialect`로 어댑터를 결정 — 전체 config를 복호화하지 않아도 됨
2. **목록 조회 최적화**: `listDataSources()`에서 `-encryptedConfig`로 민감 정보를 제외하면서도 dialect 정보는 표시 가능
3. **필터링**: 향후 dialect별 데이터소스 필터링에 활용

**추가 meta 필드 고려 (선택):**
- `meta.host`를 평문으로 저장하면 목록에서 연결 대상 호스트를 표시할 수 있으나, 보안 정책에 따라 결정
- 현재 단계에서는 `dialect`만 meta에 저장 (최소한의 변경)

---

## 5. 검증 스키마 설계

### 5.1 createDataSourceSchema

```
createDataSourceSchema (discriminatedUnion on 'type')
├─ type: 'database'
│  ├─ name: string (1~200자)
│  ├─ description: string (0~500자, default '')
│  ├─ projectId: string (필수)
│  └─ config: databaseConfigSchema (discriminatedUnion on 'dialect')
│     ├─ dialect: 'mongodb'
│     │  ├─ connectionString: string (필수)
│     │  └─ database: string (필수)
│     ├─ dialect: 'postgresql'
│     │  ├─ host: string (필수)
│     │  ├─ port: number (1~65535, optional, default 5432)
│     │  ├─ user: string (필수)
│     │  ├─ password: string (필수)
│     │  ├─ database: string (필수)
│     │  └─ ssl: boolean (optional)
│     ├─ dialect: 'mysql'
│     │  ├─ host: string (필수)
│     │  ├─ port: number (1~65535, optional, default 3306)
│     │  ├─ user: string (필수)
│     │  ├─ password: string (필수)
│     │  ├─ database: string (필수)
│     │  └─ ssl: boolean (optional)
│     ├─ dialect: 'mssql'
│     │  ├─ host: string (필수)
│     │  ├─ port: number (1~65535, optional, default 1433)
│     │  ├─ user: string (필수)
│     │  ├─ password: string (필수)
│     │  ├─ database: string (필수)
│     │  └─ ssl: boolean (optional)
│     └─ dialect: 'sqlite'
│        └─ database: string (필수, 파일 경로)
├─ type: 'restApi'   (변경 없음)
└─ type: 'static'    (변경 없음)
```

### 5.2 기본 포트 값

| Dialect    | 기본 포트 |
|-----------|----------|
| PostgreSQL | 5432     |
| MySQL      | 3306     |
| MSSQL      | 1433     |
| SQLite     | N/A      |

기본 포트는 **Zod 스키마의 default가 아닌 어댑터 레벨**에서 처리하는 것을 권장. 스키마에서는 `optional()`로 선언하고, 어댑터 생성 시 미입력이면 기본 포트 적용.

### 5.3 SQL DB 공통 필드 헬퍼 (DRY)

스키마 중복을 줄이기 위해 공통 필드를 추출:

```typescript
/** SQL DB 공통 필드 */
const sqlCommonFields = {
  host: z.string().min(1, 'host는 필수입니다'),
  port: z.number().int().positive().max(65535).optional(),
  user: z.string().min(1, 'user는 필수입니다'),
  password: z.string().min(1, 'password는 필수입니다'),
  database: z.string().min(1, 'database는 필수입니다'),
  ssl: z.boolean().optional(),
};

const postgresqlConfigSchema = z.object({
  dialect: z.literal('postgresql'),
  ...sqlCommonFields,
});

const mysqlConfigSchema = z.object({
  dialect: z.literal('mysql'),
  ...sqlCommonFields,
});

const mssqlConfigSchema = z.object({
  dialect: z.literal('mssql'),
  ...sqlCommonFields,
});
```

---

## 6. 하위 호환성 고려사항

### 6.1 기존 MongoDB 데이터 호환

**기존 MongoDB에 저장된 데이터:**
```json
{
  "type": "database",
  "encryptedConfig": "iv:cipher",
  "meta": { "dialect": "mongodb" }
}
```

- 복호화 시: `{ "connectionString": "...", "database": "..." }` → `MongoDBConfig`와 호환
- `meta.dialect`가 이미 `'mongodb'`이므로 변경 없이 동작
- **마이그레이션 불필요**

### 6.2 TypeScript 타입 호환

| 변경 전 | 변경 후 | 영향 |
|---------|---------|------|
| `DatabaseConfig` (interface) | `DatabaseConfig` (type alias, union) | `interface`→`type`으로 변경되므로, `extends`로 상속받는 코드가 있다면 영향 받음. 현재 코드베이스에서 `DatabaseConfig`를 extend하는 곳 없음 |
| `dialect: 'mongodb' \| 'mysql' \| 'mssql' \| 'sqlite'` | `DatabaseDialect` 타입 | 기존 4개 dialect를 모두 포함하므로 호환 |
| `connectionString: string` (필수) | `connectionString?: string` (MongoDB만) | union 타입이므로 dialect 검사 후 접근해야 함 — 기존 코드에서 `input.config.connectionString` 직접 접근하던 곳 수정 필요 |

### 6.3 API 호환

- **기존 API 요청:** `{ dialect: 'mongodb', connectionString: '...', database: '...' }` → 새 스키마에서도 유효
- **새 API 요청:** `{ dialect: 'postgresql', host: '...', ... }` → 새 스키마에서만 유효
- **Breaking change 없음** — 기존 MongoDB 요청은 그대로 동작

### 6.4 Zod 검증 호환

- 기존: `dialect: z.literal('mongodb')` → 변경 후: `z.discriminatedUnion('dialect', [...])`
- MongoDB 입력은 기존과 동일한 필드로 검증 통과
- SQL DB 입력은 새로 추가된 스키마로 검증

### 6.5 DataSource 모델 (Mongoose)

- `meta.dialect` 타입을 문자열 union으로 확장
- Mongoose 스키마에서 `meta`는 `Schema.Types.Mixed`이므로 실질적 변경 최소화
- DB 레벨 마이그레이션 불필요

---

## 7. 구현 순서 (권장)

```
Step 1: packages/common — 타입 변경
  ├─ DatabaseDialect 타입 추가
  ├─ MongoDBConfig, SqlDBConfig, SqliteConfig 인터페이스 추가
  └─ DatabaseConfig를 union 타입으로 변경

Step 2: packages/server — Zod 검증 스키마 변경
  ├─ dialect별 개별 스키마 정의
  ├─ databaseConfigSchema를 discriminatedUnion으로 변경
  └─ createDataSourceSchema, updateDataSourceSchema 업데이트

Step 3: packages/server — DataSourceService 변경
  ├─ createDataSource()에서 dialect별 암호화 분기
  ├─ updateDataSource()에서 dialect별 암호화 분기
  └─ createAdapter()에서 dialect별 분기 (미구현 어댑터는 501 에러)

Step 4: packages/server — DataSource 모델 타입 확장
  └─ meta.dialect 타입을 DatabaseDialect로 확장

Step 5: 테스트
  ├─ Zod 스키마 단위 테스트 (각 dialect 유효/무효 입력)
  ├─ DataSourceService 통합 테스트 (생성/수정/조회 흐름)
  └─ TypeScript 타입 체크 (pnpm typecheck)
```

---

## 8. 요약

| 항목 | 내용 |
|-----|------|
| 변경 파일 수 | 4개 |
| 새 타입 | `DatabaseDialect`, `MongoDBConfig`, `SqlDBConfig`, `SqliteConfig` |
| 암호화 대상 | MongoDB: connectionString+database / SQL: host+port+user+password+database+ssl / SQLite: database |
| meta 저장 | `dialect` (항상) |
| 검증 방식 | `z.discriminatedUnion('dialect', [...])` — 각 dialect별 리터럴 스키마 |
| 하위 호환 | 기존 MongoDB 데이터/API 완전 호환, 마이그레이션 불필요 |
| 미구현 사항 | SQL/SQLite 어댑터 (Phase 2에서 구현 예정) |
