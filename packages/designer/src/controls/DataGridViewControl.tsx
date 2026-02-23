import type { CSSProperties } from 'react';
import type { DesignerControlProps } from './registry';

interface ColumnDefinition {
  field: string;
  headerText: string;
  /** @deprecated use headerText instead */
  name?: string;
  width?: number;
}

const styles = {
  container: {
    border: '1px solid #a0a0a0',
    overflow: 'hidden',
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
  emptyMessage: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#888',
  } as CSSProperties,
};

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { field: 'col1', headerText: 'Column1' },
  { field: 'col2', headerText: 'Column2' },
  { field: 'col3', headerText: 'Column3' },
];

export function DataGridViewControl({ properties, size }: DesignerControlProps) {
  const columns = (properties.columns as ColumnDefinition[] | undefined);
  const dataSource = (properties.dataSource as Record<string, unknown>[] | undefined);
  const resolvedColumns = columns && columns.length > 0 ? columns : DEFAULT_COLUMNS;

  return (
    <div style={{ ...styles.container, width: size.width, height: size.height }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {resolvedColumns.map((col, i) => (
              <th key={col.field || i} style={{ ...styles.headerCell, width: col.width }}>
                {col.headerText || col.name || col.field || `Column${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource && dataSource.length > 0 ? (
            dataSource.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {resolvedColumns.map((col) => (
                  <td key={col.field} style={{ ...styles.cell, width: col.width }}>
                    {String(row[col.field] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={resolvedColumns.length}>
                <div style={styles.emptyMessage}>데이터가 없습니다.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
