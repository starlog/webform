import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface ListViewItem {
  text: string;
  subItems?: string[];
  imageIndex?: number;
}

interface ListViewColumn {
  text: string;
  width?: number;
}

type ViewMode = 'LargeIcon' | 'SmallIcon' | 'List' | 'Details' | 'Tile';

interface ListViewProps {
  id: string;
  name: string;
  items?: ListViewItem[];
  columns?: ListViewColumn[];
  view?: ViewMode;
  selectedIndex?: number;
  multiSelect?: boolean;
  fullRowSelect?: boolean;
  gridLines?: boolean;
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  onSelectedIndexChanged?: () => void;
  onItemActivate?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

// baseStyle is now computed inside the component via useTheme

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

export function ListView({
  id,
  items = [],
  columns = [],
  view = 'Details',
  selectedIndex = -1,
  multiSelect = false,
  fullRowSelect = true,
  gridLines = false,
  style,
  enabled = true,
  backColor,
  foreColor,
  onSelectedIndexChanged,
  onItemActivate,
}: ListViewProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const controlStates = useRuntimeStore((s) => s.controlStates);
  const theme = useTheme();
  const colors = useControlColors('ListView', { backColor, foreColor });

  const baseStyle: CSSProperties = {
    backgroundColor: theme.controls.select.background,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    overflow: 'auto',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
    boxSizing: 'border-box',
  };
  const selectedIndices: number[] = (controlStates[id]?.selectedIndices as number[]) ?? (selectedIndex >= 0 ? [selectedIndex] : []);

  const handleSelect = useCallback(
    (index: number, e?: React.MouseEvent) => {
      if (!enabled) return;
      if (multiSelect && e) {
        let newIndices: number[];
        if (e.ctrlKey || e.metaKey) {
          // Toggle selection
          if (selectedIndices.includes(index)) {
            newIndices = selectedIndices.filter((i) => i !== index);
          } else {
            newIndices = [...selectedIndices, index];
          }
        } else if (e.shiftKey && selectedIndices.length > 0) {
          // Range selection
          const anchor = selectedIndices[selectedIndices.length - 1];
          const start = Math.min(anchor, index);
          const end = Math.max(anchor, index);
          const range: number[] = [];
          for (let i = start; i <= end; i++) range.push(i);
          newIndices = range;
        } else {
          newIndices = [index];
        }
        updateControlState(id, 'selectedIndices', newIndices);
        updateControlState(id, 'selectedIndex', newIndices.length > 0 ? newIndices[newIndices.length - 1] : -1);
      } else {
        updateControlState(id, 'selectedIndex', index);
        updateControlState(id, 'selectedIndices', [index]);
      }
      onSelectedIndexChanged?.();
    },
    [id, enabled, multiSelect, selectedIndices, updateControlState, onSelectedIndexChanged],
  );

  const handleDoubleClick = useCallback(
    (index: number) => {
      if (!enabled) return;
      updateControlState(id, 'selectedIndex', index);
      onItemActivate?.();
    },
    [id, enabled, updateControlState, onItemActivate],
  );

  const isItemSelected = useCallback(
    (index: number): boolean => {
      if (multiSelect) {
        return selectedIndices.includes(index);
      }
      return index === selectedIndex;
    },
    [multiSelect, selectedIndices, selectedIndex],
  );

  const mergedStyle: CSSProperties = {
    ...baseStyle,
    backgroundColor: colors.backgroundColor,
    color: colors.color,
    ...style,
    opacity: enabled ? 1 : 0.6,
  };

  const selectedStyle: CSSProperties = {
    backgroundColor: theme.controls.select.selectedBackground,
    color: theme.controls.select.selectedForeground,
  };

  if (items.length === 0) {
    return (
      <div className="wf-listview" data-control-id={id} style={mergedStyle}>
        <div style={{ padding: '8px', color: '#999', textAlign: 'center' }}>(항목 없음)</div>
      </div>
    );
  }

  // Details view — table layout
  if (view === 'Details') {
    return (
      <div className="wf-listview" data-control-id={id} style={mergedStyle}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          {columns.length > 0 && (
            <thead>
              <tr>
                {columns.map((col, ci) => (
                  <th
                    key={ci}
                    style={{
                      backgroundColor: theme.controls.dataGrid.headerBackground,
                      color: theme.controls.dataGrid.headerForeground,
                      borderRight: theme.controls.dataGrid.headerBorder,
                      borderBottom: theme.controls.dataGrid.headerBorder,
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
          )}
          <tbody>
            {items.map((item, ri) => {
              const isSelected = isItemSelected(ri);
              return (
                <tr
                  key={ri}
                  style={{
                    cursor: enabled ? 'pointer' : 'default',
                    ...(isSelected && fullRowSelect ? selectedStyle : {}),
                  }}
                  onClick={(e) => handleSelect(ri, e)}
                  onDoubleClick={() => handleDoubleClick(ri)}
                >
                  {columns.length > 0 ? (
                    columns.map((col, ci) => {
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
                            ...(isSelected && !fullRowSelect && ci === 0 ? selectedStyle : {}),
                          }}
                        >
                          {cellText}
                        </td>
                      );
                    })
                  ) : (
                    <td
                      style={{
                        padding: '2px 6px',
                        height: 20,
                        ...(isSelected ? selectedStyle : {}),
                      }}
                    >
                      {item.text}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // LargeIcon view
  if (view === 'LargeIcon') {
    return (
      <div
        className="wf-listview"
        data-control-id={id}
        style={{ ...mergedStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 4 }}
      >
        {items.map((item, i) => {
          const isSelected = isItemSelected(i);
          return (
            <div
              key={i}
              style={{
                width: 72,
                padding: 4,
                textAlign: 'center',
                cursor: enabled ? 'pointer' : 'default',
                borderRadius: 2,
                ...(isSelected ? selectedStyle : {}),
              }}
              onClick={(e) => handleSelect(i, e)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              <IconPlaceholder size={32} />
              <div
                style={{
                  marginTop: 4,
                  fontSize: '11px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.text}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // SmallIcon view
  if (view === 'SmallIcon') {
    return (
      <div
        className="wf-listview"
        data-control-id={id}
        style={{ ...mergedStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 2 }}
      >
        {items.map((item, i) => {
          const isSelected = isItemSelected(i);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                cursor: enabled ? 'pointer' : 'default',
                borderRadius: 2,
                ...(isSelected ? selectedStyle : {}),
              }}
              onClick={(e) => handleSelect(i, e)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              <IconPlaceholder size={16} />
              <span style={{ whiteSpace: 'nowrap' }}>{item.text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // List view
  if (view === 'List') {
    return (
      <div
        className="wf-listview"
        data-control-id={id}
        style={{ ...mergedStyle, padding: 2 }}
      >
        {items.map((item, i) => {
          const isSelected = isItemSelected(i);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 6px',
                height: 20,
                cursor: enabled ? 'pointer' : 'default',
                ...(isSelected ? selectedStyle : {}),
              }}
              onClick={(e) => handleSelect(i, e)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              <IconPlaceholder size={16} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.text}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Tile view
  return (
    <div
      className="wf-listview"
      data-control-id={id}
      style={{ ...mergedStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 4 }}
    >
      {items.map((item, i) => {
        const isSelected = isItemSelected(i);
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              width: 200,
              padding: 6,
              cursor: enabled ? 'pointer' : 'default',
              borderRadius: 2,
              ...(isSelected ? selectedStyle : {}),
            }}
            onClick={(e) => handleSelect(i, e)}
            onDoubleClick={() => handleDoubleClick(i)}
          >
            <IconPlaceholder size={32} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.text}
              </div>
              {item.subItems?.slice(0, 2).map((sub, si) => (
                <div
                  key={si}
                  style={{
                    fontSize: '11px',
                    color: isSelected ? '#DDDDDD' : '#888',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {sub}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
