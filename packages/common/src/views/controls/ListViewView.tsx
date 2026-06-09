import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface ListViewItem {
  text?: string;
  subItems?: string[];
  imageIndex?: number;
  [key: string]: unknown;
}

export interface ListViewColumn {
  text?: string;
  header?: string;
  headerText?: string;
  field?: string;
  width?: number;
}

export type ListViewMode = 'LargeIcon' | 'SmallIcon' | 'List' | 'Details' | 'Tile';

export interface ListViewViewProps {
  items?: ListViewItem[];
  columns?: ListViewColumn[];
  view?: ListViewMode;
  /** 선택된 아이템 인덱스 목록 (단일 선택이면 길이 1) */
  selectedIndices?: number[];
  fullRowSelect?: boolean;
  gridLines?: boolean;
  /** 아이템이 없을 때 표시할 문구 (미지정 시 빈 영역) */
  emptyText?: string;
  backColor?: string;
  foreColor?: string;
  interactive?: boolean;
  disabled?: boolean;
  onItemClick?: (index: number, e: ReactMouseEvent) => void;
  onItemDoubleClick?: (index: number) => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

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

/** 아이템의 대표 텍스트 추출: text 필드 또는 첫 번째 컬럼 필드값 */
function getItemText(item: ListViewItem, columns: ListViewColumn[]): string {
  if (item.text) return item.text;
  if (columns.length > 0 && columns[0].field) {
    return String(item[columns[0].field] ?? '');
  }
  // text/field 모두 없으면 첫 번째 문자열 값 사용
  for (const val of Object.values(item)) {
    if (typeof val === 'string' && val) return val;
  }
  return '';
}

export function ListViewView({
  items = [],
  columns = [],
  view = 'Details',
  selectedIndices = [],
  fullRowSelect = true,
  gridLines = false,
  emptyText,
  backColor,
  foreColor,
  interactive = false,
  disabled = false,
  onItemClick,
  onItemDoubleClick,
  style,
  className,
  'data-control-id': dataControlId,
}: ListViewViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('ListView', { backColor, foreColor });
  const clickable = interactive && !disabled;
  const itemCursor = clickable ? 'pointer' : 'default';

  const handleClick = (index: number, e: ReactMouseEvent) => {
    if (!clickable) return;
    onItemClick?.(index, e);
  };

  const handleDoubleClick = (index: number) => {
    if (!clickable) return;
    onItemDoubleClick?.(index);
  };

  const isItemSelected = (index: number) => selectedIndices.includes(index);

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    border: theme.controls.select.border,
    borderRadius: theme.controls.select.borderRadius,
    overflow: 'auto',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
    boxSizing: 'border-box',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const selectedStyle: CSSProperties = {
    backgroundColor: theme.controls.select.selectedBackground,
    color: theme.controls.select.selectedForeground,
  };

  if (items.length === 0) {
    return (
      <div className={className} data-control-id={dataControlId} style={rootStyle}>
        {emptyText && <div style={{ padding: '8px', color: '#999', textAlign: 'center' }}>{emptyText}</div>}
      </div>
    );
  }

  // Details view — table layout
  if (view === 'Details') {
    return (
      <div className={className} data-control-id={dataControlId} style={rootStyle}>
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
                    {col.header || col.headerText || col.text}
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
                    cursor: itemCursor,
                    ...(isSelected && fullRowSelect ? selectedStyle : {}),
                  }}
                  onClick={(e) => handleClick(ri, e)}
                  onDoubleClick={() => handleDoubleClick(ri)}
                >
                  {columns.length > 0 ? (
                    columns.map((col, ci) => {
                      const cellText = col.field
                        ? String(item[col.field] ?? '')
                        : ci === 0
                          ? (item.text ?? '')
                          : item.subItems?.[ci - 1] ?? '';
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
                      {getItemText(item, columns)}
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
        className={className}
        data-control-id={dataControlId}
        style={{ ...rootStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 4 }}
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
                cursor: itemCursor,
                borderRadius: 2,
                ...(isSelected ? selectedStyle : {}),
              }}
              onClick={(e) => handleClick(i, e)}
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
                {getItemText(item, columns)}
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
        className={className}
        data-control-id={dataControlId}
        style={{ ...rootStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 2 }}
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
                cursor: itemCursor,
                borderRadius: 2,
                ...(isSelected ? selectedStyle : {}),
              }}
              onClick={(e) => handleClick(i, e)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              <IconPlaceholder size={16} />
              <span style={{ whiteSpace: 'nowrap' }}>{getItemText(item, columns)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // List view
  if (view === 'List') {
    return (
      <div className={className} data-control-id={dataControlId} style={{ ...rootStyle, padding: 2 }}>
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
                cursor: itemCursor,
                ...(isSelected ? selectedStyle : {}),
              }}
              onClick={(e) => handleClick(i, e)}
              onDoubleClick={() => handleDoubleClick(i)}
            >
              <IconPlaceholder size={16} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getItemText(item, columns)}
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
      className={className}
      data-control-id={dataControlId}
      style={{ ...rootStyle, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', padding: 4 }}
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
              cursor: itemCursor,
              borderRadius: 2,
              ...(isSelected ? selectedStyle : {}),
            }}
            onClick={(e) => handleClick(i, e)}
            onDoubleClick={() => handleDoubleClick(i)}
          >
            <IconPlaceholder size={32} />
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getItemText(item, columns)}
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
