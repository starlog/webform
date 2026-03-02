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
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.rawQuery('SELECT 1');
      return { success: true, message: '연결 성공' };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const table = query.table;
    if (!table || typeof table !== 'string') {
      throw new AppError(400, 'table is required');
    }

    const { sql, params } = this.buildSelectQuery({
      table: String(table),
      filter: query.filter as Record<string, unknown> | undefined,
      columns: query.columns as string[] | undefined,
      limit: Math.min(Number(query.limit) || 100, 1000),
      offset: Number(query.offset) || 0,
    });
    return this.rawQuery(sql, params);
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

    sql += ` LIMIT ${opts.limit} OFFSET ${opts.offset}`;

    return { sql, params };
  }

  protected abstract escapeId(identifier: string): string;
  protected abstract placeholder(index: number): string;
  protected abstract rawQuery(sql: string, params?: unknown[]): Promise<unknown[]>;
  abstract disconnect(): Promise<void>;
}
