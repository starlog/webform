import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBindingStore } from '../bindings/bindingStore';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useDataBinding } from '../hooks/useDataBinding';
import type { FormDefinition, DataBindingDefinition } from '@webform/common';

// apiClient mock
vi.mock('../communication/apiClient', () => ({
  apiClient: {
    queryDataSource: vi.fn(),
  },
}));

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
    dataBindings: [],
    ...overrides,
  };
}

describe('에러 처리 개선', () => {
  beforeEach(() => {
    useBindingStore.getState().reset();
    useRuntimeStore.setState({
      currentFormDef: null,
      controlStates: {},
      dialogQueue: [],
      navigateRequest: null,
      pendingPatchGroups: [],
    });
  });

  describe('bindingStore 에러 상태 관리', () => {
    it('setError로 데이터소스 에러를 저장한다', () => {
      useBindingStore.getState().setError('ds1', '데이터소스 연결 실패');

      const state = useBindingStore.getState();
      expect(state.errors['ds1']).toBe('데이터소스 연결 실패');
    });

    it('setError(null)로 에러를 해제한다', () => {
      useBindingStore.getState().setError('ds1', '연결 실패');
      useBindingStore.getState().setError('ds1', null);

      const state = useBindingStore.getState();
      expect(state.errors['ds1']).toBeNull();
    });

    it('여러 데이터소스의 에러를 독립적으로 관리한다', () => {
      useBindingStore.getState().setError('ds1', '타임아웃');
      useBindingStore.getState().setError('ds2', '인증 실패');

      const state = useBindingStore.getState();
      expect(state.errors['ds1']).toBe('타임아웃');
      expect(state.errors['ds2']).toBe('인증 실패');
    });

    it('setLoading으로 로딩 상태를 설정한다', () => {
      useBindingStore.getState().setLoading('ds1', true);

      expect(useBindingStore.getState().loadingStates['ds1']).toBe(true);

      useBindingStore.getState().setLoading('ds1', false);

      expect(useBindingStore.getState().loadingStates['ds1']).toBe(false);
    });

    it('에러 발생 후에도 기존 데이터가 유지된다', () => {
      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);
      useBindingStore.getState().setError('ds1', '새로고침 실패');

      const state = useBindingStore.getState();
      expect(state.dataSourceData['ds1']).toEqual([{ name: 'Alice' }]);
      expect(state.errors['ds1']).toBe('새로고침 실패');
    });

    it('로딩 완료 후 에러가 발생하면 로딩은 false, 에러는 설정된다', () => {
      // 로딩 시작
      useBindingStore.getState().setLoading('ds1', true);
      expect(useBindingStore.getState().loadingStates['ds1']).toBe(true);

      // 로딩 실패
      useBindingStore.getState().setLoading('ds1', false);
      useBindingStore.getState().setError('ds1', '500 Internal Server Error');

      const state = useBindingStore.getState();
      expect(state.loadingStates['ds1']).toBe(false);
      expect(state.errors['ds1']).toBe('500 Internal Server Error');
    });

    it('성공적 로드 시 에러가 해제된다', () => {
      // 먼저 에러 상태
      useBindingStore.getState().setError('ds1', '이전 에러');

      // 다시 로드 성공
      useBindingStore.getState().setLoading('ds1', true);
      useBindingStore.getState().setError('ds1', null);
      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Bob' }]);
      useBindingStore.getState().setLoading('ds1', false);

      const state = useBindingStore.getState();
      expect(state.errors['ds1']).toBeNull();
      expect(state.loadingStates['ds1']).toBe(false);
      expect(state.dataSourceData['ds1']).toEqual([{ name: 'Bob' }]);
    });
  });

  describe('useDataBinding 에러/로딩 상태 전파', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'grid1',
        controlProperty: 'dataSource',
        dataSourceId: 'ds1',
        dataField: '',
        bindingMode: 'oneWay',
      },
    ];

    it('데이터소스 에러 시 __error__가 결과에 포함된다', () => {
      useBindingStore.getState().setError('ds1', '조회 실패');

      const { result } = renderHook(() => useDataBinding('grid1', bindings));

      expect(result.current['__error__']).toBe('조회 실패');
    });

    it('데이터소스 로딩 중일 때 __loading__이 결과에 포함된다', () => {
      useBindingStore.getState().setLoading('ds1', true);

      const { result } = renderHook(() => useDataBinding('grid1', bindings));

      expect(result.current['__loading__']).toBe(true);
    });

    it('에러가 없으면 __error__가 결과에 포함되지 않는다', () => {
      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);

      const { result } = renderHook(() => useDataBinding('grid1', bindings));

      expect(result.current['__error__']).toBeUndefined();
    });

    it('로딩이 아니면 __loading__이 결과에 포함되지 않는다', () => {
      useBindingStore.getState().setLoading('ds1', false);

      const { result } = renderHook(() => useDataBinding('grid1', bindings));

      expect(result.current['__loading__']).toBeUndefined();
    });

    it('에러와 데이터가 동시에 존재할 수 있다', () => {
      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);
      useBindingStore.getState().setError('ds1', '새로고침 실패');

      const { result } = renderHook(() => useDataBinding('grid1', bindings));

      expect(result.current.dataSource).toEqual([{ name: 'Alice' }]);
      expect(result.current['__error__']).toBe('새로고침 실패');
    });
  });

  describe('폼 전환 시 에러 상태 초기화', () => {
    it('bindingStore.reset()이 모든 에러/로딩 상태를 초기화한다', () => {
      // 에러, 로딩, 데이터 설정
      useBindingStore.getState().loadDataSource('ds1', [{ a: 1 }]);
      useBindingStore.getState().setError('ds1', '에러 발생');
      useBindingStore.getState().setLoading('ds2', true);
      useBindingStore.getState().setSelectedRow('grid1', 3);

      // 폼 전환 시 reset 호출
      useBindingStore.getState().reset();

      const state = useBindingStore.getState();
      expect(state.dataSourceData).toEqual({});
      expect(state.errors).toEqual({});
      expect(state.loadingStates).toEqual({});
      expect(state.selectedRows).toEqual({});
    });

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

    it('폼 전환 시 dialogQueue가 초기화된다', () => {
      // 다이얼로그가 있는 상태에서 폼 전환
      useRuntimeStore.getState().applyPatch({
        type: 'showDialog',
        target: '_system',
        payload: { text: '알림', title: '정보', dialogType: 'info' },
      });

      const newForm = createMockFormDef({ id: 'form2', name: 'Form2' });
      useRuntimeStore.getState().setFormDef(newForm);

      // dialogQueue는 setFormDef에서 초기화되므로 비어 있어야 함
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
