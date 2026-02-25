import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface BindingNavigatorProps {
  id: string;
  name: string;
  bindingSource?: string;
  showAddButton?: boolean;
  showDeleteButton?: boolean;
  backColor?: string;
  font?: { family?: string; size?: number };
  style?: CSSProperties;
  enabled?: boolean;
  onPositionChanged?: () => void;
  onItemClicked?: () => void;
  [key: string]: unknown;
}

export function BindingNavigator({
  id,
  bindingSource,
  showAddButton = true,
  showDeleteButton = true,
  backColor,
  font,
  style,
  enabled = true,
  onPositionChanged,
  onItemClicked,
}: BindingNavigatorProps) {
  const controlStates = useRuntimeStore((s) => s.controlStates);
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('BindingNavigator', { backColor });

  // Get bound data from the binding source control
  const boundData = bindingSource ? (controlStates[bindingSource] as Record<string, unknown>) : null;
  const dataSource = (boundData?.dataSource as unknown[]) ?? [];
  const totalCount = dataSource.length;

  const [position, setPosition] = useState(0);

  const moveTo = useCallback(
    (newPos: number) => {
      if (!enabled) return;
      const clamped = Math.max(0, Math.min(totalCount - 1, newPos));
      setPosition(clamped);
      updateControlState(id, 'position', clamped);
      if (bindingSource) {
        updateControlState(bindingSource, 'selectedRow', clamped);
      }
      onPositionChanged?.();
    },
    [id, enabled, totalCount, bindingSource, updateControlState, onPositionChanged],
  );

  const handleAdd = useCallback(() => {
    if (!enabled) return;
    updateControlState(id, 'clickedItem', { action: 'add' });
    onItemClicked?.();
  }, [id, enabled, updateControlState, onItemClicked]);

  const handleDelete = useCallback(() => {
    if (!enabled) return;
    updateControlState(id, 'clickedItem', { action: 'delete', position });
    onItemClicked?.();
  }, [id, enabled, position, updateControlState, onItemClicked]);

  const btnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 22,
    fontSize: 12,
    cursor: enabled ? 'pointer' : 'default',
    borderRadius: 2,
    border: 'none',
    background: 'transparent',
    opacity: enabled ? 1 : 0.5,
    padding: 0,
  };

  const sepStyle: CSSProperties = {
    width: 1,
    height: 16,
    backgroundColor: theme.controls.toolStrip.separator,
    margin: '0 3px',
    flexShrink: 0,
  };

  const mergedStyle: CSSProperties = {
    backgroundColor: colors.backgroundColor,
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
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  const displayPos = totalCount > 0 ? position + 1 : 0;

  return (
    <div className="wf-binding-navigator" data-control-id={id} style={mergedStyle}>
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
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) moveTo(val - 1);
        }}
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
        <button style={btnStyle} title="Add new" onClick={handleAdd}>
          &#10010;
        </button>
      )}
      {showDeleteButton && (
        <button style={btnStyle} title="Delete" onClick={handleDelete}>
          &#10005;
        </button>
      )}
    </div>
  );
}
