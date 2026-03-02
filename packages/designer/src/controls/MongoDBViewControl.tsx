import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

const DEFAULT_previewCols = ['_id', 'name', 'value', 'status'];
const PREVIEW_ROWS = 4;

export function MongoDBViewControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const showToolbar = (properties.showToolbar as boolean) ?? true;
  const collection = (properties.collection as string) || 'collection';
  const title = (properties.title as string) || '';
  const columnsProp = properties.columns;
  const backColor = (properties.backColor as string) || theme.controls.dataGrid.rowBackground;

  const previewCols = columnsProp
    ? Array.isArray(columnsProp)
      ? (columnsProp as unknown[]).map((c) =>
          typeof c === 'object' && c !== null
            ? (c as Record<string, unknown>).header ?? (c as Record<string, unknown>).field ?? ''
            : String(c)
        ).filter(Boolean) as string[]
      : String(columnsProp).split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_previewCols;

  const themedHeaderCell: CSSProperties = {
    ...styles.headerCell,
    backgroundColor: theme.controls.dataGrid.headerBackground,
    color: theme.controls.dataGrid.headerForeground,
    borderBottom: theme.controls.dataGrid.border,
  };

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: theme.controls.dataGrid.border,
        borderRadius: theme.controls.dataGrid.borderRadius,
        backgroundColor: backColor,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.mongoIcon}>{'\u25A7'}</span>
        <span style={styles.headerText}>{title || `MongoDB: ${collection}`}</span>
      </div>

      {/* Toolbar */}
      {showToolbar && (
        <div style={styles.toolbar}>
          <span style={styles.toolBtn}>Refresh</span>
          <span style={styles.toolBtn}>+ Add</span>
          <span style={styles.toolBtn}>- Delete</span>
          <span style={styles.toolBtn}>Save</span>
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {previewCols.map((col) => (
                <th key={col} style={{
                  ...themedHeaderCell,
                  ...(col === '_id' ? { fontFamily: 'monospace', color: '#888' } : {}),
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PREVIEW_ROWS }, (_, rowIdx) => (
              <tr key={rowIdx}>
                {previewCols.map((col) => (
                  <td key={col} style={{
                    ...styles.cell,
                    ...(col === '_id' ? { fontFamily: 'monospace', color: '#999', fontSize: 10 } : {}),
                  }}>
                    {col === '_id' ? '64a...' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span>{collection} | 0 documents</span>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
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
  mongoIcon: {
    fontSize: 13,
  },
  headerText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
    cursor: 'default',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  headerCell: {
    backgroundColor: '#e0e0e0',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '2px solid #a0a0a0',
    padding: '3px 6px',
    textAlign: 'left',
    fontWeight: 600,
    height: 22,
    userSelect: 'none',
    whiteSpace: 'nowrap',
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
    whiteSpace: 'nowrap',
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
};
