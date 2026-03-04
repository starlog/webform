import type { ControlDefinition, EventHandlerDefinition } from '@webform/common';
import { runtimeControlRegistry } from '../controls/registry';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useEventHandlers } from '../hooks/useEventHandlers';
import { computeLayoutStyle, getContainerClientSize, TAB_HEADER_HEIGHT } from './layoutUtils';
import { useFormScale } from './FormScaleContext';

const EMPTY_STATE: Record<string, unknown> = {};

interface ControlRendererProps {
  definition: ControlDefinition;
  events: EventHandlerDefinition[];
  parentSize?: { width: number; height: number };
  fillParent?: boolean;
}

export function ControlRenderer({ definition, events, parentSize, fillParent }: ControlRendererProps) {
  const controlState = useRuntimeStore((s) => s.controlStates[definition.id] ?? EMPTY_STATE);
  const eventHandlers = useEventHandlers(definition.id, events);
  const scale = useFormScale();

  const Component = runtimeControlRegistry[definition.type];
  if (!Component) {
    console.warn(`Unknown control type: ${definition.type}`);
    return null;
  }

  // Tab-page Panels: positioned so their origin matches TabControl origin
  // (offset up by tab header height). Content area overflow:hidden clips the header region.
  const layoutStyle = fillParent
    ? { position: 'absolute' as const, top: -TAB_HEADER_HEIGHT, left: 0, right: 0, bottom: 0 }
    : computeLayoutStyle(definition, parentSize, scale);

  if (controlState.visible === false) return null;

  // For dock=Fill controls with non-zero stored position, children coordinates
  // are relative to the stored position. Wrap children in an offset container
  // so they render at correct visual positions within the parent.
  const needsChildOffset =
    definition.dock === 'Fill' &&
    (definition.position.x !== 0 || definition.position.y !== 0) &&
    definition.children &&
    definition.children.length > 0;

  // Card 등 컨테이너 컨트롤은 헤더/보더로 CSS containing block이 디자인 크기보다 작으므로 보정
  // fillParent Panel: 좌표 원점이 TabControl 원점이므로 전체 TabControl 크기 사용
  const childParentSize = fillParent && parentSize
    ? { width: parentSize.width, height: parentSize.height + TAB_HEADER_HEIGHT }
    : getContainerClientSize(definition);

  // TabControl tab-page Panels should fill the content area (like WinForms TabPages)
  const isTabControl = definition.type === 'TabControl';

  // Collapse: flatten Panel intermediaries — render their children directly
  // so the flow-layout CSS (.wf-collapse-panel-content > *) applies to actual controls
  let flatChildren: ControlDefinition[] | undefined;
  let childCollapseKeys: string[] | undefined;
  if (definition.type === 'Collapse' && definition.children) {
    const flat: ControlDefinition[] = [];
    const keys: string[] = [];
    for (const child of definition.children) {
      if (child.type === 'Panel' && child.properties.collapseKey) {
        const key = child.properties.collapseKey as string;
        for (const grandchild of child.children || []) {
          flat.push(grandchild);
          keys.push(key);
        }
      } else {
        flat.push(child);
        keys.push('');
      }
    }
    flatChildren = flat;
    childCollapseKeys = keys;
  }

  const effectiveChildren = flatChildren ?? definition.children;

  const childElements = effectiveChildren?.map((child) => (
    <ControlRenderer
      key={child.id}
      definition={child}
      events={events}
      parentSize={childParentSize}
      fillParent={isTabControl && child.type === 'Panel' && !!child.properties.tabId}
    />
  ));

  // TabControl: pass tabId mapping so it can group children by tab
  const childTabIds =
    definition.type === 'TabControl' && definition.children
      ? definition.children.map((c) => (c.properties.tabId as string) ?? '')
      : undefined;

  const wrappedChildren = needsChildOffset ? (
    <div
      style={{
        position: 'absolute',
        top: definition.position.y,
        left: definition.position.x,
        right: 0,
        bottom: 0,
      }}
    >
      {childElements}
    </div>
  ) : (
    childElements
  );

  return (
    <Component
      id={definition.id}
      name={definition.name}
      {...controlState}
      {...eventHandlers}
      style={layoutStyle}
      enabled={controlState.enabled ?? definition.enabled}
      {...(childTabIds ? { childTabIds } : {})}
      {...(childCollapseKeys ? { childCollapseKeys } : {})}
    >
      {wrappedChildren}
    </Component>
  );
}
