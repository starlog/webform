import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface BindingState {
  /** 데이터소스ID -> 데이터 배열 */
  dataSourceData: Record<string, unknown[]>;

  /** 컨트롤ID -> 선택된 행 인덱스 */
  selectedRows: Record<string, number>;

  /** 데이터소스 로딩 상태 */
  loadingStates: Record<string, boolean>;

  /** 에러 상태 */
  errors: Record<string, string | null>;

  // 액션
  loadDataSource: (dsId: string, data: unknown[]) => void;
  setSelectedRow: (controlId: string, rowIndex: number) => void;
  updateCellValue: (dsId: string, rowIndex: number, field: string, value: unknown) => void;
  setLoading: (dsId: string, loading: boolean) => void;
  setError: (dsId: string, error: string | null) => void;
  reset: () => void;
}

const initialState = {
  dataSourceData: {} as Record<string, unknown[]>,
  selectedRows: {} as Record<string, number>,
  loadingStates: {} as Record<string, boolean>,
  errors: {} as Record<string, string | null>,
};

export const useBindingStore = create<BindingState>()(
  immer((set) => ({
    ...initialState,

    loadDataSource: (dsId, data) =>
      set((state) => {
        state.dataSourceData[dsId] = data;
      }),

    setSelectedRow: (controlId, rowIndex) =>
      set((state) => {
        state.selectedRows[controlId] = rowIndex;
      }),

    updateCellValue: (dsId, rowIndex, field, value) =>
      set((state) => {
        const data = state.dataSourceData[dsId];
        if (data && data[rowIndex]) {
          (data[rowIndex] as Record<string, unknown>)[field] = value;
        }
      }),

    setLoading: (dsId, loading) =>
      set((state) => {
        state.loadingStates[dsId] = loading;
      }),

    setError: (dsId, error) =>
      set((state) => {
        state.errors[dsId] = error;
      }),

    reset: () =>
      set(() => ({ ...initialState })),
  })),
);
