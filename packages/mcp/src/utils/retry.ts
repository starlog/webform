import { ApiError } from './apiClient.js';

interface RetryOptions<TData, TResult> {
  /** 데이터를 가져오는 함수 */
  fetch: () => Promise<TData>;
  /** 데이터를 변형하는 함수 (동기) */
  mutate: (data: TData) => TResult;
  /** 변형된 데이터를 저장하는 함수 */
  save: (data: TData) => Promise<unknown>;
  /** 최대 재시도 횟수 (기본값: 2) */
  maxRetries?: number;
}

/**
 * 낙관적 잠금 자동 재시도.
 * fetch → mutate → save 사이클을 실행하며, save에서 409 Conflict 발생 시
 * 최대 maxRetries 횟수만큼 fetch부터 다시 시도한다.
 */
export async function withOptimisticRetry<TData, TResult>(
  opts: RetryOptions<TData, TResult>,
): Promise<{ result: TResult; data: TData }> {
  const maxRetries = opts.maxRetries ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const data = await opts.fetch();
    const result = opts.mutate(data);

    try {
      await opts.save(data);
      return { result, data };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && attempt < maxRetries) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('최대 재시도 횟수 초과');
}
