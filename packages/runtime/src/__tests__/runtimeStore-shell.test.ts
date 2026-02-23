import { describe, it, expect, beforeEach } from 'vitest';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { ApplicationShellDefinition, UIPatch } from '@webform/common';

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
    controls: [
      {
        id: 'menu1',
        type: 'MenuStrip',
        name: 'mainMenu',
        properties: { items: ['File', 'Edit'] },
        position: { x: 0, y: 0 },
        size: { width: 1024, height: 24 },
        anchor: { top: true, left: true, bottom: false, right: true },
        dock: 'Top',
        tabIndex: 0,
        visible: true,
        enabled: true,
      },
      {
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
      },
    ],
    eventHandlers: [],
    startFormId: 'form1',
    ...overrides,
  };
}

describe('runtimeStore - Shell', () => {
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

  describe('setShellDef', () => {
    it('Shell 정의를 설정한다', () => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);

      const state = useRuntimeStore.getState();
      expect(state.shellDef).not.toBeNull();
      expect(state.shellDef!.id).toBe('shell1');
      expect(state.shellDef!.name).toBe('TestShell');
      expect(state.shellDef!.startFormId).toBe('form1');
    });

    it('Shell 컨트롤 상태를 초기화한다', () => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);

      const state = useRuntimeStore.getState();
      expect(state.shellControlStates['menu1']).toEqual({
        items: ['File', 'Edit'],
        visible: true,
        enabled: true,
      });
      expect(state.shellControlStates['status1']).toEqual({
        text: 'Ready',
        visible: true,
        enabled: true,
      });
    });

    it('중첩 자식 컨트롤도 초기화한다', () => {
      const shellDef = createMockShellDef({
        controls: [
          {
            id: 'toolbar1',
            type: 'ToolStrip',
            name: 'mainToolbar',
            properties: {},
            position: { x: 0, y: 24 },
            size: { width: 1024, height: 32 },
            anchor: { top: true, left: true, bottom: false, right: true },
            dock: 'Top',
            tabIndex: 0,
            visible: true,
            enabled: true,
            children: [
              {
                id: 'toolBtn1',
                type: 'Button',
                name: 'btnSave',
                properties: { text: 'Save', icon: 'save' },
                position: { x: 0, y: 0 },
                size: { width: 32, height: 32 },
                anchor: { top: true, left: true, bottom: false, right: false },
                dock: 'None',
                tabIndex: 0,
                visible: true,
                enabled: false,
              },
            ],
          },
        ],
      });
      useRuntimeStore.getState().setShellDef(shellDef);

      const state = useRuntimeStore.getState();
      expect(state.shellControlStates['toolbar1']).toBeDefined();
      expect(state.shellControlStates['toolBtn1']).toEqual({
        text: 'Save',
        icon: 'save',
        visible: true,
        enabled: false,
      });
    });

    it('null을 전달하면 Shell 정의와 상태를 초기화한다', () => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);
      expect(useRuntimeStore.getState().shellDef).not.toBeNull();

      useRuntimeStore.getState().setShellDef(null);

      const state = useRuntimeStore.getState();
      expect(state.shellDef).toBeNull();
      expect(state.shellControlStates).toEqual({});
    });
  });

  describe('updateShellControlState', () => {
    it('특정 Shell 컨트롤의 속성을 업데이트한다', () => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);

      useRuntimeStore.getState().updateShellControlState('status1', 'text', '처리 중...');

      const state = useRuntimeStore.getState();
      expect(state.shellControlStates['status1'].text).toBe('처리 중...');
    });

    it('존재하지 않는 컨트롤에도 상태를 생성한다', () => {
      useRuntimeStore.getState().updateShellControlState('newCtrl', 'value', 42);

      const state = useRuntimeStore.getState();
      expect(state.shellControlStates['newCtrl']).toEqual({ value: 42 });
    });

    it('기존 속성을 유지하면서 새 속성을 추가한다', () => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);

      useRuntimeStore.getState().updateShellControlState('menu1', 'backgroundColor', 'blue');

      const state = useRuntimeStore.getState();
      expect(state.shellControlStates['menu1'].items).toEqual(['File', 'Edit']);
      expect(state.shellControlStates['menu1'].backgroundColor).toBe('blue');
    });
  });

  describe('getShellControlState', () => {
    it('Shell 컨트롤 상태를 반환한다', () => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);

      const controlState = useRuntimeStore.getState().getShellControlState('menu1');
      expect(controlState).toEqual({
        items: ['File', 'Edit'],
        visible: true,
        enabled: true,
      });
    });

    it('존재하지 않는 컨트롤은 빈 객체를 반환한다', () => {
      const controlState = useRuntimeStore.getState().getShellControlState('nonexistent');
      expect(controlState).toEqual({});
    });
  });

  describe('applyShellPatches', () => {
    beforeEach(() => {
      const shellDef = createMockShellDef();
      useRuntimeStore.getState().setShellDef(shellDef);
    });

    describe('updateShell 패치', () => {
      it('Shell 컨트롤의 속성을 업데이트한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'updateShell',
            target: 'status1',
            payload: { text: '저장 완료' },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.shellControlStates['status1'].text).toBe('저장 완료');
      });

      it('여러 속성을 동시에 업데이트한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'updateShell',
            target: 'menu1',
            payload: { visible: false, enabled: false },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.shellControlStates['menu1'].visible).toBe(false);
        expect(state.shellControlStates['menu1'].enabled).toBe(false);
      });

      it('존재하지 않는 컨트롤에는 적용하지 않는다', () => {
        const patches: UIPatch[] = [
          {
            type: 'updateShell',
            target: 'nonexistent',
            payload: { text: 'test' },
          },
        ];

        // 에러 없이 무시
        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.shellControlStates['nonexistent']).toBeUndefined();
      });
    });

    describe('updateAppState 패치', () => {
      it('appState의 키-값을 업데이트한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'updateAppState',
            target: 'app',
            payload: { theme: 'dark', language: 'ko' },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.appState.theme).toBe('dark');
        expect(state.appState.language).toBe('ko');
      });

      it('undefined 값은 해당 키를 삭제한다', () => {
        // 먼저 appState에 값을 설정
        useRuntimeStore.getState().setAppState('toRemove', 'value');
        useRuntimeStore.getState().setAppState('toKeep', 'kept');

        const patches: UIPatch[] = [
          {
            type: 'updateAppState',
            target: 'app',
            payload: { toRemove: undefined },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect('toRemove' in state.appState).toBe(false);
        expect(state.appState.toKeep).toBe('kept');
      });

      it('여러 updateAppState 패치를 순차 적용한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'updateAppState',
            target: 'app',
            payload: { count: 1 },
          },
          {
            type: 'updateAppState',
            target: 'app',
            payload: { count: 2, extra: 'added' },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.appState.count).toBe(2);
        expect(state.appState.extra).toBe('added');
      });
    });

    describe('navigate 패치', () => {
      it('새 폼으로 네비게이션을 설정한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'navigate',
            target: 'app',
            payload: { formId: 'form2', params: { id: 123 } },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.navigateRequest).toEqual({
          formId: 'form2',
          params: { id: 123 },
        });
        expect(state.navigateParams).toEqual({ id: 123 });
      });

      it('params 없이 네비게이션을 설정한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'navigate',
            target: 'app',
            payload: { formId: 'form3' },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.navigateRequest).toEqual({
          formId: 'form3',
          params: {},
        });
        expect(state.navigateParams).toEqual({});
      });

      it('back: true이면 formHistory에서 이전 폼으로 돌아간다', () => {
        // 히스토리에 폼 추가
        useRuntimeStore.getState().pushFormHistory('form1', { page: 1 });
        useRuntimeStore.getState().pushFormHistory('form2', { page: 2 });

        const patches: UIPatch[] = [
          {
            type: 'navigate',
            target: 'app',
            payload: { back: true },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        // form2(마지막)로 돌아감
        expect(state.navigateRequest).toEqual({
          formId: 'form2',
          params: { page: 2 },
        });
        expect(state.navigateParams).toEqual({ page: 2 });
        // 히스토리에서 form2는 제거, form1만 남음
        expect(state.formHistory).toHaveLength(1);
        expect(state.formHistory[0].formId).toBe('form1');
      });

      it('back: true이지만 히스토리가 비어있으면 아무 것도 하지 않는다', () => {
        const patches: UIPatch[] = [
          {
            type: 'navigate',
            target: 'app',
            payload: { back: true },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.navigateRequest).toBeNull();
        expect(state.formHistory).toHaveLength(0);
      });
    });

    describe('showDialog 패치', () => {
      it('dialogQueue에 메시지를 추가한다', () => {
        const patches: UIPatch[] = [
          {
            type: 'showDialog',
            target: '_system',
            payload: { text: '오류 발생', title: '에러', dialogType: 'error' },
          },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.dialogQueue).toHaveLength(1);
        expect(state.dialogQueue[0]).toEqual({
          text: '오류 발생',
          title: '에러',
          dialogType: 'error',
        });
      });
    });

    describe('혼합 패치', () => {
      it('여러 타입의 패치를 한번에 적용한다', () => {
        const patches: UIPatch[] = [
          { type: 'updateShell', target: 'status1', payload: { text: '로딩 중...' } },
          { type: 'updateAppState', target: 'app', payload: { loading: true } },
          { type: 'navigate', target: 'app', payload: { formId: 'formX' } },
        ];

        useRuntimeStore.getState().applyShellPatches(patches);

        const state = useRuntimeStore.getState();
        expect(state.shellControlStates['status1'].text).toBe('로딩 중...');
        expect(state.appState.loading).toBe(true);
        expect(state.navigateRequest?.formId).toBe('formX');
      });
    });
  });

  describe('pushFormHistory / popFormHistory', () => {
    it('formHistory 스택에 항목을 추가한다', () => {
      useRuntimeStore.getState().pushFormHistory('form1');
      useRuntimeStore.getState().pushFormHistory('form2', { id: 42 });

      const state = useRuntimeStore.getState();
      expect(state.formHistory).toHaveLength(2);
      expect(state.formHistory[0]).toEqual({ formId: 'form1', params: undefined });
      expect(state.formHistory[1]).toEqual({ formId: 'form2', params: { id: 42 } });
    });

    it('popFormHistory는 마지막 항목을 제거하고 반환한다', () => {
      useRuntimeStore.getState().pushFormHistory('form1');
      useRuntimeStore.getState().pushFormHistory('form2', { id: 42 });

      const popped = useRuntimeStore.getState().popFormHistory();

      expect(popped).toEqual({ formId: 'form2', params: { id: 42 } });
      expect(useRuntimeStore.getState().formHistory).toHaveLength(1);
      expect(useRuntimeStore.getState().formHistory[0].formId).toBe('form1');
    });

    it('빈 히스토리에서 popFormHistory는 null을 반환한다', () => {
      const popped = useRuntimeStore.getState().popFormHistory();

      expect(popped).toBeNull();
      expect(useRuntimeStore.getState().formHistory).toHaveLength(0);
    });

    it('LIFO(후입선출) 순서로 동작한다', () => {
      useRuntimeStore.getState().pushFormHistory('form1');
      useRuntimeStore.getState().pushFormHistory('form2');
      useRuntimeStore.getState().pushFormHistory('form3');

      expect(useRuntimeStore.getState().popFormHistory()?.formId).toBe('form3');
      expect(useRuntimeStore.getState().popFormHistory()?.formId).toBe('form2');
      expect(useRuntimeStore.getState().popFormHistory()?.formId).toBe('form1');
      expect(useRuntimeStore.getState().popFormHistory()).toBeNull();
    });
  });

  describe('setAppState', () => {
    it('appState에 키-값을 설정한다', () => {
      useRuntimeStore.getState().setAppState('theme', 'dark');

      const state = useRuntimeStore.getState();
      expect(state.appState.theme).toBe('dark');
    });

    it('기존 값을 덮어쓴다', () => {
      useRuntimeStore.getState().setAppState('count', 1);
      useRuntimeStore.getState().setAppState('count', 2);

      const state = useRuntimeStore.getState();
      expect(state.appState.count).toBe(2);
    });

    it('다른 키는 영향받지 않는다', () => {
      useRuntimeStore.getState().setAppState('key1', 'val1');
      useRuntimeStore.getState().setAppState('key2', 'val2');

      const state = useRuntimeStore.getState();
      expect(state.appState.key1).toBe('val1');
      expect(state.appState.key2).toBe('val2');
    });
  });
});
