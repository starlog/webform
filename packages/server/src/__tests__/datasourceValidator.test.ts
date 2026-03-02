import { describe, it, expect } from 'vitest';
import { createDataSourceSchema } from '../validators/datasourceValidator.js';

const baseFields = {
  name: 'Test DataSource',
  description: '테스트용 데이터소스',
  projectId: 'proj-1',
};

describe('datasourceValidator - MongoDB 검증', () => {
  it('유효한 MongoDB config는 검증을 통과해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: {
        dialect: 'mongodb' as const,
        connectionString: 'mongodb://localhost:27017',
        database: 'testdb',
      },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('connectionString 누락 시 검증에 실패해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: {
        dialect: 'mongodb' as const,
        database: 'testdb',
      },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('datasourceValidator - SQL DB 검증', () => {
  const sqlConfig = {
    host: 'localhost',
    user: 'admin',
    password: 'secret',
    database: 'mydb',
  };

  it('유효한 PostgreSQL config는 검증을 통과해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: { dialect: 'postgresql' as const, ...sqlConfig },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('유효한 MySQL config는 검증을 통과해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: { dialect: 'mysql' as const, ...sqlConfig },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('유효한 MSSQL config는 검증을 통과해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: { dialect: 'mssql' as const, ...sqlConfig },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('host 누락 시 검증에 실패해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: {
        dialect: 'postgresql' as const,
        user: 'admin',
        password: 'secret',
        database: 'mydb',
      },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('잘못된 dialect는 검증에 실패해야 한다', () => {
    const input = {
      type: 'database' as const,
      ...baseFields,
      config: {
        dialect: 'oracle',
        host: 'localhost',
        user: 'admin',
        password: 'secret',
        database: 'mydb',
      },
    };

    const result = createDataSourceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
