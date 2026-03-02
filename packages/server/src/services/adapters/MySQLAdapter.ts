import mysql from 'mysql2/promise';
import { BaseSqlAdapter, type SqlConnectionOptions } from './BaseSqlAdapter.js';
import type { AdapterFactory } from './AdapterRegistry.js';

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
      charset: 'utf8mb4',
      connectionLimit: 10,
      connectTimeout: 10000,
    });
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const values = params as (string | number | boolean | null)[] | undefined;
    const [rows] = await this.pool.execute(sql, values);
    return rows as unknown[];
  }

  protected escapeId(id: string): string {
    return `\`${id.replace(/`/g, '``')}\``;
  }

  protected placeholder(_index: number): string {
    return '?';
  }

  async listTables(): Promise<string[]> {
    const rows = await this.rawQuery(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    );
    return (rows as { TABLE_NAME: string }[]).map((r) => r.TABLE_NAME);
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export const MySQLAdapterFactory: AdapterFactory = {
  dialect: 'mysql',
  displayName: 'MySQL',
  create(config: Record<string, unknown>) {
    const host = config.host as string;
    const database = config.database as string;
    if (!host || !database) {
      throw new Error('MySQL adapter requires host and database');
    }
    return new MySQLAdapter({
      host,
      port: (config.port as number) || 3306,
      user: (config.user as string) || 'root',
      password: (config.password as string) || '',
      database,
      ssl: config.ssl as boolean | Record<string, unknown> | undefined,
    });
  },
};
