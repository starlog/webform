import { useRef, useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { useDesignerStore } from '../stores/designerStore';
import { useSelectionStore } from '../stores/selectionStore';
import { useHistoryStore, createSnapshot } from '../stores/historyStore';
import { snapPositionToGrid } from '../utils/snapGrid';
import { getDesignerComponent } from './registry';
import type { DesignerControlProps } from './registry';
import { ResizeHandle, RESIZE_DIRECTIONS } from '../components/Canvas/ResizeHandle';

export function CardControl({ id, properties, size, position = { x: 0, y: 0 } }: DesignerControlProps) {
  const theme = useTheme();
  const controls = useDesignerStore((s) => s.controls);

  const title = (properties.title as string) ?? 'Card Title';
  const subtitle = (properties.subtitle as string) ?? '';
  const showHeader = (properties.showHeader as boolean) ?? true;
  const showBorder = (properties.showBorder as boolean) ?? true;
  const hoverable = (properties.hoverable as boolean) ?? false;
  const cardSize = (properties.size as string) ?? 'Default';
  const borderRadius = (properties.borderRadius as number) ?? 8;

  const colors = useControlColors('Card', {
    backColor: properties.backColor as string | undefined,
    foreColor: properties.foreColor as string | undefined,
  });

  const [isHovered, setIsHovered] = useState(false);
  const isSmall = cardSize === 'Small';
  const headerPadding = isSmall ? '8px 12px' : '12px 16px';
  const bodyPadding = isSmall ? 12 : 16;

  // Card의 직접 자식 컨트롤 조회
  const children = id
    ? controls.filter((c) => (c.properties._parentId as string) === id)
    : [];

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        borderRadius,
        border: showBorder ? theme.controls.panel.border : 'none',
        background: colors.background,
        color: colors.color,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: hoverable ? 'pointer' : undefined,
        position: 'relative',
        boxShadow: hoverable && isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 2px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.3s ease',
      }}
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
    >
      {showHeader && (
        <div
          style={{
            padding: headerPadding,
            borderBottom: theme.controls.panel.border,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: isSmall ? '14px' : '16px' }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: '13px', opacity: 0.6, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      )}
      <div
        style={{
          flex: 1,
          padding: bodyPadding,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children.map((child) => (
          <CardChildPreview
            key={child.id}
            control={child}
            cardPosition={position}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Card 자식 컨트롤의 인라인 렌더링 — 절대 위치로 배치.
 * 선택, 드래그 이동, 리사이즈를 지원한다.
 */
function CardChildPreview({
  control,
  cardPosition,
}: {
  control: {
    id: string;
    type: string;
    properties: Record<string, unknown>;
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
  cardPosition: { x: number; y: number };
}) {
  const select = useSelectionStore((s) => s.select);
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const isSelected = selectedIds.has(control.id);
  const isDragging = useRef(false);
  const activeDragListeners = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  useEffect(() => {
    return () => {
      const { move, up } = activeDragListeners.current;
      if (move) document.removeEventListener('mousemove', move);
      if (up) document.removeEventListener('mouseup', up);
    };
  }, []);

  const Component = getDesignerComponent(control.type as Parameters<typeof getDesignerComponent>[0]);

  // Runtime의 nestControls와 동일한 상대좌표 계산: child_absolute - parent_absolute
  const relX = control.position.x - cardPosition.x;
  const relY = control.position.y - cardPosition.y;

  const handleMouseDown = (e: React.MouseEvent) => {
    // 리사이즈 핸들 클릭은 무시
    if ((e.target as HTMLElement).closest('.resize-handle')) return;

    e.stopPropagation();
    e.preventDefault();

    const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;

    const { gridSize, moveControls } = useDesignerStore.getState();
    const { selectedIds: currentSelectedIds } = useSelectionStore.getState();
    const alreadySelected = currentSelectedIds.has(control.id);

    if (!alreadySelected && hasModifier) {
      toggleSelect(control.id);
    } else if (!alreadySelected && !hasModifier) {
      select(control.id);
    }
    // 이미 선택된 컨트롤 → 선택 유지 (다중 드래그 준비)

    useHistoryStore.getState().pushSnapshot(createSnapshot());

    // 드래그할 모든 선택된 컨트롤의 시작 위치 기록
    const { controls: allControls } = useDesignerStore.getState();
    const dragSelectedIds = Array.from(useSelectionStore.getState().selectedIds);
    const startPositions = new Map<string, { x: number; y: number }>();
    for (const cid of dragSelectedIds) {
      const ctrl = allControls.find((c) => c.id === cid);
      if (ctrl) startPositions.set(cid, { ...ctrl.position });
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      if (!moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        moved = true;
        isDragging.current = true;
      }

      if (moved) {
        // 마우스 클릭 대상 기준으로 스냅된 위치 계산
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
          .filter((cid) => startPositions.has(cid))
          .map((cid) => ({
            id: cid,
            position: {
              x: startPositions.get(cid)!.x + snappedDeltaX,
              y: startPositions.get(cid)!.y + snappedDeltaY,
            },
          }));
        moveControls(moves);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      activeDragListeners.current = { move: null, up: null };

      if (!moved) {
        if (hasModifier && alreadySelected) {
          toggleSelect(control.id);
        } else if (!hasModifier && alreadySelected && currentSelectedIds.size > 1) {
          select(control.id);
        }
      }

      requestAnimationFrame(() => {
        isDragging.current = false;
      });
    };

    activeDragListeners.current = { move: handleMouseMove, up: handleMouseUp };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const content = Component ? (
    <Component
      id={control.id}
      properties={control.properties}
      size={control.size}
      position={control.position}
    />
  ) : (
    <div style={{ lineHeight: 1.5 }}>
      {(control.properties.text as string) ?? `[${control.type}]`}
    </div>
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: relX,
        top: relY,
        width: control.size.width,
        height: control.size.height,
        cursor: 'move',
        border: isSelected ? '1px solid #0078D7' : '1px solid transparent',
        boxShadow: isSelected ? '0 0 0 1px #0078D7' : 'none',
        boxSizing: 'border-box',
        borderRadius: 2,
      }}
    >
      {content}
      {isSelected && RESIZE_DIRECTIONS.map((direction) => (
        <ResizeHandle key={direction} direction={direction} controlId={control.id} />
      ))}
    </div>
  );
}
