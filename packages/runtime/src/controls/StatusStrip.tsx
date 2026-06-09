import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { StatusStripView, type StatusStripItem } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface StatusStripProps {
  id: string;
  name: string;
  items?: StatusStripItem[];
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number };
  onItemClicked?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function StatusStrip({
  id,
  items = [],
  style,
  enabled = true,
  backColor,
  foreColor,
  font,
  onItemClicked,
}: StatusStripProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleItemClick = useCallback(
    (item: StatusStripItem, index: number) => {
      updateControlState(id, 'clickedItem', { ...item, index });
      onItemClicked?.();
    },
    [id, updateControlState, onItemClicked],
  );

  return (
    <StatusStripView
      items={items}
      backColor={backColor}
      foreColor={foreColor}
      font={font}
      interactive={enabled}
      disabled={!enabled}
      onItemClick={handleItemClick}
      className="wf-statusstrip"
      data-control-id={id}
      style={style}
    />
  );
}
