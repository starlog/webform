import sql from 'mssql';
import { BaseSqlAdapter, type SqlConnectionOptions } from './BaseSqlAdapter.js';
import type { AdapterFactory } from './AdapterRegistry.js';

export class MSSQLAdapter extends BaseSqlAdapter {
  private pool: sql.ConnectionPool;
  private connected = false;

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

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.pool.connect();
      this.connected = true;
    }
  }

  protected async rawQuery(sqlStr: string, params?: unknown[]): Promise<unknown[]> {
    await this.ensureConnected();
    const request = this.pool.request();
    params?.forEach((val, i) => request.input(`p${i + 1}`, val));
    const result = await request.query(sqlStr);
    return result.recordset;
  }

  protected escapeId(id: string): string {
    return `[${id.replace(/\]/g, ']]')}]`;
  }

  protected placeholder(index: number): string {
    return `@p${index}`;
  }

  // MSSQL은 LIMIT/OFFSET 미지원 → OFFSET...FETCH 문법 사용
  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const table = query.table;
    if (!table || typeof table !== 'string') {
      const { AppError } = await import('../../middleware/errorHandler.js');
      throw new AppError(400, 'table is required');
    }

    const safeLimit = Math.min(Number(query.limit) || 100, 1000);
    const safeOffset = Number(query.offset) || 0;
    const columns = query.columns as string[] | undefined;
    const filter = query.filter as Record<string, unknown> | undefined;

    const cols = columns?.length ? columns.map((c) => this.escapeId(c)).join(', ') : '*';
    let sqlStr = `SELECT ${cols} FROM ${this.escapeId(table)}`;
    const params: unknown[] = [];

    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter).map(([key, value], i) => {
        params.push(value);
        return `${this.escapeId(key)} = ${this.placeholder(i + 1)}`;
      });
      sqlStr += ` WHERE ${conditions.join(' AND ')}`;
    }

    sqlStr += ` ORDER BY (SELECT NULL) OFFSET ${safeOffset} ROWS FETCH NEXT ${safeLimit} ROWS ONLY`;
    return this.rawQuery(sqlStr, params);
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.pool.close();
      this.connected = false;
    }
  }
}

export const MSSQLAdapterFactory: AdapterFactory = {
  dialect: 'mssql',
  displayName: 'Microsoft SQL Server',
  create(config: Record<string, unknown>) {
    const host = config.host as string;
    const database = config.database as string;
    if (!host || !database) {
      throw new Error('MSSQL adapter requires host and database');
    }
    return new MSSQLAdapter({
      host,
      port: (config.port as number) || 1433,
      user: (config.user as string) || 'sa',
      password: (config.password as string) || '',
      database,
      ssl: config.ssl as boolean | Record<string, unknown> | undefined,
    });
  },
};
