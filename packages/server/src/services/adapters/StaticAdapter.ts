import type { DataSourceAdapter } from './types.js';

export class StaticAdapter implements DataSourceAdapter {
  constructor(private data: unknown[]) {}

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: `Static data: ${this.data.length} items`,
    };
  }

  async executeQuery(query: Record<string, unknown>): Promise<unknown[]> {
    const { filter, limit = 100 } = query as {
      filter?: Record<string, unknown>;
      limit?: number;
    };

    let results = [...this.data];

    if (filter && typeof filter === 'object') {
      results = results.filter((item) =>
        Object.entries(filter).every(
          ([key, value]) => (item as Record<string, unknown>)[key] === value,
        ),
      );
    }

    return results.slice(0, Math.min(limit, 1000));
  }

  async disconnect(): Promise<void> {
    // 정적 데이터이므로 정리 불필요
  }
}
