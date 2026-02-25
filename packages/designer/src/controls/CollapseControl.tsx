import { useTheme } from '../theme/ThemeContext';
import { useDesignerStore } from '../stores/designerStore';
import { useSelectionStore } from '../stores/selectionStore';
import { getDesignerComponent } from './registry';
import type { DesignerControlProps } from './registry';

interface CollapsePanel {
  title: string;
  key: string;
}

export function CollapseControl({ id, properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const updateControl = useDesignerStore((s) => s.updateControl);
  const controls = useDesignerStore((s) => s.controls);

  const panels = (properties.panels as CollapsePanel[]) ?? [
    { title: 'Panel 1', key: '1' },
    { title: 'Panel 2', key: '2' },
  ];
  const activeKeysStr = (properties.activeKeys as string) ?? '1';
  const bordered = (properties.bordered as boolean) ?? true;
  const expandIconPosition = (properties.expandIconPosition as string) ?? 'Start';

  const activeKeys = new Set(
    activeKeysStr.split(',').map((k) => k.trim()).filter(Boolean),
  );

  // Collapse의 직접 자식 컨트롤 (인덱스 순서 = 패널 순서)
  const children = id
    ? controls.filter((c) => (c.properties._parentId as string) === id)
    : [];

  // 디자이너에서는 한 번에 하나의 패널만 활성화 (자식 컨트롤 겹침 방지)
  const handlePanelClick = (key: string) => {
    if (!id) return;
    const newActiveKeys = activeKeys.has(key) ? '' : key;
    updateControl(id, {
      properties: { ...properties, activeKeys: newActiveKeys },
    });
  };

  const icon = (isActive: boolean) => (
    <span
      style={{
        fontSize: '0.7em',
        display: 'inline-block',
        transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      ▶
    </span>
  );

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        border: bordered ? `1px solid ${theme.controls.panel.border}` : 'none',
        borderRadius: 8,
        boxSizing: 'border-box',
        overflow: 'auto',
        backgroundColor: theme.form.backgroundColor,
        color: theme.form.foreground,
      }}
    >
      {panels.map((panel, i) => {
        const isActive = activeKeys.has(panel.key);
        const child = children[i];

        return (
          <div
            key={panel.key}
            style={{
              borderBottom:
                bordered && i < panels.length - 1
                  ? `1px solid ${theme.controls.panel.border}`
                  : 'none',
            }}
          >
            {/* 헤더 — 클릭으로 패널 전환 */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handlePanelClick(panel.key);
              }}
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(0,0,0,0.02)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                userSelect: 'none',
              }}
            >
              {expandIconPosition === 'Start' && icon(isActive)}
              <span style={{ flex: 1 }}>{panel.title}</span>
              {expandIconPosition === 'End' && icon(isActive)}
            </div>
            {/* 활성 패널의 컨텐츠 — 자식 컨트롤 인라인 렌더링 */}
            {isActive && (
              <div style={{ padding: '8px 12px' }}>
                {child ? (
                  <ChildPreview control={child} parentWidth={size.width} />
                ) : (
                  <div
                    style={{
                      color: 'rgba(0,0,0,0.3)',
                      fontSize: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    (빈 패널)
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 자식 컨트롤의 인라인 미리보기 — 클릭으로 자식 컨트롤 선택 가능 */
function ChildPreview({
  control,
  parentWidth,
}: {
  control: { id: string; type: string; properties: Record<string, unknown>; size: { width: number; height: number } };
  parentWidth: number;
}) {
  const select = useSelectionStore((s) => s.select);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const isSelected = selectedIds.has(control.id);

  const Component = getDesignerComponent(control.type as Parameters<typeof getDesignerComponent>[0]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    select(control.id);
  };

  const content = Component ? (
    <Component
      id={control.id}
      properties={control.properties}
      size={{ width: parentWidth - 24, height: control.size.height }}
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
        cursor: 'pointer',
        outline: isSelected ? '2px solid #0078D7' : 'none',
        outlineOffset: 2,
        borderRadius: 2,
      }}
    >
      {content}
    </div>
  );
}
