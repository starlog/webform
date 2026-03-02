export interface DataSourceAdapter {
  testConnection(): Promise<{ success: boolean; message: string }>;
  executeQuery(query: Record<string, unknown>): Promise<unknown[]>;
  executeRawQuery(raw: string, params?: unknown[]): Promise<unknown[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
  listTables(): Promise<string[]>;
  disconnect(): Promise<void>;
}
