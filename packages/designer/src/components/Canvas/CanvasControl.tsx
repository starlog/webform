import { useDrag } from 'react-dnd';
import type { ControlDefinition, ControlType } from '@webform/common';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { snapPositionToGrid } from '../../utils/snapGrid';
import type { Snapline } from '../../utils/snapGrid';
import { ResizeHandle, RESIZE_DIRECTIONS } from './ResizeHandle';

export const DragItemTypes = {
  TOOLBOX_CONTROL: 'TOOLBOX_CONTROL',
  CANVAS_CONTROL: 'CANVAS_CONTROL',
} as const;

interface CanvasControlProps {
  control: ControlDefinition;
  isSelected: boolean;
  onSnaplineChange: (snaplines: Snapline[]) => void;
}

function ControlPreview({ type, properties }: { type: ControlType; properties: Record<string, unknown> }) {
  const text = (properties.text as string) ?? type;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'Segoe UI, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        color: '#333',
      }}
    >
      {text}
    </div>
  );
}

export function CanvasControl({ control, isSelected, onSnaplineChange }: CanvasControlProps) {
  const gridSize = useDesignerStore((s) => s.gridSize);
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);

  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: DragItemTypes.CANVAS_CONTROL,
    item: () => {
      // 변경 전 스냅샷 저장
      const snapshot = JSON.stringify(useDesignerStore.getState().controls);
      useHistoryStore.getState().pushSnapshot(snapshot);
      return { id: control.id, originalPosition: { ...control.position } };
    },
    end: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta && item) {
        const newPos = snapPositionToGrid({
          x: item.originalPosition.x + delta.x,
          y: item.originalPosition.y + delta.y,
        }, gridSize);
        useDesignerStore.getState().moveControl(control.id, newPos);
      }
      onSnaplineChange([]);
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [control.id, control.position, gridSize]);

  // 드래그 중 스냅라인 계산은 hover에서 처리 (DesignerCanvas의 useDrop hover에서)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      toggleSelect(control.id);
    } else {
      select(control.id);
    }
  };

  return (
    <div
      ref={dragRef as unknown as React.Ref<HTMLDivElement>}
      className={`canvas-control ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: control.position.x,
        top: control.position.y,
        width: control.size.width,
        height: control.size.height,
        opacity: isDragging ? 0.5 : 1,
        border: isSelected ? '1px solid #0078D7' : '1px solid transparent',
        boxShadow: isSelected ? '0 0 0 1px #0078D7' : 'none',
        cursor: 'move',
        backgroundColor: '#fff',
        boxSizing: 'border-box',
      }}
      onClick={handleClick}
    >
      <ControlPreview type={control.type} properties={control.properties} />

      {isSelected && (
        <>
          {RESIZE_DIRECTIONS.map((direction) => (
            <ResizeHandle
              key={direction}
              direction={direction}
              controlId={control.id}
            />
          ))}
        </>
      )}
    </div>
  );
}
