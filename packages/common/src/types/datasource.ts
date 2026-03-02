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

export interface DataSourceDefinition {
  id: string;
  name: string;
  type: 'database' | 'restApi' | 'static';
  config: DatabaseConfig | RestApiConfig | StaticConfig;
}

export interface DataBindingDefinition {
  controlId: string;
  controlProperty: string;
  dataSourceId: string;
  dataField: string;
  bindingMode: 'oneWay' | 'twoWay' | 'oneTime';
}
