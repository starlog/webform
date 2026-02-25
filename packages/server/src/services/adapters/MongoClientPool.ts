import { MongoClient, type MongoClientOptions } from 'mongodb';

const DEFAULT_OPTIONS: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 30_000,
  maxIdleTimeMS: 60_000,
  retryWrites: true,
  retryReads: true,
};

// connectionString → MongoClient 캐시
const clientCache = new Map<string, MongoClient>();

/**
 * connectionString 기반으로 MongoClient 싱글톤을 반환한다.
 * 동일한 connectionString에 대해 항상 같은 클라이언트를 재사용한다.
 * MongoClient는 connect()를 명시적으로 호출하지 않아도 첫 쿼리 시 자동 연결된다.
 */
export function getMongoClient(connectionString: string): MongoClient {
  let client = clientCache.get(connectionString);
  if (!client) {
    client = new MongoClient(connectionString, DEFAULT_OPTIONS);
    clientCache.set(connectionString, client);
  }
  return client;
}

/**
 * 특정 connectionString의 클라이언트를 캐시에서 제거하고 연결을 닫는다.
 * 연결 오류 발생 시 해당 클라이언트를 교체하기 위해 사용.
 */
export async function evictMongoClient(connectionString: string): Promise<void> {
  const client = clientCache.get(connectionString);
  if (client) {
    clientCache.delete(connectionString);
    await client.close().catch(() => {});
  }
}

/**
 * 모든 캐시된 MongoClient를 닫고 캐시를 비운다.
 * 앱 종료(graceful shutdown) 시 호출.
 */
export async function closeAllMongoClients(): Promise<void> {
  const closePromises = Array.from(clientCache.values()).map((client) =>
    client.close().catch(() => {}),
  );
  await Promise.all(closePromises);
  clientCache.clear();
}
