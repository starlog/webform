import { useEffect } from 'react';
import type { FormDefinition } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';
import { FormContainer } from './FormContainer';
import { ControlRenderer } from './ControlRenderer';

interface SDUIRendererProps {
  formDefinition: FormDefinition;
}

export function SDUIRenderer({ formDefinition }: SDUIRendererProps) {
  const setFormDef = useRuntimeStore((s) => s.setFormDef);
  const applyPatches = useRuntimeStore((s) => s.applyPatches);

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

  // Form.OnLoading 이벤트 실행 (서버 사이드)
  useEffect(() => {
    const onLoadingHandlers = formDefinition.eventHandlers.filter(
      (e) => e.controlId === formDefinition.id && e.eventName === 'OnLoading',
    );
    if (onLoadingHandlers.length === 0) return;

    const formId = formDefinition.id;
    const formState = useRuntimeStore.getState().controlStates;

    for (const handler of onLoadingHandlers) {
      if (handler.handlerType === 'server') {
        apiClient
          .postEvent(formId, {
            formId,
            controlId: formId,
            eventName: 'OnLoading',
            eventArgs: { type: 'OnLoading', timestamp: Date.now() },
            formState,
          })
          .then((response) => {
            if (response.success && response.patches) {
              applyPatches(response.patches);
            }
          })
          .catch((err) => {
            console.error('Form.OnLoading handler error:', err);
          });
      }
    }
  }, [formDefinition.id, applyPatches]);

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
