import { describe, it, expect, vi, beforeEach } from 'vitest';

// MongoClient mock
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('mongodb', () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    close: mockClose,
  })),
}));

// 매 테스트마다 모듈을 새로 로드하여 캐시를 초기화
async function loadPool() {
  const mod = await import('../services/adapters/MongoClientPool.js');
  return mod;
}

describe('MongoClientPool', () => {
  beforeEach(() => {
    vi.resetModules();
    mockClose.mockClear();
  });

  it('동일 connectionString에 같은 인스턴스를 반환해야 한다', async () => {
    const { getMongoClient } = await loadPool();
    const client1 = getMongoClient('mongodb://localhost:27017');
    const client2 = getMongoClient('mongodb://localhost:27017');
    expect(client1).toBe(client2);
  });

  it('서로 다른 connectionString에 다른 인스턴스를 반환해야 한다', async () => {
    const { getMongoClient } = await loadPool();
    const client1 = getMongoClient('mongodb://host1:27017');
    const client2 = getMongoClient('mongodb://host2:27017');
    expect(client1).not.toBe(client2);
  });

  it('evictMongoClient 후 새 인스턴스를 반환해야 한다', async () => {
    const { getMongoClient, evictMongoClient } = await loadPool();
    const client1 = getMongoClient('mongodb://localhost:27017');
    await evictMongoClient('mongodb://localhost:27017');
    const client2 = getMongoClient('mongodb://localhost:27017');
    expect(client1).not.toBe(client2);
    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('evictMongoClient는 존재하지 않는 키에 대해 아무 일도 하지 않아야 한다', async () => {
    const { evictMongoClient } = await loadPool();
    await evictMongoClient('mongodb://nonexistent:27017');
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('closeAllMongoClients는 모든 클라이언트를 닫고 캐시를 비워야 한다', async () => {
    const { getMongoClient, closeAllMongoClients } = await loadPool();
    getMongoClient('mongodb://host1:27017');
    getMongoClient('mongodb://host2:27017');
    await closeAllMongoClients();
    expect(mockClose).toHaveBeenCalledTimes(2);

    // 캐시가 비워졌으므로 새 인스턴스가 생성되어야 한다
    const newClient = getMongoClient('mongodb://host1:27017');
    expect(newClient).toBeDefined();
  });
});
