import { useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import type {
  ApplicationShellDefinition,
  ControlDefinition,
  EventArgs,
} from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { apiClient } from '../communication/apiClient';
import { runtimeControlRegistry } from '../controls/registry';
import { computeLayoutStyle, computeFontStyle } from './layoutUtils';

interface ShellRendererProps {
  shellDef: ApplicationShellDefinition;
  projectId: string;
  children: ReactNode;
}

const TITLE_BAR_HEIGHT = 30;

/**
 * Shell 컨트롤을 dock 위치별로 분류.
 * Shell에서는 주로 Top(MenuStrip, ToolStrip), Bottom(StatusStrip) 사용.
 */
function classifyShellControls(controls: ControlDefinition[]) {
  const dockTop: ControlDefinition[] = [];
  const dockBottom: ControlDefinition[] = [];
  const rest: ControlDefinition[] = [];

  for (const c of controls) {
    switch (c.dock) {
      case 'Top':
        dockTop.push(c);
        break;
      case 'Bottom':
        dockBottom.push(c);
        break;
      default:
        rest.push(c);
        break;
    }
  }
  return { dockTop, dockBottom, rest };
}

const EMPTY_STATE: Record<string, unknown> = {};

/**
 * Shell 컨트롤 렌더러.
 * Form의 ControlRenderer와 유사하지만 shellControlStates를 사용하고
 * 이벤트는 postShellEvent API를 호출한다.
 */
function ShellControlRenderer({
  definition,
  projectId,
  shellDef,
}: {
  definition: ControlDefinition;
  projectId: string;
  shellDef: ApplicationShellDefinition;
}) {
  const controlState = useRuntimeStore(
    (s) => s.shellControlStates[definition.id] ?? EMPTY_STATE,
  );
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);

  const Component = runtimeControlRegistry[definition.type];
  if (!Component) return null;

  const layoutStyle = computeLayoutStyle(definition);
  if (controlState.visible === false) return null;

  // Shell 이벤트 핸들러 생성
  const eventHandlers: Record<string, () => void> = {};

  const relevantEvents = shellDef.eventHandlers.filter(
    (e) => e.controlId === definition.id,
  );
  for (const evt of relevantEvents) {
    const propName = `on${evt.eventName}`;
    eventHandlers[propName] = async () => {
      const eventArgs: EventArgs = { type: evt.eventName, timestamp: Date.now() };
      try {
        const response = await apiClient.postShellEvent(projectId, {
          projectId,
          controlId: definition.id,
          eventName: evt.eventName,
          eventArgs,
          shellState: useRuntimeStore.getState().shellControlStates,
          currentFormId: useRuntimeStore.getState().currentFormDef?.id ?? '',
        });
        if (response.success && response.patches) {
          applyShellPatches(response.patches);
        }
      } catch (err) {
        console.error(`Shell event error [${definition.id}.${evt.eventName}]:`, err);
      }
    };
  }

  return (
    <Component
      id={definition.id}
      name={definition.name}
      {...controlState}
      {...eventHandlers}
      style={layoutStyle}
      enabled={controlState.enabled ?? definition.enabled}
    >
      {definition.children?.map((child) => (
        <ShellControlRenderer
          key={child.id}
          definition={child}
          projectId={projectId}
          shellDef={shellDef}
        />
      ))}
    </Component>
  );
}

function getBorderStyle(
  formBorderStyle: ApplicationShellDefinition['properties']['formBorderStyle'],
): CSSProperties {
  switch (formBorderStyle) {
    case 'None':
      return { border: 'none' };
    case 'FixedSingle':
      return { border: '1px solid #333333' };
    case 'Fixed3D':
      return { border: '2px inset #D0D0D0' };
    case 'Sizable':
      return { border: '1px solid #333333', resize: 'both', overflow: 'auto' };
    default:
      return { border: '1px solid #333333' };
  }
}

const titleBarStyle: CSSProperties = {
  height: TITLE_BAR_HEIGHT,
  background: 'linear-gradient(to right, #0078D7, #005A9E)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  color: '#FFFFFF',
  fontSize: '12px',
  fontFamily: 'Segoe UI, sans-serif',
  userSelect: 'none',
  flexShrink: 0,
};

const titleTextStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

const windowButtonStyle: CSSProperties = {
  width: 30,
  height: 30,
  border: 'none',
  background: 'transparent',
  color: '#FFFFFF',
  fontSize: '14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

export function ShellRenderer({ shellDef, projectId, children }: ShellRendererProps) {
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);

  // Shell.Load 이벤트 실행
  useEffect(() => {
    const loadHandlers = shellDef.eventHandlers.filter(
      (e) => e.controlId === shellDef.id && e.eventName === 'Load',
    );
    if (loadHandlers.length === 0) return;

    for (const handler of loadHandlers) {
      if (handler.handlerType === 'server') {
        apiClient
          .postShellEvent(projectId, {
            projectId,
            controlId: shellDef.id,
            eventName: 'Load',
            eventArgs: { type: 'Load', timestamp: Date.now() },
            shellState: useRuntimeStore.getState().shellControlStates,
            currentFormId: useRuntimeStore.getState().currentFormDef?.id ?? '',
          })
          .then((response) => {
            if (response.success && response.patches) {
              applyShellPatches(response.patches);
            }
          })
          .catch((err) => console.error('Shell.Load handler error:', err));
      }
    }
  }, [shellDef.id, shellDef.eventHandlers, projectId, applyShellPatches]);

  const { dockTop, dockBottom } = useMemo(
    () => classifyShellControls(shellDef.controls),
    [shellDef.controls],
  );

  const { properties } = shellDef;
  const fontStyles = computeFontStyle(properties.font);
  const borderStyles = getBorderStyle(properties.formBorderStyle);
  const showTitleBar = properties.showTitleBar;

  const containerStyle: CSSProperties = {
    width: properties.width,
    height: showTitleBar ? properties.height + TITLE_BAR_HEIGHT : properties.height,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    ...borderStyles,
  };

  const contentStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: properties.backgroundColor || '#F0F0F0',
    overflow: 'hidden',
    ...fontStyles,
  };

  const formAreaStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'auto',
    minHeight: 0,
  };

  const renderShellControl = (ctrl: ControlDefinition) => (
    <ShellControlRenderer
      key={ctrl.id}
      definition={ctrl}
      projectId={projectId}
      shellDef={shellDef}
    />
  );

  return (
    <div className="wf-shell" style={containerStyle}>
      {showTitleBar && (
        <div className="wf-titlebar" style={titleBarStyle}>
          <span style={titleTextStyle}>{properties.title}</span>
          {properties.minimizeBox && (
            <button style={windowButtonStyle} title="Minimize">
              &#x2500;
            </button>
          )}
          {properties.maximizeBox && (
            <button style={windowButtonStyle} title="Maximize">
              &#x25A1;
            </button>
          )}
          <button style={{ ...windowButtonStyle, fontWeight: 'bold' }} title="Close">
            &#x2715;
          </button>
        </div>
      )}

      <div style={contentStyle}>
        {/* Dock Top: MenuStrip, ToolStrip 등 */}
        {dockTop.map(renderShellControl)}

        {/* FormArea: 교체 가능한 폼 영역 */}
        <div className="wf-shell-form-area" style={formAreaStyle}>
          {children}
        </div>

        {/* Dock Bottom: StatusStrip 등 */}
        {dockBottom.map(renderShellControl)}
      </div>
    </div>
  );
}
