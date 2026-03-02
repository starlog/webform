export type DatabaseDialect = 'mongodb' | 'postgresql' | 'mysql' | 'mssql' | 'sqlite';

export interface DatabaseConfig {
  dialect: DatabaseDialect;
  // MongoDB용
  connectionString?: string;
  // SQL DB 공통
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'apiKey';
  credentials?: Record<string, string>;
}

export interface RestApiConfig {
  baseUrl: string;
  headers: Record<string, string>;
  auth: AuthConfig;
}

export interface StaticConfig {
  data: unknown[];
}

interface DataSourceBase {
  id: string;
  name: string;
  description?: string;
}

export type DataSourceDefinition =
  | (DataSourceBase & { type: 'database'; config: DatabaseConfig })
  | (DataSourceBase & { type: 'restApi'; config: RestApiConfig })
  | (DataSourceBase & { type: 'static'; config: StaticConfig });

