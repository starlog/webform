import type { FormDefinition, DataBindingDefinition } from '@webform/common';
import { useBindingStore } from './bindingStore';
import { apiClient } from '../communication/apiClient';

type DataSourceRef =
  | { type: 'selectedRow'; controlId: string }
  | { type: 'dataSource'; dataSourceId: string };

/** dataSourceId 문자열을 파싱하여 참조 유형 결정 */
export function parseDataSourceRef(dataSourceId: string): DataSourceRef {
  const parts = dataSourceId.split('.');
  if (parts.length === 2 && parts[1] === 'selectedRow') {
    return { type: 'selectedRow', controlId: parts[0] };
  }
  return { type: 'dataSource', dataSourceId };
}

export class BindingEngine {
  /**
   * 폼 정의의 모든 DataBindingDefinition을 순회하며 초기 데이터 로드
   */
  static async initializeBindings(
    formDef: FormDefinition,
    formId: string,
  ): Promise<void> {
    const bindings = formDef.dataBindings;
    if (!bindings || bindings.length === 0) return;

    // 고유한 실제 데이터소스 ID 추출 (selectedRow 참조 제외)
    const dataSourceIds = new Set<string>();
    for (const binding of bindings) {
      const ref = parseDataSourceRef(binding.dataSourceId);
      if (ref.type === 'dataSource') {
        dataSourceIds.add(ref.dataSourceId);
      }
    }

    // 각 데이터소스에 대해 병렬 로드
    const promises = Array.from(dataSourceIds).map((dsId) =>
      BindingEngine.loadDataSourceData(dsId, formId),
    );
    await Promise.allSettled(promises);
  }

  /**
   * 특정 데이터소스의 데이터를 서버에서 로드
   */
  static async loadDataSourceData(
    dsId: string,
    formId: string,
    query?: Record<string, unknown>,
  ): Promise<void> {
    const store = useBindingStore.getState();
    store.setLoading(dsId, true);
    store.setError(dsId, null);

    try {
      const data = await apiClient.queryDataSource(formId, dsId, query);
      useBindingStore.getState().loadDataSource(dsId, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      useBindingStore.getState().setError(dsId, message);
    } finally {
      useBindingStore.getState().setLoading(dsId, false);
    }
  }

  /**
   * 특정 컨트롤/속성에 대한 바인딩 값 계산
   */
  static getControlValue(
    controlId: string,
    property: string,
    bindings: DataBindingDefinition[],
  ): unknown {
    const binding = bindings.find(
      (b) => b.controlId === controlId && b.controlProperty === property,
    );
    if (!binding) return undefined;

    const store = useBindingStore.getState();
    const ref = parseDataSourceRef(binding.dataSourceId);

    if (ref.type === 'selectedRow') {
      const rowIdx = store.selectedRows[ref.controlId] ?? -1;
      // selectedRow 바인딩의 실제 데이터소스는 해당 그리드의 dataSource 바인딩에서 조회
      const gridBinding = bindings.find(
        (b) => b.controlId === ref.controlId && b.controlProperty === 'dataSource',
      );
      if (gridBinding && rowIdx >= 0) {
        const gridRef = parseDataSourceRef(gridBinding.dataSourceId);
        const dsId = gridRef.type === 'dataSource' ? gridRef.dataSourceId : '';
        const rows = store.dataSourceData[dsId] ?? [];
        const row = rows[rowIdx] as Record<string, unknown> | undefined;
        return row?.[binding.dataField];
      }
      return undefined;
    }

    // 일반 데이터소스 참조
    const data = store.dataSourceData[ref.dataSourceId];
    if (!data) return undefined;

    // dataSource 속성: 전체 데이터 배열 (DataGridView용)
    if (property === 'dataSource') {
      return data;
    }

    // 단일 값: 첫 번째 행의 특정 필드
    const firstRow = data[0] as Record<string, unknown> | undefined;
    return firstRow?.[binding.dataField];
  }

  /**
   * twoWay 바인딩 변경 처리
   */
  static handleTwoWayUpdate(
    controlId: string,
    property: string,
    value: unknown,
    bindings: DataBindingDefinition[],
  ): void {
    const binding = bindings.find(
      (b) =>
        b.controlId === controlId &&
        b.controlProperty === property &&
        b.bindingMode === 'twoWay',
    );
    if (!binding) return;

    const store = useBindingStore.getState();
    const ref = parseDataSourceRef(binding.dataSourceId);

    if (ref.type === 'selectedRow') {
      const rowIdx = store.selectedRows[ref.controlId] ?? -1;
      const gridBinding = bindings.find(
        (b) => b.controlId === ref.controlId && b.controlProperty === 'dataSource',
      );
      if (gridBinding && rowIdx >= 0) {
        const gridRef = parseDataSourceRef(gridBinding.dataSourceId);
        if (gridRef.type === 'dataSource') {
          store.updateCellValue(gridRef.dataSourceId, rowIdx, binding.dataField, value);
        }
      }
    } else {
      // 일반 바인딩: 첫 번째 행의 필드 업데이트
      store.updateCellValue(ref.dataSourceId, 0, binding.dataField, value);
    }
  }
}
