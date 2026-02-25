import { useEffect, useMemo } from 'react';
import type { FormDefinition, ControlDefinition } from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';
import { ThemeProvider } from '../theme/ThemeContext';
import { FormContainer } from './FormContainer';
import { ControlRenderer } from './ControlRenderer';

interface SDUIRendererProps {
  formDefinition: FormDefinition;
}

function classifyControls(controls: ControlDefinition[]) {
  const dockTop: ControlDefinition[] = [];
  const dockBottom: ControlDefinition[] = [];
  const dockLeft: ControlDefinition[] = [];
  const dockRight: ControlDefinition[] = [];
  const dockFill: ControlDefinition[] = [];
  const rest: ControlDefinition[] = [];

  for (const c of controls) {
    switch (c.dock) {
      case 'Top':
        dockTop.push(c);
        break;
      case 'Bottom':
        dockBottom.push(c);
        break;
      case 'Left':
        dockLeft.push(c);
        break;
      case 'Right':
        dockRight.push(c);
        break;
      case 'Fill':
        dockFill.push(c);
        break;
      default:
        rest.push(c);
        break;
    }
  }
  return { dockTop, dockBottom, dockLeft, dockRight, dockFill, rest };
}

export function SDUIRenderer({ formDefinition }: SDUIRendererProps) {
  const setFormDef = useRuntimeStore((s) => s.setFormDef);
  const applyPatches = useRuntimeStore((s) => s.applyPatches);

  useEffect(() => {
    setFormDef(formDefinition);
  }, [formDefinition, setFormDef]);

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
  }, [formDefinition.id, formDefinition.eventHandlers]);

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
  }, [formDefinition.id, formDefinition.eventHandlers, applyPatches]);

  const { dockTop, dockBottom, dockLeft, dockRight, dockFill, rest } = useMemo(
    () => classifyControls(formDefinition.controls),
    [formDefinition.controls],
  );

  const bindings = formDefinition.dataBindings;
  const events = formDefinition.eventHandlers;

  const renderControl = (control: ControlDefinition) => (
    <ControlRenderer key={control.id} definition={control} bindings={bindings} events={events} />
  );

  return (
    <ThemeProvider themeId={formDefinition.properties.theme}>
      <FormContainer
        properties={formDefinition.properties}
        dockTop={dockTop.length > 0 ? dockTop.map(renderControl) : undefined}
        dockBottom={dockBottom.length > 0 ? dockBottom.map(renderControl) : undefined}
        dockLeft={dockLeft.length > 0 ? dockLeft.map(renderControl) : undefined}
        dockRight={dockRight.length > 0 ? dockRight.map(renderControl) : undefined}
        dockFill={dockFill.length > 0 ? dockFill.map(renderControl) : undefined}
      >
        {rest.map(renderControl)}
      </FormContainer>
    </ThemeProvider>
  );
}
