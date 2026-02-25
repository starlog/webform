import { describe, it, expect, vi, beforeEach } from 'vitest';

// fetch 모킹
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// 동적 import로 apiService 로드 (fetch가 모킹된 후)
const { apiService } = await import('../services/apiService');

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    statusText: 'OK',
  };
}

function mockErrorResponse(message: string, status = 404) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
    statusText: 'Not Found',
  };
}

// ensureAuth()의 auth token을 사전 설정
fetchMock.mockResolvedValueOnce(mockResponse({ token: 'test-token' }));
fetchMock.mockResolvedValueOnce(
  mockResponse({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
);
await apiService.listForms();
fetchMock.mockReset();

const sampleShellDoc = {
  _id: 'shell-1',
  projectId: 'proj-1',
  name: 'My App Shell',
  version: 1,
  properties: {
    title: 'My Application',
    width: 1024,
    height: 768,
    backgroundColor: '#FFFFFF',
    font: {
      family: 'Segoe UI',
      size: 9,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
    },
    showTitleBar: true,
    formBorderStyle: 'Sizable' as const,
    maximizeBox: true,
    minimizeBox: true,
  },
  controls: [],
  eventHandlers: [],
  startFormId: 'form-1',
  published: false,
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('apiService - Shell API', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('getShell', () => {
    it('성공 시 Shell 데이터를 반환해야 한다', async () => {
      const responseData = { data: sampleShellDoc };
      fetchMock.mockResolvedValueOnce(mockResponse(responseData));

      const result = await apiService.getShell('proj-1');

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toContain('/projects/proj-1/shell');
      expect(result).not.toBeNull();
      expect(result!.data.name).toBe('My App Shell');
      expect(result!.data.projectId).toBe('proj-1');
      expect(result!.data.properties.title).toBe('My Application');
    });

    it('Shell이 없으면 data: null을 반환해야 한다', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ data: null }));

      const result = await apiService.getShell('proj-nonexistent');

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(result.data).toBeNull();
    });
  });

  describe('createShell', () => {
    it('POST 요청으로 Shell을 생성해야 한다', async () => {
      const responseData = { data: sampleShellDoc };
      fetchMock.mockResolvedValueOnce(mockResponse(responseData));

      const payload = {
        name: 'My App Shell',
        properties: { title: 'My Application' },
      };

      const result = await apiService.createShell('proj-1', payload);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/projects/proj-1/shell');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(payload);
      expect(result.data.name).toBe('My App Shell');
    });
  });

  describe('updateShell', () => {
    it('PUT 요청으로 Shell을 수정해야 한다', async () => {
      const updatedDoc = { ...sampleShellDoc, name: 'Updated Shell', version: 2 };
      fetchMock.mockResolvedValueOnce(mockResponse({ data: updatedDoc }));

      const payload = {
        name: 'Updated Shell',
        properties: { title: 'Updated App' },
        controls: [],
        eventHandlers: [],
      };

      const result = await apiService.updateShell('proj-1', payload);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/projects/proj-1/shell');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual(payload);
      expect(result.data.name).toBe('Updated Shell');
      expect(result.data.version).toBe(2);
    });
  });

  describe('deleteShell', () => {
    it('DELETE 요청으로 Shell을 삭제해야 한다', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(undefined, 204));

      await apiService.deleteShell('proj-1');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/projects/proj-1/shell');
      expect(options.method).toBe('DELETE');
    });
  });

  describe('publishShell', () => {
    it('POST 요청으로 Shell을 퍼블리시해야 한다', async () => {
      const publishedDoc = { ...sampleShellDoc, published: true, version: 2 };
      fetchMock.mockResolvedValueOnce(mockResponse({ data: publishedDoc }));

      const result = await apiService.publishShell('proj-1');

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/projects/proj-1/shell/publish');
      expect(options.method).toBe('POST');
      expect(result.data.published).toBe(true);
      expect(result.data.version).toBe(2);
    });
  });
});
