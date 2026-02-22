import { describe, it, expect, beforeEach } from 'vitest';
import { useBindingStore } from '../bindings/bindingStore';

describe('bindingStore', () => {
  beforeEach(() => {
    useBindingStore.getState().reset();
  });

  describe('loadDataSource', () => {
    it('데이터소스 데이터를 저장한다', () => {
      const data = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];

      useBindingStore.getState().loadDataSource('ds1', data);

      const state = useBindingStore.getState();
      expect(state.dataSourceData['ds1']).toEqual(data);
      expect(state.dataSourceData['ds1']).toHaveLength(2);
    });

    it('빈 배열도 저장한다', () => {
      useBindingStore.getState().loadDataSource('ds1', []);

      const state = useBindingStore.getState();
      expect(state.dataSourceData['ds1']).toEqual([]);
    });

    it('다른 데이터소스에 영향을 주지 않는다', () => {
      useBindingStore.getState().loadDataSource('ds1', [{ a: 1 }]);
      useBindingStore.getState().loadDataSource('ds2', [{ b: 2 }]);

      const state = useBindingStore.getState();
      expect(state.dataSourceData['ds1']).toEqual([{ a: 1 }]);
      expect(state.dataSourceData['ds2']).toEqual([{ b: 2 }]);
    });
  });

  describe('setSelectedRow', () => {
    it('selectedRows를 업데이트한다', () => {
      useBindingStore.getState().setSelectedRow('grid1', 3);

      const state = useBindingStore.getState();
      expect(state.selectedRows['grid1']).toBe(3);
    });

    it('다른 컨트롤의 선택을 유지한다', () => {
      useBindingStore.getState().setSelectedRow('grid1', 0);
      useBindingStore.getState().setSelectedRow('grid2', 5);

      const state = useBindingStore.getState();
      expect(state.selectedRows['grid1']).toBe(0);
      expect(state.selectedRows['grid2']).toBe(5);
    });

    it('같은 컨트롤의 선택을 덮어쓴다', () => {
      useBindingStore.getState().setSelectedRow('grid1', 0);
      useBindingStore.getState().setSelectedRow('grid1', 2);

      const state = useBindingStore.getState();
      expect(state.selectedRows['grid1']).toBe(2);
    });
  });

  describe('updateCellValue', () => {
    it('특정 행의 값을 변경한다', () => {
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      useBindingStore.getState().loadDataSource('ds1', data);

      useBindingStore.getState().updateCellValue('ds1', 1, 'name', 'Charlie');

      const state = useBindingStore.getState();
      const rows = state.dataSourceData['ds1'] as Record<string, unknown>[];
      expect(rows[1].name).toBe('Charlie');
      // 다른 행은 변경되지 않음
      expect(rows[0].name).toBe('Alice');
    });

    it('존재하지 않는 데이터소스는 무시한다', () => {
      // 에러 없이 무시되어야 함
      useBindingStore.getState().updateCellValue('nonexistent', 0, 'name', 'value');

      const state = useBindingStore.getState();
      expect(state.dataSourceData['nonexistent']).toBeUndefined();
    });

    it('범위 밖 인덱스는 무시한다', () => {
      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);

      useBindingStore.getState().updateCellValue('ds1', 5, 'name', 'value');

      const state = useBindingStore.getState();
      const rows = state.dataSourceData['ds1'] as Record<string, unknown>[];
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Alice');
    });
  });

  describe('reset', () => {
    it('모든 상태를 초기화한다', () => {
      useBindingStore.getState().loadDataSource('ds1', [{ a: 1 }]);
      useBindingStore.getState().setSelectedRow('grid1', 2);
      useBindingStore.getState().setLoading('ds1', true);
      useBindingStore.getState().setError('ds1', 'error');

      useBindingStore.getState().reset();

      const state = useBindingStore.getState();
      expect(state.dataSourceData).toEqual({});
      expect(state.selectedRows).toEqual({});
      expect(state.loadingStates).toEqual({});
      expect(state.errors).toEqual({});
    });
  });
});
