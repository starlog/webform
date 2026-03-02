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
        properties: { text: 'Click me' },
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

describe('runtimeStore 메모리 누수 수정 검증', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      currentFormDef: null,
      controlStates: {},
      dialogQueue: [],
      pendingPatchGroups: [],
      navigateRequest: null,
    });
  });

  describe('setFormDef 호출 시 상태 초기화', () => {
    it('pendingPatchGroups가 초기화된다', () => {
      const formA = createMockFormDef({ id: 'formA' });
      useRuntimeStore.getState().setFormDef(formA);

      // showDialog 패치를 포함한 패치 그룹 생성 → pending 패치 생성
      const patches: UIPatch[] = [
        {
          type: 'showDialog',
          target: '_system',
          payload: { text: '알림', title: '정보', dialogType: 'info' },
        },
        {
          type: 'updateProperty',
          target: 'btn1',
          payload: { text: '변경됨' },
        },
      ];
      useRuntimeStore.getState().applyPatches(patches);

      // pending 패치 그룹이 존재함을 확인
      expect(useRuntimeStore.getState().pendingPatchGroups.length).toBeGreaterThan(0);

      // 폼 전환
      const formB = createMockFormDef({ id: 'formB' });
      useRuntimeStore.getState().setFormDef(formB);

      // pendingPatchGroups가 초기화됨
      expect(useRuntimeStore.getState().pendingPatchGroups).toHaveLength(0);
    });

    it('dialogQueue가 초기화된다', () => {
      const formA = createMockFormDef({ id: 'formA' });
      useRuntimeStore.getState().setFormDef(formA);

      // 다이얼로그 추가
      useRuntimeStore.getState().applyPatch({
        type: 'showDialog',
        target: '_system',
        payload: { text: '에러', title: '오류', dialogType: 'error' },
      });

      expect(useRuntimeStore.getState().dialogQueue).toHaveLength(1);

      // 폼 전환
      const formB = createMockFormDef({ id: 'formB' });
      useRuntimeStore.getState().setFormDef(formB);

      // dialogQueue가 초기화됨
      expect(useRuntimeStore.getState().dialogQueue).toHaveLength(0);
    });

    it('이전 폼의 controlStates가 새 폼으로 교체된다', () => {
      const formA = createMockFormDef({
        id: 'formA',
        controls: [
          {
            id: 'ctrlA',
            type: 'TextBox',
            name: 'textA',
            properties: { text: 'Form A' },
            position: { x: 0, y: 0 },
            size: { width: 100, height: 25 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ],
      });
      useRuntimeStore.getState().setFormDef(formA);
      expect(useRuntimeStore.getState().controlStates['ctrlA']).toBeDefined();

      const formB = createMockFormDef({
        id: 'formB',
        controls: [
          {
            id: 'ctrlB',
            type: 'Label',
            name: 'labelB',
            properties: { text: 'Form B' },
            position: { x: 0, y: 0 },
            size: { width: 200, height: 20 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ],
      });
      useRuntimeStore.getState().setFormDef(formB);

      // 이전 폼의 컨트롤 상태가 없어짐
      expect(useRuntimeStore.getState().controlStates['ctrlA']).toBeUndefined();
      // 새 폼의 컨트롤 상태만 존재
      expect(useRuntimeStore.getState().controlStates['ctrlB']).toEqual({
        text: 'Form B',
        visible: true,
        enabled: true,
      });
    });

    it('이전 폼의 pending 패치가 새 폼에 적용되지 않는다', () => {
      const formA = createMockFormDef({
        id: 'formA',
        controls: [
          {
            id: 'sharedId',
            type: 'Label',
            name: 'label1',
            properties: { text: 'Form A Label' },
            position: { x: 0, y: 0 },
            size: { width: 200, height: 20 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ],
      });
      useRuntimeStore.getState().setFormDef(formA);

      // showDialog 패치 이후에 sharedId를 수정하는 pending 패치 생성
      const patches: UIPatch[] = [
        {
          type: 'showDialog',
          target: '_system',
          payload: { text: '알림', title: '정보', dialogType: 'info' },
        },
        {
          type: 'updateProperty',
          target: 'sharedId',
          payload: { text: 'Form A에서 수정됨' },
        },
      ];
      useRuntimeStore.getState().applyPatches(patches);

      // 같은 컨트롤 ID를 가진 새 폼으로 전환
      const formB = createMockFormDef({
        id: 'formB',
        controls: [
          {
            id: 'sharedId',
            type: 'Label',
            name: 'label1',
            properties: { text: 'Form B Label' },
            position: { x: 0, y: 0 },
            size: { width: 200, height: 20 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ],
      });
      useRuntimeStore.getState().setFormDef(formB);

      // 이전 폼의 pending 패치가 제거되었으므로 새 폼의 텍스트 유지
      expect(useRuntimeStore.getState().controlStates['sharedId'].text).toBe('Form B Label');

      // dismissDialog를 호출해도 pending 패치가 없으므로 상태 변경 없음
      useRuntimeStore.getState().dismissDialog();
      expect(useRuntimeStore.getState().controlStates['sharedId'].text).toBe('Form B Label');
    });
  });
});
