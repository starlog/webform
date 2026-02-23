import { useRef } from 'react';
import type { ControlDefinition, ControlType } from '@webform/common';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore } from '../../stores/historyStore';
import { snapPositionToGrid, getSnaplines } from '../../utils/snapGrid';
import type { Snapline } from '../../utils/snapGrid';
import { ResizeHandle, RESIZE_DIRECTIONS } from './ResizeHandle';
import { getDesignerComponent } from '../../controls/registry';

export const DragItemTypes = {
  TOOLBOX_CONTROL: 'TOOLBOX_CONTROL',
} as const;

interface CanvasControlProps {
  control: ControlDefinition;
  isSelected: boolean;
  onSnaplineChange: (snaplines: Snapline[]) => void;
}

function ControlPreview({
  id,
  type,
  properties,
  size,
}: {
  id: string;
  type: ControlType;
  properties: Record<string, unknown>;
  size: { width: number; height: number };
}) {
  const Component = getDesignerComponent(type);

  if (Component) {
    return <Component id={id} properties={properties} size={size} />;
  }

  const text = (properties.text as string) ?? type;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        fontSize: 'inherit',
        fontFamily: 'inherit',
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
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 리사이즈 핸들 클릭은 무시
    if ((e.target as HTMLElement).closest('.resize-handle')) return;

    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const { controls, gridSize, moveControl } = useDesignerStore.getState();
    const ctrl = controls.find((c) => c.id === control.id);
    if (!ctrl) return;

    const startPos = { ...ctrl.position };

    // 변경 전 스냅샷 저장
    const snapshot = JSON.stringify(controls);
    useHistoryStore.getState().pushSnapshot(snapshot);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        moved = true;
        isDragging.current = true;
      }

      if (moved) {
        const newPos = snapPositionToGrid(
          { x: startPos.x + deltaX, y: startPos.y + deltaY },
          gridSize,
        );
        moveControl(control.id, newPos);

        // 스냅라인 계산
        const currentControls = useDesignerStore.getState().controls;
        const movingCtrl = currentControls.find((c) => c.id === control.id);
        if (movingCtrl) {
          const others = currentControls.filter((c) => c.id !== control.id);
          const lines = getSnaplines(
            { position: newPos, size: movingCtrl.size },
            others,
          );
          onSnaplineChange(lines);
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      onSnaplineChange([]);

      if (!moved) {
        // 이동하지 않았으면 선택 처리
        if (e.ctrlKey || e.metaKey) {
          toggleSelect(control.id);
        } else {
          select(control.id);
        }
      }

      // isDragging 플래그 해제 (다음 틱에서)
      requestAnimationFrame(() => {
        isDragging.current = false;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`canvas-control ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        left: control.position.x,
        top: control.position.y,
        width: control.size.width,
        height: control.size.height,
        border: isSelected ? '1px solid #0078D7' : '1px solid transparent',
        boxShadow: isSelected ? '0 0 0 1px #0078D7' : 'none',
        cursor: 'move',
        backgroundColor: 'transparent',
        boxSizing: 'border-box',
      }}
      onMouseDown={handleMouseDown}
    >
      <ControlPreview id={control.id} type={control.type} properties={control.properties} size={control.size} />

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
