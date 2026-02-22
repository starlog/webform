import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// apiClient는 모듈 수준 싱글턴이므로 fetch를 mock하여 테스트
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// 모듈을 매 테스트마다 새로 import하기 위해 dynamic import 사용
let apiClient: typeof import('../communication/apiClient')['apiClient'];

describe('apiClient', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../communication/apiClient');
    apiClient = mod.apiClient;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchForm', () => {
    it('GET 요청으로 폼 정의를 가져온다', async () => {
      const mockFormDef = {
        id: 'form1',
        name: 'TestForm',
        version: 1,
        properties: {},
        controls: [],
        eventHandlers: [],
        dataBindings: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFormDef),
      });

      const result = await apiClient.fetchForm('form1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/runtime/forms/form1');
      expect(result).toEqual(mockFormDef);
    });

    it('요청 실패 시 에러를 던진다', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(apiClient.fetchForm('nonexistent')).rejects.toThrow('Failed to fetch form: 404');
    });
  });

  describe('postEvent', () => {
    it('POST 요청 형식이 올바르다', async () => {
      const mockResponse = {
        success: true,
        patches: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const payload = {
        formId: 'form1',
        controlId: 'btn1',
        eventName: 'Click',
        eventArgs: { type: 'Click', timestamp: 12345 },
        formState: { btn1: { text: 'Hello' } },
      };

      await apiClient.postEvent('form1', payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runtime/forms/form1/events',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    });

    it('UIPatch 응답을 올바르게 처리한다', async () => {
      const mockResponse = {
        success: true,
        patches: [
          { type: 'updateProperty', target: 'btn1', payload: { text: 'Updated' } },
          { type: 'updateProperty', target: 'lbl1', payload: { visible: false } },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const payload = {
        formId: 'form1',
        controlId: 'btn1',
        eventName: 'Click',
        eventArgs: { type: 'Click', timestamp: 12345 },
        formState: {},
      };

      const result = await apiClient.postEvent('form1', payload);

      expect(result.success).toBe(true);
      expect(result.patches).toHaveLength(2);
      expect(result.patches[0]).toEqual({
        type: 'updateProperty',
        target: 'btn1',
        payload: { text: 'Updated' },
      });
    });

    it('요청 실패 시 에러를 던진다', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const payload = {
        formId: 'form1',
        controlId: 'btn1',
        eventName: 'Click',
        eventArgs: { type: 'Click', timestamp: 12345 },
        formState: {},
      };

      await expect(apiClient.postEvent('form1', payload)).rejects.toThrow('Event request failed: 500');
    });
  });
});
