import { useRef, useMemo } from 'react';
import type { DataBindingDefinition } from '@webform/common';
import { useBindingStore } from '../bindings/bindingStore';
import { parseDataSourceRef, BindingEngine } from '../bindings/BindingEngine';

export function useDataBinding(
  controlId: string,
  bindings: DataBindingDefinition[],
): Record<string, unknown> {
  // 1. 이 컨트롤에 해당하는 바인딩만 필터링
  const myBindings = useMemo(
    () => bindings.filter((b) => b.controlId === controlId),
    [controlId, bindings],
  );

  // 2. bindingStore 구독
  const dataSourceData = useBindingStore((s) => s.dataSourceData);
  const selectedRows = useBindingStore((s) => s.selectedRows);
  const errors = useBindingStore((s) => s.errors);
  const loadingStates = useBindingStore((s) => s.loadingStates);

  // 3. oneTime 바인딩용 ref
  const oneTimeRef = useRef<Record<string, unknown>>({});
  const initializedRef = useRef(false);

  if (myBindings.length === 0) return {};

  // 4. 각 바인딩에 대해 값 계산
  const result: Record<string, unknown> = {};

  for (const binding of myBindings) {
    const { controlProperty, dataSourceId, dataField, bindingMode } = binding;

    // oneTime: 이미 초기화되었으면 캐시된 값 사용
    if (bindingMode === 'oneTime' && initializedRef.current) {
      result[controlProperty] = oneTimeRef.current[controlProperty];
      continue;
    }

    // 값 계산
    const ref = parseDataSourceRef(dataSourceId);
    let value: unknown;

    if (ref.type === 'selectedRow') {
      const rowIdx = selectedRows[ref.controlId] ?? -1;
      // selectedRow 바인딩의 실제 데이터소스는 해당 그리드의 dataSource 바인딩에서 조회
      const gridBinding = bindings.find(
        (b) => b.controlId === ref.controlId && b.controlProperty === 'dataSource',
      );
      if (gridBinding && rowIdx >= 0) {
        const gridRef = parseDataSourceRef(gridBinding.dataSourceId);
        if (gridRef.type === 'dataSource') {
          const rows = dataSourceData[gridRef.dataSourceId] ?? [];
          const row = rows[rowIdx] as Record<string, unknown> | undefined;
          value = row?.[dataField];
        }
      }
    } else {
      // 일반 데이터소스 참조
      const data = dataSourceData[ref.dataSourceId];
      if (data) {
        if (controlProperty === 'dataSource') {
          // DataGridView용: 전체 데이터 배열
          value = data;
        } else {
          // 단일 값: 첫 번째 행의 특정 필드
          const firstRow = data[0] as Record<string, unknown> | undefined;
          value = firstRow?.[dataField];
        }
      }
    }

    // 바인딩 데이터가 로드되지 않은 경우 undefined로 controlState를 덮어쓰지 않음
    if (value !== undefined) {
      result[controlProperty] = value;
    }

    // twoWay: onChange 콜백 추가
    if (bindingMode === 'twoWay') {
      const onChangeKey = `on${controlProperty.charAt(0).toUpperCase() + controlProperty.slice(1)}Change`;
      result[onChangeKey] = (newValue: unknown) => {
        BindingEngine.handleTwoWayUpdate(controlId, controlProperty, newValue, bindings);
      };
    }

    // oneTime: 첫 로드 시 캐시
    if (bindingMode === 'oneTime' && value !== undefined) {
      oneTimeRef.current[controlProperty] = value;
    }
  }

  // 바인딩된 데이터소스의 에러/로딩 상태 추가
  for (const binding of myBindings) {
    const ref = parseDataSourceRef(binding.dataSourceId);
    if (ref.type === 'dataSource') {
      if (errors[ref.dataSourceId]) {
        result['__error__'] = errors[ref.dataSourceId];
      }
      if (loadingStates[ref.dataSourceId]) {
        result['__loading__'] = true;
      }
    }
  }

  // oneTime 초기화 플래그
  if (!initializedRef.current && Object.keys(result).length > 0) {
    initializedRef.current = true;
  }

  return result;
}
