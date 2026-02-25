import type { ControlDefinition, DataBindingDefinition, EventHandlerDefinition } from '@webform/common';
import { runtimeControlRegistry } from '../controls/registry';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useDataBinding } from '../hooks/useDataBinding';
import { useEventHandlers } from '../hooks/useEventHandlers';
import { computeLayoutStyle, getContainerClientSize } from './layoutUtils';
import { useFormScale } from './FormScaleContext';

const EMPTY_STATE: Record<string, unknown> = {};

interface ControlRendererProps {
  definition: ControlDefinition;
  bindings: DataBindingDefinition[];
  events: EventHandlerDefinition[];
  parentSize?: { width: number; height: number };
}

export function ControlRenderer({ definition, bindings, events, parentSize }: ControlRendererProps) {
  const controlState = useRuntimeStore((s) => s.controlStates[definition.id] ?? EMPTY_STATE);
  const boundProps = useDataBinding(definition.id, bindings);
  const eventHandlers = useEventHandlers(definition.id, events);
  const scale = useFormScale();

  const Component = runtimeControlRegistry[definition.type];
  if (!Component) {
    console.warn(`Unknown control type: ${definition.type}`);
    return null;
  }

  const layoutStyle = computeLayoutStyle(definition, parentSize, scale);

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
  const childParentSize = getContainerClientSize(definition);

  const childElements = definition.children?.map((child) => (
    <ControlRenderer
      key={child.id}
      definition={child}
      bindings={bindings}
      events={events}
      parentSize={childParentSize}
    />
  ));

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
      {...boundProps}
      {...eventHandlers}
      style={layoutStyle}
      enabled={controlState.enabled ?? definition.enabled}
    >
      {wrappedChildren}
    </Component>
  );
}
