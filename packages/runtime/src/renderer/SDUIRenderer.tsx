import { useEffect } from 'react';
import type { FormDefinition } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { FormContainer } from './FormContainer';
import { ControlRenderer } from './ControlRenderer';

interface SDUIRendererProps {
  formDefinition: FormDefinition;
}

export function SDUIRenderer({ formDefinition }: SDUIRendererProps) {
  const setFormDef = useRuntimeStore((s) => s.setFormDef);

  useEffect(() => {
    setFormDef(formDefinition);
  }, [formDefinition.id, setFormDef]);

  // Form.Load 이벤트 실행
  useEffect(() => {
    const loadHandlers = formDefinition.eventHandlers.filter(
      (e) => e.controlId === formDefinition.id && e.eventName === 'Load',
    );
    for (const handler of loadHandlers) {
      if (handler.handlerType === 'client') {
        try {
          const fn = new Function('sender', 'e', 'ctx', handler.handlerCode);
          fn(null, { type: 'Load', timestamp: Date.now() }, null);
        } catch (err) {
          console.error('Form.Load handler error:', err);
        }
      }
    }
  }, [formDefinition.id]);

  return (
    <FormContainer properties={formDefinition.properties}>
      {formDefinition.controls.map((control) => (
        <ControlRenderer
          key={control.id}
          definition={control}
          bindings={formDefinition.dataBindings}
          events={formDefinition.eventHandlers}
        />
      ))}
    </FormContainer>
  );
}
