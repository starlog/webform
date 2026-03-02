import { DataSource } from '../models/DataSource.js';
import type { DataSourceDocument } from '../models/DataSource.js';
import { EncryptionService } from './EncryptionService.js';
import { adapterRegistry } from './adapters/index.js';
import { getSqlAdapter, evictSqlAdapter } from './adapters/SqlAdapterPool.js';
import { RestApiAdapter } from './adapters/RestApiAdapter.js';
import { StaticAdapter } from './adapters/StaticAdapter.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';
import type { DataSourceAdapter } from './adapters/types.js';
import type {
  CreateDataSourceInput,
  UpdateDataSourceInput,
  ListDataSourcesQuery,
} from '../validators/datasourceValidator.js';

const DS_CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/** SQL 어댑터로 캐싱하는 dialect 목록 */
const POOLED_SQL_DIALECTS = new Set(['mysql', 'postgresql', 'mssql']);

export class DataSourceService {
  private encryption = new EncryptionService();

  /** getDataSource 결과를 TTL 캐시 */
  private static dsCache = new Map<string, { data: DataSourceDocument & { config: unknown }; expiry: number }>();

  /**
   * 데이터소스 생성
   */
  async createDataSource(
    input: CreateDataSourceInput,
    userId: string,
  ): Promise<DataSourceDocument> {
    const doc: Record<string, unknown> = {
      name: input.name,
      type: input.type,
      description: input.description,
      projectId: input.projectId,
      createdBy: userId,
      updatedBy: userId,
    };

    switch (input.type) {
      case 'database': {
        const config = input.config;
        const { dialect } = config;

        if (dialect === 'mongodb') {
          const { connectionString, database } = config;
          doc.encryptedConfig = this.encryption.encrypt(
            JSON.stringify({ connectionString, database }),
          );
        } else if (dialect === 'sqlite') {
          const { database } = config;
          doc.encryptedConfig = this.encryption.encrypt(
            JSON.stringify({ database }),
          );
        } else {
          const { host, port, user, password, database, ssl } = config;
          doc.encryptedConfig = this.encryption.encrypt(
            JSON.stringify({ host, port, user, password, database, ssl }),
          );
        }

        doc.meta = { dialect };
        break;
      }
      case 'restApi': {
        doc.encryptedConfig = this.encryption.encrypt(
          JSON.stringify(input.config),
        );
        doc.meta = { baseUrl: input.config.baseUrl };
        break;
      }
      case 'static': {
        doc.staticData = input.config.data;
        doc.meta = {};
        break;
      }
    }

    const created = await DataSource.create(doc);
    const result = created.toObject() as DataSourceDocument;

    // 응답에서 암호화된 config 제거
    const resultObj = result as unknown as Record<string, unknown>;
    const safe = Object.fromEntries(
      Object.entries(resultObj).filter(([k]) => k !== 'encryptedConfig' && k !== 'staticData'),
    );
    return safe as unknown as DataSourceDocument;
  }

  /**
   * 단일 데이터소스 조회 (config 복호화 포함, TTL 캐시)
   */
  async getDataSource(id: string): Promise<DataSourceDocument & { config: unknown }> {
    const cached = DataSourceService.dsCache.get(id);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    DataSourceService.dsCache.delete(id);

    const doc = await DataSource.findOne({ _id: id, deletedAt: null }).lean<DataSourceDocument>();
    if (!doc) {
      throw new NotFoundError(`DataSource not found: ${id}`);
    }

    let config: unknown;
    if (doc.encryptedConfig) {
      config = JSON.parse(this.encryption.decrypt(doc.encryptedConfig));
    } else if (doc.staticData) {
      config = { data: doc.staticData };
    } else {
      config = {};
    }

    const docObj = doc as unknown as Record<string, unknown>;
    const rest = Object.fromEntries(
      Object.entries(docObj).filter(([k]) => k !== 'encryptedConfig' && k !== 'staticData'),
    );
    const result = { ...rest, config } as DataSourceDocument & { config: unknown };

    DataSourceService.dsCache.set(id, { data: result, expiry: Date.now() + DS_CACHE_TTL_MS });
    return result;
  }

  /**
   * 데이터소스 목록 조회 (암호화 정보 제외)
   */
  async listDataSources(
    query: ListDataSourcesQuery,
  ): Promise<{ data: DataSourceDocument[]; total: number }> {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.projectId) {
      filter.projectId = query.projectId;
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      DataSource.find(filter)
        .select('-encryptedConfig -staticData')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<DataSourceDocument[]>(),
      DataSource.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * 데이터소스 수정
   */
  async updateDataSource(
    id: string,
    input: UpdateDataSourceInput,
    userId: string,
  ): Promise<DataSourceDocument> {
    const existing = await this.getDataSource(id);

    const update: Record<string, unknown> = {
      updatedBy: userId,
    };

    if (input.name !== undefined) {
      update.name = input.name;
    }
    if (input.description !== undefined) {
      update.description = input.description;
    }

    if (input.config) {
      switch (existing.type) {
        case 'database': {
          const cfg = input.config as Record<string, unknown>;
          const dialect = cfg.dialect as string;

          if (dialect === 'mongodb') {
            const { connectionString, database } = cfg as { connectionString: string; database: string };
            update.encryptedConfig = this.encryption.encrypt(
              JSON.stringify({ connectionString, database }),
            );
          } else if (dialect === 'sqlite') {
            const { database } = cfg as { database: string };
            update.encryptedConfig = this.encryption.encrypt(
              JSON.stringify({ database }),
            );
          } else {
            const { host, port, user, password, database, ssl } = cfg as {
              host: string; port?: number; user: string; password: string; database: string; ssl?: boolean;
            };
            update.encryptedConfig = this.encryption.encrypt(
              JSON.stringify({ host, port, user, password, database, ssl }),
            );
          }

          if (dialect) {
            update['meta.dialect'] = dialect;
          }
          break;
        }
        case 'restApi': {
          const cfg = input.config as { baseUrl: string; headers?: Record<string, string>; auth?: unknown };
          update.encryptedConfig = this.encryption.encrypt(JSON.stringify(cfg));
          update['meta.baseUrl'] = cfg.baseUrl;
          break;
        }
        case 'static': {
          const cfg = input.config as { data: unknown[] };
          update.staticData = cfg.data;
          break;
        }
      }
    }

    // 캐시 무효화 (config 변경 가능성)
    DataSourceService.dsCache.delete(id);
    await evictSqlAdapter(id);

    const doc = await DataSource.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: update },
      { new: true },
    ).lean<DataSourceDocument>();

    if (!doc) {
      throw new NotFoundError(`DataSource not found: ${id}`);
    }

    const updateObj = doc as unknown as Record<string, unknown>;
    const safe = Object.fromEntries(
      Object.entries(updateObj).filter(([k]) => k !== 'encryptedConfig' && k !== 'staticData'),
    );
    return safe as unknown as DataSourceDocument;
  }

  /**
   * Soft delete
   */
  async deleteDataSource(id: string): Promise<void> {
    const doc = await DataSource.findOne({ _id: id, deletedAt: null });
    if (!doc) {
      throw new NotFoundError(`DataSource not found: ${id}`);
    }
    await DataSource.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });

    // 캐시 무효화
    DataSourceService.dsCache.delete(id);
    await evictSqlAdapter(id);
  }

  /**
   * 연결 테스트
   */
  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const ds = await this.getDataSource(id);
    const adapter = this.createAdapter(ds);
    try {
      return await adapter.testConnection();
    } catch (err) {
      console.error(
        `[DataSourceService] testConnection failed — id=${id}, type=${ds.type}`,
        err,
      );
      throw err;
    } finally {
      await adapter.disconnect();
    }
  }

  /**
   * 테이블/컬렉션 목록 조회
   */
  async listTables(id: string): Promise<string[]> {
    const ds = await this.getDataSource(id);
    const adapter = this.getOrCreateAdapter(id, ds);
    try {
      return await adapter.listTables();
    } catch (err) {
      console.error(
        `[DataSourceService] listTables failed — id=${id}, type=${ds.type}`,
        err,
      );
      throw err;
    }
  }

  /**
   * Raw 쿼리 실행 (SQL: SELECT만 허용, MongoDB: JSON 쿼리)
   */
  async executeRawQuery(id: string, raw: string, params?: unknown[]): Promise<unknown[]> {
    const ds = await this.getDataSource(id);
    const adapter = this.getOrCreateAdapter(id, ds);
    try {
      return await adapter.executeRawQuery(raw, params);
    } catch (err) {
      console.error(
        `[DataSourceService] executeRawQuery failed — id=${id}, type=${ds.type}`,
        err,
      );
      throw err;
    }
  }

  /**
   * 쿼리 실행
   */
  async executeQuery(id: string, query: Record<string, unknown>): Promise<unknown[]> {
    const ds = await this.getDataSource(id);
    const adapter = this.getOrCreateAdapter(id, ds);
    try {
      return await adapter.executeQuery(query);
    } catch (err) {
      console.error(
        `[DataSourceService] executeQuery failed — id=${id}, type=${ds.type}, query=${JSON.stringify(query)}`,
        err,
      );
      throw err;
    }
  }

  /**
   * 캐싱이 적용된 어댑터 획득.
   * SQL 어댑터(mysql, postgresql, mssql)는 SqlAdapterPool로 캐싱.
   * MongoDB는 MongoClientPool이 내부적으로 캐싱. RestApi/Static은 stateless.
   */
  private getOrCreateAdapter(
    dsId: string,
    dataSource: DataSourceDocument & { config: unknown },
  ): DataSourceAdapter {
    switch (dataSource.type) {
      case 'database': {
        const config = dataSource.config as Record<string, unknown>;
        const dialect = dataSource.meta.dialect;
        if (!dialect) {
          throw new AppError(400, 'Database data source requires a dialect');
        }
        if (POOLED_SQL_DIALECTS.has(dialect)) {
          return getSqlAdapter(dsId, dialect, config);
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

  /**
   * 일회성 어댑터 생성 (testConnection 전용).
   * 테스트 후 disconnect로 즉시 해제.
   */
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
}
