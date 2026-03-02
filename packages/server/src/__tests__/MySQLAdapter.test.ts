import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MySQLAdapter, MySQLAdapterFactory } from '../services/adapters/MySQLAdapter.js';

const mockExecute = vi.fn();
const mockEnd = vi.fn();

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: vi.fn().mockImplementation(() => ({
      execute: mockExecute,
      end: mockEnd,
    })),
  },
}));

import mysql from 'mysql2/promise';

describe('MySQLAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue([[], []]);
    mockEnd.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('createPool에 올바른 설정이 전달된다', () => {
      new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
      });

      expect(mysql.createPool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
        ssl: undefined,
        connectionLimit: 10,
        connectTimeout: 10000,
      });
    });
  });

  describe('testConnection', () => {
    it('SELECT 1 실행 및 성공 응답', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.testConnection();

      expect(mockExecute).toHaveBeenCalledWith('SELECT 1', undefined);
      expect(result).toEqual({ success: true, message: '연결 성공' });
    });

    it('Pool 오류 시 { success: false } 반환', async () => {
      mockExecute.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
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
      mockExecute.mockResolvedValueOnce([mockRows, []]);

      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.executeQuery({ table: 'users' });

      expect(mockExecute).toHaveBeenCalledWith('SELECT * FROM `users` LIMIT 100 OFFSET 0', []);
      expect(result).toEqual(mockRows);
    });
  });

  describe('disconnect', () => {
    it('pool.end() 호출', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
      });

      await adapter.disconnect();

      expect(mockEnd).toHaveBeenCalledOnce();
    });
  });

  describe('escapeId', () => {
    it('MySQL 스타일 백틱 이스케이핑', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
      });

      mockExecute.mockResolvedValueOnce([[], []]);

      await adapter.executeQuery({ table: 'my`table' });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('`my``table`'),
        [],
      );
    });
  });

  describe('placeholder', () => {
    it('항상 ? 반환', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'secret',
        database: 'testdb',
      });

      mockExecute.mockResolvedValueOnce([[], []]);

      await adapter.executeQuery({
        table: 'users',
        filter: { name: 'Alice', age: 30 },
      });

      expect(mockExecute).toHaveBeenCalledWith(
        'SELECT * FROM `users` WHERE `name` = ? AND `age` = ? LIMIT 100 OFFSET 0',
        ['Alice', 30],
      );
    });
  });
});

describe('MySQLAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dialect은 'mysql'", () => {
    expect(MySQLAdapterFactory.dialect).toBe('mysql');
  });

  it("displayName은 'MySQL'", () => {
    expect(MySQLAdapterFactory.displayName).toBe('MySQL');
  });

  it('create()는 MySQLAdapter 인스턴스를 반환', () => {
    const adapter = MySQLAdapterFactory.create({
      host: 'localhost',
      database: 'testdb',
    });

    expect(adapter).toBeInstanceOf(MySQLAdapter);
  });

  it('host 누락 시 에러', () => {
    expect(() => MySQLAdapterFactory.create({ database: 'testdb' })).toThrow(
      'MySQL adapter requires host and database',
    );
  });

  it('database 누락 시 에러', () => {
    expect(() => MySQLAdapterFactory.create({ host: 'localhost' })).toThrow(
      'MySQL adapter requires host and database',
    );
  });
});
