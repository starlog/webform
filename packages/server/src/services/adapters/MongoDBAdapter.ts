import { MongoClient } from 'mongodb';
import { sanitizeQueryInput } from '@webform/common';
import { AppError } from '../../middleware/errorHandler.js';
import type { DataSourceAdapter } from './types.js';
import type { AdapterFactory } from './AdapterRegistry.js';
import { getMongoClient } from './MongoClientPool.js';

const QUERY_TIMEOUT_MS = 10_000;

export class MongoDBAdapter implements DataSourceAdapter {
  constructor(
    private connectionString: string,
    private database: string,
  ) {}

  private get db() {
    return getMongoClient(this.connectionString).db(this.database);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // testConnection은 일회성 클라이언트 사용 (풀 캐시에 넣지 않음)
      const client = new MongoClient(this.connectionString, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      try {
        await client.connect();
        await client.db(this.database).command({ ping: 1 });
        return { success: true, message: 'Connection successful' };
      } finally {
        await client.close();
      }
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const { collection, filter = {}, projection, limit = 100, skip = 0 } = query as {
      collection?: string;
      filter?: Record<string, unknown>;
      projection?: Record<string, unknown>;
      limit?: number;
      skip?: number;
    };

    if (!collection || typeof collection !== 'string') {
      throw new AppError(400, 'collection is required');
    }

    const sanitizedFilter = sanitizeQueryInput(filter as Record<string, unknown>);

    return this.db
      .collection(collection)
      .find(sanitizedFilter, {
        projection,
        maxTimeMS: QUERY_TIMEOUT_MS,
      })
      .skip(skip)
      .limit(Math.min(limit, 1000))
      .toArray();
  }

  async countDocuments(
    collection: string,
    filter: Record<string, unknown> = {},
  ): Promise<number> {
    const sanitizedFilter = sanitizeQueryInput(filter);
    return this.db.collection(collection).countDocuments(sanitizedFilter, {
      maxTimeMS: QUERY_TIMEOUT_MS,
    });
  }

  async insertOne(
    collection: string,
    document: Record<string, unknown>,
  ): Promise<{ insertedId: string }> {
    const result = await this.db.collection(collection).insertOne(document);
    return { insertedId: result.insertedId.toString() };
  }

  async updateOne(
    collection: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<{ modifiedCount: number }> {
    const result = await this.db.collection(collection).updateOne(filter, { $set: update });
    return { modifiedCount: result.modifiedCount };
  }

  async deleteOne(
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<{ deletedCount: number }> {
    const result = await this.db.collection(collection).deleteOne(filter);
    return { deletedCount: result.deletedCount };
  }

  async executeRawQuery(raw: string, _params?: unknown[]): Promise<unknown[]> {
    let query: Record<string, unknown>;
    try {
      query = JSON.parse(raw);
    } catch {
      throw new AppError(400, 'Invalid JSON — expected { "collection": "...", "filter": {...}, "limit": 10 }');
    }
    if (!query.limit) {
      query.limit = 100;
    }
    return this.executeQuery(query);
  }

  async listTables(): Promise<string[]> {
    const collections = await this.db.listCollections({}, { nameOnly: true }).toArray();
    return collections.map((c) => c.name);
  }

  async disconnect(): Promise<void> {
    // 풀링 방식에서는 개별 어댑터가 클라이언트를 닫지 않음 (no-op)
    // 클라이언트 생명주기는 MongoClientPool에서 관리
  }
}

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
