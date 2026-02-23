import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  ApplicationShellDefinition,
  ShellProperties,
  ShellEventRequest,
  ShellEventType,
  UIPatch,
} from '../index';
import { SHELL_EVENTS } from '../index';

describe('Shell 타입 정의', () => {
  it('ApplicationShellDefinition 객체를 생성할 수 있어야 한다', () => {
    const shell: ApplicationShellDefinition = {
      id: 'shell-1',
      projectId: 'project-1',
      name: 'TestShell',
      version: 1,
      properties: {
        title: 'Test App',
        width: 1024,
        height: 768,
        backgroundColor: '#ffffff',
        font: {
          family: 'Segoe UI',
          size: 12,
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
      startFormId: 'form-main',
    };

    expect(shell.id).toBe('shell-1');
    expect(shell.projectId).toBe('project-1');
    expect(shell.properties.showTitleBar).toBe(true);
    expect(shell.startFormId).toBe('form-main');
  });

  it('startFormId는 선택적 필드여야 한다', () => {
    const shell: ApplicationShellDefinition = {
      id: 'shell-2',
      projectId: 'project-2',
      name: 'NoStartForm',
      version: 1,
      properties: {
        title: 'Test',
        width: 800,
        height: 600,
        backgroundColor: '#000000',
        font: {
          family: 'Arial',
          size: 10,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
        },
        showTitleBar: false,
        formBorderStyle: 'None',
        maximizeBox: false,
        minimizeBox: false,
      },
      controls: [],
      eventHandlers: [],
    };

    expect(shell.startFormId).toBeUndefined();
  });

  it('SHELL_EVENTS에 Load, FormChanged, BeforeFormChange가 포함되어야 한다', () => {
    expect(SHELL_EVENTS).toContain('Load');
    expect(SHELL_EVENTS).toContain('FormChanged');
    expect(SHELL_EVENTS).toContain('BeforeFormChange');
    expect(SHELL_EVENTS).toHaveLength(3);
  });

  it('ShellEventType은 SHELL_EVENTS 요소 타입이어야 한다', () => {
    expectTypeOf<ShellEventType>().toEqualTypeOf<'Load' | 'FormChanged' | 'BeforeFormChange'>();
  });

  it('UIPatch type에 updateShell, updateAppState, closeApp이 포함되어야 한다', () => {
    const shellPatch: UIPatch = {
      type: 'updateShell',
      target: 'shell-1',
      payload: { title: 'New Title' },
    };
    expect(shellPatch.type).toBe('updateShell');

    const appStatePatch: UIPatch = {
      type: 'updateAppState',
      target: 'app',
      payload: { theme: 'dark' },
    };
    expect(appStatePatch.type).toBe('updateAppState');

    const closeAppPatch: UIPatch = {
      type: 'closeApp',
      target: 'app',
      payload: {},
    };
    expect(closeAppPatch.type).toBe('closeApp');
  });

  it('ShellEventRequest 객체를 생성할 수 있어야 한다', () => {
    const req: ShellEventRequest = {
      projectId: 'project-1',
      controlId: 'menuStrip1',
      eventName: 'ItemClicked',
      eventArgs: { type: 'click', timestamp: Date.now() },
      shellState: { menuStrip1: { visible: true } },
      currentFormId: 'form-main',
    };

    expect(req.projectId).toBe('project-1');
    expect(req.controlId).toBe('menuStrip1');
    expect(req.currentFormId).toBe('form-main');
  });

  it('ShellProperties에는 showTitleBar가 있고 startPosition은 없어야 한다', () => {
    const props: ShellProperties = {
      title: 'Test',
      width: 800,
      height: 600,
      backgroundColor: '#fff',
      font: {
        family: 'Arial',
        size: 12,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      },
      showTitleBar: true,
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    };

    expect(props.showTitleBar).toBe(true);
    expect('startPosition' in props).toBe(false);
  });
});
