import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MSSQLAdapter, MSSQLAdapterFactory } from '../services/adapters/MSSQLAdapter.js';

const mockQuery = vi.fn();
const mockInput = vi.fn().mockReturnThis();
const mockClose = vi.fn();
const mockConnect = vi.fn();

vi.mock('mssql', () => {
  const ConnectionPool = vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    request: vi.fn().mockReturnValue({
      input: mockInput,
      query: mockQuery,
    }),
    close: mockClose,
  }));
  return { default: { ConnectionPool } };
});

import sql from 'mssql';

describe('MSSQLAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ recordset: [] });
    mockClose.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('ConnectionPool 생성 시 올바른 설정이 전달된다', () => {
      new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      expect(sql.ConnectionPool).toHaveBeenCalledWith({
        server: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
        pool: { max: 10, min: 2, idleTimeoutMillis: 60000 },
        connectionTimeout: 10000,
        requestTimeout: 10000,
      });
    });
  });

  describe('testConnection', () => {
    it('SELECT 1 실행 및 성공 응답', async () => {
      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.testConnection();

      expect(mockConnect).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
      expect(result).toEqual({ success: true, message: '연결 성공' });
    });

    it('Pool 오류 시 { success: false } 반환', async () => {
      mockConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.testConnection();

      expect(result).toEqual({ success: false, message: 'ECONNREFUSED' });
    });
  });

  describe('executeQuery', () => {
    it('OFFSET FETCH 문법이 포함된 쿼리 생성', async () => {
      const mockRows = [{ id: 1, name: 'Alice' }];
      mockQuery.mockResolvedValueOnce({ recordset: mockRows });

      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      const result = await adapter.executeQuery({ table: 'users' });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM [users] ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY',
      );
      expect(result).toEqual(mockRows);
    });

    it('WHERE 조건 포함 쿼리', async () => {
      mockQuery.mockResolvedValueOnce({ recordset: [] });

      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      await adapter.executeQuery({
        table: 'users',
        filter: { name: 'Alice', age: 30 },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM [users] WHERE [name] = @p1 AND [age] = @p2 ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY',
      );
      expect(mockInput).toHaveBeenCalledWith('p1', 'Alice');
      expect(mockInput).toHaveBeenCalledWith('p2', 30);
    });
  });

  describe('disconnect', () => {
    it('pool.close() 호출', async () => {
      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      // ensureConnected를 먼저 호출해서 connected 상태로 만듦
      await adapter.testConnection();
      vi.clearAllMocks();

      await adapter.disconnect();

      expect(mockClose).toHaveBeenCalledOnce();
    });
  });

  describe('escapeId', () => {
    it('MSSQL 스타일 대괄호 이스케이핑 ([col])', async () => {
      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await adapter.executeQuery({ table: 'my]table' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('[my]]table]'),
      );
    });
  });

  describe('placeholder', () => {
    it('@p1, @p2 형식 반환', async () => {
      const adapter = new MSSQLAdapter({
        host: 'localhost',
        port: 1433,
        user: 'sa',
        password: 'secret',
        database: 'testdb',
      });

      mockQuery.mockResolvedValueOnce({ recordset: [] });

      await adapter.executeQuery({
        table: 'users',
        filter: { name: 'Alice', age: 30 },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('@p1'),
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('@p2'),
      );
    });
  });
});

describe('MSSQLAdapterFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dialect은 'mssql'", () => {
    expect(MSSQLAdapterFactory.dialect).toBe('mssql');
  });

  it("displayName은 'Microsoft SQL Server'", () => {
    expect(MSSQLAdapterFactory.displayName).toBe('Microsoft SQL Server');
  });

  it('create()는 MSSQLAdapter 인스턴스를 반환', () => {
    const adapter = MSSQLAdapterFactory.create({
      host: 'localhost',
      database: 'testdb',
    });

    expect(adapter).toBeInstanceOf(MSSQLAdapter);
  });

  it('host 누락 시 에러', () => {
    expect(() => MSSQLAdapterFactory.create({ database: 'testdb' })).toThrow(
      'MSSQL adapter requires host and database',
    );
  });

  it('database 누락 시 에러', () => {
    expect(() => MSSQLAdapterFactory.create({ host: 'localhost' })).toThrow(
      'MSSQL adapter requires host and database',
    );
  });
});
