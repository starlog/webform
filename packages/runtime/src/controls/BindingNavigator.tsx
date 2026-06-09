import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { BindingNavigatorView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

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

  // Get bound data from the binding source control
  const boundData = bindingSource ? (controlStates[bindingSource] as Record<string, unknown>) : null;
  const dataSource = (boundData?.dataSource as unknown[]) ?? [];
  const totalCount = dataSource.length;

  const [position, setPosition] = useState(0);

  const moveTo = useCallback(
    (newPos: number) => {
      const clamped = Math.max(0, Math.min(totalCount - 1, newPos));
      setPosition(clamped);
      updateControlState(id, 'position', clamped);
      if (bindingSource) {
        updateControlState(bindingSource, 'selectedRow', clamped);
      }
      onPositionChanged?.();
    },
    [id, totalCount, bindingSource, updateControlState, onPositionChanged],
  );

  const handleAdd = useCallback(() => {
    updateControlState(id, 'clickedItem', { action: 'add' });
    onItemClicked?.();
  }, [id, updateControlState, onItemClicked]);

  const handleDelete = useCallback(() => {
    updateControlState(id, 'clickedItem', { action: 'delete', position });
    onItemClicked?.();
  }, [id, position, updateControlState, onItemClicked]);

  return (
    <BindingNavigatorView
      position={position}
      totalCount={totalCount}
      showAddButton={showAddButton}
      showDeleteButton={showDeleteButton}
      backColor={backColor}
      font={font}
      interactive={enabled}
      disabled={!enabled}
      onMoveTo={moveTo}
      onPositionInput={(e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) moveTo(val - 1);
      }}
      onAdd={handleAdd}
      onDelete={handleDelete}
      className="wf-binding-navigator"
      data-control-id={id}
      style={style}
    />
  );
}
