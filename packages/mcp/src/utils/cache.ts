/**
 * TTL 기반 in-memory 캐시
 *
 * - 폼 조회 캐싱: 컨트롤 조작 시 get_form -> update_form 반복 조회 방지 (TTL 5초)
 * - 정적 리소스 캐싱: 스키마 데이터 등 변하지 않는 데이터 (TTL 무한)
 */
export class MemoryCache<T> {
  private store = new Map<string, { data: T; expiresAt: number }>();

  /**
   * @param ttlMs 캐시 유효 시간 (밀리초). 0이면 만료 없음.
   */
  constructor(private ttlMs: number = 5000) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.ttlMs > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    const expiresAt = this.ttlMs > 0 ? Date.now() + this.ttlMs : Infinity;
    this.store.set(key, { data, expiresAt });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

/** 폼 데이터 캐시 (TTL 5초) — 컨트롤 조작 시 반복 GET 방지 */
export const formCache = new MemoryCache<unknown>(5000);
