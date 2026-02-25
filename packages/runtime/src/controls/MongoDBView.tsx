import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CSSProperties } from 'react';
import type { FontDefinition } from '@webform/common';
import { apiClient } from '../communication/apiClient';
import { computeFontStyle } from '../renderer/layoutUtils';
import { useControlColors } from '../theme/useControlColors';

interface MongoDBViewProps {
  id: string;
  name: string;
  title?: string;
  columns?: string;
  connectionString?: string;
  database?: string;
  collection?: string;
  filter?: string;
  pageSize?: number;
  readOnly?: boolean;
  showToolbar?: boolean;
  font?: FontDefinition;
  foreColor?: string;
  backColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onDataLoaded?: () => void;
  onSelectionChanged?: (rowIndex: number) => void;
  onCellValueChanged?: (rowIndex: number, field: string, value: unknown) => void;
  onDocumentInserted?: (id: string) => void;
  onDocumentUpdated?: (id: string) => void;
  onDocumentDeleted?: (id: string) => void;
  onError?: (message: string) => void;
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

const FILTERED_KEYS = ['__v'];

export function MongoDBView({
  id,
  title,
  columns: columnsProp,
  connectionString = '',
  database = '',
  collection = '',
  filter = '{}',
  pageSize = 50,
  readOnly = false,
  showToolbar = true,
  font,
  foreColor,
  backColor,
  style,
  enabled = true,
  onDataLoaded,
  onSelectionChanged,
  onCellValueChanged,
  onDocumentInserted,
  onDocumentUpdated,
  onDocumentDeleted,
  onError,
}: MongoDBViewProps) {
  const controlColors = useControlColors('MongoDBView', { backColor, foreColor });
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [detailDoc, setDetailDoc] = useState<Record<string, unknown> | null>(null);
  const [detailJson, setDetailJson] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [autoFitMaxWidth, setAutoFitMaxWidth] = useState(300);
  const editInputRef = useRef<HTMLInputElement>(null);
  const measureCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const isConfigured = connectionString && database && collection;

  // 데이터 로드
  const loadData = useCallback(async (page: number) => {
    if (!isConfigured) return;
    setLoading(true);
    setError(null);
    try {
      let parsedFilter: Record<string, unknown> = {};
      try {
        parsedFilter = JSON.parse(filter);
      } catch {
        // invalid filter JSON, use empty
      }
      const skip = page * pageSize;
      const result = await apiClient.mongoQuery(connectionString, database, collection, parsedFilter, skip, pageSize);
      setDocuments(result.data as Record<string, unknown>[]);
      setTotalCount(result.totalCount);
      setCurrentPage(page);
      setModifiedRows(new Set());
      setSelectedRowIndex(-1);
      setEditingCell(null);
      onDataLoaded?.();
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [connectionString, database, collection, filter, pageSize, isConfigured, onDataLoaded, onError]);

  // 마운트 시 + 설정 변경 시 자동 로드 (첫 페이지)
  useEffect(() => {
    loadData(0);
  }, [loadData]);

  // 컬럼 자동 생성 + columns 속성으로 필터링
  const includeColumns = useMemo(
    () => {
      if (!columnsProp) return [];
      if (Array.isArray(columnsProp)) {
        return (columnsProp as unknown[]).map((c) =>
          typeof c === 'object' && c !== null
            ? String((c as Record<string, unknown>).header ?? (c as Record<string, unknown>).field ?? '')
            : String(c)
        ).filter(Boolean);
      }
      return String(columnsProp).split(',').map((s) => s.trim()).filter(Boolean);
    },
    [columnsProp],
  );

  const columns = useMemo(() => {
    if (documents.length === 0) return [];
    const keys = Object.keys(documents[0]).filter((k) => !FILTERED_KEYS.includes(k));
    if (includeColumns.length === 0) return keys;
    return includeColumns.filter((c) => keys.includes(c));
  }, [documents, includeColumns]);

  // 정렬된 데이터
  const sortedDocs = useMemo(() => {
    if (!sortConfig) return documents;
    const { field, direction } = sortConfig;
    return [...documents].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return direction === 'asc' ? -1 : 1;
      if (bVal == null) return direction === 'asc' ? 1 : -1;
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [documents, sortConfig]);

  // Canvas 텍스트 측정
  const measureTextWidth = useCallback((text: string, font: string): number => {
    if (!measureCtxRef.current) {
      measureCtxRef.current = document.createElement('canvas').getContext('2d');
    }
    const ctx = measureCtxRef.current;
    if (!ctx) return text.length * 7;
    ctx.font = font;
    return Math.ceil(ctx.measureText(text).width);
  }, []);

  // 단일 컬럼 자동 맞춤
  const autoFitColumn = useCallback((col: string, maxWidth?: number) => {
    const headerFont = 'bold 11px Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    const cellFont = col === '_id'
      ? '10px monospace'
      : '12px Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    let max = measureTextWidth(col, headerFont) + 24;
    for (const doc of sortedDocs) {
      const val = doc[col];
      const text = val != null && typeof val === 'object'
        ? JSON.stringify(val) : String(val ?? '');
      const w = measureTextWidth(text, cellFont) + 16;
      if (w > max) max = w;
    }
    const cap = maxWidth ?? autoFitMaxWidth;
    setColumnWidths(prev => ({ ...prev, [col]: Math.min(Math.max(max, 40), cap) }));
  }, [sortedDocs, measureTextWidth, autoFitMaxWidth]);

  // 전체 컬럼 자동 맞춤
  const autoFitAllColumns = useCallback(() => {
    const headerFont = 'bold 11px Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    const newWidths: Record<string, number> = {};
    for (const col of columns) {
      const cellFont = col === '_id'
        ? '10px monospace'
        : '12px Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
      let max = measureTextWidth(col, headerFont) + 24;
      for (const doc of sortedDocs) {
        const val = doc[col];
        const text = val != null && typeof val === 'object'
          ? JSON.stringify(val) : String(val ?? '');
        const w = measureTextWidth(text, cellFont) + 16;
        if (w > max) max = w;
      }
      newWidths[col] = Math.min(Math.max(max, 40), autoFitMaxWidth);
    }
    setColumnWidths(newWidths);
  }, [columns, sortedDocs, measureTextWidth, autoFitMaxWidth]);

  // 컬럼 리사이즈 드래그
  const handleColResizeStart = useCallback((col: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + e.clientX - startX);
      setColumnWidths(prev => ({ ...prev, [col]: newWidth }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // 정렬 토글
  const handleSort = useCallback((field: string) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        if (prev.direction === 'asc') return { field, direction: 'desc' };
        return null;
      }
      return { field, direction: 'asc' };
    });
  }, []);

  // 행 선택
  const handleRowClick = useCallback(
    (rowIndex: number) => {
      setSelectedRowIndex(rowIndex);
      onSelectionChanged?.(rowIndex);
    },
    [onSelectionChanged],
  );

  // View 버튼 → 다이얼로그 열기
  const handleViewClick = useCallback(
    (doc: Record<string, unknown>) => {
      setDetailDoc(doc);
      setDetailJson(JSON.stringify(doc, null, 2));
      setDetailError('');
    },
    [],
  );

  // 다이얼로그 저장
  const handleDetailSave = useCallback(async () => {
    if (!detailDoc || !isConfigured) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(detailJson);
    } catch {
      setDetailError('Invalid JSON');
      return;
    }
    setDetailSaving(true);
    setDetailError('');
    try {
      const docId = String(detailDoc._id);
      const fields = Object.fromEntries(
        Object.entries(parsed).filter(([k]) => k !== '_id' && k !== '__v'),
      );
      await apiClient.mongoUpdate(connectionString, database, collection, { _id: docId }, fields);
      onDocumentUpdated?.(docId);
      setDetailDoc(null);
      await loadData(currentPage);
    } catch (err) {
      setDetailError((err as Error).message);
    } finally {
      setDetailSaving(false);
    }
  }, [detailDoc, detailJson, isConfigured, connectionString, database, collection, onDocumentUpdated, loadData, currentPage]);

  // 다이얼로그 닫기
  const handleDetailClose = useCallback(() => {
    setDetailDoc(null);
    setDetailJson('');
    setDetailError('');
  }, []);

  // 셀 더블클릭 → 편집
  const handleCellDoubleClick = useCallback(
    (rowIndex: number, field: string) => {
      if (!enabled || readOnly || field === '_id') return;
      setEditingCell({ rowIndex, field });
    },
    [enabled, readOnly],
  );

  // 편집 포커스
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
      const originalRow = sortedDocs[rowIndex];
      const originalIndex = documents.indexOf(originalRow);
      if (originalIndex >= 0) {
        const updated = [...documents];
        updated[originalIndex] = { ...updated[originalIndex], [field]: value };
        setDocuments(updated);
        setModifiedRows((prev) => new Set(prev).add(originalIndex));
        onCellValueChanged?.(rowIndex, field, value);
      }
      setEditingCell(null);
    },
    [editingCell, sortedDocs, documents, onCellValueChanged],
  );

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

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

  // 새 문서 추가
  const handleInsert = useCallback(async () => {
    if (!isConfigured || readOnly) return;
    setLoading(true);
    try {
      const result = await apiClient.mongoInsert(connectionString, database, collection, {});
      onDocumentInserted?.(result.insertedId);
      await loadData(currentPage);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, readOnly, connectionString, database, collection, onDocumentInserted, loadData, currentPage, onError]);

  // 선택된 문서 삭제
  const handleDelete = useCallback(async () => {
    if (!isConfigured || readOnly || selectedRowIndex < 0) return;
    const doc = sortedDocs[selectedRowIndex];
    if (!doc?._id) return;
    setLoading(true);
    try {
      await apiClient.mongoDelete(connectionString, database, collection, {
        _id: String(doc._id),
      });
      onDocumentDeleted?.(String(doc._id));
      await loadData(currentPage);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, readOnly, selectedRowIndex, sortedDocs, connectionString, database, collection, onDocumentDeleted, loadData, currentPage, onError]);

  // 변경된 행 저장
  const handleSave = useCallback(async () => {
    if (!isConfigured || readOnly || modifiedRows.size === 0) return;
    setLoading(true);
    try {
      for (const idx of modifiedRows) {
        const doc = documents[idx];
        if (!doc?._id) continue;
        const docId = String(doc._id);
        const fields = Object.fromEntries(
          Object.entries(doc).filter(([k]) => k !== '_id' && k !== '__v'),
        );
        await apiClient.mongoUpdate(connectionString, database, collection, { _id: docId }, fields);
        onDocumentUpdated?.(docId);
      }
      await loadData(currentPage);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, readOnly, modifiedRows, documents, connectionString, database, collection, onDocumentUpdated, loadData, currentPage, onError]);

  const fontStyle = font ? computeFontStyle(font) : {};

  const containerStyle: CSSProperties = {
    ...sty.container,
    ...fontStyle,
    background: controlColors.background,
    color: controlColors.color,
    ...style,
  };

  // 미설정 상태
  if (!isConfigured) {
    return (
      <div className="wf-mongodbview" data-control-id={id} style={containerStyle}>
        <div style={sty.emptyMessage}>
          ConnectionString, Database, Collection을 설정하세요.
        </div>
      </div>
    );
  }

  return (
    <div className="wf-mongodbview" data-control-id={id} style={containerStyle}>
      {/* Header */}
      <div style={sty.header}>
        <span>{'\u25A7'} {title || `MongoDB: ${collection}`}</span>
      </div>

      {/* Toolbar */}
      {showToolbar && (
        <div style={sty.toolbar}>
          <button style={sty.toolBtn} onClick={() => loadData(currentPage)} disabled={loading}>
            Refresh
          </button>
          {!readOnly && (
            <>
              <button style={sty.toolBtn} onClick={handleInsert} disabled={loading}>
                + Add
              </button>
              <button
                style={sty.toolBtn}
                onClick={handleDelete}
                disabled={loading || selectedRowIndex < 0}
              >
                - Delete
              </button>
              <button
                style={sty.toolBtn}
                onClick={handleSave}
                disabled={loading || modifiedRows.size === 0}
              >
                Save ({modifiedRows.size})
              </button>
            </>
          )}
          {columns.length > 0 && (
            <>
              <span style={sty.toolbarSep} />
              <button style={sty.toolBtn} onClick={autoFitAllColumns}>
                Auto Fit
              </button>
              <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 2 }}>
                Max:
                <input
                  type="number"
                  value={autoFitMaxWidth}
                  onChange={(e) => setAutoFitMaxWidth(Math.max(40, Number(e.target.value) || 300))}
                  style={{ width: 50, fontSize: 11, border: '1px solid #c0c0c0', padding: '1px 3px' }}
                  min={40}
                />
                px
              </label>
            </>
          )}
        </div>
      )}

      {/* Error bar */}
      {error && (
        <div style={sty.errorBar}>{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={sty.loadingBar}>Loading...</div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {documents.length === 0 && !loading ? (
          <div style={sty.emptyMessage}>No documents</div>
        ) : (
          <table style={{
            ...sty.table,
            ...(columns.length > 0 && columns.every(c => columnWidths[c])
              ? { width: `max(${columns.reduce((s, c) => s + columnWidths[c], 0) + 40}px, 100%)` }
              : {}),
          }}>
            <thead>
              <tr>
                <th style={{ ...sty.headerCell, width: 40, cursor: 'default' }} />
                {columns.map((col) => (
                  <th
                    key={col}
                    style={{
                      ...sty.headerCell,
                      position: 'relative' as const,
                      ...(columnWidths[col] ? { width: columnWidths[col] } : {}),
                      ...(col === '_id' ? { fontFamily: 'monospace', color: '#888' } : {}),
                    }}
                    onClick={() => handleSort(col)}
                  >
                    {col}
                    {sortConfig?.field === col && (
                      <span style={{ marginLeft: 4 }}>
                        {sortConfig.direction === 'asc' ? '\u25B2' : '\u25BC'}
                      </span>
                    )}
                    <div
                      style={sty.colResizeHandle}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => { e.stopPropagation(); autoFitColumn(col); }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const th = e.currentTarget.parentElement as HTMLElement;
                        handleColResizeStart(col, e.clientX, th.offsetWidth);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDocs.map((doc, rowIndex) => {
                const isSelected = rowIndex === selectedRowIndex;
                const originalIndex = documents.indexOf(doc);
                const isModified = modifiedRows.has(originalIndex);
                return (
                  <tr
                    key={rowIndex}
                    onClick={() => handleRowClick(rowIndex)}
                    style={isSelected ? sty.selectedRow : isModified ? sty.modifiedRow : undefined}
                  >
                    <td style={{ ...sty.cell, width: 40, textAlign: 'center' as const, padding: '1px 2px' }}>
                      <button
                        style={sty.viewBtn}
                        onClick={(e) => { e.stopPropagation(); handleViewClick(doc); }}
                      >
                        View
                      </button>
                    </td>
                    {columns.map((col) => {
                      const isEditing =
                        editingCell?.rowIndex === rowIndex && editingCell?.field === col;
                      const cellValue = doc[col];
                      const isIdCol = col === '_id';
                      const displayValue =
                        cellValue != null && typeof cellValue === 'object'
                          ? JSON.stringify(cellValue)
                          : String(cellValue ?? '');

                      return (
                        <td
                          key={col}
                          style={{
                            ...sty.cell,
                            ...(isSelected ? sty.selectedRow : {}),
                            ...(isIdCol
                              ? { fontFamily: 'monospace', color: '#999', fontSize: 10 }
                              : {}),
                          }}
                          onDoubleClick={() => handleCellDoubleClick(rowIndex, col)}
                        >
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              style={sty.editInput}
                              defaultValue={displayValue}
                              onKeyDown={handleEditKeyDown}
                              onBlur={(e) => commitEdit(e.target.value)}
                            />
                          ) : (
                            displayValue
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div style={sty.statusBar}>
        <span style={{ flex: 1 }}>
          {collection} | {totalCount} documents
          {modifiedRows.size > 0 && ` | ${modifiedRows.size} modified`}
        </span>
        {totalCount > pageSize && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              style={sty.pageBtn}
              disabled={currentPage <= 0 || loading}
              onClick={() => loadData(currentPage - 1)}
            >
              &lt; Prev
            </button>
            <span style={{ fontSize: 11 }}>
              {currentPage + 1} / {Math.ceil(totalCount / pageSize)}
            </span>
            <button
              style={sty.pageBtn}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) - 1 || loading}
              onClick={() => loadData(currentPage + 1)}
            >
              Next &gt;
            </button>
          </span>
        )}
      </div>

      {/* Document Detail Dialog */}
      {detailDoc && (
        <div style={sty.dialogOverlay} onClick={handleDetailClose}>
          <div style={sty.dialogBox} onClick={(e) => e.stopPropagation()}>
            <div style={sty.dialogHeader}>
              <span style={{ fontWeight: 600 }}>Document Detail</span>
              <button style={sty.dialogCloseBtn} onClick={handleDetailClose}>&times;</button>
            </div>
            <div style={sty.dialogBody}>
              <textarea
                style={sty.dialogTextarea}
                value={detailJson}
                onChange={(e) => setDetailJson(e.target.value)}
                readOnly={readOnly}
                spellCheck={false}
              />
              {detailError && <div style={sty.dialogError}>{detailError}</div>}
            </div>
            <div style={sty.dialogFooter}>
              {readOnly ? (
                <button style={sty.toolBtn} onClick={handleDetailClose}>Close</button>
              ) : (
                <>
                  <button style={sty.toolBtn} onClick={handleDetailSave} disabled={detailSaving}>
                    {detailSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button style={sty.toolBtn} onClick={handleDetailClose}>Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const sty: Record<string, CSSProperties> = {
  container: {
    border: '1px solid #a0a0a0',
    overflow: 'hidden',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    backgroundColor: '#4a7c4f',
    color: '#fff',
    height: 24,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 600,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 4px',
    backgroundColor: '#f3f3f3',
    borderBottom: '1px solid #d0d0d0',
    height: 26,
    flexShrink: 0,
  },
  toolBtn: {
    padding: '2px 8px',
    border: '1px solid #c0c0c0',
    backgroundColor: '#fff',
    borderRadius: 2,
    fontSize: 11,
    color: '#333',
    cursor: 'pointer',
  },
  errorBar: {
    padding: '4px 8px',
    backgroundColor: '#fdd',
    color: '#c00',
    borderBottom: '1px solid #faa',
    fontSize: 11,
    flexShrink: 0,
  },
  loadingBar: {
    padding: '4px 8px',
    backgroundColor: '#eef',
    color: '#339',
    borderBottom: '1px solid #aaf',
    fontSize: 11,
    flexShrink: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
  },
  headerCell: {
    backgroundColor: '#e0e0e0',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '2px solid #a0a0a0',
    padding: '3px 6px',
    textAlign: 'left' as const,
    fontWeight: 600,
    height: 22,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 11,
  },
  cell: {
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #d0d0d0',
    padding: '2px 6px',
    height: 22,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  selectedRow: {
    backgroundColor: '#0078d7',
    color: '#ffffff',
  },
  modifiedRow: {
    backgroundColor: '#fffde7',
  },
  emptyMessage: {
    padding: 20,
    textAlign: 'center' as const,
    color: '#888',
  },
  editInput: {
    width: '100%',
    height: '100%',
    border: '1px solid #0078d7',
    padding: '1px 4px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 8px',
    backgroundColor: '#f3f3f3',
    borderTop: '1px solid #d0d0d0',
    height: 24,
    flexShrink: 0,
    fontSize: 11,
    color: '#666',
  },
  pageBtn: {
    padding: '1px 6px',
    border: '1px solid #c0c0c0',
    backgroundColor: '#fff',
    borderRadius: 2,
    fontSize: 10,
    color: '#333',
    cursor: 'pointer',
  },
  toolbarSep: {
    display: 'inline-block',
    width: 1,
    height: 16,
    backgroundColor: '#c0c0c0',
    margin: '0 4px',
    flexShrink: 0,
  },
  colResizeHandle: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 5,
    cursor: 'col-resize',
    backgroundColor: 'transparent',
  },
  viewBtn: {
    padding: '0 5px',
    border: '1px solid #b0b0b0',
    backgroundColor: '#f5f5f5',
    borderRadius: 2,
    fontSize: 10,
    color: '#333',
    cursor: 'pointer',
    lineHeight: '18px',
  },
  dialogOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  dialogBox: {
    backgroundColor: '#fff',
    borderRadius: 6,
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
    width: 560,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  dialogHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#4a7c4f',
    color: '#fff',
    fontSize: 13,
  },
  dialogCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0 4px',
  },
  dialogBody: {
    flex: 1,
    padding: 12,
    overflow: 'auto',
  },
  dialogTextarea: {
    width: '100%',
    minHeight: 300,
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: 12,
    border: '1px solid #ccc',
    borderRadius: 3,
    padding: 8,
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
    outline: 'none',
    lineHeight: 1.5,
  },
  dialogError: {
    marginTop: 8,
    padding: '4px 8px',
    backgroundColor: '#fdd',
    color: '#c00',
    borderRadius: 3,
    fontSize: 11,
  },
  dialogFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid #e0e0e0',
  },
};
