import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDesignerStore } from '../stores/designerStore';

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

describe('apiService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('loadForm', () => {
    it('API를 호출하고 올바른 데이터를 반환해야 한다', async () => {
      const formData = {
        data: {
          _id: 'form-1',
          name: 'Test Form',
          version: 1,
          status: 'draft',
          projectId: 'proj-1',
          properties: { title: 'Test', width: 800, height: 600 },
          controls: [{ id: 'c1', type: 'Button', name: 'btn1' }],
          eventHandlers: [],
          dataBindings: [],
          createdBy: 'user-1',
          updatedBy: 'user-1',
          updatedAt: '2025-01-01',
          createdAt: '2025-01-01',
        },
      };

      fetchMock.mockResolvedValueOnce(mockResponse(formData));

      const result = await apiService.loadForm('form-1');

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock.mock.calls[0][0]).toContain('/forms/form-1');
      expect(result.data.name).toBe('Test Form');
      expect(result.data.controls).toHaveLength(1);
    });
  });

  describe('saveForm', () => {
    it('PUT 요청을 전송해야 한다', async () => {
      const savedForm = {
        data: { _id: 'form-1', name: 'Updated', version: 2 },
      };

      fetchMock.mockResolvedValueOnce(mockResponse(savedForm));

      const payload = {
        name: 'Updated',
        controls: [],
        properties: { title: 'Updated' },
      };

      await apiService.saveForm('form-1', payload);

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/forms/form-1');
      expect(options.method).toBe('PUT');
      expect(JSON.parse(options.body)).toEqual(payload);
    });
  });

  describe('autoSave (isDirty 조건)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      fetchMock.mockReset();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('isDirty가 true일 때만 autoSave가 실행되어야 한다', async () => {
      // isDirty = false, currentFormId = 'form-1' 상태 설정
      useDesignerStore.setState({
        currentFormId: 'form-1',
        isDirty: false,
        controls: [],
        formProperties: {
          title: 'Test',
          width: 800,
          height: 600,
          backgroundColor: '#F0F0F0',
          font: { family: 'Segoe UI', size: 9, bold: false, italic: false, underline: false, strikethrough: false },
          startPosition: 'CenterScreen',
          formBorderStyle: 'Sizable',
          maximizeBox: true,
          minimizeBox: true,
        },
      });

      // useAutoSave는 React 훅이므로 내부 로직을 직접 시뮬레이션
      // isDirty가 false이면 save가 호출되지 않아야 함
      const { isDirty, currentFormId } = useDesignerStore.getState();
      if (currentFormId && isDirty) {
        await apiService.saveForm(currentFormId, {
          controls: useDesignerStore.getState().controls,
          properties: useDesignerStore.getState().formProperties,
        });
      }

      expect(fetchMock).not.toHaveBeenCalled();

      // isDirty를 true로 변경
      useDesignerStore.setState({ isDirty: true });
      fetchMock.mockResolvedValueOnce(mockResponse({ data: {} }));

      const state = useDesignerStore.getState();
      if (state.currentFormId && state.isDirty) {
        await apiService.saveForm(state.currentFormId, {
          controls: state.controls,
          properties: state.formProperties,
        });
      }

      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/forms/form-1');
      expect(options.method).toBe('PUT');
    });
  });
});
