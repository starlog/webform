import { describe, it, expect, beforeEach } from 'vitest';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { FormDefinition, UIPatch } from '@webform/common';

function createMockFormDef(overrides?: Partial<FormDefinition>): FormDefinition {
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
        properties: { text: 'Click me' },
        position: { x: 10, y: 10 },
        size: { width: 100, height: 30 },
        anchor: { top: true, left: true, bottom: false, right: false },
        dock: 'None',
        tabIndex: 0,
        visible: true,
        enabled: true,
      },
      {
        id: 'lbl1',
        type: 'Label',
        name: 'label1',
        properties: { text: 'Hello' },
        position: { x: 10, y: 50 },
        size: { width: 200, height: 20 },
        anchor: { top: true, left: true, bottom: false, right: false },
        dock: 'None',
        tabIndex: 1,
        visible: true,
        enabled: true,
      },
    ],
    eventHandlers: [],
    dataBindings: [],
    ...overrides,
  };
}

describe('runtimeStore', () => {
  beforeEach(() => {
    // Zustand store를 초기 상태로 리셋
    useRuntimeStore.setState({
      currentFormDef: null,
      controlStates: {},
    });
  });

  describe('setFormDef', () => {
    it('currentFormDef를 설정한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      const state = useRuntimeStore.getState();
      expect(state.currentFormDef).not.toBeNull();
      expect(state.currentFormDef!.id).toBe('form1');
      expect(state.currentFormDef!.name).toBe('TestForm');
    });

    it('컨트롤 상태를 초기화한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      const state = useRuntimeStore.getState();
      expect(state.controlStates['btn1']).toEqual({
        text: 'Click me',
        visible: true,
        enabled: true,
      });
      expect(state.controlStates['lbl1']).toEqual({
        text: 'Hello',
        visible: true,
        enabled: true,
      });
    });

    it('중첩 자식 컨트롤도 초기화한다', () => {
      const formDef = createMockFormDef({
        controls: [
          {
            id: 'panel1',
            type: 'Panel',
            name: 'panel1',
            properties: {},
            position: { x: 0, y: 0 },
            size: { width: 400, height: 300 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
            children: [
              {
                id: 'childBtn',
                type: 'Button',
                name: 'childButton',
                properties: { text: 'Child' },
                position: { x: 5, y: 5 },
                size: { width: 80, height: 25 },
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
      useRuntimeStore.getState().setFormDef(formDef);

      const state = useRuntimeStore.getState();
      expect(state.controlStates['panel1']).toBeDefined();
      expect(state.controlStates['childBtn']).toEqual({
        text: 'Child',
        visible: true,
        enabled: false,
      });
    });
  });

  describe('updateControlState', () => {
    it('특정 컨트롤의 속성을 업데이트한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      useRuntimeStore.getState().updateControlState('btn1', 'text', 'Updated');

      const state = useRuntimeStore.getState();
      expect(state.controlStates['btn1'].text).toBe('Updated');
    });

    it('존재하지 않는 컨트롤에도 상태를 생성한다', () => {
      useRuntimeStore.getState().updateControlState('new1', 'value', 42);

      const state = useRuntimeStore.getState();
      expect(state.controlStates['new1']).toEqual({ value: 42 });
    });

    it('기존 속성을 유지하면서 새 속성을 추가한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      useRuntimeStore.getState().updateControlState('btn1', 'backgroundColor', 'red');

      const state = useRuntimeStore.getState();
      expect(state.controlStates['btn1'].text).toBe('Click me');
      expect(state.controlStates['btn1'].backgroundColor).toBe('red');
    });
  });

  describe('getControlState', () => {
    it('컨트롤 상태를 반환한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      const controlState = useRuntimeStore.getState().getControlState('btn1');
      expect(controlState).toEqual({
        text: 'Click me',
        visible: true,
        enabled: true,
      });
    });

    it('존재하지 않는 컨트롤은 빈 객체를 반환한다', () => {
      const controlState = useRuntimeStore.getState().getControlState('nonexistent');
      expect(controlState).toEqual({});
    });
  });

  describe('applyPatch', () => {
    beforeEach(() => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);
    });

    it('updateProperty 패치를 적용한다', () => {
      const patch: UIPatch = {
        type: 'updateProperty',
        target: 'btn1',
        payload: { text: 'Patched', enabled: false },
      };

      useRuntimeStore.getState().applyPatch(patch);

      const state = useRuntimeStore.getState();
      expect(state.controlStates['btn1'].text).toBe('Patched');
      expect(state.controlStates['btn1'].enabled).toBe(false);
    });

    it('addControl 패치를 처리한다', () => {
      const patch: UIPatch = {
        type: 'addControl',
        target: 'form1', // parent가 없으면 루트에 추가
        payload: {
          id: 'newBtn',
          type: 'Button',
          name: 'newButton',
          properties: { text: 'New' },
          position: { x: 0, y: 0 },
          size: { width: 80, height: 30 },
          anchor: { top: true, left: true, bottom: false, right: false },
          dock: 'None',
          tabIndex: 2,
          visible: true,
          enabled: true,
        } as unknown as Record<string, unknown>,
      };

      useRuntimeStore.getState().applyPatch(patch);

      const state = useRuntimeStore.getState();
      // 새 컨트롤이 controlStates에 등록됨
      expect(state.controlStates['newBtn']).toBeDefined();
      expect(state.controlStates['newBtn'].text).toBe('New');
      expect(state.controlStates['newBtn'].visible).toBe(true);
    });

    it('removeControl 패치를 처리한다', () => {
      const patch: UIPatch = {
        type: 'removeControl',
        target: 'btn1',
        payload: {},
      };

      useRuntimeStore.getState().applyPatch(patch);

      const state = useRuntimeStore.getState();
      expect(state.controlStates['btn1']).toBeUndefined();
      // formDef에서도 제거됨
      const found = state.currentFormDef!.controls.find((c) => c.id === 'btn1');
      expect(found).toBeUndefined();
    });
  });

  describe('applyPatches', () => {
    it('여러 패치를 한번에 적용한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      const patches: UIPatch[] = [
        { type: 'updateProperty', target: 'btn1', payload: { text: 'Batch1' } },
        { type: 'updateProperty', target: 'lbl1', payload: { text: 'Batch2' } },
      ];

      useRuntimeStore.getState().applyPatches(patches);

      const state = useRuntimeStore.getState();
      expect(state.controlStates['btn1'].text).toBe('Batch1');
      expect(state.controlStates['lbl1'].text).toBe('Batch2');
    });
  });
});
