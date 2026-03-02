import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppContainer } from '../renderer/AppContainer';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { AppLoadResponse, FormDefinition, ApplicationShellDefinition } from '@webform/common';

// apiClient 모킹
vi.mock('../communication/apiClient', () => ({
  apiClient: {
    fetchApp: vi.fn(),
    fetchForm: vi.fn(),
    postEvent: vi.fn().mockResolvedValue({ success: true, patches: [] }),
    postShellEvent: vi.fn().mockResolvedValue({ success: true, patches: [] }),
  },
}));

// wsClient 모킹
vi.mock('../communication/wsClient', () => ({
  wsClient: {
    connectApp: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    onMessage: vi.fn().mockReturnValue(() => {}),
  },
}));

// patchApplier 모킹
vi.mock('../communication/patchApplier', () => ({
  setupPatchListener: vi.fn(),
}));

import { apiClient } from '../communication/apiClient';
import { wsClient } from '../communication/wsClient';

function createMockFormDef(overrides?: Partial<FormDefinition>): FormDefinition {
  return {
    id: 'form1',
    name: 'TestForm',
    version: 1,
    properties: {
      title: 'Test Form',
      width: 800,
      height: 600,
      backgroundColor: '#FFFFFF',
      font: {
        family: 'Segoe UI',
        size: 9,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      },
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
        properties: { text: 'Test Button' },
        position: { x: 10, y: 10 },
        size: { width: 100, height: 30 },
        anchor: { top: true, left: true, bottom: false, right: false },
        dock: 'None',
        tabIndex: 0,
        visible: true,
        enabled: true,
      },
    ],
    eventHandlers: [],
    ...overrides,
  };
}

function createMockShellDef(
  overrides?: Partial<ApplicationShellDefinition>,
): ApplicationShellDefinition {
  return {
    id: 'shell1',
    projectId: 'proj1',
    name: 'TestShell',
    version: 1,
    properties: {
      title: 'Test App',
      width: 1024,
      height: 768,
      backgroundColor: '#F0F0F0',
      font: {
        family: 'Segoe UI',
        size: 9,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      },
      showTitleBar: true,
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    },
    controls: [],
    eventHandlers: [],
    ...overrides,
  };
}

describe('AppContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeStore.setState({
      currentFormDef: null,
      controlStates: {},
      shellDef: null,
      shellControlStates: {},
      appState: {},
      formHistory: [],
      navigateParams: {},
      navigateRequest: null,
      dialogQueue: [],
      pendingPatchGroups: [],
    });
  });

  it('projectId prop으로 fetchApp을 호출한다', async () => {
    const mockFormDef = createMockFormDef();
    const response: AppLoadResponse = {
      shell: null,
      startForm: mockFormDef,
    };
    (apiClient.fetchApp as Mock).mockResolvedValue(response);

    render(<AppContainer projectId="proj1" />);

    await waitFor(() => {
      expect(apiClient.fetchApp).toHaveBeenCalledWith('proj1', undefined);
    });
  });

  it('initialFormId가 있으면 fetchApp에 전달한다', async () => {
    const mockFormDef = createMockFormDef();
    const response: AppLoadResponse = {
      shell: null,
      startForm: mockFormDef,
    };
    (apiClient.fetchApp as Mock).mockResolvedValue(response);

    render(<AppContainer projectId="proj1" initialFormId="form99" />);

    await waitFor(() => {
      expect(apiClient.fetchApp).toHaveBeenCalledWith('proj1', 'form99');
    });
  });

  it('로딩 중에는 로딩 메시지를 표시한다', () => {
    // fetchApp이 resolve되지 않는 Promise 반환
    (apiClient.fetchApp as Mock).mockReturnValue(new Promise(() => {}));

    render(<AppContainer projectId="proj1" />);

    expect(screen.getByText('로딩 중...')).toBeInTheDocument();
  });

  it('fetchApp 오류 시 오류 메시지를 표시한다', async () => {
    (apiClient.fetchApp as Mock).mockRejectedValue(new Error('Network error'));

    render(<AppContainer projectId="proj1" />);

    await waitFor(() => {
      expect(screen.getByText(/오류: Network error/)).toBeInTheDocument();
    });
  });

  it('Shell이 있을 때 ShellRenderer로 감싸서 렌더링한다', async () => {
    const mockFormDef = createMockFormDef();
    const mockShellDef = createMockShellDef();
    const response: AppLoadResponse = {
      shell: mockShellDef,
      startForm: mockFormDef,
    };
    (apiClient.fetchApp as Mock).mockResolvedValue(response);

    render(<AppContainer projectId="proj1" />);

    await waitFor(() => {
      // ShellRenderer의 .wf-shell 컨테이너가 존재
      const shellContainer = document.querySelector('.wf-shell');
      expect(shellContainer).toBeInTheDocument();
    });

    // TitleBar가 존재 (Shell이 렌더링된 증거)
    const titleBar = document.querySelector('.wf-titlebar');
    expect(titleBar).toBeInTheDocument();
    expect(screen.getByText('Test App')).toBeInTheDocument();

    // 폼 콘텐츠도 Shell 내부에 렌더링됨
    const formArea = document.querySelector('.wf-shell-form-area');
    expect(formArea).toBeInTheDocument();
  });

  it('Shell이 없을 때 기존 SDUIRenderer로 렌더링한다 (FormContainer)', async () => {
    const mockFormDef = createMockFormDef();
    const response: AppLoadResponse = {
      shell: null,
      startForm: mockFormDef,
    };
    (apiClient.fetchApp as Mock).mockResolvedValue(response);

    render(<AppContainer projectId="proj1" />);

    await waitFor(() => {
      // Shell 컨테이너가 없음
      const shellContainer = document.querySelector('.wf-shell');
      expect(shellContainer).not.toBeInTheDocument();
    });

    // FormContainer (wf-form)가 직접 렌더링됨
    const formContainer = document.querySelector('.wf-form');
    expect(formContainer).toBeInTheDocument();
  });

  it('WebSocket을 프로젝트 단위로 연결한다', async () => {
    const mockFormDef = createMockFormDef();
    const response: AppLoadResponse = {
      shell: null,
      startForm: mockFormDef,
    };
    (apiClient.fetchApp as Mock).mockResolvedValue(response);

    render(<AppContainer projectId="proj1" />);

    await waitFor(() => {
      expect(wsClient.connectApp).toHaveBeenCalledWith('proj1');
    });
  });
});
