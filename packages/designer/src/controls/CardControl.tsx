import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import { useDesignerStore } from '../stores/designerStore';
import { useSelectionStore } from '../stores/selectionStore';
import { getDesignerComponent } from './registry';
import type { DesignerControlProps } from './registry';

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
        backgroundColor: colors.backgroundColor,
        color: colors.color,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        cursor: hoverable ? 'pointer' : undefined,
        position: 'relative',
      }}
    >
      {showHeader && (
        <div
          style={{
            padding: headerPadding,
            borderBottom: `1px solid ${theme.controls.panel.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{subtitle}</div>
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
 * Card 자식 컨트롤의 인라인 렌더링 — 절대 위치로 배치, 클릭 시 선택.
 * Runtime과 동일하게 자식의 상대좌표(child.pos - card.pos)를
 * body div 내에서 position: absolute로 배치한다.
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
  const theme = useTheme();
  const select = useSelectionStore((s) => s.select);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const isSelected = selectedIds.has(control.id);

  const Component = getDesignerComponent(control.type as Parameters<typeof getDesignerComponent>[0]);

  // Runtime의 nestControls와 동일한 상대좌표 계산: child_absolute - parent_absolute
  const relX = control.position.x - cardPosition.x;
  const relY = control.position.y - cardPosition.y;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    select(control.id);
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
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      style={{
        position: 'absolute',
        left: relX,
        top: relY,
        width: control.size.width,
        height: control.size.height,
        cursor: 'pointer',
        outline: isSelected ? `2px solid ${theme.accent.primary}` : 'none',
        outlineOffset: 2,
        borderRadius: 2,
      }}
    >
      {content}
    </div>
  );
}
