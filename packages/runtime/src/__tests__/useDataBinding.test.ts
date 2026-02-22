import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataBinding } from '../hooks/useDataBinding';
import { useBindingStore } from '../bindings/bindingStore';
import type { DataBindingDefinition } from '@webform/common';

// apiClient mock (BindingEngine에서 import하므로 필요)
vi.mock('../communication/apiClient', () => ({
  apiClient: {
    queryDataSource: vi.fn(),
  },
}));

describe('useDataBinding', () => {
  beforeEach(() => {
    useBindingStore.getState().reset();
  });

  it('Static 데이터소스 바인딩 값을 반환한다', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'txt1',
        controlProperty: 'text',
        dataSourceId: 'ds1',
        dataField: 'name',
        bindingMode: 'oneWay',
      },
    ];

    // 스토어에 데이터 로드
    useBindingStore.getState().loadDataSource('ds1', [
      { name: 'Alice', age: 30 },
    ]);

    const { result } = renderHook(() => useDataBinding('txt1', bindings));

    expect(result.current.text).toBe('Alice');
  });

  it('바인딩이 없으면 빈 객체를 반환한다', () => {
    const { result } = renderHook(() => useDataBinding('txt1', []));
    expect(result.current).toEqual({});
  });

  it('데이터소스가 로드되지 않았으면 undefined를 반환한다', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'txt1',
        controlProperty: 'text',
        dataSourceId: 'ds1',
        dataField: 'name',
        bindingMode: 'oneWay',
      },
    ];

    const { result } = renderHook(() => useDataBinding('txt1', bindings));

    expect(result.current.text).toBeUndefined();
  });

  it('twoWay onChange 핸들러가 동작한다', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'txt1',
        controlProperty: 'text',
        dataSourceId: 'ds1',
        dataField: 'name',
        bindingMode: 'twoWay',
      },
    ];

    useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);

    const { result } = renderHook(() => useDataBinding('txt1', bindings));

    // twoWay 바인딩이므로 onTextChange 콜백이 생성됨
    expect(result.current.text).toBe('Alice');
    expect(typeof result.current.onTextChange).toBe('function');

    // onChange 호출
    act(() => {
      (result.current.onTextChange as (value: unknown) => void)('Bob');
    });

    // 스토어 데이터가 업데이트됨
    const state = useBindingStore.getState();
    const rows = state.dataSourceData['ds1'] as Record<string, unknown>[];
    expect(rows[0].name).toBe('Bob');
  });

  it('oneWay 바인딩은 onChange 콜백을 생성하지 않는다', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'txt1',
        controlProperty: 'text',
        dataSourceId: 'ds1',
        dataField: 'name',
        bindingMode: 'oneWay',
      },
    ];

    useBindingStore.getState().loadDataSource('ds1', [{ name: 'Alice' }]);

    const { result } = renderHook(() => useDataBinding('txt1', bindings));

    expect(result.current.text).toBe('Alice');
    expect(result.current.onTextChange).toBeUndefined();
  });

  it('dataSource 속성은 전체 배열을 반환한다', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'grid1',
        controlProperty: 'dataSource',
        dataSourceId: 'ds1',
        dataField: '',
        bindingMode: 'oneWay',
      },
    ];

    const data = [{ name: 'Alice' }, { name: 'Bob' }];
    useBindingStore.getState().loadDataSource('ds1', data);

    const { result } = renderHook(() => useDataBinding('grid1', bindings));

    expect(result.current.dataSource).toEqual(data);
  });

  it('selectedRow 바인딩: 선택된 행의 값을 반환한다', () => {
    const bindings: DataBindingDefinition[] = [
      {
        controlId: 'grid1',
        controlProperty: 'dataSource',
        dataSourceId: 'ds1',
        dataField: '',
        bindingMode: 'oneWay',
      },
      {
        controlId: 'txtDetail',
        controlProperty: 'text',
        dataSourceId: 'grid1.selectedRow',
        dataField: 'name',
        bindingMode: 'oneWay',
      },
    ];

    useBindingStore.getState().loadDataSource('ds1', [
      { name: 'Alice' },
      { name: 'Bob' },
    ]);
    useBindingStore.getState().setSelectedRow('grid1', 1);

    const { result } = renderHook(() => useDataBinding('txtDetail', bindings));

    expect(result.current.text).toBe('Bob');
  });
});
