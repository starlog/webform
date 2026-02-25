import { DataSource } from '../models/DataSource.js';
import type { DataSourceDocument } from '../models/DataSource.js';
import { EncryptionService } from './EncryptionService.js';
import { MongoDBAdapter } from './adapters/MongoDBAdapter.js';
import { RestApiAdapter } from './adapters/RestApiAdapter.js';
import { StaticAdapter } from './adapters/StaticAdapter.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';
import type { DataSourceAdapter } from './adapters/types.js';
import type {
  CreateDataSourceInput,
  UpdateDataSourceInput,
  ListDataSourcesQuery,
} from '../validators/datasourceValidator.js';

export class DataSourceService {
  private encryption = new EncryptionService();

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
        const { dialect, connectionString, database } = input.config;
        doc.encryptedConfig = this.encryption.encrypt(
          JSON.stringify({ connectionString, database }),
        );
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
   * 단일 데이터소스 조회 (config 복호화 포함)
   */
  async getDataSource(id: string): Promise<DataSourceDocument & { config: unknown }> {
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
    return { ...rest, config } as DataSourceDocument & { config: unknown };
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
          const cfg = input.config as { dialect?: string; connectionString: string; database: string };
          update.encryptedConfig = this.encryption.encrypt(
            JSON.stringify({ connectionString: cfg.connectionString, database: cfg.database }),
          );
          if (cfg.dialect) {
            update['meta.dialect'] = cfg.dialect;
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
   * 쿼리 실행
   */
  async executeQuery(id: string, query: Record<string, unknown>): Promise<unknown[]> {
    const ds = await this.getDataSource(id);
    const adapter = this.createAdapter(ds);
    try {
      return await adapter.executeQuery(query);
    } catch (err) {
      console.error(
        `[DataSourceService] executeQuery failed — id=${id}, type=${ds.type}, query=${JSON.stringify(query)}`,
        err,
      );
      throw err;
    } finally {
      await adapter.disconnect();
    }
  }

  private createAdapter(
    dataSource: DataSourceDocument & { config: unknown },
  ): DataSourceAdapter {
    switch (dataSource.type) {
      case 'database': {
        const config = dataSource.config as { connectionString: string; database: string };
        if (dataSource.meta.dialect !== 'mongodb') {
          throw new AppError(400, `Unsupported dialect: ${dataSource.meta.dialect}`);
        }
        return new MongoDBAdapter(config.connectionString, config.database);
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
