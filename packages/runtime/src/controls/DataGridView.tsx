import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useBindingStore } from '../bindings/bindingStore';

export interface ColumnDefinition {
  field: string;
  headerText: string;
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
  foreColor?: string;
  children?: ReactNode;
  [key: string]: unknown;
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

const styles = {
  container: {
    border: '1px solid #a0a0a0',
    overflow: 'auto',
    backgroundColor: '#ffffff',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
  } as CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
  } as CSSProperties,
  headerCell: {
    backgroundColor: '#e0e0e0',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '2px solid #a0a0a0',
    padding: '3px 6px',
    textAlign: 'left' as const,
    fontWeight: 600,
    height: '22px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as CSSProperties,
  cell: {
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #d0d0d0',
    padding: '2px 6px',
    height: '22px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,
  selectedRow: {
    backgroundColor: '#0078d7',
    color: '#ffffff',
  } as CSSProperties,
  emptyMessage: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#888',
  } as CSSProperties,
  editInput: {
    width: '100%',
    height: '100%',
    border: '1px solid #0078d7',
    padding: '1px 4px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    outline: 'none',
  } as CSSProperties,
};

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
  foreColor,
}: DataGridViewProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const setSelectedRow = useBindingStore((s) => s.setSelectedRow);

  const fontStyle = useMemo<CSSProperties>(() => {
    if (!font) return {};
    const textDecoration = [
      font.underline ? 'underline' : '',
      font.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ');
    return {
      fontFamily: font.family || undefined,
      fontSize: font.size ? `${font.size}pt` : undefined,
      fontWeight: font.bold ? 'bold' : undefined,
      fontStyle: font.italic ? 'italic' : undefined,
      textDecoration: textDecoration || undefined,
    };
  }, [font]);

  const rows = useMemo(() => (dataSource ?? rowsProp ?? []) as Record<string, unknown>[], [dataSource, rowsProp]);

  // 컬럼 자동 생성: columns prop이 없으면 데이터의 키에서 추출
  const resolvedColumns = useMemo<ColumnDefinition[]>(() => {
    if (columns && columns.length > 0) {
      // headerText가 비어있으면 field 이름으로 폴백
      return columns.map((col, i) => ({
        ...col,
        headerText: col.headerText || col.name || col.field || `Column${i + 1}`,
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
      onSelectionChanged?.(rowIndex);
    },
    [id, setSelectedRow, onSelectionChanged],
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

  const mergedStyle: CSSProperties = { ...styles.container, ...fontStyle, ...(foreColor ? { color: foreColor } : {}), ...style };

  // 빈 데이터 처리
  if (rows.length === 0) {
    return (
      <div className="wf-datagridview" data-control-id={id} style={mergedStyle}>
        <table style={styles.table}>
          <thead>
            <tr>
              {resolvedColumns.map((col) => (
                <th key={col.field} style={{ ...styles.headerCell, width: col.width }}>
                  {col.headerText}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div style={styles.emptyMessage}>데이터가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="wf-datagridview" data-control-id={id} style={mergedStyle}>
      <table style={styles.table}>
        <thead>
          <tr>
            {resolvedColumns.map((col) => (
              <th
                key={col.field}
                style={{ ...styles.headerCell, width: col.width }}
                onClick={() => handleSort(col.field, col.sortable)}
              >
                {col.headerText}
                {sortConfig?.field === col.field && (
                  <span style={{ marginLeft: 4 }}>
                    {sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => {
            const isSelected = rowIndex === selectedRowIndex;
            return (
              <tr
                key={rowIndex}
                onClick={() => {
                  handleRowClick(rowIndex);
                }}
                style={isSelected ? styles.selectedRow : undefined}
              >
                {resolvedColumns.map((col) => {
                  const isEditing =
                    editingCell?.rowIndex === rowIndex && editingCell?.field === col.field;
                  const cellValue = row[col.field];

                  return (
                    <td
                      key={col.field}
                      style={{
                        ...styles.cell,
                        width: col.width,
                        ...(isSelected ? styles.selectedRow : {}),
                      }}
                      onClick={() => handleCellClick(rowIndex, col.field)}
                      onDoubleClick={() =>
                        handleCellDoubleClick(rowIndex, col.field, col.editable)
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
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
