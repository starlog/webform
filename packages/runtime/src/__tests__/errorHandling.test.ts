import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRuntimeStore } from '../stores/runtimeStore';
import type { FormDefinition } from '@webform/common';

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
        id: 'txt1',
        type: 'TextBox',
        name: 'txtName',
        properties: { text: '' },
        position: { x: 0, y: 210 },
        size: { width: 200, height: 25 },
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

describe('에러 처리 개선', () => {
  beforeEach(() => {
    useRuntimeStore.setState({
      currentFormDef: null,
      controlStates: {},
      dialogQueue: [],
      navigateRequest: null,
      pendingPatchGroups: [],
    });
  });

  describe('폼 전환 시 상태 초기화', () => {
    it('runtimeStore.setFormDef로 새 폼 설정 후 controlStates가 초기화된다', () => {
      // 이전 폼 상태
      const oldForm = createMockFormDef();
      useRuntimeStore.getState().setFormDef(oldForm);
      useRuntimeStore.getState().updateControlState('grid1', 'dataSource', [{ old: true }]);

      // 새 폼으로 전환
      const newForm = createMockFormDef({
        id: 'form2',
        name: 'NewForm',
        controls: [
          {
            id: 'btn2',
            type: 'Button',
            name: 'button2',
            properties: { text: 'New Button' },
            position: { x: 10, y: 10 },
            size: { width: 100, height: 30 },
            anchor: { top: true, left: true, bottom: false, right: false },
            dock: 'None',
            tabIndex: 0,
            visible: true,
            enabled: true,
          },
        ],
      });

      useRuntimeStore.getState().setFormDef(newForm);

      const state = useRuntimeStore.getState();
      // 이전 컨트롤 상태 제거됨
      expect(state.controlStates['grid1']).toBeUndefined();
      expect(state.controlStates['txt1']).toBeUndefined();
      // 새 컨트롤만 존재
      expect(state.controlStates['btn2']).toEqual({
        text: 'New Button',
        visible: true,
        enabled: true,
      });
    });

    it('폼 전환 시 dialogQueue가 초기화된다 (메모리 누수 방지)', () => {
      // 다이얼로그가 있는 상태에서 폼 전환
      useRuntimeStore.getState().applyPatch({
        type: 'showDialog',
        target: '_system',
        payload: { text: '알림', title: '정보', dialogType: 'info' },
      });

      const newForm = createMockFormDef({ id: 'form2', name: 'Form2' });
      useRuntimeStore.getState().setFormDef(newForm);

      // dialogQueue는 setFormDef에서 초기화되므로 비어 있어야 함 (이전 폼의 다이얼로그가 새 폼에 남지 않도록)
      const state = useRuntimeStore.getState();
      expect(state.dialogQueue).toHaveLength(0);
    });
  });

  describe('showDialog를 통한 에러 표시', () => {
    it('error 타입 다이얼로그를 큐에 추가한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      useRuntimeStore.getState().applyPatch({
        type: 'showDialog',
        target: '_system',
        payload: {
          text: '데이터 저장에 실패했습니다.',
          title: '오류',
          dialogType: 'error',
        },
      });

      const state = useRuntimeStore.getState();
      expect(state.dialogQueue).toHaveLength(1);
      expect(state.dialogQueue[0]).toEqual({
        text: '데이터 저장에 실패했습니다.',
        title: '오류',
        dialogType: 'error',
      });
    });

    it('여러 에러 다이얼로그를 순차적으로 처리한다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);

      // 두 개의 showDialog가 연속으로 포함된 패치
      useRuntimeStore.getState().applyPatches([
        {
          type: 'showDialog',
          target: '_system',
          payload: { text: '첫 번째 에러', title: '오류', dialogType: 'error' },
        },
        {
          type: 'showDialog',
          target: '_system',
          payload: { text: '두 번째 에러', title: '오류', dialogType: 'error' },
        },
      ]);

      // 첫 번째 그룹만 즉시 적용
      let state = useRuntimeStore.getState();
      expect(state.dialogQueue).toHaveLength(1);
      expect(state.dialogQueue[0].text).toBe('첫 번째 에러');

      // 첫 번째 다이얼로그 닫기 → 두 번째 표시
      useRuntimeStore.getState().dismissDialog();

      state = useRuntimeStore.getState();
      expect(state.dialogQueue).toHaveLength(1);
      expect(state.dialogQueue[0].text).toBe('두 번째 에러');

      // 두 번째 다이얼로그 닫기
      useRuntimeStore.getState().dismissDialog();

      state = useRuntimeStore.getState();
      expect(state.dialogQueue).toHaveLength(0);
    });

    it('존재하지 않는 컨트롤에 패치 적용 시 경고만 출력하고 크래시하지 않는다', () => {
      const formDef = createMockFormDef();
      useRuntimeStore.getState().setFormDef(formDef);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 존재하지 않는 컨트롤에 패치 적용
      useRuntimeStore.getState().applyPatch({
        type: 'updateProperty',
        target: 'nonexistent',
        payload: { text: 'should not crash' },
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"nonexistent"'),
        expect.anything(),
      );

      // 기존 상태에 영향 없음
      const state = useRuntimeStore.getState();
      expect(state.controlStates['nonexistent']).toBeUndefined();

      warnSpy.mockRestore();
    });
  });
});
