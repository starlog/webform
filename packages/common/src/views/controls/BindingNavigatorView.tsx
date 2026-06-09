import type { CSSProperties, ChangeEvent } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface BindingNavigatorViewProps {
  position?: number;
  totalCount?: number;
  showAddButton?: boolean;
  showDeleteButton?: boolean;
  backColor?: string;
  font?: { family?: string; size?: number };
  interactive?: boolean;
  disabled?: boolean;
  onMoveTo?: (position: number) => void;
  onPositionInput?: (e: ChangeEvent<HTMLInputElement>) => void;
  onAdd?: () => void;
  onDelete?: () => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function BindingNavigatorView({
  position = 0,
  totalCount = 0,
  showAddButton = true,
  showDeleteButton = true,
  backColor,
  font,
  interactive = false,
  disabled = false,
  onMoveTo,
  onPositionInput,
  onAdd,
  onDelete,
  style,
  className,
  'data-control-id': dataControlId,
}: BindingNavigatorViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('BindingNavigator', { backColor });
  const clickable = interactive && !disabled;

  const moveTo = (newPos: number) => {
    if (!clickable) return;
    onMoveTo?.(newPos);
  };

  const btnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 22,
    fontSize: 12,
    cursor: clickable ? 'pointer' : 'default',
    borderRadius: 2,
    border: 'none',
    background: 'transparent',
    opacity: disabled ? 0.5 : 1,
    padding: 0,
  };

  const sepStyle: CSSProperties = {
    width: 1,
    height: 16,
    backgroundColor: theme.controls.toolStrip.separator,
    margin: '0 3px',
    flexShrink: 0,
  };

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    borderBottom: theme.controls.toolStrip.border,
    display: 'flex',
    alignItems: 'center',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    paddingLeft: 2,
    paddingRight: 2,
    gap: 1,
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const displayPos = totalCount > 0 ? position + 1 : 0;

  return (
    <div className={className} data-control-id={dataControlId} style={rootStyle}>
      <button style={btnStyle} title="Move first" onClick={() => moveTo(0)}>
        |&#9664;
      </button>
      <button style={btnStyle} title="Move previous" onClick={() => moveTo(position - 1)}>
        &#9664;
      </button>
      <div style={sepStyle} />
      <input
        type="text"
        value={displayPos}
        readOnly={!interactive}
        onChange={clickable ? onPositionInput : undefined}
        style={{
          width: 40,
          height: 18,
          textAlign: 'center',
          fontSize: 11,
          border: theme.controls.textInput.border,
          padding: 0,
        }}
      />
      <span style={{ fontSize: 11, margin: '0 2px' }}>/ {totalCount}</span>
      <div style={sepStyle} />
      <button style={btnStyle} title="Move next" onClick={() => moveTo(position + 1)}>
        &#9654;
      </button>
      <button style={btnStyle} title="Move last" onClick={() => moveTo(totalCount - 1)}>
        &#9654;|
      </button>
      {(showAddButton || showDeleteButton) && <div style={sepStyle} />}
      {showAddButton && (
        <button style={btnStyle} title="Add new" onClick={clickable ? onAdd : undefined}>
          &#10010;
        </button>
      )}
      {showDeleteButton && (
        <button style={btnStyle} title="Delete" onClick={clickable ? onDelete : undefined}>
          &#10005;
        </button>
      )}
    </div>
  );
}
