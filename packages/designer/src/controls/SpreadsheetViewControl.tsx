import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

const DEFAULT_COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PREVIEW_ROWS = 5;

export function SpreadsheetViewControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const showToolbar = (properties.showToolbar as boolean) ?? true;
  const showFormulaBar = (properties.showFormulaBar as boolean) ?? true;
  const showRowNumbers = (properties.showRowNumbers as boolean) ?? true;
  const backColor = (properties.backColor as string) || theme.controls.dataGrid.rowBackground;

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
      {/* Toolbar */}
      {showToolbar && (
        <div style={styles.toolbar}>
          <span style={styles.toolBtn}>+ Row</span>
          <span style={styles.toolBtn}>- Row</span>
          <span style={{ ...styles.toolBtn, marginLeft: 'auto', color: '#888' }}>SpreadsheetView</span>
        </div>
      )}

      {/* Formula Bar */}
      {showFormulaBar && (
        <div style={styles.formulaBar}>
          <span style={styles.cellAddress}>A1</span>
          <span style={styles.fxLabel}>fx</span>
          <div style={styles.formulaInput} />
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {showRowNumbers && <th style={{ ...themedHeaderCell, width: 32 }} />}
              {DEFAULT_COLS.map((col) => (
                <th key={col} style={themedHeaderCell}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: PREVIEW_ROWS }, (_, rowIdx) => (
              <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 1 ? theme.controls.dataGrid.rowAlternateBackground : undefined }}>
                {showRowNumbers && (
                  <td style={{ ...styles.rowNumber, backgroundColor: theme.controls.dataGrid.headerBackground }}>{rowIdx + 1}</td>
                )}
                {DEFAULT_COLS.map((col) => (
                  <td key={col} style={styles.cell} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
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
    color: '#333',
    cursor: 'default',
  },
  formulaBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 6px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #d0d0d0',
    height: 22,
    flexShrink: 0,
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
  formulaInput: {
    flex: 1,
    minHeight: 16,
    border: '1px solid #d0d0d0',
    backgroundColor: '#fff',
    fontSize: 11,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
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
  },
};
