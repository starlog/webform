import type { ControlDefinition, DataBindingDefinition, EventHandlerDefinition } from '@webform/common';
import { runtimeControlRegistry } from '../controls/registry';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useDataBinding } from '../hooks/useDataBinding';
import { useEventHandlers } from '../hooks/useEventHandlers';
import { computeLayoutStyle } from './layoutUtils';

const EMPTY_STATE: Record<string, unknown> = {};

interface ControlRendererProps {
  definition: ControlDefinition;
  bindings: DataBindingDefinition[];
  events: EventHandlerDefinition[];
}

export function ControlRenderer({ definition, bindings, events }: ControlRendererProps) {
  const controlState = useRuntimeStore((s) => s.controlStates[definition.id] ?? EMPTY_STATE);
  const boundProps = useDataBinding(definition.id, bindings);
  const eventHandlers = useEventHandlers(definition.id, events);

  const Component = runtimeControlRegistry[definition.type];
  if (!Component) {
    console.warn(`Unknown control type: ${definition.type}`);
    return null;
  }

  const layoutStyle = computeLayoutStyle(definition);

  if (controlState.visible === false) return null;

  // For dock=Fill controls with non-zero stored position, children coordinates
  // are relative to the stored position. Wrap children in an offset container
  // so they render at correct visual positions within the parent.
  const needsChildOffset =
    definition.dock === 'Fill' &&
    (definition.position.x !== 0 || definition.position.y !== 0) &&
    definition.children &&
    definition.children.length > 0;

  const childElements = definition.children?.map((child) => (
    <ControlRenderer key={child.id} definition={child} bindings={bindings} events={events} />
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
