import { useRef } from 'react';
import type { ControlDefinition, ControlType } from '@webform/common';
import { useDesignerStore } from '../../stores/designerStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { useHistoryStore, createSnapshot } from '../../stores/historyStore';
import { snapPositionToGrid, getSnaplines } from '../../utils/snapGrid';
import type { Snapline } from '../../utils/snapGrid';
import { ResizeHandle, RESIZE_DIRECTIONS } from './ResizeHandle';
import { getDesignerComponent } from '../../controls/registry';

/** 주어진 parentId의 모든 자손 컨트롤 ID를 재귀적으로 수집한다 */
function collectDescendantIds(
  controls: ControlDefinition[],
  parentId: string,
  result: Set<string>,
) {
  for (const c of controls) {
    if ((c.properties._parentId as string) === parentId && !result.has(c.id)) {
      result.add(c.id);
      collectDescendantIds(controls, c.id, result);
    }
  }
}

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

    const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const { controls, gridSize, moveControls } = useDesignerStore.getState();
    const { selectedIds } = useSelectionStore.getState();
    const alreadySelected = selectedIds.has(control.id);

    // mousedown 시 선택 상태 결정
    if (!alreadySelected && hasModifier) {
      // 미선택 컨트롤 + modifier → 선택에 추가
      toggleSelect(control.id);
    } else if (!alreadySelected && !hasModifier) {
      // 미선택 컨트롤 + modifier 없음 → 단일 선택으로 교체
      select(control.id);
    }
    // 이미 선택된 컨트롤 → 선택 유지 (다중 드래그 준비)

    // 드래그 시작 시점의 선택된 컨트롤 ID + 자손 ID 수집 및 시작 위치 기록
    const selectedIdSet = new Set(useSelectionStore.getState().selectedIds);
    const allDragIds = new Set<string>(selectedIdSet);
    // 선택된 각 컨트롤의 모든 자손을 재귀적으로 수집
    for (const id of selectedIdSet) {
      collectDescendantIds(controls, id, allDragIds);
    }
    const dragSelectedIds = Array.from(allDragIds);
    const startPositions = new Map<string, { x: number; y: number }>();
    for (const id of dragSelectedIds) {
      const ctrl = controls.find((c) => c.id === id);
      if (ctrl) startPositions.set(id, { ...ctrl.position });
    }

    // 변경 전 스냅샷 저장
    useHistoryStore.getState().pushSnapshot(createSnapshot());

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        moved = true;
        isDragging.current = true;
      }

      if (moved) {
        // 드래그 중인 컨트롤(mousedown 대상) 기준으로 스냅 위치 계산
        const primaryStart = startPositions.get(control.id);
        if (!primaryStart) return;
        const snappedPos = snapPositionToGrid(
          { x: primaryStart.x + deltaX, y: primaryStart.y + deltaY },
          gridSize,
        );
        const snappedDeltaX = snappedPos.x - primaryStart.x;
        const snappedDeltaY = snappedPos.y - primaryStart.y;

        // 모든 선택된 컨트롤에 동일한 delta 적용
        const moves = dragSelectedIds
          .filter((id) => startPositions.has(id))
          .map((id) => ({
            id,
            position: {
              x: startPositions.get(id)!.x + snappedDeltaX,
              y: startPositions.get(id)!.y + snappedDeltaY,
            },
          }));
        moveControls(moves);

        // 스냅라인은 드래그 중인 컨트롤 기준으로 계산
        const currentControls = useDesignerStore.getState().controls;
        const movingCtrl = currentControls.find((c) => c.id === control.id);
        if (movingCtrl) {
          const others = currentControls.filter(
            (c) => !dragSelectedIds.includes(c.id),
          );
          const lines = getSnaplines(
            { position: snappedPos, size: movingCtrl.size },
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
        // 이동하지 않았으면 mouseup에서 선택 처리
        if (hasModifier && alreadySelected) {
          // modifier + 이미 선택된 컨트롤 → 토글 (해제)
          toggleSelect(control.id);
        } else if (!hasModifier && alreadySelected && selectedIds.size > 1) {
          // modifier 없음 + 다중 선택 상태였으면 → 단일 선택으로 전환
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
