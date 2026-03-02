import { adapterRegistry } from './AdapterRegistry.js';
import type { DataSourceAdapter } from './types.js';

// datasourceId → DataSourceAdapter 캐시
const adapterCache = new Map<string, DataSourceAdapter>();

/**
 * 데이터소스 ID 기반으로 SQL 어댑터 싱글톤을 반환한다.
 * 동일한 datasourceId에 대해 항상 같은 어댑터(커넥션 풀)를 재사용한다.
 */
export function getSqlAdapter(
  dsId: string,
  dialect: string,
  config: Record<string, unknown>,
): DataSourceAdapter {
  let adapter = adapterCache.get(dsId);
  if (!adapter) {
    adapter = adapterRegistry.create(dialect, config);
    adapterCache.set(dsId, adapter);
  }
  return adapter;
}

/**
 * 특정 데이터소스의 어댑터를 캐시에서 제거하고 연결을 닫는다.
 * 데이터소스 설정 변경/삭제 시 호출하여 풀을 무효화한다.
 */
export async function evictSqlAdapter(dsId: string): Promise<void> {
  const adapter = adapterCache.get(dsId);
  if (adapter) {
    adapterCache.delete(dsId);
    await adapter.disconnect().catch(() => {});
  }
}

/**
 * 모든 캐시된 SQL 어댑터를 닫고 캐시를 비운다.
 * 앱 종료(graceful shutdown) 시 호출.
 */
export async function closeAllSqlAdapters(): Promise<void> {
  const closePromises = Array.from(adapterCache.values()).map((adapter) =>
    adapter.disconnect().catch(() => {}),
  );
  await Promise.all(closePromises);
  adapterCache.clear();
}
