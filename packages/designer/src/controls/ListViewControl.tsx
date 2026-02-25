import { useTheme } from '../theme/ThemeContext';
import type { DesignerControlProps } from './registry';

interface ListViewItem {
  text: string;
  subItems?: string[];
}

interface ListViewColumn {
  text: string;
  width?: number;
}

type ViewMode = 'LargeIcon' | 'SmallIcon' | 'List' | 'Details' | 'Tile';

const SAMPLE_COLUMNS: ListViewColumn[] = [
  { text: 'Name', width: 120 },
  { text: 'Type', width: 80 },
  { text: 'Size', width: 60 },
];

const SAMPLE_ITEMS: ListViewItem[] = [
  { text: 'Document.txt', subItems: ['Text', '12 KB'] },
  { text: 'Image.png', subItems: ['Image', '256 KB'] },
  { text: 'Data.xlsx', subItems: ['Spreadsheet', '48 KB'] },
];

function IconPlaceholder({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: '#D0D0D0',
        borderRadius: 2,
        flexShrink: 0,
      }}
    />
  );
}

export function ListViewControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const items = (properties.items as ListViewItem[]) ?? [];
  const columns = (properties.columns as ListViewColumn[]) ?? [];
  const view = (properties.view as ViewMode) ?? 'Details';
  const backColor = (properties.backColor as string) ?? theme.controls.select.background;
  const foreColor = (properties.foreColor as string) ?? theme.controls.select.foreground;
  const gridLines = (properties.gridLines as boolean) ?? false;

  const displayItems = items.length > 0 ? items : SAMPLE_ITEMS;
  const displayColumns = columns.length > 0 ? columns : SAMPLE_COLUMNS;

  const containerStyle = {
    width: size.width,
    height: size.height,
    backgroundColor: backColor,
    color: foreColor,
    border: `1px solid ${theme.controls.select.border}`,
    borderRadius: theme.controls.select.borderRadius,
    overflow: 'auto',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  };

  // Details view
  if (view === 'Details') {
    return (
      <div style={containerStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {displayColumns.map((col, ci) => (
                <th
                  key={ci}
                  style={{
                    backgroundColor: theme.controls.dataGrid.headerBackground,
                    color: theme.controls.dataGrid.headerForeground,
                    borderRight: `1px solid ${theme.controls.dataGrid.headerBorder}`,
                    borderBottom: `2px solid ${theme.controls.dataGrid.border}`,
                    padding: '3px 6px',
                    textAlign: 'left',
                    fontWeight: 600,
                    height: 22,
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: col.width,
                  }}
                >
                  {col.text}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item, ri) => (
              <tr key={ri}>
                {displayColumns.map((col, ci) => {
                  const cellText = ci === 0 ? item.text : item.subItems?.[ci - 1] ?? '';
                  return (
                    <td
                      key={ci}
                      style={{
                        borderRight: gridLines ? '1px solid #D0D0D0' : undefined,
                        borderBottom: gridLines ? '1px solid #D0D0D0' : undefined,
                        padding: '2px 6px',
                        height: 20,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: col.width,
                      }}
                    >
                      {cellText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // LargeIcon view
  if (view === 'LargeIcon') {
    return (
      <div style={{ ...containerStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 4 }}>
        {displayItems.map((item, i) => (
          <div key={i} style={{ width: 72, padding: 4, textAlign: 'center' }}>
            <IconPlaceholder size={32} />
            <div style={{ marginTop: 4, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.text}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // SmallIcon view
  if (view === 'SmallIcon') {
    return (
      <div style={{ ...containerStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 2 }}>
        {displayItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}>
            <IconPlaceholder size={16} />
            <span style={{ whiteSpace: 'nowrap' }}>{item.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // List view
  if (view === 'List') {
    return (
      <div style={{ ...containerStyle, padding: 2 }}>
        {displayItems.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 6px', height: 20 }}>
            <IconPlaceholder size={16} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.text}</span>
          </div>
        ))}
      </div>
    );
  }

  // Tile view
  return (
    <div style={{ ...containerStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 4 }}>
      {displayItems.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, width: 200, padding: 6 }}>
          <IconPlaceholder size={32} />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.text}
            </div>
            {item.subItems?.slice(0, 2).map((sub, si) => (
              <div key={si} style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sub}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
