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
          control: {
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
          },
        },
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

    it('DataGridView의 dataSource 배열을 정상 적용한다', () => {
      const formDef = createMockFormDef({
        controls: [
          {
            id: 'grid1',
            type: 'DataGridView',
            name: 'dgvOrders',
            properties: { columns: [] },
            position: { x: 0, y: 0 },
            size: { width: 400, height: 200 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ],
      });
      useRuntimeStore.getState().setFormDef(formDef);

      // 초기 상태: dataSource 없음
      expect(useRuntimeStore.getState().controlStates['grid1'].dataSource).toBeUndefined();

      // dataSource 패치 적용
      const patches: UIPatch[] = [
        {
          type: 'updateProperty',
          target: 'grid1',
          payload: {
            dataSource: [
              { orderNo: 1, customer: '홍길동', payment: '계좌이체' },
              { orderNo: 2, customer: '김철수', payment: '카드결제' },
            ],
          },
        },
      ];

      useRuntimeStore.getState().applyPatches(patches);

      const state = useRuntimeStore.getState();
      const dataSource = state.controlStates['grid1'].dataSource as unknown[];
      expect(dataSource).toHaveLength(2);
      expect(dataSource[0]).toEqual({ orderNo: 1, customer: '홍길동', payment: '계좌이체' });
      expect(dataSource[1]).toEqual({ orderNo: 2, customer: '김철수', payment: '카드결제' });
    });

    it('showDialog 이후의 패치는 다이얼로그 닫힘 후 적용된다', () => {
      const formDef = createMockFormDef({
        controls: [
          {
            id: 'grid1',
            type: 'DataGridView',
            name: 'dgvOrders',
            properties: { columns: [] },
            position: { x: 0, y: 0 },
            size: { width: 400, height: 200 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
          {
            id: 'lbl1',
            type: 'Label',
            name: 'lblStatus',
            properties: { text: '' },
            position: { x: 0, y: 210 },
            size: { width: 200, height: 20 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 1,
            visible: true,
            enabled: true,
          },
        ],
      });
      useRuntimeStore.getState().setFormDef(formDef);

      // showDialog 앞의 패치 + showDialog + 뒤의 패치
      const patches: UIPatch[] = [
        { type: 'updateProperty', target: 'lbl1', payload: { text: '처리 중...' } },
        { type: 'showDialog', target: '_system', payload: { text: '완료!', title: '알림', dialogType: 'info' } },
        {
          type: 'updateProperty',
          target: 'grid1',
          payload: { dataSource: [{ orderNo: 1 }] },
        },
      ];

      useRuntimeStore.getState().applyPatches(patches);

      // 첫 번째 그룹 (라벨 + 다이얼로그)만 적용됨
      let state = useRuntimeStore.getState();
      expect(state.controlStates['lbl1'].text).toBe('처리 중...');
      expect(state.dialogQueue).toHaveLength(1);
      expect(state.controlStates['grid1'].dataSource).toBeUndefined(); // 아직 적용 안 됨

      // 다이얼로그 닫기 → 두 번째 그룹 적용
      useRuntimeStore.getState().dismissDialog();

      state = useRuntimeStore.getState();
      expect(state.dialogQueue).toHaveLength(0);
      const dataSource = state.controlStates['grid1'].dataSource as unknown[];
      expect(dataSource).toEqual([{ orderNo: 1 }]);
    });
  });
});
