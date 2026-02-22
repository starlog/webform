import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { DragItemTypes } from '../Canvas/CanvasControl';
import type { ControlMeta } from '../../controls/registry';

interface ToolboxItemProps {
  meta: ControlMeta;
}

export function ToolboxItem({ meta }: ToolboxItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DragItemTypes.TOOLBOX_CONTROL,
    item: { type: meta.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [meta.type]);

  return (
    <div
      ref={dragRef as unknown as React.Ref<HTMLDivElement>}
      style={{
        ...itemStyle,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isHovered ? '#E0E8F0' : 'transparent',
      }}
      title={meta.displayName}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span style={iconStyle}>{meta.icon}</span>
      <span style={labelStyle}>{meta.displayName}</span>
    </div>
  );
}

const itemStyle: CSSProperties = {
  padding: '3px 8px',
  cursor: 'grab',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  borderRadius: '2px',
};

const iconStyle: CSSProperties = {
  width: '16px',
  textAlign: 'center',
  fontSize: '12px',
  flexShrink: 0,
};

const labelStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
