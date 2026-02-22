export interface DatabaseConfig {
  dialect: 'mongodb' | 'mysql' | 'mssql' | 'sqlite';
  connectionString: string;
  database: string;
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
