import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

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

const baseStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px inset #D0D0D0',
  overflow: 'auto',
  fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  fontSize: '12px',
  boxSizing: 'border-box',
};

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

  const handleSelect = useCallback(
    (index: number) => {
      if (!enabled) return;
      updateControlState(id, 'selectedIndex', index);
      onSelectedIndexChanged?.();
    },
    [id, enabled, updateControlState, onSelectedIndexChanged],
  );

  const handleDoubleClick = useCallback(
    (index: number) => {
      if (!enabled) return;
      updateControlState(id, 'selectedIndex', index);
      onItemActivate?.();
    },
    [id, enabled, updateControlState, onItemActivate],
  );

  const mergedStyle: CSSProperties = {
    ...baseStyle,
    ...(backColor ? { backgroundColor: backColor } : {}),
    ...(foreColor ? { color: foreColor } : {}),
    ...style,
    opacity: enabled ? 1 : 0.6,
  };

  const selectedStyle: CSSProperties = {
    backgroundColor: '#0078D7',
    color: '#FFFFFF',
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
                      backgroundColor: '#E0E0E0',
                      borderRight: '1px solid #D0D0D0',
                      borderBottom: '2px solid #A0A0A0',
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
              const isSelected = ri === selectedIndex;
              return (
                <tr
                  key={ri}
                  style={{
                    cursor: enabled ? 'pointer' : 'default',
                    ...(isSelected && fullRowSelect ? selectedStyle : {}),
                  }}
                  onClick={() => handleSelect(ri)}
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
          const isSelected = i === selectedIndex;
          return (
            <div
              key={i}
              style={{
                width: 72,
                padding: 4,
                textAlign: 'center',
                cursor: enabled ? 'pointer' : 'default',
                borderRadius: 2,
                ...(isSelected ? { backgroundColor: '#0078D7', color: '#FFFFFF' } : {}),
              }}
              onClick={() => handleSelect(i)}
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
          const isSelected = i === selectedIndex;
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
                ...(isSelected ? { backgroundColor: '#0078D7', color: '#FFFFFF' } : {}),
              }}
              onClick={() => handleSelect(i)}
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
          const isSelected = i === selectedIndex;
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
                ...(isSelected ? { backgroundColor: '#0078D7', color: '#FFFFFF' } : {}),
              }}
              onClick={() => handleSelect(i)}
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
        const isSelected = i === selectedIndex;
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
              ...(isSelected ? { backgroundColor: '#0078D7', color: '#FFFFFF' } : {}),
            }}
            onClick={() => handleSelect(i)}
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
