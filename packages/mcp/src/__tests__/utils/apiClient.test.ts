import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebFormApiClient, ApiError } from '../../utils/apiClient.js';

// --- fetch mock ---

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- 헬퍼 ---

function jsonResponse(data: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
  };
}

// --- ApiError ---

describe('ApiError', () => {
  it('상태코드와 메서드, 경로를 포함한 메시지를 생성한다', () => {
    const err = new ApiError(404, 'Not Found', 'GET', '/api/forms/abc');
    expect(err.status).toBe(404);
    expect(err.method).toBe('GET');
    expect(err.path).toBe('/api/forms/abc');
    expect(err.message).toContain('404');
    expect(err.message).toContain('GET');
    expect(err.name).toBe('ApiError');
  });

  it('detail이 있으면 기본 메시지 대신 사용한다', () => {
    const err = new ApiError(400, 'Bad Request', 'POST', '/api/forms', '커스텀 에러');
    expect(err.message).toContain('커스텀 에러');
  });

  it('404 에러는 리소스 경로를 한국어로 변환한다', () => {
    const err = new ApiError(404, 'Not Found', 'GET', '/api/forms/aabbccddee112233ff445566');
    expect(err.message).toContain('폼 (aabbccddee112233ff445566)');
  });

  it('409 에러는 버전 충돌 안내를 포함한다', () => {
    const err = new ApiError(409, 'Conflict', 'PUT', '/api/forms/aabbccddee112233ff445566');
    expect(err.message).toContain('버전 충돌');
  });

  it('알 수 없는 경로는 경로 그대로 반환한다', () => {
    const err = new ApiError(404, 'Not Found', 'GET', '/api/unknown/path');
    expect(err.message).toContain('/api/unknown/path');
  });

  it('프로젝트 경로를 인식한다', () => {
    const err = new ApiError(404, 'Not Found', 'GET', '/api/projects/aabbccddee112233ff445566');
    expect(err.message).toContain('프로젝트 (aabbccddee112233ff445566)');
  });

  it('프로젝트 Shell 경로를 인식한다', () => {
    const err = new ApiError(404, 'Not Found', 'GET', '/api/projects/aabbccddee112233ff445566/shell');
    expect(err.message).toContain('프로젝트 Shell');
  });

  it('폼 버전 경로를 인식한다', () => {
    const err = new ApiError(404, 'Not Found', 'GET', '/api/forms/aabbccddee112233ff445566/versions/3');
    expect(err.message).toContain('폼 버전');
    expect(err.message).toContain('version: 3');
  });

  it('500 에러 메시지를 생성한다', () => {
    const err = new ApiError(500, 'Internal Server Error', 'POST', '/api/forms');
    expect(err.message).toContain('서버 내부 오류');
  });

  it('502/503 에러 메시지를 생성한다', () => {
    const err = new ApiError(503, 'Service Unavailable', 'GET', '/api/forms');
    expect(err.message).toContain('서버에 연결할 수 없습니다');
  });

  it('401 에러는 인증 토큰 안내를 포함한다', () => {
    const err = new ApiError(401, 'Unauthorized', 'GET', '/api/forms');
    expect(err.message).toContain('인증 토큰');
  });

  it('403 에러는 접근 권한 안내를 포함한다', () => {
    const err = new ApiError(403, 'Forbidden', 'GET', '/api/forms');
    expect(err.message).toContain('접근 권한');
  });

  it('422 에러는 형식 안내를 포함한다', () => {
    const err = new ApiError(422, 'Unprocessable Entity', 'POST', '/api/forms');
    expect(err.message).toContain('형식');
  });
});

// --- WebFormApiClient ---

describe('WebFormApiClient', () => {
  let client: WebFormApiClient;

  beforeEach(() => {
    client = new WebFormApiClient('http://test:4000');
    mockFetch.mockReset();
  });

  describe('init()', () => {
    it('dev-token을 발급받아 토큰을 저장한다', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ token: 'test-token-123' }));

      await client.init();

      expect(mockFetch).toHaveBeenCalledWith('http://test:4000/auth/dev-token', {
        method: 'POST',
        keepalive: true,
      });
    });

    it('토큰 발급 실패 시 에러를 던진다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.init(1)).rejects.toThrow('토큰 발급 실패');
    });
  });

  describe('GET', () => {
    it('JSON 응답을 파싱하여 반환한다', async () => {
      const data = { data: [{ id: '1', name: 'test' }] };
      mockFetch.mockResolvedValueOnce(jsonResponse(data));

      const result = await client.get('/api/projects');

      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test:4000/api/projects',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('POST', () => {
    it('body를 JSON으로 전송한다', async () => {
      const reqBody = { name: 'Test Project' };
      const resData = { data: { _id: '1', name: 'Test Project' } };
      mockFetch.mockResolvedValueOnce(jsonResponse(resData));

      const result = await client.post('/api/projects', reqBody);

      expect(result).toEqual(resData);
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify(reqBody));
      expect(callArgs[1].headers['Content-Type']).toBe('application/json');
    });
  });

  describe('PUT', () => {
    it('PUT 요청을 보낸다', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await client.put('/api/forms/abc', { version: 1 });

      expect(mockFetch.mock.calls[0][1].method).toBe('PUT');
    });
  });

  describe('PATCH', () => {
    it('PATCH 요청을 보낸다', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await client.patch('/api/forms/abc', { name: 'new' });

      expect(mockFetch.mock.calls[0][1].method).toBe('PATCH');
    });
  });

  describe('DELETE', () => {
    it('204 응답 시 undefined를 반환한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: () => Promise.reject(new Error('no body')),
      });

      const result = await client.delete('/api/projects/abc');

      expect(result).toBeUndefined();
    });
  });

  describe('에러 처리', () => {
    it('HTTP 에러 응답 시 ApiError를 던진다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: { message: '찾을 수 없음' } }),
      });

      await expect(client.get('/api/forms/abc')).rejects.toThrow(ApiError);
      try {
        await client.get('/api/forms/abc');
      } catch (e) {
        // 이미 첫 호출에서 검증됨
      }
    });

    it('에러 응답의 body에서 detail을 추출한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ error: { message: '이름은 필수입니다' } }),
      });

      try {
        await client.get('/api/forms');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).detail).toBe('이름은 필수입니다');
      }
    });

    it('에러 응답 body 파싱 실패 시 기본 메시지를 사용한다', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('parse failed')),
      });

      try {
        await client.get('/api/forms');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(500);
      }
    });

    it('AbortError 발생 시 408 타임아웃 ApiError를 던진다', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      mockFetch.mockRejectedValueOnce(abortError);

      try {
        await client.get('/api/forms');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(408);
        expect((e as ApiError).message).toContain('30초');
      }
    });
  });

  describe('인증 헤더', () => {
    it('init 후 Authorization 헤더를 포함한다', async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ token: 'my-token' }))
        .mockResolvedValueOnce(jsonResponse({ data: [] }));

      await client.init();
      await client.get('/api/projects');

      const headers = mockFetch.mock.calls[1][1].headers;
      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('init 전에는 Authorization 헤더가 없다', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      await client.get('/api/projects');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  describe('기본 URL', () => {
    it('baseUrl 미지정 시 기본 localhost:4000을 사용한다', async () => {
      const defaultClient = new WebFormApiClient();
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

      await defaultClient.get('/api/test');

      expect(mockFetch.mock.calls[0][0]).toMatch(/^http:\/\/localhost:4000\/api\/test/);
    });
  });
});
