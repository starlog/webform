import { AppError } from '../../middleware/errorHandler.js';
import type { DataSourceAdapter } from './types.js';

const QUERY_TIMEOUT_MS = 10_000;

interface RestApiAdapterConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  auth?: {
    type: 'bearer' | 'basic' | 'apiKey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
}

export class RestApiAdapter implements DataSourceAdapter {
  constructor(private config: RestApiAdapterConfig) {}

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.config.baseUrl, {
        method: 'HEAD',
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return {
        success: response.ok,
        message: response.ok ? 'Connection successful' : `HTTP ${response.status}`,
      };
    } catch (err: unknown) {
      return { success: false, message: (err as Error).message };
    }
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const { path = '', method = 'GET', params, body } = query as {
      path?: string;
      method?: string;
      params?: Record<string, unknown>;
      body?: unknown;
    };

    const url = new URL(path, this.config.baseUrl);
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...this.buildHeaders(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new AppError(502, `REST API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  async executeRawQuery(_raw: string): Promise<unknown[]> {
    throw new AppError(400, 'Raw query is not supported for REST API data sources');
  }

  async listTables(): Promise<string[]> {
    return [];
  }

  async disconnect(): Promise<void> {
    // HTTP는 stateless이므로 정리 불필요
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${this.config.auth.token}`;
          break;
        case 'basic': {
          const credentials = Buffer.from(
            `${this.config.auth.username}:${this.config.auth.password}`,
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
          break;
        }
        case 'apiKey':
          headers[this.config.auth.headerName || 'X-API-Key'] = this.config.auth.apiKey || '';
          break;
      }
    }

    return headers;
  }
}
