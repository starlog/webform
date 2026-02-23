import { describe, it, expect } from 'vitest';
import type { ApplicationShellDefinition, ShellEventRequest } from '@webform/common';
import { EventEngine } from '../services/EventEngine.js';

function makeShellDef(
  handlers: ApplicationShellDefinition['eventHandlers'],
  controls: ApplicationShellDefinition['controls'] = [],
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
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    },
    controls,
    eventHandlers: handlers,
    startFormId: 'form1',
  };
}

function makeShellPayload(overrides?: Partial<ShellEventRequest>): ShellEventRequest {
  return {
    projectId: 'proj1',
    controlId: 'btnNav',
    eventName: 'Click',
    eventArgs: { type: 'Click', timestamp: Date.now() },
    shellState: {},
    currentFormId: 'form1',
    ...overrides,
  };
}

describe('Shell Events - EventEngine', () => {
  const engine = new EventEngine();

  describe('executeShellEvent 기본 동작', () => {
    it('executeShellEvent 메서드가 존재해야 한다', () => {
      expect(typeof engine.executeShellEvent).toBe('function');
    });

    it('핸들러가 없으면 에러를 반환해야 한다', async () => {
      const shellDef = makeShellDef([]);
      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No server handler found');
    });

    it('에러 코드 실행 시 error 필드가 있는 응답을 반환해야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: 'throw new Error("Shell 에러")',
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.patches).toEqual([]);
    });
  });

  describe('ctx.navigate', () => {
    it('navigate 호출 시 navigate 타입 UIPatch를 반환해야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: "ctx.navigate('form2', { id: 123 })",
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      const navPatch = result.patches.find((p) => p.type === 'navigate');
      expect(navPatch).toBeDefined();
      expect(navPatch).toEqual({
        type: 'navigate',
        target: '_system',
        payload: { formId: 'form2', params: { id: 123 } },
      });
    });
  });

  describe('ctx.navigateBack', () => {
    it('navigateBack 호출 시 back: true인 navigate 패치를 반환해야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: 'ctx.navigateBack()',
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      const navPatch = result.patches.find((p) => p.type === 'navigate');
      expect(navPatch).toEqual({
        type: 'navigate',
        target: '_system',
        payload: { back: true },
      });
    });
  });

  describe('ctx.navigateReplace', () => {
    it('navigateReplace 호출 시 replace: true인 navigate 패치를 반환해야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: "ctx.navigateReplace('form3', { tab: 'settings' })",
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      const navPatch = result.patches.find((p) => p.type === 'navigate');
      expect(navPatch).toEqual({
        type: 'navigate',
        target: '_system',
        payload: { formId: 'form3', params: { tab: 'settings' }, replace: true },
      });
    });
  });

  describe('ctx.closeApp', () => {
    it('closeApp 호출 시 closeApp 타입 UIPatch를 반환해야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: 'ctx.closeApp()',
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      const closePatch = result.patches.find((p) => p.type === 'closeApp');
      expect(closePatch).toBeDefined();
      expect(closePatch).toEqual({
        type: 'closeApp',
        target: '_system',
        payload: {},
      });
    });
  });

  describe('ctx.appState', () => {
    it('appState 변경 시 updateAppState 타입 UIPatch를 반환해야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: "ctx.appState.theme = 'dark'; ctx.appState.lang = 'ko'",
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      const appStatePatch = result.patches.find((p) => p.type === 'updateAppState');
      expect(appStatePatch).toBeDefined();
      expect(appStatePatch).toEqual({
        type: 'updateAppState',
        target: '_system',
        payload: { theme: 'dark', lang: 'ko' },
      });
    });

    it('appState 기존 값을 변경하면 변경된 키만 패치에 포함되어야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: "ctx.appState.theme = 'light'",
        },
      ]);

      const originalAppState = { theme: 'dark', lang: 'ko' };

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        originalAppState,
      );

      expect(result.success).toBe(true);
      const appStatePatch = result.patches.find((p) => p.type === 'updateAppState');
      expect(appStatePatch).toBeDefined();
      expect(appStatePatch!.payload).toEqual({ theme: 'light' });
      // lang은 변경되지 않았으므로 포함되지 않아야 한다
      expect(appStatePatch!.payload).not.toHaveProperty('lang');
    });

    it('appState 변경이 없으면 updateAppState 패치가 없어야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: '// 아무 변경 없음',
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        { theme: 'dark' },
      );

      expect(result.success).toBe(true);
      const appStatePatch = result.patches.find((p) => p.type === 'updateAppState');
      expect(appStatePatch).toBeUndefined();
    });
  });

  describe('Shell 컨트롤 속성 변경', () => {
    it('Shell 컨트롤 변경 시 updateShell 타입 패치를 반환해야 한다', async () => {
      const shellDef = makeShellDef(
        [
          {
            controlId: 'statusBar1',
            eventName: 'Click',
            handlerType: 'server',
            handlerCode: "ctx.controls.statusLabel.text = '준비 완료'",
          },
        ],
        [
          {
            id: 'statusBar1',
            name: 'statusLabel',
            type: 'StatusStrip',
            properties: { text: '대기 중' },
          },
        ],
      );

      const payload = makeShellPayload({
        controlId: 'statusBar1',
        shellState: {
          statusBar1: { text: '대기 중' },
        },
      });

      const result = await engine.executeShellEvent('proj1', payload, shellDef, {});

      expect(result.success).toBe(true);
      const shellPatch = result.patches.find((p) => p.type === 'updateShell');
      expect(shellPatch).toBeDefined();
      expect(shellPatch!.target).toBe('statusBar1');
      expect(shellPatch!.payload).toEqual({ text: '준비 완료' });
    });
  });

  describe('ctx.currentFormId / ctx.params', () => {
    it('ctx.currentFormId가 올바르게 주입되어야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode:
            "if (ctx.currentFormId === 'formA') { ctx.navigate('formB') }",
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload({ currentFormId: 'formA' }),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      const navPatch = result.patches.find((p) => p.type === 'navigate');
      expect(navPatch).toBeDefined();
      expect(navPatch!.payload).toEqual({ formId: 'formB', params: {} });
    });
  });

  describe('복합 시나리오', () => {
    it('navigate와 appState 변경을 동시에 수행할 수 있어야 한다', async () => {
      const shellDef = makeShellDef([
        {
          controlId: 'btnNav',
          eventName: 'Click',
          handlerType: 'server',
          handlerCode: "ctx.appState.lastPage = 'form1'; ctx.navigate('form2')",
        },
      ]);

      const result = await engine.executeShellEvent(
        'proj1',
        makeShellPayload(),
        shellDef,
        {},
      );

      expect(result.success).toBe(true);
      expect(result.patches.find((p) => p.type === 'navigate')).toBeDefined();
      expect(result.patches.find((p) => p.type === 'updateAppState')).toBeDefined();
    });
  });
});
