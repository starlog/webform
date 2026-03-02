import { Pool } from 'pg';
import { BaseSqlAdapter, type SqlConnectionOptions } from './BaseSqlAdapter.js';
import type { AdapterFactory } from './AdapterRegistry.js';

export class PostgreSQLAdapter extends BaseSqlAdapter {
  private pool: Pool;

  constructor(config: SqlConnectionOptions) {
    super();
    this.pool = new Pool({
      host: config.host,
      port: config.port || 5432,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: this.buildSslConfig(config.ssl),
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgreSQLAdapter] pool error:', err.message);
    });
  }

  private buildSslConfig(
    ssl?: boolean | Record<string, unknown>,
  ): boolean | Record<string, unknown> | undefined {
    if (!ssl) return undefined;
    if (ssl === true) return { rejectUnauthorized: false };
    return ssl;
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  protected escapeId(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  protected placeholder(index: number): string {
    return `$${index}`;
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}

export const PostgreSQLAdapterFactory: AdapterFactory = {
  dialect: 'postgresql',
  displayName: 'PostgreSQL',
  create(config: Record<string, unknown>) {
    const host = config.host as string;
    const database = config.database as string;
    if (!host || !database) {
      throw new Error('PostgreSQL adapter requires host and database');
    }
    return new PostgreSQLAdapter({
      host,
      port: (config.port as number) || 5432,
      user: (config.user as string) || 'postgres',
      password: (config.password as string) || '',
      database,
      ssl: config.ssl as boolean | Record<string, unknown> | undefined,
    });
  },
};
