import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventHandlers } from '../hooks/useEventHandlers';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { EventHandlerDefinition, FormDefinition } from '@webform/common';

// apiClient mock
vi.mock('../communication/apiClient', () => ({
  apiClient: {
    postEvent: vi.fn(),
  },
}));

import { apiClient } from '../communication/apiClient';

const mockedPostEvent = vi.mocked(apiClient.postEvent);

function createMockFormDef(): FormDefinition {
  return {
    id: 'form1',
    name: 'TestForm',
    version: 1,
    properties: {
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
    controls: [
      {
        id: 'btn1',
        type: 'Button',
        name: 'button1',
        properties: { text: 'Click' },
        position: { x: 0, y: 0 },
        size: { width: 100, height: 30 },
        anchor: { top: true, left: true, bottom: false, right: false },
        dock: 'None',
        tabIndex: 0,
        visible: true,
        enabled: true,
      },
    ],
    eventHandlers: [],
    dataBindings: [],
  };
}

describe('useEventHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeStore.setState({ currentFormDef: null, controlStates: {} });
    const formDef = createMockFormDef();
    useRuntimeStore.getState().setFormDef(formDef);
  });

  it('client 이벤트: apiClient 호출 없이 로컬에서 실행한다', () => {
    const events: EventHandlerDefinition[] = [
      {
        controlId: 'btn1',
        eventName: 'Click',
        handlerType: 'client',
        handlerCode: 'sender.text = "Clicked!";',
      },
    ];

    const { result } = renderHook(() => useEventHandlers('btn1', events));

    act(() => {
      result.current.onClick?.();
    });

    // apiClient가 호출되지 않음
    expect(mockedPostEvent).not.toHaveBeenCalled();

    // 로컬 상태가 업데이트됨
    const state = useRuntimeStore.getState();
    expect(state.controlStates['btn1'].text).toBe('Clicked!');
  });

  it('server 이벤트: apiClient.postEvent 호출을 확인한다', async () => {
    mockedPostEvent.mockResolvedValue({
      success: true,
      patches: [
        { type: 'updateProperty', target: 'btn1', payload: { text: 'Server Updated' } },
      ],
    });

    const events: EventHandlerDefinition[] = [
      {
        controlId: 'btn1',
        eventName: 'Click',
        handlerType: 'server',
        handlerCode: '',
      },
    ];

    const { result } = renderHook(() => useEventHandlers('btn1', events));

    await act(async () => {
      await result.current.onClick?.();
    });

    // apiClient.postEvent가 호출됨
    expect(mockedPostEvent).toHaveBeenCalledTimes(1);
    expect(mockedPostEvent).toHaveBeenCalledWith(
      'form1',
      expect.objectContaining({
        formId: 'form1',
        controlId: 'btn1',
        eventName: 'Click',
      }),
    );

    // 서버 응답의 patches가 적용됨
    const state = useRuntimeStore.getState();
    expect(state.controlStates['btn1'].text).toBe('Server Updated');
  });
});
