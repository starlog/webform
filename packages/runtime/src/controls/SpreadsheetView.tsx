import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

export interface SpreadsheetColumn {
  field: string;
  headerText: string;
  width?: number;
}

interface SpreadsheetViewProps {
  id: string;
  name: string;
  data?: unknown;
  dataSource?: unknown[];
  columns?: SpreadsheetColumn[];
  style?: CSSProperties;
  enabled?: boolean;
  readOnly?: boolean;
  showToolbar?: boolean;
  showFormulaBar?: boolean;
  showRowNumbers?: boolean;
  allowAddRows?: boolean;
  allowDeleteRows?: boolean;
  allowSort?: boolean;
  allowFilter?: boolean;
  backColor?: string;
  onCellChanged?: () => void;
  onRowAdded?: () => void;
  onRowDeleted?: () => void;
  onSelectionChanged?: () => void;
  onDataLoaded?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

type RowData = Record<string, unknown>;

interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

/** CSV 문자열을 RowData[]로 변환 */
function parseCsv(csv: string): RowData[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: RowData[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: RowData = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

/** data prop을 RowData[]로 파싱 */
function parseData(raw: unknown): RowData[] {
  if (Array.isArray(raw)) return raw as RowData[];
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    // JSON 배열 시도
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // CSV로 폴백
      }
    }
    return parseCsv(trimmed);
  }
  return [];
}

/** 열 인덱스를 문자로 변환 (0→A, 1→B, ..., 25→Z, 26→AA) */
function colToLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

const DEFAULT_COL_COUNT = 8;

export function SpreadsheetView({
  id,
  data,
  dataSource,
  columns,
  style,
  enabled = true,
  readOnly = false,
  showToolbar = true,
  showFormulaBar = true,
  showRowNumbers = true,
  allowAddRows = true,
  allowDeleteRows = true,
  allowSort = true,
  backColor = '#ffffff',
  onCellChanged,
  onRowAdded,
  onRowDeleted,
  onSelectionChanged,
  onDataLoaded,
}: SpreadsheetViewProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  // 데이터 파싱 — data prop 또는 dataSource 사용
  const rows = useMemo(() => {
    const raw = data ?? dataSource;
    return parseData(raw);
  }, [data, dataSource]);

  // DataLoaded 이벤트
  const prevRowLenRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevRowLenRef.current === null) {
      prevRowLenRef.current = rows.length;
      if (rows.length > 0) onDataLoaded?.();
    } else if (prevRowLenRef.current !== rows.length) {
      prevRowLenRef.current = rows.length;
    }
  }, [rows.length, onDataLoaded]);

  // 열 결정
  const resolvedColumns = useMemo<SpreadsheetColumn[]>(() => {
    if (columns && columns.length > 0) return columns;
    if (rows.length > 0) {
      return Object.keys(rows[0]).map((key) => ({
        field: key,
        headerText: key,
      }));
    }
    return Array.from({ length: DEFAULT_COL_COUNT }, (_, i) => ({
      field: colToLetter(i),
      headerText: colToLetter(i),
    }));
  }, [columns, rows]);

  // 선택 상태
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 정렬
  const sortedRows = useMemo(() => {
    if (!sortConfig || !allowSort) return rows;
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
  }, [rows, sortConfig, allowSort]);

  // 편집 완료
  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const field = resolvedColumns[col]?.field;
    if (field == null) return;

    const newRows = [...rows];
    if (row < newRows.length) {
      newRows[row] = { ...newRows[row], [field]: editValue };
    }
    updateControlState(id, 'data', newRows);
    setEditingCell(null);
    onCellChanged?.();
  }, [editingCell, editValue, rows, resolvedColumns, updateControlState, id, onCellChanged]);

  // 편집 취소
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // 셀 편집 진입
  const enterEdit = useCallback(
    (row: number, col: number, initialValue?: string) => {
      if (readOnly || !enabled) return;
      const field = resolvedColumns[col]?.field;
      if (!field) return;
      const currentValue = sortedRows[row]?.[field];
      setEditingCell({ row, col });
      setEditValue(initialValue ?? String(currentValue ?? ''));
    },
    [readOnly, enabled, resolvedColumns, sortedRows],
  );

  // 셀 선택
  const selectCell = useCallback(
    (row: number, col: number) => {
      setSelectedCell({ row, col });
      onSelectionChanged?.();
    },
    [onSelectionChanged],
  );

  // 행 추가
  const addRow = useCallback(() => {
    if (readOnly || !enabled || !allowAddRows) return;
    const emptyRow: RowData = {};
    for (const col of resolvedColumns) {
      emptyRow[col.field] = '';
    }
    const newRows = [...rows, emptyRow];
    updateControlState(id, 'data', newRows);
    onRowAdded?.();
  }, [readOnly, enabled, allowAddRows, resolvedColumns, rows, updateControlState, id, onRowAdded]);

  // 행 삭제
  const deleteRow = useCallback(() => {
    if (readOnly || !enabled || !allowDeleteRows || !selectedCell) return;
    const { row } = selectedCell;
    if (row >= rows.length) return;
    const newRows = rows.filter((_, i) => i !== row);
    updateControlState(id, 'data', newRows);
    setSelectedCell(null);
    onRowDeleted?.();
  }, [readOnly, enabled, allowDeleteRows, selectedCell, rows, updateControlState, id, onRowDeleted]);

  // 헤더 정렬 토글
  const handleSort = useCallback(
    (field: string) => {
      if (!allowSort) return;
      setSortConfig((prev) => {
        if (prev?.field === field) {
          if (prev.direction === 'asc') return { field, direction: 'desc' };
          return null;
        }
        return { field, direction: 'asc' };
      });
    },
    [allowSort],
  );

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) {
        // 편집 모드의 키 처리는 input에서 직접 처리
        return;
      }

      if (!selectedCell) return;
      const { row, col } = selectedCell;
      const maxRow = sortedRows.length - 1;
      const maxCol = resolvedColumns.length - 1;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (row > 0) selectCell(row - 1, col);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (row < maxRow) selectCell(row + 1, col);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (col > 0) selectCell(row, col - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (col < maxCol) selectCell(row, col + 1);
          break;
        case 'Tab':
          e.preventDefault();
          if (col < maxCol) selectCell(row, col + 1);
          else if (row < maxRow) selectCell(row + 1, 0);
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          enterEdit(row, col);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (!readOnly && enabled) {
            enterEdit(row, col, '');
          }
          break;
        default:
          // 일반 문자 입력 → 편집 진입
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            enterEdit(row, col, e.key);
          }
          break;
      }
    },
    [editingCell, selectedCell, sortedRows.length, resolvedColumns.length, selectCell, enterEdit, readOnly, enabled],
  );

  // 편집 input 키 핸들러
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        // 아래로 이동
        if (selectedCell && selectedCell.row < sortedRows.length - 1) {
          selectCell(selectedCell.row + 1, selectedCell.col);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        // 오른쪽으로 이동
        if (selectedCell) {
          const maxCol = resolvedColumns.length - 1;
          if (selectedCell.col < maxCol) {
            selectCell(selectedCell.row, selectedCell.col + 1);
          } else if (selectedCell.row < sortedRows.length - 1) {
            selectCell(selectedCell.row + 1, 0);
          }
        }
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit, selectedCell, sortedRows.length, resolvedColumns.length, selectCell],
  );

  // 편집 input 포커스
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingCell]);

  // 수식 바 셀 주소
  const cellAddress = useMemo(() => {
    if (!selectedCell) return '';
    return `${colToLetter(selectedCell.col)}${selectedCell.row + 1}`;
  }, [selectedCell]);

  // 수식 바 셀 값
  const cellDisplayValue = useMemo(() => {
    if (!selectedCell) return '';
    const field = resolvedColumns[selectedCell.col]?.field;
    if (!field) return '';
    const val = sortedRows[selectedCell.row]?.[field];
    return String(val ?? '');
  }, [selectedCell, resolvedColumns, sortedRows]);

  const mergedStyle: CSSProperties = {
    ...SS.container,
    backgroundColor: backColor,
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className="wf-spreadsheetview"
      data-control-id={id}
      style={mergedStyle}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      {showToolbar && (
        <div style={SS.toolbar}>
          {allowAddRows && !readOnly && (
            <button
              type="button"
              style={SS.toolBtn}
              onClick={addRow}
              disabled={!enabled}
            >
              + Row
            </button>
          )}
          {allowDeleteRows && !readOnly && (
            <button
              type="button"
              style={SS.toolBtn}
              onClick={deleteRow}
              disabled={!enabled || !selectedCell}
            >
              - Row
            </button>
          )}
        </div>
      )}

      {/* Formula Bar */}
      {showFormulaBar && (
        <div style={SS.formulaBar}>
          <span style={SS.cellAddress}>{cellAddress || '\u00A0'}</span>
          <span style={SS.fxLabel}>fx</span>
          <div style={SS.formulaValue}>{cellDisplayValue}</div>
        </div>
      )}

      {/* Grid */}
      <div style={SS.gridArea}>
        <table style={SS.table}>
          <thead>
            <tr>
              {showRowNumbers && <th style={{ ...SS.cornerCell, width: 40 }} />}
              {resolvedColumns.map((col, colIdx) => (
                <th
                  key={col.field}
                  style={{
                    ...SS.headerCell,
                    ...(col.width ? { width: col.width } : {}),
                    cursor: allowSort ? 'pointer' : 'default',
                  }}
                  onClick={() => handleSort(col.field)}
                >
                  {col.headerText || colToLetter(colIdx)}
                  {sortConfig?.field === col.field && (
                    <span style={{ marginLeft: 4, fontSize: 10 }}>
                      {sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={(showRowNumbers ? 1 : 0) + resolvedColumns.length}
                  style={SS.emptyMessage}
                >
                  {'\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {showRowNumbers && (
                    <td style={SS.rowNumber}>{rowIdx + 1}</td>
                  )}
                  {resolvedColumns.map((col, colIdx) => {
                    const isSelected =
                      selectedCell?.row === rowIdx && selectedCell?.col === colIdx;
                    const isEditing =
                      editingCell?.row === rowIdx && editingCell?.col === colIdx;
                    const cellVal = row[col.field];

                    return (
                      <td
                        key={col.field}
                        style={{
                          ...SS.cell,
                          ...(isSelected ? SS.selectedCell : {}),
                          ...(col.width ? { width: col.width } : {}),
                        }}
                        onClick={() => selectCell(rowIdx, colIdx)}
                        onDoubleClick={() => enterEdit(rowIdx, colIdx)}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            style={SS.editInput}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={commitEdit}
                          />
                        ) : (
                          String(cellVal ?? '')
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SS: Record<string, CSSProperties> = {
  container: {
    border: '1px solid #a0a0a0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: 12,
    outline: 'none',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 6px',
    backgroundColor: '#f3f3f3',
    borderBottom: '1px solid #d0d0d0',
    flexShrink: 0,
  },
  toolBtn: {
    padding: '2px 8px',
    border: '1px solid #c0c0c0',
    backgroundColor: '#fff',
    borderRadius: 2,
    fontSize: 11,
    cursor: 'pointer',
  },
  formulaBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #d0d0d0',
    flexShrink: 0,
    height: 22,
  },
  cellAddress: {
    padding: '1px 6px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #d0d0d0',
    fontSize: 11,
    minWidth: 44,
    textAlign: 'center',
    fontWeight: 600,
  },
  fxLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#888',
    flexShrink: 0,
  },
  formulaValue: {
    flex: 1,
    padding: '1px 4px',
    border: '1px solid #d0d0d0',
    backgroundColor: '#fff',
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minHeight: 16,
  },
  gridArea: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  cornerCell: {
    backgroundColor: '#e8e8e8',
    borderRight: '1px solid #a0a0a0',
    borderBottom: '2px solid #a0a0a0',
    padding: '2px 4px',
    textAlign: 'center',
    fontWeight: 600,
    height: 22,
  },
  headerCell: {
    backgroundColor: '#e8e8e8',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '2px solid #a0a0a0',
    padding: '2px 6px',
    textAlign: 'center',
    fontWeight: 600,
    height: 22,
    userSelect: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rowNumber: {
    backgroundColor: '#e8e8e8',
    borderRight: '1px solid #a0a0a0',
    borderBottom: '1px solid #d0d0d0',
    padding: '2px 4px',
    textAlign: 'center',
    color: '#555',
    fontSize: 11,
    width: 40,
    userSelect: 'none',
  },
  cell: {
    borderRight: '1px solid #e0e0e0',
    borderBottom: '1px solid #e0e0e0',
    padding: '2px 6px',
    height: 22,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'cell',
  },
  selectedCell: {
    outline: '2px solid #0078d7',
    outlineOffset: -2,
    backgroundColor: '#e8f0fe',
  },
  emptyMessage: {
    padding: 20,
    textAlign: 'center',
    color: '#888',
  },
  editInput: {
    width: '100%',
    height: '100%',
    border: 'none',
    padding: 0,
    margin: '-2px -6px',
    paddingLeft: 6,
    fontSize: 'inherit',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: '2px solid #0078d7',
    outlineOffset: -2,
    backgroundColor: '#fff',
  },
};
