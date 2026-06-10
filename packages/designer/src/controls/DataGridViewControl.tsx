import type { CSSProperties } from 'react';
import {
  type GridColumnDefinition,
  resolveGridColumns,
  dataGridContainerStyle,
  dataGridHeaderCellStyle,
  dataGridCellStyle,
  dataGridEmptyMessageStyle,
} from '@webform/common';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

const DEFAULT_COLUMNS: GridColumnDefinition[] = [
  { field: 'col1', headerText: 'Column1' },
  { field: 'col2', headerText: 'Column2' },
  { field: 'col3', headerText: 'Column3' },
];

export function DataGridViewControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const columns = properties.columns as GridColumnDefinition[] | undefined;
  const dataSource = properties.dataSource as Record<string, unknown>[] | undefined;
  const resolvedColumns = resolveGridColumns(
    columns && columns.length > 0 ? columns : DEFAULT_COLUMNS,
  );

  const containerStyle: CSSProperties = {
    ...(dataGridContainerStyle(theme) as CSSProperties),
    overflow: 'auto',
    backgroundColor:
      (properties.backColor as string) ?? theme.controls.dataGrid.rowBackground,
    width: size.width,
    height: size.height,
  };

  const headerCellStyle = dataGridHeaderCellStyle(theme) as CSSProperties;
  const cellStyle: CSSProperties = {
    ...(dataGridCellStyle(theme) as CSSProperties),
    color: (properties.foreColor as string) ?? theme.controls.dataGrid.rowForeground,
  };

  return (
    <div style={containerStyle}>
      <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {resolvedColumns.map((col, i) => (
              <th key={col.field || i} style={{ ...headerCellStyle, width: col.width }}>
                {col.headerText}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource && dataSource.length > 0 ? (
            dataSource.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{
                  backgroundColor:
                    rowIndex % 2 === 1 ? theme.controls.dataGrid.rowAlternateBackground : undefined,
                }}
              >
                {resolvedColumns.map((col, colIndex) => (
                  <td key={col.field || colIndex} style={{ ...cellStyle, width: col.width }}>
                    {String(row[col.field] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={resolvedColumns.length}>
                <div style={dataGridEmptyMessageStyle as CSSProperties}>데이터가 없습니다.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
