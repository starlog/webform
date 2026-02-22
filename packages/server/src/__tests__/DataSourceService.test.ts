import { describe, it, expect } from 'vitest';
import { DataSourceService } from '../services/DataSourceService.js';
import { DataSource } from '../models/DataSource.js';

describe('DataSourceService', () => {
  const service = new DataSourceService();
  const userId = 'user-001';

  it('createDataSource: config가 암호화되어 DB에 저장되어야 한다', async () => {
    const result = await service.createDataSource(
      {
        type: 'database',
        name: 'Test DB',
        description: 'test',
        projectId: 'proj-1',
        config: {
          dialect: 'mongodb',
          connectionString: 'mongodb://localhost:27017',
          database: 'testdb',
        },
      },
      userId,
    );

    // DB에서 직접 조회하여 암호화된 값 확인
    const raw = await DataSource.findById(result._id).lean();
    expect(raw!.encryptedConfig).toBeDefined();
    expect(raw!.encryptedConfig).not.toBe('mongodb://localhost:27017');
    expect(raw!.encryptedConfig).toContain(':'); // iv:ciphertext 형식
  });

  it('getDataSource: 복호화된 config를 반환해야 한다', async () => {
    const created = await service.createDataSource(
      {
        type: 'database',
        name: 'Get Test DB',
        description: '',
        projectId: 'proj-1',
        config: {
          dialect: 'mongodb',
          connectionString: 'mongodb://secret-host:27017',
          database: 'mydb',
        },
      },
      userId,
    );

    const fetched = await service.getDataSource(created._id.toString());

    expect(fetched.config).toEqual({
      connectionString: 'mongodb://secret-host:27017',
      database: 'mydb',
    });
  });

  it('listDataSources: config 필드 없는 목록을 반환해야 한다', async () => {
    await service.createDataSource(
      {
        type: 'static',
        name: 'List Test 1',
        description: '',
        projectId: 'proj-list',
        config: { data: [{ a: 1 }] },
      },
      userId,
    );
    await service.createDataSource(
      {
        type: 'static',
        name: 'List Test 2',
        description: '',
        projectId: 'proj-list',
        config: { data: [{ b: 2 }] },
      },
      userId,
    );

    const { data, total } = await service.listDataSources({
      projectId: 'proj-list',
      page: 1,
      limit: 20,
    });

    expect(total).toBe(2);
    expect(data.length).toBe(2);
    for (const item of data) {
      const raw = item as unknown as Record<string, unknown>;
      expect(raw.encryptedConfig).toBeUndefined();
      expect(raw.staticData).toBeUndefined();
    }
  });
});
