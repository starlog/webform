import { MongoClient } from 'mongodb';
import { sanitizeQueryInput } from '@webform/common';
import { AppError } from '../../middleware/errorHandler.js';
import type { DataSourceAdapter } from './types.js';

const QUERY_TIMEOUT_MS = 10_000;

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
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const { collection, filter = {}, projection, limit = 100 } = query as {
      collection?: string;
      filter?: Record<string, unknown>;
      projection?: Record<string, unknown>;
      limit?: number;
    };

    if (!collection || typeof collection !== 'string') {
      throw new AppError(400, 'collection is required');
    }

    const sanitizedFilter = sanitizeQueryInput(filter as Record<string, unknown>);

    const client = new MongoClient(this.connectionString, {
      serverSelectionTimeoutMS: QUERY_TIMEOUT_MS,
    });

    try {
      await client.connect();
      const db = client.db(this.database);
      const cursor = db
        .collection(collection)
        .find(sanitizedFilter, {
          projection,
          maxTimeMS: QUERY_TIMEOUT_MS,
        })
        .limit(Math.min(limit, 1000));

      return await cursor.toArray();
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
