# 데이터소스 서비스 구현 계획

## 1. 개요

PRD 섹션 4.1.6(데이터소스 설정 및 데이터 바인딩)과 5.2(보안 요구사항)를 기반으로 데이터소스 CRUD, 연결 테스트, 쿼리 실행 API를 구현한다. 데이터소스 연결 정보는 AES-256-CBC로 암호화 저장하며, 어댑터 패턴으로 MongoDB/REST API/Static 타입을 지원한다.

**의존성**: `common-types-commit`, `server-foundation-commit`, `form-crud-api-commit` (완료됨)

**생성/수정 파일**:
| 파일 | 역할 |
|------|------|
| `packages/server/src/models/DataSource.ts` | Mongoose 스키마 및 인터페이스 |
| `packages/server/src/services/EncryptionService.ts` | AES-256-CBC 암호화/복호화 |
| `packages/server/src/services/adapters/MongoDBAdapter.ts` | MongoDB 데이터소스 어댑터 |
| `packages/server/src/services/adapters/RestApiAdapter.ts` | REST API 데이터소스 어댑터 |
| `packages/server/src/services/adapters/StaticAdapter.ts` | 정적 데이터 어댑터 |
| `packages/server/src/services/DataSourceService.ts` | 데이터소스 비즈니스 로직 |
| `packages/server/src/validators/datasourceValidator.ts` | Zod 검증 스키마 |
| `packages/server/src/routes/datasources.ts` | Express 라우터 핸들러 (기존 스텁 교체) |

---

## 2. MongoDB 스키마

### 2.1 DataSourceDocument 인터페이스

파일: `packages/server/src/models/DataSource.ts`

```typescript
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface DataSourceDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: 'database' | 'restApi' | 'static';
  description?: string;
  projectId: string;

  // 암호화된 config JSON 문자열 (database, restApi 타입)
  // EncryptionService로 암호화/복호화
  encryptedConfig?: string;

  // static 타입 전용 (암호화 불필요)
  staticData?: any[];

  // 메타데이터 (PRD 섹션 4.1.6의 dialect 등 비민감 정보)
  meta: {
    dialect?: 'mongodb';           // database 타입 시 dialect
    baseUrl?: string;              // restApi 타입 시 baseUrl (민감 정보 아님)
  };

  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;         // soft delete
  createdAt: Date;
  updatedAt: Date;
}
```

**설계 결정**: `config` 전체를 JSON 직렬화 후 암호화하여 `encryptedConfig` 단일 필드에 저장한다. 이유:
- 필드별 암호화보다 구현이 단순하고 누락 위험이 없음
- `meta` 필드에 비민감 정보만 별도 저장하여 목록 조회 시 활용

### 2.2 Mongoose 스키마

```typescript
const dataSourceSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 200 },
    type: { type: String, required: true, enum: ['database', 'restApi', 'static'] },
    description: { type: String, default: '' },
    projectId: { type: String, required: true },
    encryptedConfig: { type: String, default: null },
    staticData: { type: Schema.Types.Mixed, default: null },
    meta: {
      dialect: { type: String, enum: ['mongodb'], default: null },
      baseUrl: { type: String, default: null },
    },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

dataSourceSchema.index({ projectId: 1, deletedAt: 1 });
dataSourceSchema.index({ type: 1 });
dataSourceSchema.index({ name: 'text' });

export const DataSource: Model<DataSourceDocument> =
  mongoose.model<DataSourceDocument>('DataSource', dataSourceSchema);
```

---

## 3. EncryptionService

파일: `packages/server/src/services/EncryptionService.ts`

### 3.1 설계

- **알고리즘**: AES-256-CBC (Node.js `crypto` 내장 모듈)
- **키**: `ENCRYPTION_KEY` 환경변수 (64자 hex = 32바이트)
- **IV**: 매 암호화마다 `crypto.randomBytes(16)`으로 새 IV 생성
- **저장 형식**: `{iv_hex}:{ciphertext_hex}` (콜론 구분)

### 3.2 클래스 구조

```typescript
import crypto from 'node:crypto';
import { env } from '../config/index.js';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

export class EncryptionService {
  private key: Buffer;

  constructor() {
    this.key = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32바이트
  }

  /**
   * 평문을 AES-256-CBC로 암호화
   * @returns "iv_hex:ciphertext_hex" 형식 문자열
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * "iv_hex:ciphertext_hex" 형식 문자열을 복호화
   */
  decrypt(encryptedText: string): string {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
```

---

## 4. 어댑터 패턴

### 4.1 공통 인터페이스

```typescript
// 각 어댑터가 구현하는 공통 인터페이스
export interface DataSourceAdapter {
  testConnection(): Promise<{ success: boolean; message: string }>;
  executeQuery(query: Record<string, unknown>): Promise<unknown[]>;
  disconnect(): Promise<void>;
}
```

### 4.2 MongoDBAdapter

파일: `packages/server/src/services/adapters/MongoDBAdapter.ts`

```typescript
import { MongoClient } from 'mongodb';
import { sanitizeQueryInput } from '@webform/common';
import { AppError } from '../../middleware/errorHandler.js';

const QUERY_TIMEOUT_MS = 10_000; // 10초

export class MongoDBAdapter implements DataSourceAdapter {
  private client: MongoClient | null = null;

  constructor(
    private connectionString: string,
    private database: string,
  ) {}

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const client = new MongoClient(this.connectionString, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await client.connect();
      await client.db(this.database).command({ ping: 1 });
      await client.close();
      return { success: true, message: 'Connection successful' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    // query 형식: { collection: string, filter?: object, projection?: object, limit?: number }
    const { collection, filter = {}, projection, limit = 100 } = query as any;

    if (!collection || typeof collection !== 'string') {
      throw new AppError(400, 'collection is required');
    }

    // NoSQL 인젝션 방지: sanitizeQueryInput 적용
    const sanitizedFilter = sanitizeQueryInput(filter as Record<string, unknown>);

    const client = new MongoClient(this.connectionString, {
      serverSelectionTimeoutMS: QUERY_TIMEOUT_MS,
    });

    try {
      await client.connect();
      const db = client.db(this.database);
      const cursor = db.collection(collection)
        .find(sanitizedFilter, {
          projection,
          maxTimeMS: QUERY_TIMEOUT_MS,
        })
        .limit(Math.min(limit, 1000));   // 최대 1000건 제한

      const results = await cursor.toArray();
      return results;
    } finally {
      await client.close();
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}
```

**보안 조치**:
1. `sanitizeQueryInput`으로 `$where`, `$function`, `$accumulator`, `$expr` 연산자 차단 (기존 common 유틸리티 재사용)
2. `maxTimeMS: 10000`으로 쿼리 타임아웃 적용
3. 결과 최대 1000건 제한
4. 매 쿼리마다 새 연결 생성/해제 (커넥션 풀 오염 방지)

**참고**: PRD에서 `dialect: 'mongodb' | 'mysql' | 'mssql' | 'sqlite'`를 정의하지만, 1차 구현에서는 MongoDB만 지원한다. 다른 dialect는 추후 확장 시 별도 어댑터로 추가한다.

### 4.3 RestApiAdapter

파일: `packages/server/src/services/adapters/RestApiAdapter.ts`

```typescript
import { AppError } from '../../middleware/errorHandler.js';

const QUERY_TIMEOUT_MS = 10_000;

interface RestApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apiKey';
    token?: string;         // bearer
    username?: string;       // basic
    password?: string;       // basic
    apiKey?: string;         // apiKey
    headerName?: string;     // apiKey
  };
}

export class RestApiAdapter implements DataSourceAdapter {
  constructor(private config: RestApiConfig) {}

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return {
        success: response.ok,
        message: response.ok ? 'Connection successful' : `HTTP ${response.status}`,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    // query 형식: { path: string, method?: string, params?: object, body?: object }
    const { path = '', method = 'GET', params, body } = query as any;

    const url = new URL(path, this.config.baseUrl);
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...this.buildHeaders(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new AppError(502, `REST API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  async disconnect(): Promise<void> {
    // HTTP는 stateless이므로 특별한 정리 불필요
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${this.config.auth.token}`;
          break;
        case 'basic': {
          const credentials = Buffer.from(
            `${this.config.auth.username}:${this.config.auth.password}`,
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
          break;
        }
        case 'apiKey':
          headers[this.config.auth.headerName || 'X-API-Key'] = this.config.auth.apiKey || '';
          break;
      }
    }

    return headers;
  }
}
```

**참고**: Node.js 18+ 내장 `fetch`를 사용하여 axios 의존성을 추가하지 않는다. 기존 프로젝트가 외부 HTTP 클라이언트 라이브러리를 사용하지 않으므로 이 패턴을 따른다.

### 4.4 StaticAdapter

파일: `packages/server/src/services/adapters/StaticAdapter.ts`

```typescript
export class StaticAdapter implements DataSourceAdapter {
  constructor(private data: any[]) {}

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Static data: ${this.data.length} items`,
    };
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    // query 형식: { filter?: object, limit?: number }
    const { filter, limit = 100 } = query as any;

    let results = [...this.data];

    // 간단한 필드 매칭 필터
    if (filter && typeof filter === 'object') {
      results = results.filter((item) =>
        Object.entries(filter).every(([key, value]) => item[key] === value),
      );
    }

    return results.slice(0, Math.min(limit, 1000));
  }

  async disconnect(): Promise<void> {
    // 정적 데이터이므로 정리 불필요
  }
}
```

---

## 5. DataSourceService

파일: `packages/server/src/services/DataSourceService.ts`

### 5.1 클래스 구조

```typescript
import { DataSource, DataSourceDocument } from '../models/DataSource.js';
import { EncryptionService } from './EncryptionService.js';
import { MongoDBAdapter } from './adapters/MongoDBAdapter.js';
import { RestApiAdapter } from './adapters/RestApiAdapter.js';
import { StaticAdapter } from './adapters/StaticAdapter.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';
import type { DataSourceAdapter } from './adapters/types.js';

export class DataSourceService {
  private encryption = new EncryptionService();

  /**
   * 데이터소스 생성
   * - database/restApi: config를 JSON 직렬화 후 AES-256 암호화
   * - static: staticData 필드에 평문 저장
   */
  async createDataSource(
    input: CreateDataSourceInput,
    userId: string,
  ): Promise<DataSourceDocument>

  /**
   * 단일 데이터소스 조회 (config 복호화 포함)
   * - encryptedConfig를 복호화하여 config 필드로 반환
   */
  async getDataSource(id: string): Promise<DataSourceDocument & { config: any }>

  /**
   * 데이터소스 목록 조회 (암호화 정보 제외)
   * - encryptedConfig 필드 제외
   * - meta 필드의 비민감 정보만 반환
   */
  async listDataSources(
    query: ListDataSourcesQuery,
  ): Promise<{ data: DataSourceDocument[]; total: number }>

  /**
   * 데이터소스 수정
   * - config 변경 시 재암호화
   */
  async updateDataSource(
    id: string,
    input: UpdateDataSourceInput,
    userId: string,
  ): Promise<DataSourceDocument>

  /**
   * Soft delete
   */
  async deleteDataSource(id: string): Promise<void>

  /**
   * 연결 테스트
   * - 적절한 어댑터를 생성하여 testConnection 호출
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string }>

  /**
   * 쿼리 실행
   * - 적절한 어댑터를 생성하여 executeQuery 호출
   * - sanitizeQueryInput 적용 (MongoDB 타입)
   */
  async executeQuery(
    id: string,
    query: Record<string, unknown>,
  ): Promise<unknown[]>
}
```

### 5.2 메서드 상세

#### createDataSource

1. `createDataSourceSchema`로 입력 검증
2. 타입별 분기:
   - `database`: `{ connectionString, database }` → `JSON.stringify()` → `encryption.encrypt()` → `encryptedConfig`에 저장, `meta.dialect` 설정
   - `restApi`: `{ baseUrl, headers, auth }` → `JSON.stringify()` → `encryption.encrypt()` → `encryptedConfig`에 저장, `meta.baseUrl` 설정
   - `static`: `config.data` → `staticData`에 평문 저장
3. `createdBy`, `updatedBy`에 userId 설정
4. MongoDB에 저장 후 반환 (encryptedConfig 제외한 안전한 응답)

#### getDataSource

1. `DataSource.findOne({ _id: id, deletedAt: null })`
2. 없으면 `NotFoundError` throw
3. `encryptedConfig`가 있으면 → `encryption.decrypt()` → `JSON.parse()` → config 필드 추가
4. `staticData`가 있으면 → config.data 필드로 매핑

#### listDataSources

1. 기본 필터: `{ deletedAt: null }`
2. `projectId` 있으면 필터에 추가
3. `type` 있으면 필터에 추가
4. `search` 있으면 `{ name: { $regex: search, $options: 'i' } }` 필터 추가
5. select: `-encryptedConfig -staticData` (민감 정보 제외)
6. 페이지네이션, `updatedAt` 내림차순 정렬

#### updateDataSource

1. `getDataSource(id)`으로 존재 확인
2. config 변경이 있으면 재암호화
3. `updatedBy`를 userId로 설정
4. `findByIdAndUpdate`로 업데이트

#### deleteDataSource

1. 존재 확인 후 `deletedAt = new Date()` 설정

#### testConnection

1. `getDataSource(id)`로 조회 (config 복호화)
2. `createAdapter(dataSource)`로 어댑터 생성
3. `adapter.testConnection()` 호출
4. `adapter.disconnect()` 정리

#### executeQuery

1. `getDataSource(id)`로 조회 (config 복호화)
2. `createAdapter(dataSource)`로 어댑터 생성
3. `adapter.executeQuery(query)` 호출
4. `adapter.disconnect()` 정리

### 5.3 어댑터 팩토리

```typescript
private createAdapter(
  dataSource: DataSourceDocument & { config: any },
): DataSourceAdapter {
  switch (dataSource.type) {
    case 'database': {
      const { connectionString, database } = dataSource.config;
      if (dataSource.meta.dialect !== 'mongodb') {
        throw new AppError(400, `Unsupported dialect: ${dataSource.meta.dialect}`);
      }
      return new MongoDBAdapter(connectionString, database);
    }
    case 'restApi':
      return new RestApiAdapter(dataSource.config);
    case 'static':
      return new StaticAdapter(dataSource.config.data || []);
    default:
      throw new AppError(400, `Unknown data source type: ${dataSource.type}`);
  }
}
```

---

## 6. Zod 검증 스키마

파일: `packages/server/src/validators/datasourceValidator.ts`

### 6.1 Config 스키마

```typescript
import { z } from 'zod';

// Database config (현재 MongoDB만 지원)
const databaseConfigSchema = z.object({
  dialect: z.literal('mongodb'),
  connectionString: z.string().min(1),
  database: z.string().min(1),
});

// REST API auth config
const authConfigSchema = z.object({
  type: z.enum(['bearer', 'basic', 'apiKey']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
  headerName: z.string().optional(),
});

// REST API config
const restApiConfigSchema = z.object({
  baseUrl: z.string().url(),
  headers: z.record(z.string()).default({}),
  auth: authConfigSchema.optional(),
});

// Static config
const staticConfigSchema = z.object({
  data: z.array(z.unknown()),
});
```

### 6.2 CRUD 스키마

```typescript
// 생성: discriminated union으로 type별 config 검증
export const createDataSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('database'),
    name: z.string().min(1).max(200),
    description: z.string().max(500).default(''),
    projectId: z.string().min(1),
    config: databaseConfigSchema,
  }),
  z.object({
    type: z.literal('restApi'),
    name: z.string().min(1).max(200),
    description: z.string().max(500).default(''),
    projectId: z.string().min(1),
    config: restApiConfigSchema,
  }),
  z.object({
    type: z.literal('static'),
    name: z.string().min(1).max(200),
    description: z.string().max(500).default(''),
    projectId: z.string().min(1),
    config: staticConfigSchema,
  }),
]);

export type CreateDataSourceInput = z.infer<typeof createDataSourceSchema>;

// 수정
export const updateDataSourceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  config: z.union([databaseConfigSchema, restApiConfigSchema, staticConfigSchema]).optional(),
});

export type UpdateDataSourceInput = z.infer<typeof updateDataSourceSchema>;

// 목록 쿼리
export const listDataSourcesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['database', 'restApi', 'static']).optional(),
  projectId: z.string().optional(),
});

export type ListDataSourcesQuery = z.infer<typeof listDataSourcesQuerySchema>;

// 쿼리 실행
export const executeQuerySchema = z.object({
  // MongoDB: { collection, filter, projection, limit }
  // REST API: { path, method, params, body }
  // Static: { filter, limit }
}).passthrough(); // 타입별 쿼리 형식이 다르므로 passthrough
```

---

## 7. API 엔드포인트 상세

파일: `packages/server/src/routes/datasources.ts`

### 7.1 응답 형식

기존 formsRouter 패턴을 따른다.

```typescript
// 단일 리소스 (config 복호화 포함)
{ data: DataSourceDocument & { config: any } }

// 목록 (encryptedConfig, staticData 제외)
{
  data: DataSourceDocument[],
  meta: { total, page, limit, totalPages }
}

// 연결 테스트 결과
{ data: { success: boolean, message: string } }

// 쿼리 실행 결과
{ data: unknown[] }
```

### 7.2 엔드포인트 매핑

| 메서드 | 경로 | 핸들러 | 상태코드 | 설명 |
|--------|------|--------|----------|------|
| GET | `/api/datasources` | listDataSources | 200 | 목록 (암호화 정보 제외) |
| POST | `/api/datasources` | createDataSource | 201 | 생성 (config AES-256 암호화) |
| GET | `/api/datasources/:id` | getDataSource | 200 | 단일 조회 (config 복호화) |
| PUT | `/api/datasources/:id` | updateDataSource | 200 | 수정 (config 재암호화) |
| DELETE | `/api/datasources/:id` | deleteDataSource | 204 | Soft delete |
| POST | `/api/datasources/:id/test` | testConnection | 200 | 연결 테스트 |
| POST | `/api/datasources/:id/query` | executeQuery | 200 | 쿼리 실행 |

### 7.3 라우터 핸들러

```typescript
import { Router } from 'express';
import { DataSourceService } from '../services/DataSourceService.js';
import {
  createDataSourceSchema,
  updateDataSourceSchema,
  listDataSourcesQuerySchema,
  executeQuerySchema,
} from '../validators/datasourceValidator.js';

export const datasourcesRouter = Router();
const dataSourceService = new DataSourceService();

// GET /api/datasources
datasourcesRouter.get('/', async (req, res, next) => {
  try {
    const query = listDataSourcesQuerySchema.parse(req.query);
    const { data, total } = await dataSourceService.listDataSources(query);
    const totalPages = Math.ceil(total / query.limit);
    res.json({
      data,
      meta: { total, page: query.page, limit: query.limit, totalPages },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources
datasourcesRouter.post('/', async (req, res, next) => {
  try {
    const input = createDataSourceSchema.parse(req.body);
    const ds = await dataSourceService.createDataSource(input, req.user!.sub);
    res.status(201).json({ data: ds });
  } catch (err) {
    next(err);
  }
});

// GET /api/datasources/:id
datasourcesRouter.get('/:id', async (req, res, next) => {
  try {
    const ds = await dataSourceService.getDataSource(req.params.id);
    res.json({ data: ds });
  } catch (err) {
    next(err);
  }
});

// PUT /api/datasources/:id
datasourcesRouter.put('/:id', async (req, res, next) => {
  try {
    const input = updateDataSourceSchema.parse(req.body);
    const ds = await dataSourceService.updateDataSource(
      req.params.id,
      input,
      req.user!.sub,
    );
    res.json({ data: ds });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/datasources/:id
datasourcesRouter.delete('/:id', async (req, res, next) => {
  try {
    await dataSourceService.deleteDataSource(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources/:id/test
datasourcesRouter.post('/:id/test', async (req, res, next) => {
  try {
    const result = await dataSourceService.testConnection(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/datasources/:id/query
datasourcesRouter.post('/:id/query', async (req, res, next) => {
  try {
    const query = executeQuerySchema.parse(req.body);
    const results = await dataSourceService.executeQuery(req.params.id, query);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});
```

---

## 8. 보안 설계 상세

### 8.1 암호화 계층

```
┌─────────────────────────────────────────────────────┐
│  API Layer (routes/datasources.ts)                  │
│  - 평문 config를 request body로 수신                  │
│  - 평문 config를 response body로 반환 (getDataSource)  │
└──────────────┬──────────────────────────┬───────────┘
               │ 생성/수정                 │ 조회
               ▼                          ▼
┌──────────────────────────────────────────────────────┐
│  Service Layer (DataSourceService.ts)                │
│  - 생성/수정: encrypt(JSON.stringify(config))         │
│  - 조회: JSON.parse(decrypt(encryptedConfig))        │
│  - 목록: encryptedConfig 필드 제외                    │
└──────────────┬──────────────────────────┬────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────────────────────────────┐
│  Storage Layer (MongoDB)                             │
│  - encryptedConfig: "iv_hex:ciphertext_hex"          │
│  - 평문 config는 DB에 절대 저장되지 않음                │
└──────────────────────────────────────────────────────┘
```

### 8.2 NoSQL 인젝션 방지

```
쿼리 실행 흐름:
1. 클라이언트 → executeQuery API (raw query)
2. Zod 스키마 기본 검증
3. DataSourceService.executeQuery()
4. MongoDBAdapter.executeQuery()
   └─ sanitizeQueryInput(filter) 적용
      ├─ $where   → 제거
      ├─ $function → 제거
      ├─ $accumulator → 제거
      └─ $expr    → 제거
5. MongoDB 쿼리 실행 (maxTimeMS: 10000)
6. 결과 최대 1000건 제한
```

### 8.3 쿼리 타임아웃

| 대상 | 타임아웃 | 설정 위치 |
|------|---------|----------|
| MongoDB 쿼리 | 10초 | `maxTimeMS: 10000` |
| MongoDB 연결 | 5초 | `serverSelectionTimeoutMS: 5000` |
| REST API 호출 | 10초 | `AbortSignal.timeout(10000)` |
| REST API 연결 테스트 | 5초 | `AbortSignal.timeout(5000)` |

---

## 9. 구현 순서

### Step 1: EncryptionService 구현
- `packages/server/src/services/EncryptionService.ts` 신규 생성
- AES-256-CBC 암호화/복호화 메서드
- 기존 `config/index.ts`의 `ENCRYPTION_KEY` 환경변수 활용

### Step 2: DataSource 모델 구현
- `packages/server/src/models/DataSource.ts` 신규 생성
- Mongoose 스키마 + TypeScript 인터페이스
- 인덱스 설정

### Step 3: 어댑터 구현
- `packages/server/src/services/adapters/MongoDBAdapter.ts`
- `packages/server/src/services/adapters/RestApiAdapter.ts`
- `packages/server/src/services/adapters/StaticAdapter.ts`
- 각 어댑터의 공통 인터페이스 타입 파일

### Step 4: Zod 검증 스키마 구현
- `packages/server/src/validators/datasourceValidator.ts` 신규 생성
- discriminatedUnion으로 타입별 config 검증

### Step 5: DataSourceService 구현
- `packages/server/src/services/DataSourceService.ts` 신규 생성
- 7개 메서드 (CRUD + testConnection + executeQuery)
- 어댑터 팩토리 메서드

### Step 6: 라우터 핸들러 구현
- `packages/server/src/routes/datasources.ts` 기존 스텁 교체
- 7개 엔드포인트 핸들러 연결

---

## 10. 추가 의존성

### 필수 추가 패키지

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `mongodb` | MongoDB native driver | MongoDBAdapter에서 직접 연결용 |

- **Node.js `crypto`**: 내장 모듈 (추가 설치 불필요)
- **`fetch`**: Node.js 18+ 내장 (추가 설치 불필요)
- **`mongoose`**: 이미 의존성에 포함 (DataSource 모델용)

### 설치 명령

```bash
pnpm --filter @webform/server add mongodb
```

**설계 결정**: mongoose의 내장 MongoDB 드라이버를 직접 사용할 수도 있지만, `MongoDBAdapter`는 외부 데이터소스에 연결하는 것이므로 (서버 자체 DB가 아님) 별도의 `mongodb` native driver를 사용한다. 이렇게 하면 서버의 mongoose 연결 풀과 완전히 분리된다.

---

## 11. 설계 결정 요약

| 결정 사항 | 선택 | 이유 |
|-----------|------|------|
| 암호화 방식 | AES-256-CBC, config 전체 암호화 | PRD 요구사항 준수, 필드별 암호화보다 단순하고 안전 |
| 암호화 저장 | `iv_hex:ciphertext_hex` 단일 필드 | 파싱 간단, IV 분리 명확 |
| MongoDB 어댑터 | `mongodb` native driver | 외부 DB 연결이므로 서버 mongoose 연결과 분리 |
| REST API 클라이언트 | Node.js 내장 `fetch` | 추가 의존성 없음, 프로젝트 패턴 일관성 |
| 쿼리 보안 | `sanitizeQueryInput` 재사용 | common 패키지에 이미 구현되어 있음 |
| Soft delete | `deletedAt` 필드 | 기존 Form 모델 패턴과 일관성 유지 |
| 목록 조회 | `encryptedConfig` 제외 | 대량 조회 시 불필요한 암호화 데이터 전송 방지 |
| dialect 지원 범위 | MongoDB만 (1차) | PRD에 mysql/mssql/sqlite 언급 있으나, 점진적 확장 |
| 쿼리 결과 제한 | 최대 1000건 | 디자이너 미리보기 용도이므로 대량 데이터 불필요 |

---

## 12. 테스트 전략 (후속 태스크에서 구현)

| 테스트 대상 | 유형 | 파일 |
|-------------|------|------|
| EncryptionService | 단위 | `__tests__/EncryptionService.test.ts` |
| MongoDBAdapter | 단위 | `__tests__/MongoDBAdapter.test.ts` |
| DataSourceService | 단위 | `__tests__/DataSourceService.test.ts` |
| API 엔드포인트 | 통합 | `__tests__/datasources.integration.test.ts` |

**테스트 환경**:
- 기존 `setup.ts`의 MongoDB Memory Server 재사용
- `ENCRYPTION_KEY`는 vitest.config.ts에 이미 설정됨 (64자 hex "000...0")
- Redis mock 패턴 재사용 (기존 통합 테스트 참고)
