import { describe, it, expect, beforeEach } from 'vitest';
import { BaseSqlAdapter } from '../services/adapters/BaseSqlAdapter.js';

class TestAdapter extends BaseSqlAdapter {
  public queries: Array<{ sql: string; params?: unknown[] }> = [];
  public shouldFail = false;

  protected escapeId(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  protected placeholder(index: number): string {
    return `$${index}`;
  }

  protected async rawQuery(sql: string, params?: unknown[]): Promise<unknown[]> {
    if (this.shouldFail) {
      throw new Error('Connection failed');
    }
    this.queries.push({ sql, params });
    return [];
  }

  async listTables(): Promise<string[]> {
    return [];
  }

  async disconnect(): Promise<void> {}
}

describe('BaseSqlAdapter', () => {
  let adapter: TestAdapter;

  beforeEach(() => {
    adapter = new TestAdapter();
  });

  describe('testConnection', () => {
    it('성공 시 { success: true } 반환', async () => {
      const result = await adapter.testConnection();
      expect(result).toEqual({ success: true, message: '연결 성공' });
      expect(adapter.queries).toHaveLength(1);
      expect(adapter.queries[0].sql).toBe('SELECT 1');
    });

    it('실패 시 { success: false, message } 반환', async () => {
      adapter.shouldFail = true;
      const result = await adapter.testConnection();
      expect(result).toEqual({ success: false, message: 'Connection failed' });
    });
  });

  describe('executeQuery', () => {
    it('기본 SELECT 쿼리 생성', async () => {
      await adapter.executeQuery({ table: 'users' });
      expect(adapter.queries[0].sql).toBe('SELECT * FROM "users" LIMIT 100 OFFSET 0');
      expect(adapter.queries[0].params).toEqual([]);
    });

    it('WHERE 조건 포함 parameterized 쿼리', async () => {
      await adapter.executeQuery({
        table: 'users',
        filter: { name: 'Alice', age: 30 },
      });
      expect(adapter.queries[0].sql).toBe(
        'SELECT * FROM "users" WHERE "name" = $1 AND "age" = $2 LIMIT 100 OFFSET 0',
      );
      expect(adapter.queries[0].params).toEqual(['Alice', 30]);
    });

    it('columns 지정 시 SELECT 절', async () => {
      await adapter.executeQuery({
        table: 'users',
        columns: ['name', 'email'],
      });
      expect(adapter.queries[0].sql).toBe(
        'SELECT "name", "email" FROM "users" LIMIT 100 OFFSET 0',
      );
    });

    it('limit 최대 1000 제한', async () => {
      await adapter.executeQuery({ table: 'users', limit: 5000 });
      expect(adapter.queries[0].sql).toBe('SELECT * FROM "users" LIMIT 1000 OFFSET 0');
    });

    it('limit 기본값 100', async () => {
      await adapter.executeQuery({ table: 'users' });
      expect(adapter.queries[0].sql).toContain('LIMIT 100');
    });

    it('offset 처리', async () => {
      await adapter.executeQuery({ table: 'users', offset: 50 });
      expect(adapter.queries[0].sql).toBe('SELECT * FROM "users" LIMIT 100 OFFSET 50');
    });

    it('table 누락 시 에러', async () => {
      await expect(adapter.executeQuery({})).rejects.toThrow('table or sql is required');
    });

    it('table이 문자열이 아닌 경우 에러', async () => {
      await expect(adapter.executeQuery({ table: 123 })).rejects.toThrow('table or sql is required');
    });
  });

  describe('SQL injection 방지', () => {
    it('escapeId — 특수문자 이스케이핑', async () => {
      await adapter.executeQuery({ table: 'user"name' });
      expect(adapter.queries[0].sql).toContain('"user""name"');
    });

    it('filter 값은 parameterized query로 전달', async () => {
      await adapter.executeQuery({
        table: 'users',
        filter: { name: "'; DROP TABLE users; --" },
      });
      expect(adapter.queries[0].sql).toBe(
        'SELECT * FROM "users" WHERE "name" = $1 LIMIT 100 OFFSET 0',
      );
      expect(adapter.queries[0].params).toEqual(["'; DROP TABLE users; --"]);
    });
  });

  describe('buildSelectQuery', () => {
    it('빈 filter 시 WHERE 절 없이 생성', async () => {
      await adapter.executeQuery({ table: 'users', filter: {} });
      expect(adapter.queries[0].sql).toBe('SELECT * FROM "users" LIMIT 100 OFFSET 0');
    });

    it('filter + columns 조합', async () => {
      await adapter.executeQuery({
        table: 'users',
        columns: ['id', 'name'],
        filter: { active: true },
        limit: 10,
        offset: 5,
      });
      expect(adapter.queries[0].sql).toBe(
        'SELECT "id", "name" FROM "users" WHERE "active" = $1 LIMIT 10 OFFSET 5',
      );
      expect(adapter.queries[0].params).toEqual([true]);
    });
  });
});
