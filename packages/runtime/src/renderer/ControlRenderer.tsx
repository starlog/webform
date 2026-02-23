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
      {definition.children?.map((child) => (
        <ControlRenderer
          key={child.id}
          definition={child}
          bindings={bindings}
          events={events}
        />
      ))}
    </Component>
  );
}
