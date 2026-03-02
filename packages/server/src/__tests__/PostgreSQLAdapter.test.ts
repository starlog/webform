import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PostgreSQLAdapter,
  PostgreSQLAdapterFactory,
} from '../services/adapters/PostgreSQLAdapter.js';

const mockQuery = vi.fn();
const mockEnd = vi.fn();
const mockOn = vi.fn();

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
    on: mockOn,
  })),
}));

import { Pool } from 'pg';

describe('PostgreSQLAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
    mockEnd.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('Pool 생성 시 올바른 설정이 전달된다', () => {
      new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
        ssl: undefined,
        max: 10,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000,
      });
    });

    it('ssl: true 시 { rejectUnauthorized: false }로 변환', () => {
      new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
        ssl: true,
      });

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        }),
      );
    });

    it('포트 기본값 5432', () => {
      new PostgreSQLAdapter({
        host: 'localhost',
        port: 0,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5432,
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('SELECT 1 쿼리 실행 및 성공 응답', async () => {
      const adapter = new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.testConnection();

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1', undefined);
      expect(result).toEqual({ success: true, message: '연결 성공' });
    });

    it('Pool 오류 시 { success: false } 반환', async () => {
      mockQuery.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const adapter = new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.testConnection();

      expect(result).toEqual({ success: false, message: 'ECONNREFUSED' });
    });
  });

  describe('executeQuery', () => {
    it('기본 쿼리 실행', async () => {
      const mockRows = [{ id: 1, name: 'Alice' }];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const adapter = new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.executeQuery({ table: 'users' });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM "users" LIMIT 100 OFFSET 0',
        [],
      );
      expect(result).toEqual(mockRows);
    });
  });

  describe('disconnect', () => {
    it('pool.end() 호출', async () => {
      const adapter = new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      await adapter.disconnect();

      expect(mockEnd).toHaveBeenCalledOnce();
    });
  });

  describe('escapeId', () => {
    it('PostgreSQL 스타일 더블 쿼트 이스케이핑', async () => {
      const adapter = new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await adapter.executeQuery({ table: 'my"table' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('"my""table"'),
        [],
      );
    });
  });

  describe('placeholder', () => {
    it('$1, $2 형식의 플레이스홀더', async () => {
      const adapter = new PostgreSQLAdapter({
        host: 'localhost',
        port: 5432,
        user: 'admin',
        password: 'secret',
        database: 'testdb',
      });

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await adapter.executeQuery({
        table: 'users',
        filter: { name: 'Alice', age: 30 },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM "users" WHERE "name" = $1 AND "age" = $2 LIMIT 100 OFFSET 0',
        ['Alice', 30],
      );
    });
  });
});

describe('PostgreSQLAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dialect은 'postgresql'", () => {
    expect(PostgreSQLAdapterFactory.dialect).toBe('postgresql');
  });

  it("displayName은 'PostgreSQL'", () => {
    expect(PostgreSQLAdapterFactory.displayName).toBe('PostgreSQL');
  });

  it('create()는 PostgreSQLAdapter 인스턴스를 반환', () => {
    const adapter = PostgreSQLAdapterFactory.create({
      host: 'localhost',
      database: 'testdb',
    });

    expect(adapter).toBeInstanceOf(PostgreSQLAdapter);
  });

  it('host 누락 시 에러', () => {
    expect(() => PostgreSQLAdapterFactory.create({ database: 'testdb' })).toThrow(
      'PostgreSQL adapter requires host and database',
    );
  });

  it('database 누락 시 에러', () => {
    expect(() => PostgreSQLAdapterFactory.create({ host: 'localhost' })).toThrow(
      'PostgreSQL adapter requires host and database',
    );
  });
});
