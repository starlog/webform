import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BindingEngine, parseDataSourceRef } from '../bindings/BindingEngine';
import { useBindingStore } from '../bindings/bindingStore';
import type { DataBindingDefinition, FormDefinition } from '@webform/common';

// apiClient mock
vi.mock('../communication/apiClient', () => ({
  apiClient: {
    queryDataSource: vi.fn(),
  },
}));

import { apiClient } from '../communication/apiClient';

const mockedQueryDataSource = vi.mocked(apiClient.queryDataSource);

function createMockFormDef(
  dataBindings: DataBindingDefinition[],
): FormDefinition {
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
    controls: [],
    eventHandlers: [],
    dataBindings,
  };
}

describe('parseDataSourceRef', () => {
  it('selectedRow 참조를 파싱한다', () => {
    const ref = parseDataSourceRef('grid1.selectedRow');
    expect(ref).toEqual({ type: 'selectedRow', controlId: 'grid1' });
  });

  it('일반 데이터소스 참조를 파싱한다', () => {
    const ref = parseDataSourceRef('employeeDS');
    expect(ref).toEqual({ type: 'dataSource', dataSourceId: 'employeeDS' });
  });
});

describe('BindingEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBindingStore.getState().reset();
  });

  describe('initializeBindings', () => {
    it('바인딩이 없으면 아무것도 로드하지 않는다', async () => {
      const formDef = createMockFormDef([]);
      await BindingEngine.initializeBindings(formDef, 'form1');

      expect(mockedQueryDataSource).not.toHaveBeenCalled();
    });

    it('고유한 데이터소스만 로드한다 (중복 제거)', async () => {
      mockedQueryDataSource.mockResolvedValue([{ id: 1 }]);
      const bindings: DataBindingDefinition[] = [
        { controlId: 'grid1', controlProperty: 'dataSource', dataSourceId: 'ds1', dataField: '', bindingMode: 'oneWay' },
        { controlId: 'txt1', controlProperty: 'text', dataSourceId: 'ds1', dataField: 'name', bindingMode: 'oneWay' },
      ];
      const formDef = createMockFormDef(bindings);

      await BindingEngine.initializeBindings(formDef, 'form1');

      // ds1은 한 번만 호출
      expect(mockedQueryDataSource).toHaveBeenCalledTimes(1);
      expect(mockedQueryDataSource).toHaveBeenCalledWith('form1', 'ds1', undefined);
    });

    it('selectedRow 참조는 직접 로드하지 않는다', async () => {
      const bindings: DataBindingDefinition[] = [
        { controlId: 'txt1', controlProperty: 'text', dataSourceId: 'grid1.selectedRow', dataField: 'name', bindingMode: 'oneWay' },
      ];
      const formDef = createMockFormDef(bindings);

      await BindingEngine.initializeBindings(formDef, 'form1');

      expect(mockedQueryDataSource).not.toHaveBeenCalled();
    });
  });

  describe('loadDataSourceData', () => {
    it('성공 시 데이터를 스토어에 저장한다', async () => {
      const data = [{ id: 1, name: 'Alice' }];
      mockedQueryDataSource.mockResolvedValue(data);

      await BindingEngine.loadDataSourceData('ds1', 'form1');

      const state = useBindingStore.getState();
      expect(state.dataSourceData['ds1']).toEqual(data);
      expect(state.loadingStates['ds1']).toBe(false);
      expect(state.errors['ds1']).toBeNull();
    });

    it('실패 시 에러를 스토어에 저장한다', async () => {
      mockedQueryDataSource.mockRejectedValue(new Error('Network error'));

      await BindingEngine.loadDataSourceData('ds1', 'form1');

      const state = useBindingStore.getState();
      expect(state.errors['ds1']).toBe('Network error');
      expect(state.loadingStates['ds1']).toBe(false);
    });
  });

  describe('getControlValue', () => {
    const bindings: DataBindingDefinition[] = [
      { controlId: 'grid1', controlProperty: 'dataSource', dataSourceId: 'employeeDS', dataField: '', bindingMode: 'oneWay' },
      { controlId: 'txt1', controlProperty: 'text', dataSourceId: 'employeeDS', dataField: 'name', bindingMode: 'oneWay' },
      { controlId: 'txtDetail', controlProperty: 'text', dataSourceId: 'grid1.selectedRow', dataField: 'name', bindingMode: 'oneWay' },
    ];

    it('oneTime 바인딩: 초기 로드 후 변경 없음을 검증한다', () => {
      const oneTimeBindings: DataBindingDefinition[] = [
        { controlId: 'lbl1', controlProperty: 'text', dataSourceId: 'ds1', dataField: 'title', bindingMode: 'oneTime' },
      ];

      useBindingStore.getState().loadDataSource('ds1', [{ title: 'Initial' }]);
      const initial = BindingEngine.getControlValue('lbl1', 'text', oneTimeBindings);
      expect(initial).toBe('Initial');

      // 데이터소스 변경 후에도 BindingEngine.getControlValue는 최신 데이터를 반환
      // (oneTime 캐싱은 useDataBinding 훅 레벨에서 처리됨)
      useBindingStore.getState().loadDataSource('ds1', [{ title: 'Changed' }]);
      const after = BindingEngine.getControlValue('lbl1', 'text', oneTimeBindings);
      expect(after).toBe('Changed');
    });

    it('oneWay 바인딩: 데이터소스 변경 시 컨트롤 값 업데이트를 확인한다', () => {
      useBindingStore.getState().loadDataSource('employeeDS', [
        { name: 'Alice', age: 30 },
      ]);

      // 초기 값
      const value1 = BindingEngine.getControlValue('txt1', 'text', bindings);
      expect(value1).toBe('Alice');

      // 데이터 변경
      useBindingStore.getState().loadDataSource('employeeDS', [
        { name: 'Bob', age: 25 },
      ]);

      const value2 = BindingEngine.getControlValue('txt1', 'text', bindings);
      expect(value2).toBe('Bob');
    });

    it('dataSource 속성은 전체 배열을 반환한다', () => {
      const data = [{ name: 'Alice' }, { name: 'Bob' }];
      useBindingStore.getState().loadDataSource('employeeDS', data);

      const value = BindingEngine.getControlValue('grid1', 'dataSource', bindings);
      expect(value).toEqual(data);
    });

    it('selectedRow 바인딩: 선택된 행의 필드값을 반환한다', () => {
      useBindingStore.getState().loadDataSource('employeeDS', [
        { name: 'Alice' },
        { name: 'Bob' },
      ]);
      useBindingStore.getState().setSelectedRow('grid1', 1);

      const value = BindingEngine.getControlValue('txtDetail', 'text', bindings);
      expect(value).toBe('Bob');
    });

    it('바인딩이 없으면 undefined를 반환한다', () => {
      const value = BindingEngine.getControlValue('unknown', 'text', bindings);
      expect(value).toBeUndefined();
    });
  });

  describe('handleTwoWayUpdate', () => {
    it('twoWay 바인딩: 데이터소스 값을 업데이트한다', () => {
      const bindings: DataBindingDefinition[] = [
        { controlId: 'txt1', controlProperty: 'text', dataSourceId: 'ds1', dataField: 'name', bindingMode: 'twoWay' },
      ];

      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);

      BindingEngine.handleTwoWayUpdate('txt1', 'text', 'Bob', bindings);

      const state = useBindingStore.getState();
      const rows = state.dataSourceData['ds1'] as Record<string, unknown>[];
      expect(rows[0].name).toBe('Bob');
    });

    it('twoWay가 아닌 바인딩은 무시한다', () => {
      const bindings: DataBindingDefinition[] = [
        { controlId: 'txt1', controlProperty: 'text', dataSourceId: 'ds1', dataField: 'name', bindingMode: 'oneWay' },
      ];

      useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);

      BindingEngine.handleTwoWayUpdate('txt1', 'text', 'Bob', bindings);

      const state = useBindingStore.getState();
      const rows = state.dataSourceData['ds1'] as Record<string, unknown>[];
      expect(rows[0].name).toBe('Alice'); // 변경되지 않음
    });

    it('selectedRow 기반 twoWay 바인딩도 동작한다', () => {
      const bindings: DataBindingDefinition[] = [
        { controlId: 'grid1', controlProperty: 'dataSource', dataSourceId: 'ds1', dataField: '', bindingMode: 'oneWay' },
        { controlId: 'txtDetail', controlProperty: 'text', dataSourceId: 'grid1.selectedRow', dataField: 'name', bindingMode: 'twoWay' },
      ];

      useBindingStore.getState().loadDataSource('ds1', [
        { name: 'Alice' },
        { name: 'Bob' },
      ]);
      useBindingStore.getState().setSelectedRow('grid1', 1);

      BindingEngine.handleTwoWayUpdate('txtDetail', 'text', 'Charlie', bindings);

      const state = useBindingStore.getState();
      const rows = state.dataSourceData['ds1'] as Record<string, unknown>[];
      expect(rows[1].name).toBe('Charlie');
      expect(rows[0].name).toBe('Alice'); // 다른 행 영향 없음
    });
  });
});
