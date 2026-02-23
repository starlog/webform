import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShellRenderer } from '../renderer/ShellRenderer';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { ApplicationShellDefinition, ControlDefinition } from '@webform/common';

// apiClient 모킹
vi.mock('../communication/apiClient', () => ({
  apiClient: {
    postShellEvent: vi.fn().mockResolvedValue({ success: true, patches: [] }),
  },
}));

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

function createMenuStripControl(overrides?: Partial<ControlDefinition>): ControlDefinition {
  return {
    id: 'menu1',
    type: 'MenuStrip',
    name: 'mainMenu',
    properties: { items: [{ text: 'File' }, { text: 'Edit' }] },
    position: { x: 0, y: 0 },
    size: { width: 1024, height: 24 },
    anchor: { top: true, left: true, bottom: false, right: true },
    dock: 'Top',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

function createStatusStripControl(overrides?: Partial<ControlDefinition>): ControlDefinition {
  return {
    id: 'status1',
    type: 'StatusStrip',
    name: 'statusBar',
    properties: { text: 'Ready' },
    position: { x: 0, y: 744 },
    size: { width: 1024, height: 24 },
    anchor: { top: false, left: true, bottom: true, right: true },
    dock: 'Bottom',
    tabIndex: 1,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

describe('ShellRenderer', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      shellDef: null,
      shellControlStates: {},
      appState: {},
      formHistory: [],
      navigateParams: {},
      navigateRequest: null,
      dialogQueue: [],
    });
  });

  it('Shell 정의로 ShellRenderer를 렌더링한다', () => {
    const shellDef = createMockShellDef();
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div>폼 콘텐츠</div>
      </ShellRenderer>,
    );

    // Shell 컨테이너가 렌더링됨
    const shellContainer = document.querySelector('.wf-shell') as HTMLElement;
    expect(shellContainer).toBeInTheDocument();
  });

  it('TitleBar에 타이틀이 표시된다', () => {
    const shellDef = createMockShellDef({
      properties: {
        title: 'My Application',
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
    });
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div>콘텐츠</div>
      </ShellRenderer>,
    );

    const titleBar = document.querySelector('.wf-titlebar') as HTMLElement;
    expect(titleBar).toBeInTheDocument();
    expect(screen.getByText('My Application')).toBeInTheDocument();
  });

  it('showTitleBar가 false이면 TitleBar를 렌더링하지 않는다', () => {
    const shellDef = createMockShellDef({
      properties: {
        title: 'Hidden Title',
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
        showTitleBar: false,
        formBorderStyle: 'Sizable',
        maximizeBox: true,
        minimizeBox: true,
      },
    });
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div>콘텐츠</div>
      </ShellRenderer>,
    );

    const titleBar = document.querySelector('.wf-titlebar');
    expect(titleBar).not.toBeInTheDocument();
  });

  it('dock Top 컨트롤이 FormArea 위에 렌더링된다', () => {
    const menuStrip = createMenuStripControl();
    const shellDef = createMockShellDef({ controls: [menuStrip] });
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div>폼 콘텐츠</div>
      </ShellRenderer>,
    );

    // MenuStrip 컨트롤이 렌더링됨 (data-control-id로 확인)
    const menuElement = document.querySelector('[data-control-id="menu1"]');
    expect(menuElement).toBeInTheDocument();

    // FormArea가 존재
    const formArea = document.querySelector('.wf-shell-form-area') as HTMLElement;
    expect(formArea).toBeInTheDocument();

    // DockTop 컨트롤이 FormArea보다 앞에 위치 (DOM 순서)
    const contentDiv = formArea.parentElement!;
    const children = Array.from(contentDiv.children);
    const menuIndex = children.findIndex((el) =>
      el.querySelector('[data-control-id="menu1"]') || el.getAttribute('data-control-id') === 'menu1',
    );
    const formAreaIndex = children.indexOf(formArea);
    expect(menuIndex).toBeLessThan(formAreaIndex);
  });

  it('dock Bottom 컨트롤이 FormArea 아래에 렌더링된다', () => {
    const statusStrip = createStatusStripControl();
    const shellDef = createMockShellDef({ controls: [statusStrip] });
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div>폼 콘텐츠</div>
      </ShellRenderer>,
    );

    // StatusStrip 컨트롤이 렌더링됨
    const statusElement = document.querySelector('[data-control-id="status1"]');
    expect(statusElement).toBeInTheDocument();

    // FormArea가 존재
    const formArea = document.querySelector('.wf-shell-form-area') as HTMLElement;
    expect(formArea).toBeInTheDocument();

    // DockBottom 컨트롤이 FormArea보다 뒤에 위치 (DOM 순서)
    const contentDiv = formArea.parentElement!;
    const children = Array.from(contentDiv.children);
    const statusIndex = children.findIndex((el) =>
      el.querySelector('[data-control-id="status1"]') || el.getAttribute('data-control-id') === 'status1',
    );
    const formAreaIndex = children.indexOf(formArea);
    expect(statusIndex).toBeGreaterThan(formAreaIndex);
  });

  it('FormArea에 children(폼)이 렌더링된다', () => {
    const shellDef = createMockShellDef();
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div data-testid="form-content">폼 콘텐츠</div>
      </ShellRenderer>,
    );

    const formArea = document.querySelector('.wf-shell-form-area') as HTMLElement;
    expect(formArea).toBeInTheDocument();

    // children이 FormArea 내부에 렌더링됨
    const formContent = screen.getByTestId('form-content');
    expect(formContent).toBeInTheDocument();
    expect(formArea.contains(formContent)).toBe(true);
  });

  it('Top + Bottom 컨트롤이 동시에 올바른 순서로 렌더링된다', () => {
    const menuStrip = createMenuStripControl();
    const statusStrip = createStatusStripControl();
    const shellDef = createMockShellDef({ controls: [menuStrip, statusStrip] });
    useRuntimeStore.getState().setShellDef(shellDef);

    render(
      <ShellRenderer shellDef={shellDef} projectId="proj1">
        <div data-testid="form-content">폼</div>
      </ShellRenderer>,
    );

    const formArea = document.querySelector('.wf-shell-form-area') as HTMLElement;
    const contentDiv = formArea.parentElement!;
    const children = Array.from(contentDiv.children);

    // 순서: MenuStrip(Top) → FormArea → StatusStrip(Bottom)
    const menuIndex = children.findIndex((el) =>
      el.querySelector('[data-control-id="menu1"]') || el.getAttribute('data-control-id') === 'menu1',
    );
    const formAreaIndex = children.indexOf(formArea);
    const statusIndex = children.findIndex((el) =>
      el.querySelector('[data-control-id="status1"]') || el.getAttribute('data-control-id') === 'status1',
    );

    expect(menuIndex).toBeLessThan(formAreaIndex);
    expect(formAreaIndex).toBeLessThan(statusIndex);
  });
});
