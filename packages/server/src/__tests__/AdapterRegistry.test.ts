import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../services/adapters/AdapterRegistry.js';
import type { AdapterFactory } from '../services/adapters/AdapterRegistry.js';
import type { DataSourceAdapter } from '../services/adapters/types.js';
import { MongoDBAdapterFactory } from '../services/adapters/MongoDBAdapter.js';
import { AppError } from '../middleware/errorHandler.js';

function createStubFactory(dialect: string, displayName?: string): AdapterFactory {
  return {
    dialect,
    displayName: displayName ?? dialect,
    create(_config: Record<string, unknown>): DataSourceAdapter {
      return {
        async testConnection() {
          return { success: true, message: 'stub' };
        },
        async executeQuery() {
          return [];
        },
        async executeRawQuery() {
          return [];
        },
        async listTables() {
          return [];
        },
        async disconnect() {},
      };
    },
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it('register()가 어댑터 팩토리를 등록해야 한다', () => {
    const factory = createStubFactory('test-db');
    registry.register(factory);

    expect(registry.has('test-db')).toBe(true);
  });

  it('create()가 등록된 dialect로 어댑터를 생성해야 한다', () => {
    const factory = createStubFactory('test-db');
    registry.register(factory);

    const adapter = registry.create('test-db', { host: 'localhost' });

    expect(adapter).toBeDefined();
    expect(adapter.testConnection).toBeTypeOf('function');
    expect(adapter.executeQuery).toBeTypeOf('function');
    expect(adapter.disconnect).toBeTypeOf('function');
  });

  it('미등록 dialect로 create() 시 AppError가 발생해야 한다', () => {
    expect(() => registry.create('unknown-db', {})).toThrow(AppError);
    expect(() => registry.create('unknown-db', {})).toThrow(/unsupported dialect/);
  });

  it('이미 등록된 dialect를 중복 등록하면 에러가 발생해야 한다', () => {
    const factory = createStubFactory('duplicate-db');
    registry.register(factory);

    expect(() => registry.register(factory)).toThrow(/already registered/);
  });

  it('listDialects()가 등록된 dialect 목록을 반환해야 한다', () => {
    registry.register(createStubFactory('db-a', 'Database A'));
    registry.register(createStubFactory('db-b', 'Database B'));

    const dialects = registry.listDialects();

    expect(dialects).toHaveLength(2);
    expect(dialects).toEqual(
      expect.arrayContaining([
        { dialect: 'db-a', displayName: 'Database A' },
        { dialect: 'db-b', displayName: 'Database B' },
      ]),
    );
  });

  it('has()가 등록 여부를 정확히 반환해야 한다', () => {
    registry.register(createStubFactory('exists'));

    expect(registry.has('exists')).toBe(true);
    expect(registry.has('not-exists')).toBe(false);
  });

  describe('MongoDBAdapterFactory', () => {
    it('MongoDBAdapterFactory가 정상적으로 등록되어야 한다', () => {
      registry.register(MongoDBAdapterFactory);

      expect(registry.has('mongodb')).toBe(true);

      const dialects = registry.listDialects();
      expect(dialects).toContainEqual({
        dialect: 'mongodb',
        displayName: 'MongoDB',
      });
    });

    it('MongoDBAdapterFactory.create()가 올바른 config로 어댑터를 생성해야 한다', () => {
      registry.register(MongoDBAdapterFactory);

      const adapter = registry.create('mongodb', {
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
      });

      expect(adapter).toBeDefined();
      expect(adapter.testConnection).toBeTypeOf('function');
    });

    it('MongoDBAdapterFactory.create()가 필수 config 없이 호출 시 에러가 발생해야 한다', () => {
      registry.register(MongoDBAdapterFactory);

      expect(() => registry.create('mongodb', {})).toThrow(
        /connectionString and database/,
      );
    });
  });
});
