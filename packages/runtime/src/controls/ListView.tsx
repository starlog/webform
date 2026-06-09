import { useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  ListViewView,
  type ListViewItem,
  type ListViewColumn,
  type ListViewMode,
} from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface ListViewProps {
  id: string;
  name: string;
  items?: ListViewItem[];
  columns?: ListViewColumn[];
  view?: ListViewMode;
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
  const storedIndices = useRuntimeStore(
    (s) => s.controlStates[id]?.selectedIndices as number[] | undefined,
  );

  const selectedIndices: number[] = useMemo(
    () => storedIndices ?? (selectedIndex >= 0 ? [selectedIndex] : []),
    [storedIndices, selectedIndex],
  );

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

  // 단일 선택 모드에서는 selectedIndex prop이 선택 표시 기준
  const effectiveIndices = multiSelect
    ? selectedIndices
    : selectedIndex >= 0
      ? [selectedIndex]
      : [];

  return (
    <ListViewView
      items={items}
      columns={columns}
      view={view}
      selectedIndices={effectiveIndices}
      fullRowSelect={fullRowSelect}
      gridLines={gridLines}
      emptyText="(항목 없음)"
      backColor={backColor}
      foreColor={foreColor}
      interactive={enabled}
      disabled={!enabled}
      onItemClick={handleSelect}
      onItemDoubleClick={handleDoubleClick}
      className="wf-listview"
      data-control-id={id}
      style={style}
    />
  );
}
