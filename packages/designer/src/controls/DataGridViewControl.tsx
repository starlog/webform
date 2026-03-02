import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface ColumnDefinition {
  field?: string;
  key?: string;
  headerText?: string;
  name?: string;
  width?: number;
}

const styles = {
  container: {
    border: '1px solid #a0a0a0',
    overflow: 'auto',
    backgroundColor: '#ffffff',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
  } as CSSProperties,
  table: {
    minWidth: '100%',
    borderCollapse: 'collapse' as const,
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
  const theme = useTheme();
  const columns = (properties.columns as ColumnDefinition[] | undefined);
  const dataSource = (properties.dataSource as Record<string, unknown>[] | undefined);
  const resolvedColumns = columns && columns.length > 0 ? columns : DEFAULT_COLUMNS;
  const getField = (col: ColumnDefinition) => col.field || col.key || '';
  const getHeader = (col: ColumnDefinition, i: number) => col.headerText || col.name || getField(col) || `Column${i + 1}`;

  const themedContainer: CSSProperties = {
    ...styles.container,
    border: theme.controls.dataGrid.border,
    borderRadius: theme.controls.dataGrid.borderRadius,
    backgroundColor: (properties.backColor as string) ?? theme.controls.dataGrid.rowBackground,
    width: size.width,
    height: size.height,
  };

  const themedHeaderCell: CSSProperties = {
    ...styles.headerCell,
    backgroundColor: theme.controls.dataGrid.headerBackground,
    color: theme.controls.dataGrid.headerForeground,
    borderRight: theme.controls.dataGrid.headerBorder,
    borderBottom: theme.controls.dataGrid.headerBorder,
  };

  const themedCell: CSSProperties = {
    ...styles.cell,
    color: (properties.foreColor as string) ?? theme.controls.dataGrid.rowForeground,
  };

  return (
    <div style={themedContainer}>
      <table style={styles.table}>
        <thead>
          <tr>
            {resolvedColumns.map((col, i) => (
              <th key={getField(col) || i} style={{ ...themedHeaderCell, width: col.width }}>
                {getHeader(col, i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource && dataSource.length > 0 ? (
            dataSource.map((row, rowIndex) => (
              <tr key={rowIndex} style={{ backgroundColor: rowIndex % 2 === 1 ? theme.controls.dataGrid.rowAlternateBackground : undefined }}>
                {resolvedColumns.map((col, colIndex) => {
                  const field = getField(col);
                  return (
                    <td key={field || colIndex} style={{ ...themedCell, width: col.width }}>
                      {String(row[field] ?? '')}
                    </td>
                  );
                })}
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
