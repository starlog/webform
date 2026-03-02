# AdapterRegistry 패턴 도입 구현 계획

## 1. 현재 코드의 문제점 분석

### 1.1 `DataSourceService.createAdapter()` — 하드코딩된 switch문

**파일**: `packages/server/src/services/DataSourceService.ts:240-264`

```typescript
private createAdapter(
  dataSource: DataSourceDocument & { config: unknown },
): DataSourceAdapter {
  switch (dataSource.type) {
    case 'database': {
      if (dataSource.meta.dialect !== 'mongodb') {
        throw new AppError(400, `Unsupported dialect: ${dataSource.meta.dialect}`);
      }
      return new MongoDBAdapter(config.connectionString, config.database);
    }
    case 'restApi':
      return new RestApiAdapter(dataSource.config as { ... });
    case 'static': {
      return new StaticAdapter(config.data || []);
    }
    default:
      throw new AppError(400, `Unknown data source type: ${dataSource.type}`);
  }
}
```

**문제점**:
1. **OCP(개방-폐쇄 원칙) 위반**: 새 dialect(MySQL, MSSQL, SQLite 등)를 추가할 때마다 DataSourceService.ts의 switch문을 직접 수정해야 한다
2. **직접 import 의존성**: DataSourceService가 모든 어댑터 클래스를 직접 import하고 있어, 어댑터가 늘어날수록 import 목록과 switch 분기가 비대해진다
3. **dialect 검증 로직 분산**: `'mongodb'` 문자열 비교가 서비스 레이어에 하드코딩되어 있다
4. **지원 dialect 조회 불가**: 클라이언트(Designer)가 현재 지원되는 dialect 목록을 동적으로 알 수 없다 — UI 드롭다운에서 사용할 데이터를 API로 제공할 방법이 없다

### 1.2 관련 파일의 제약사항

| 파일 | 현재 상태 | 문제 |
|------|-----------|------|
| `adapters/types.ts` | `DataSourceAdapter` 인터페이스만 정의 | 팩토리 추상화 없음 |
| `adapters/MongoDBAdapter.ts` | 클래스만 export | 팩토리 객체 없음 |
| `adapters/` 디렉토리 | `index.ts` 없음 | 중앙 등록 진입점 없음 |
| `routes/datasources.ts` | CRUD + test + query만 | dialect 목록 API 없음 |
| `models/DataSource.ts:38` | `enum: ['mongodb']` 하드코딩 | 새 dialect 추가 시 스키마도 수정 필요 |
| `validators/datasourceValidator.ts:5` | `z.literal('mongodb')` | 새 dialect 추가 시 validator도 수정 필요 |
| `routes/runtime.ts:272-379` | `MongoDBAdapter` 직접 import/사용 (5곳) | 이번 범위 외, 추후 리팩토링 대상 |

---

## 2. 변경할 파일 목록과 변경 내용 상세

### 신규 파일 (2개)

| 파일 | 역할 |
|------|------|
| `packages/server/src/services/adapters/AdapterRegistry.ts` | AdapterFactory 인터페이스, AdapterRegistry 클래스, adapterRegistry 싱글톤 |
| `packages/server/src/services/adapters/index.ts` | 어댑터 팩토리 등록 엔트리포인트 |

### 수정 파일 (3개)

| 파일 | 변경 내용 |
|------|-----------|
| `packages/server/src/services/adapters/MongoDBAdapter.ts` | `MongoDBAdapterFactory` 객체 추가 export |
| `packages/server/src/services/DataSourceService.ts` | `createAdapter()` switch문 → `adapterRegistry.create()` 호출로 교체 |
| `packages/server/src/routes/datasources.ts` | `GET /api/datasources/dialects` 엔드포인트 추가 |

### 변경하지 않는 파일

| 파일 | 사유 |
|------|------|
| `adapters/RestApiAdapter.ts` | `restApi` 타입은 dialect 기반이 아님 — AdapterRegistry는 database dialect에만 적용 |
| `adapters/StaticAdapter.ts` | `static` 타입은 dialect 기반이 아님 — 기존 로직 유지 |
| `routes/runtime.ts` | MongoDBAdapter 직접 사용 5곳 — 이번 범위 외 (추후 리팩토링) |
| `models/DataSource.ts` | `enum: ['mongodb']` — Mongoose enum은 AdapterRegistry 도입 후 별도 태스크에서 확장 |
| `validators/datasourceValidator.ts` | `z.literal('mongodb')` — 마찬가지로 별도 태스크에서 동적 검증으로 전환 |

---

## 3. AdapterRegistry 클래스 설계

### 3.1 `AdapterFactory` 인터페이스

```typescript
// packages/server/src/services/adapters/AdapterRegistry.ts

import type { DataSourceAdapter } from './types.js';

/**
 * 데이터베이스 dialect별 어댑터 팩토리.
 * 각 어댑터 모듈에서 이 인터페이스를 구현한 객체를 export한다.
 */
export interface AdapterFactory {
  /** dialect 식별자 (예: 'mongodb', 'mysql', 'mssql') */
  dialect: string;
  /** UI에 표시할 이름 (예: 'MongoDB', 'MySQL') */
  displayName: string;
  /** config 객체를 받아 어댑터 인스턴스를 생성 */
  create(config: Record<string, unknown>): DataSourceAdapter;
}
```

### 3.2 `AdapterRegistry` 클래스

```typescript
export class AdapterRegistry {
  private factories = new Map<string, AdapterFactory>();

  /**
   * 팩토리를 레지스트리에 등록한다.
   * 동일한 dialect가 이미 등록되어 있으면 에러를 throw한다.
   */
  register(factory: AdapterFactory): void {
    if (this.factories.has(factory.dialect)) {
      throw new Error(
        `AdapterRegistry: dialect '${factory.dialect}' is already registered`,
      );
    }
    this.factories.set(factory.dialect, factory);
  }

  /**
   * dialect에 해당하는 팩토리를 사용하여 어댑터를 생성한다.
   * 미등록 dialect이면 에러를 throw한다.
   */
  create(dialect: string, config: Record<string, unknown>): DataSourceAdapter {
    const factory = this.factories.get(dialect);
    if (!factory) {
      throw new Error(
        `AdapterRegistry: unsupported dialect '${dialect}'`,
      );
    }
    return factory.create(config);
  }

  /**
   * 등록된 모든 dialect 목록을 반환한다.
   * Designer UI의 dialect 드롭다운에서 사용.
   */
  listDialects(): Array<{ dialect: string; displayName: string }> {
    return Array.from(this.factories.values()).map((f) => ({
      dialect: f.dialect,
      displayName: f.displayName,
    }));
  }

  /**
   * 특정 dialect가 등록되어 있는지 확인한다.
   */
  has(dialect: string): boolean {
    return this.factories.has(dialect);
  }
}
```

### 3.3 싱글톤 export

```typescript
/** 앱 전역 싱글톤 레지스트리 */
export const adapterRegistry = new AdapterRegistry();
```

---

## 4. MongoDBAdapterFactory 추가

### 4.1 `MongoDBAdapter.ts` 변경

파일 하단에 팩토리 객체를 추가한다:

```typescript
// packages/server/src/services/adapters/MongoDBAdapter.ts

import type { AdapterFactory } from './AdapterRegistry.js';

// ... 기존 MongoDBAdapter 클래스 그대로 유지 ...

/**
 * MongoDBAdapter를 생성하는 팩토리 객체.
 * AdapterRegistry에 등록하여 사용한다.
 */
export const MongoDBAdapterFactory: AdapterFactory = {
  dialect: 'mongodb',
  displayName: 'MongoDB',
  create(config: Record<string, unknown>) {
    const connectionString = config.connectionString as string;
    const database = config.database as string;
    if (!connectionString || !database) {
      throw new Error('MongoDB adapter requires connectionString and database');
    }
    return new MongoDBAdapter(connectionString, database);
  },
};
```

---

## 5. 어댑터 등록 엔트리포인트

### 5.1 `adapters/index.ts` 신규 생성

```typescript
// packages/server/src/services/adapters/index.ts

export { adapterRegistry } from './AdapterRegistry.js';
export type { AdapterFactory } from './AdapterRegistry.js';
export type { DataSourceAdapter } from './types.js';

// — 어댑터 팩토리 등록 —
import { MongoDBAdapterFactory } from './MongoDBAdapter.js';
import { adapterRegistry } from './AdapterRegistry.js';

adapterRegistry.register(MongoDBAdapterFactory);

// 향후 추가 어댑터 등록 예시:
// import { MySQLAdapterFactory } from './MySQLAdapter.js';
// adapterRegistry.register(MySQLAdapterFactory);
```

**설계 결정**: `index.ts` import 시 사이드이펙트로 팩토리가 자동 등록된다. 이는 Go의 `import _ "driver/mysql"` 패턴과 유사하며, 어댑터 추가 시 이 파일에 2줄(import + register)만 추가하면 된다.

---

## 6. DataSourceService 변경 방법

### 6.1 import 변경

```diff
- import { MongoDBAdapter } from './adapters/MongoDBAdapter.js';
- import { RestApiAdapter } from './adapters/RestApiAdapter.js';
- import { StaticAdapter } from './adapters/StaticAdapter.js';
- import type { DataSourceAdapter } from './adapters/types.js';
+ import { adapterRegistry } from './adapters/index.js';
+ import { RestApiAdapter } from './adapters/RestApiAdapter.js';
+ import { StaticAdapter } from './adapters/StaticAdapter.js';
+ import type { DataSourceAdapter } from './adapters/types.js';
```

**참고**: `RestApiAdapter`와 `StaticAdapter`는 `database` 타입의 dialect 기반 어댑터가 아니므로 직접 import을 유지한다.

### 6.2 `createAdapter()` 메서드 변경

```typescript
private createAdapter(
  dataSource: DataSourceDocument & { config: unknown },
): DataSourceAdapter {
  switch (dataSource.type) {
    case 'database': {
      const config = dataSource.config as Record<string, unknown>;
      const dialect = dataSource.meta.dialect;
      if (!dialect) {
        throw new AppError(400, 'Database data source requires a dialect');
      }
      return adapterRegistry.create(dialect, config);
    }
    case 'restApi':
      return new RestApiAdapter(dataSource.config as {
        baseUrl: string;
        headers?: Record<string, string>;
        auth?: { type: 'bearer' | 'basic' | 'apiKey'; token?: string; username?: string; password?: string; apiKey?: string; headerName?: string };
      });
    case 'static': {
      const config = dataSource.config as { data?: unknown[] };
      return new StaticAdapter(config.data || []);
    }
    default:
      throw new AppError(400, `Unknown data source type: ${dataSource.type}`);
  }
}
```

**변경 포인트**:
- `case 'database'` 분기에서 `if (dialect !== 'mongodb')` 하드코딩 제거
- `new MongoDBAdapter(...)` 직접 생성 → `adapterRegistry.create(dialect, config)` 위임
- `MongoDBAdapter` import 제거
- `restApi`, `static` 분기는 **그대로 유지** (이들은 dialect 기반이 아님)

---

## 7. dialects API 엔드포인트 설계

### 7.1 엔드포인트 명세

| 항목 | 값 |
|------|-----|
| Method | `GET` |
| Path | `/api/datasources/dialects` |
| Auth | 인증 필요 (기존 미들웨어) |
| Response | `{ data: Array<{ dialect: string; displayName: string }> }` |

### 7.2 응답 예시

```json
{
  "data": [
    { "dialect": "mongodb", "displayName": "MongoDB" }
  ]
}
```

향후 어댑터 추가 시 자동으로 목록에 포함된다:
```json
{
  "data": [
    { "dialect": "mongodb", "displayName": "MongoDB" },
    { "dialect": "mysql", "displayName": "MySQL" },
    { "dialect": "mssql", "displayName": "Microsoft SQL Server" }
  ]
}
```

### 7.3 라우터 코드

```typescript
// packages/server/src/routes/datasources.ts

import { adapterRegistry } from '../services/adapters/index.js';

// GET /api/datasources/dialects — 지원 dialect 목록
// 주의: /:id 라우트보다 먼저 선언해야 'dialects'가 :id로 캡처되지 않음
datasourcesRouter.get('/dialects', (_req, res) => {
  res.json({ data: adapterRegistry.listDialects() });
});
```

**중요**: `/dialects` 라우트는 `/:id` 라우트보다 **위에** 선언해야 한다. Express는 라우트를 선언 순서대로 매칭하므로, `/:id`가 먼저 선언되면 `'dialects'`가 id 파라미터로 캡처된다.

따라서 `datasourcesRouter.get('/', ...)` 바로 아래, `datasourcesRouter.get('/:id', ...)` 위에 배치한다.

---

## 8. 테스트 전략

### 8.1 신규 단위 테스트

**파일**: `packages/server/src/__tests__/AdapterRegistry.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../services/adapters/AdapterRegistry';
import type { AdapterFactory } from '../services/adapters/AdapterRegistry';

// mock 팩토리
const mockFactory: AdapterFactory = {
  dialect: 'test-db',
  displayName: 'Test Database',
  create: (config) => ({
    testConnection: async () => ({ success: true, message: 'ok' }),
    executeQuery: async () => [],
    disconnect: async () => {},
  }),
};
```

| 테스트 케이스 | 검증 내용 |
|---------------|-----------|
| `register() + create()` | 등록한 팩토리로 어댑터가 정상 생성되는지 |
| `create() — 미등록 dialect` | `'unsupported dialect'` 에러 throw |
| `register() — 중복 dialect` | `'already registered'` 에러 throw |
| `listDialects()` | 등록된 dialect/displayName 배열 반환 |
| `listDialects() — 빈 레지스트리` | 빈 배열 반환 |
| `has()` | 등록 여부 확인 true/false |

### 8.2 기존 테스트 영향도

| 테스트 파일 | 영향 | 대응 |
|-------------|------|------|
| `DataSourceService.test.ts` | `createAdapter` 내부 구현 변경 | 외부 API(testConnection, executeQuery) 레벨에서 테스트하므로 영향 없을 가능성 높음. 실패 시 mock 조정 |
| `MongoDBAdapter.test.ts` | 변경 없음 | 영향 없음 |

### 8.3 테스트 실행 명령

```bash
# AdapterRegistry 단위 테스트
cd packages/server && npx vitest run src/__tests__/AdapterRegistry.test.ts

# 기존 테스트 전체 실행 (회귀 테스트)
pnpm --filter @webform/server test

# 타입 체크
pnpm typecheck

# 린트
pnpm lint
```

---

## 9. 구현 순서

```
Step 1: AdapterRegistry.ts 신규 생성
  └─ AdapterFactory 인터페이스 + AdapterRegistry 클래스 + adapterRegistry 싱글톤

Step 2: MongoDBAdapter.ts 수정
  └─ MongoDBAdapterFactory 객체 export 추가

Step 3: adapters/index.ts 신규 생성
  └─ MongoDBAdapterFactory 등록 + re-export

Step 4: DataSourceService.ts 수정
  └─ import 변경 + createAdapter() switch 'database' 분기 수정

Step 5: routes/datasources.ts 수정
  └─ GET /api/datasources/dialects 엔드포인트 추가

Step 6: AdapterRegistry.test.ts 작성 및 실행

Step 7: 전체 테스트 + 타입체크 + 린트
```

---

## 10. 향후 확장 시나리오

새로운 dialect(예: MySQL)를 추가할 때 필요한 작업:

1. `packages/server/src/services/adapters/MySQLAdapter.ts` — 어댑터 클래스 + `MySQLAdapterFactory` export
2. `packages/server/src/services/adapters/index.ts` — 2줄 추가:
   ```typescript
   import { MySQLAdapterFactory } from './MySQLAdapter.js';
   adapterRegistry.register(MySQLAdapterFactory);
   ```
3. `models/DataSource.ts` — `enum: ['mongodb', 'mysql']` 추가
4. `validators/datasourceValidator.ts` — `z.literal('mongodb')` → `z.enum(['mongodb', 'mysql'])` 변경

**DataSourceService.ts는 수정 불필요** — 이것이 AdapterRegistry 패턴의 핵심 이점이다.

---

## 11. 설계 결정 요약

| 결정 | 선택 | 이유 |
|------|------|------|
| Registry 범위 | `database` dialect만 | `restApi`/`static`은 단일 구현이므로 registry 불필요 |
| 등록 방식 | `index.ts` import 사이드이펙트 | 명시적이고 트리쉐이킹 가능, DI 컨테이너보다 단순 |
| 싱글톤 vs DI | 모듈 레벨 싱글톤 | 기존 프로젝트가 DI 프레임워크 미사용, 일관성 유지 |
| 중복 등록 | 에러 throw | 실수 방지, fail-fast |
| dialects API 위치 | `/api/datasources/dialects` | 기존 datasources 리소스의 하위 경로로 자연스러움 |
