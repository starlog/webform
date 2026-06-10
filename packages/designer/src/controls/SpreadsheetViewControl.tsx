import type { CSSProperties } from 'react';
import { spreadsheetBaseStyles } from '@webform/common';
import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

const BASE = spreadsheetBaseStyles as Record<string, CSSProperties>;

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
  toolbar: BASE.toolbar,
  toolBtn: { ...BASE.toolBtn, color: '#333', cursor: 'default' },
  formulaBar: BASE.formulaBar,
  cellAddress: BASE.cellAddress,
  fxLabel: BASE.fxLabel,
  formulaInput: { ...BASE.formulaValue, minHeight: 16 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
  },
  headerCell: BASE.headerCell,
  rowNumber: BASE.rowNumber,
  cell: BASE.cell,
};
