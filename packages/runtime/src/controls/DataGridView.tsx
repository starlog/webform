import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { List } from 'react-window';
import { useBindingStore } from '../bindings/bindingStore';
import { computeFontStyle } from '../renderer/layoutUtils';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

export interface ColumnDefinition {
  field?: string;
  key?: string;
  headerText?: string;
  /** @deprecated use headerText instead */
  name?: string;
  width?: number;
  sortable?: boolean;
  editable?: boolean;
}

interface FontDef {
  family?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

interface DataGridViewProps {
  id: string;
  name: string;
  dataSource?: unknown[];
  rows?: unknown[];
  columns?: ColumnDefinition[];
  onDataSourceChange?: (data: unknown[]) => void;
  onCellClick?: (row: number, col: string) => void;
  onSelectionChanged?: (rowIndex: number) => void;
  style?: CSSProperties;
  enabled?: boolean;
  readOnly?: boolean;
  font?: FontDef;
  backColor?: string;
  foreColor?: string;
  children?: ReactNode;
  [key: string]: unknown;
}

interface ResolvedColumn extends ColumnDefinition {
  field: string;
  headerText: string;
}

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

interface EditingCell {
  rowIndex: number;
  field: string;
}

const INTERNAL_FIELDS = ['_id', '__v', 'createdAt', 'updatedAt'];
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 22;

function useDataGridStyles() {
  const theme = useTheme();
  return useMemo(() => ({
    container: {
      border: theme.controls.dataGrid.border,
      borderRadius: theme.controls.dataGrid.borderRadius,
      overflow: 'hidden',
      backgroundColor: theme.controls.dataGrid.rowBackground,
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
      fontSize: '12px',
    } as CSSProperties,
    headerRow: {
      display: 'flex',
      backgroundColor: theme.controls.dataGrid.headerBackground,
      color: theme.controls.dataGrid.headerForeground,
      fontWeight: 600,
      height: `${HEADER_HEIGHT}px`,
      borderBottom: theme.controls.dataGrid.headerBorder,
    } as CSSProperties,
    headerCell: {
      borderRight: theme.controls.dataGrid.headerBorder,
      padding: '3px 6px',
      textAlign: 'left' as const,
      height: `${HEADER_HEIGHT}px`,
      cursor: 'pointer',
      userSelect: 'none' as const,
      whiteSpace: 'nowrap' as const,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      boxSizing: 'border-box' as const,
      display: 'flex',
      alignItems: 'center',
    } as CSSProperties,
    cell: {
      borderRight: theme.controls.dataGrid.headerBorder,
      borderBottom: theme.controls.dataGrid.headerBorder,
      padding: '2px 6px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
      color: theme.controls.dataGrid.rowForeground,
      boxSizing: 'border-box' as const,
      display: 'flex',
      alignItems: 'center',
    } as CSSProperties,
    selectedRow: {
      backgroundColor: theme.controls.dataGrid.selectedRowBackground,
      color: theme.controls.dataGrid.selectedRowForeground,
    } as CSSProperties,
    emptyMessage: {
      padding: '20px',
      textAlign: 'center' as const,
      color: '#888',
    } as CSSProperties,
    editInput: {
      width: '100%',
      height: '100%',
      border: `1px solid ${theme.accent.primary}`,
      padding: '1px 4px',
      fontSize: 'inherit',
      fontFamily: 'inherit',
      boxSizing: 'border-box' as const,
      outline: 'none',
    } as CSSProperties,
  }), [theme]);
}

interface DataGridRowExtraProps {
  sortedRows: Record<string, unknown>[];
  selectedRowIndex: number;
  editingCell: EditingCell | null;
  resolvedColumns: ResolvedColumn[];
  styles: ReturnType<typeof useDataGridStyles>;
  editInputRef: React.RefObject<HTMLInputElement>;
  handleRowClick: (rowIndex: number) => void;
  handleCellClick: (rowIndex: number, field: string) => void;
  handleCellDoubleClick: (rowIndex: number, field: string, editable?: boolean) => void;
  handleEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  commitEdit: (value: string) => void;
}

interface VirtualizedRowProps extends DataGridRowExtraProps {
  ariaAttributes: {
    'aria-posinset': number;
    'aria-setsize': number;
    role: 'listitem';
  };
  index: number;
  style: CSSProperties;
}

function VirtualizedRow({
  ariaAttributes,
  index,
  style: rowStyle,
  sortedRows,
  selectedRowIndex,
  editingCell,
  resolvedColumns,
  styles,
  editInputRef,
  handleRowClick,
  handleCellClick,
  handleCellDoubleClick,
  handleEditKeyDown,
  commitEdit,
}: VirtualizedRowProps) {
  const row = sortedRows[index];
  const isSelected = index === selectedRowIndex;
  return (
    <div
      {...ariaAttributes}
      style={{
        ...rowStyle,
        display: 'flex',
        ...(isSelected ? styles.selectedRow : {}),
      }}
      onClick={() => handleRowClick(index)}
    >
      {resolvedColumns.map((col) => {
        const isEditing =
          editingCell?.rowIndex === index && editingCell?.field === col.field;
        const cellValue = row[col.field];

        return (
          <div
            key={col.field}
            style={{
              ...styles.cell,
              width: col.width,
              flex: col.width ? undefined : 1,
              height: `${ROW_HEIGHT}px`,
              ...(isSelected ? styles.selectedRow : {}),
            }}
            onClick={() => handleCellClick(index, col.field)}
            onDoubleClick={() =>
              handleCellDoubleClick(index, col.field, col.editable)
            }
          >
            {isEditing ? (
              <input
                ref={editInputRef}
                style={styles.editInput}
                defaultValue={String(cellValue ?? '')}
                onKeyDown={handleEditKeyDown}
                onBlur={(e) => commitEdit(e.target.value)}
              />
            ) : (
              String(cellValue ?? '')
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DataGridView({
  id,
  dataSource,
  rows: rowsProp,
  columns,
  onDataSourceChange,
  onCellClick,
  onSelectionChanged,
  style,
  enabled = true,
  readOnly = false,
  font,
  backColor,
  foreColor,
  ...rest
}: DataGridViewProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const setSelectedRow = useBindingStore((s) => s.setSelectedRow);
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const styles = useDataGridStyles();
  const colors = useControlColors('DataGridView', { backColor, foreColor });

  const fontStyle = useMemo(() => computeFontStyle(font), [font]);

  const rows = useMemo(() => (dataSource ?? rowsProp ?? []) as Record<string, unknown>[], [dataSource, rowsProp]);

  // 컬럼 자동 생성: columns prop이 없으면 데이터의 키에서 추출
  const resolvedColumns = useMemo<ResolvedColumn[]>(() => {
    if (columns && columns.length > 0) {
      // field/key 및 headerText/name 폴백 처리
      return columns.map((col, i) => ({
        ...col,
        field: col.field || col.key || `col${i}`,
        headerText: col.headerText || col.name || col.field || col.key || `Column${i + 1}`,
      }));
    }
    if (rows.length === 0) return [];
    const keys = Object.keys(rows[0]).filter((k) => !INTERNAL_FIELDS.includes(k));
    return keys.map((key) => ({
      field: key,
      headerText: key,
      sortable: true,
      editable: !readOnly,
    }));
  }, [columns, rows, readOnly]);

  // 정렬된 데이터
  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    const { field, direction } = sortConfig;
    return [...rows].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === 'asc' ? -1 : 1;
      if (bVal == null) return direction === 'asc' ? 1 : -1;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rows, sortConfig]);

  // 정렬 토글
  const handleSort = useCallback(
    (field: string, sortable?: boolean) => {
      if (sortable === false) return;
      setSortConfig((prev) => {
        if (prev?.field === field) {
          if (prev.direction === 'asc') return { field, direction: 'desc' };
          return null; // desc → none
        }
        return { field, direction: 'asc' };
      });
    },
    [],
  );

  // 행 클릭
  const handleRowClick = useCallback(
    (rowIndex: number) => {
      setSelectedRowIndex(rowIndex);
      setSelectedRow(id, rowIndex);
      updateControlState(id, 'selectedIndex', rowIndex);
      onSelectionChanged?.(rowIndex);
    },
    [id, setSelectedRow, updateControlState, onSelectionChanged],
  );

  // 셀 클릭
  const handleCellClick = useCallback(
    (rowIndex: number, field: string) => {
      onCellClick?.(rowIndex, field);
    },
    [onCellClick],
  );

  // 셀 더블클릭 → 편집 모드
  const handleCellDoubleClick = useCallback(
    (rowIndex: number, field: string, editable?: boolean) => {
      if (!enabled || readOnly || editable === false) return;
      setEditingCell({ rowIndex, field });
    },
    [enabled, readOnly],
  );

  // 편집 중인 셀에 포커스
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // 편집 완료
  const commitEdit = useCallback(
    (value: string) => {
      if (!editingCell) return;
      const { rowIndex, field } = editingCell;

      // 원본 데이터에서의 인덱스 찾기 (정렬 상태에서)
      const originalRow = sortedRows[rowIndex];
      const originalIndex = rows.indexOf(originalRow);
      if (originalIndex >= 0) {
        // 바인딩된 데이터소스의 ID를 알 수 없으므로 onDataSourceChange로 위임
        const updated = [...rows];
        updated[originalIndex] = { ...updated[originalIndex], [field]: value };
        onDataSourceChange?.(updated);
      }
      setEditingCell(null);
    },
    [editingCell, sortedRows, rows, onDataSourceChange],
  );

  // 편집 취소
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // 편집 키 핸들러
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitEdit(e.currentTarget.value);
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  // 컨테이너 높이 계산
  const containerHeight = (style?.height as number) ?? 200;
  const listHeight = Math.max(containerHeight - HEADER_HEIGHT, 0);

  const mergedStyle: CSSProperties = { ...styles.container, ...fontStyle, background: colors.background, color: colors.color, ...style };

  // rowProps: 행 렌더러에 전달되는 추가 props (hooks는 early return 앞에서 호출)
  const rowProps = useMemo<DataGridRowExtraProps>(() => ({
    sortedRows,
    selectedRowIndex,
    editingCell,
    resolvedColumns,
    styles,
    editInputRef,
    handleRowClick,
    handleCellClick,
    handleCellDoubleClick,
    handleEditKeyDown,
    commitEdit,
  }), [
    sortedRows, selectedRowIndex, editingCell, resolvedColumns, styles,
    handleRowClick, handleCellClick, handleCellDoubleClick, handleEditKeyDown, commitEdit,
  ]);

  // 에러 상태 표시
  const errorMessage = rest['__error__'];
  if (errorMessage) {
    return (
      <div className="wf-datagridview" data-control-id={id} style={mergedStyle}>
        <div style={{ padding: 12, color: '#d32f2f', fontSize: 13 }}>
          데이터 로드 실패: {String(errorMessage)}
        </div>
      </div>
    );
  }

  // 로딩 상태 표시
  if (rest['__loading__']) {
    return (
      <div className="wf-datagridview" data-control-id={id} style={mergedStyle}>
        <div style={{ padding: 12, color: '#666', fontSize: 13 }}>
          데이터 로딩 중...
        </div>
      </div>
    );
  }

  // 헤더 렌더링
  const header = (
    <div style={styles.headerRow}>
      {resolvedColumns.map((col) => (
        <div
          key={col.field}
          style={{ ...styles.headerCell, width: col.width, flex: col.width ? undefined : 1 }}
          onClick={() => handleSort(col.field, col.sortable)}
        >
          {col.headerText}
          {sortConfig?.field === col.field && (
            <span style={{ marginLeft: 4 }}>
              {sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  // 빈 데이터 처리
  if (rows.length === 0) {
    return (
      <div className="wf-datagridview" data-control-id={id} style={mergedStyle}>
        {header}
        <div style={styles.emptyMessage}>데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="wf-datagridview" data-control-id={id} style={mergedStyle}>
      {header}
      <List<DataGridRowExtraProps>
        rowComponent={VirtualizedRow}
        rowCount={sortedRows.length}
        rowHeight={ROW_HEIGHT}
        rowProps={rowProps}
        style={{ height: listHeight, overflow: 'auto' }}
      />
    </div>
  );
}
