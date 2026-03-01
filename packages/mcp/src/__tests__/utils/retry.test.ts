import { describe, it, expect, vi } from 'vitest';
import { withOptimisticRetry } from '../../utils/retry.js';
import { ApiError } from '../../utils/apiClient.js';

describe('withOptimisticRetry', () => {
  it('성공 시 result와 data를 반환한다', async () => {
    const fetch = vi.fn().mockResolvedValue({ version: 1, controls: [] });
    const mutate = vi.fn().mockReturnValue('mutated');
    const save = vi.fn().mockResolvedValue(undefined);

    const result = await withOptimisticRetry({ fetch, mutate, save });

    expect(result.result).toBe('mutated');
    expect(result.data).toEqual({ version: 1, controls: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('409 충돌 시 자동 재시도한다', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({ version: 2 });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'Conflict', 'PUT', '/api/forms/abc'))
      .mockResolvedValueOnce(undefined);

    const result = await withOptimisticRetry({ fetch, mutate, save });

    expect(result.result).toBe('ok');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('최대 재시도 횟수 초과 시 마지막 에러를 던진다', async () => {
    const conflictError = new ApiError(409, 'Conflict', 'PUT', '/api/forms/abc');
    const fetch = vi.fn().mockResolvedValue({ version: 1 });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi.fn().mockRejectedValue(conflictError);

    await expect(
      withOptimisticRetry({ fetch, mutate, save, maxRetries: 2 }),
    ).rejects.toThrow(ApiError);

    // 초기 시도 1 + 재시도 2 = 총 3회
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('409가 아닌 에러는 즉시 던진다', async () => {
    const serverError = new ApiError(500, 'Internal Server Error', 'PUT', '/api/forms/abc');
    const fetch = vi.fn().mockResolvedValue({ version: 1 });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi.fn().mockRejectedValue(serverError);

    await expect(
      withOptimisticRetry({ fetch, mutate, save }),
    ).rejects.toThrow(ApiError);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('fetch 에러는 즉시 던진다', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('네트워크 오류'));
    const mutate = vi.fn();
    const save = vi.fn();

    await expect(
      withOptimisticRetry({ fetch, mutate, save }),
    ).rejects.toThrow('네트워크 오류');

    expect(mutate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('mutate에서 에러 발생 시 save 없이 즉시 던진다', async () => {
    const fetch = vi.fn().mockResolvedValue({ version: 1 });
    const mutate = vi.fn().mockImplementation(() => {
      throw new Error('mutation error');
    });
    const save = vi.fn();

    await expect(
      withOptimisticRetry({ fetch, mutate, save }),
    ).rejects.toThrow('mutation error');

    expect(save).not.toHaveBeenCalled();
  });

  it('maxRetries 기본값은 2이다', async () => {
    const conflictError = new ApiError(409, 'Conflict', 'PUT', '/api/forms/abc');
    const fetch = vi.fn().mockResolvedValue({ version: 1 });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi.fn().mockRejectedValue(conflictError);

    await expect(withOptimisticRetry({ fetch, mutate, save })).rejects.toThrow();

    // 기본값 2: 초기 1 + 재시도 2 = 3회
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('maxRetries=0이면 재시도 없이 즉시 실패한다', async () => {
    const conflictError = new ApiError(409, 'Conflict', 'PUT', '/api/forms/abc');
    const fetch = vi.fn().mockResolvedValue({ version: 1 });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi.fn().mockRejectedValue(conflictError);

    await expect(
      withOptimisticRetry({ fetch, mutate, save, maxRetries: 0 }),
    ).rejects.toThrow(ApiError);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('재시도 시 매번 새로운 데이터를 fetch한다', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ version: 1, name: 'first' })
      .mockResolvedValueOnce({ version: 2, name: 'second' });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'Conflict', 'PUT', '/api/forms/abc'))
      .mockResolvedValueOnce(undefined);

    const result = await withOptimisticRetry({ fetch, mutate, save });

    // 두 번째 fetch 결과가 최종 data
    expect(result.data).toEqual({ version: 2, name: 'second' });
  });

  it('ApiError가 아닌 일반 에러는 재시도하지 않는다', async () => {
    const fetch = vi.fn().mockResolvedValue({ version: 1 });
    const mutate = vi.fn().mockReturnValue('ok');
    const save = vi.fn().mockRejectedValue(new Error('일반 에러'));

    await expect(
      withOptimisticRetry({ fetch, mutate, save }),
    ).rejects.toThrow('일반 에러');

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
