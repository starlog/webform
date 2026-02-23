import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';

const DEFAULT_previewCols = ['_id', 'name', 'value', 'status'];
const PREVIEW_ROWS = 4;

export function MongoDBViewControl({ properties, size }: DesignerControlProps) {
  const showToolbar = (properties.showToolbar as boolean) ?? true;
  const collection = (properties.collection as string) || 'collection';
  const title = (properties.title as string) || '';
  const columnsProp = (properties.columns as string) || '';
  const backColor = (properties.backColor as string) || '#ffffff';

  const previewCols = columnsProp
    ? columnsProp.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_previewCols;

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: '1px solid #a0a0a0',
        backgroundColor: backColor,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: 11,
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
                  ...styles.headerCell,
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
                    ...(col === '_id' ? { fontFamily: 'monospace', color: '#999', fontSize: 9 } : {}),
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
    height: 22,
    flexShrink: 0,
    fontSize: 11,
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
    height: 22,
    flexShrink: 0,
  },
  toolBtn: {
    padding: '1px 6px',
    border: '1px solid #c0c0c0',
    backgroundColor: '#fff',
    borderRadius: 2,
    fontSize: 10,
    color: '#333',
    cursor: 'default',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  headerCell: {
    backgroundColor: '#e8e8e8',
    borderRight: '1px solid #d0d0d0',
    borderBottom: '1px solid #a0a0a0',
    padding: '1px 4px',
    textAlign: 'left',
    fontWeight: 600,
    height: 18,
    color: '#333',
    fontSize: 10,
  },
  cell: {
    borderRight: '1px solid #e0e0e0',
    borderBottom: '1px solid #e0e0e0',
    padding: '1px 4px',
    height: 18,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '1px 6px',
    backgroundColor: '#f3f3f3',
    borderTop: '1px solid #d0d0d0',
    height: 18,
    flexShrink: 0,
    fontSize: 10,
    color: '#666',
  },
};
