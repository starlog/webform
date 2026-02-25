import { useState, useCallback, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react';
import type {
  ApplicationShellDefinition,
  ControlDefinition,
  EventArgs,
} from '@webform/common';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../communication/apiClient';
import { runtimeControlRegistry } from '../controls/registry';
import { computeLayoutStyle, computeFontStyle } from './layoutUtils';
import { useFormResize } from './useFormResize';

interface ShellRendererProps {
  shellDef: ApplicationShellDefinition;
  projectId: string;
  children: ReactNode;
}

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
  parentSize,
}: {
  definition: ControlDefinition;
  projectId: string;
  shellDef: ApplicationShellDefinition;
  parentSize?: { width: number; height: number };
}) {
  const controlState = useRuntimeStore(
    (s) => s.shellControlStates[definition.id] ?? EMPTY_STATE,
  );
  const applyShellPatches = useRuntimeStore((s) => s.applyShellPatches);

  const Component = runtimeControlRegistry[definition.type];
  if (!Component) return null;

  const layoutStyle = computeLayoutStyle(definition, parentSize);
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
          parentSize={definition.size}
        />
      ))}
    </Component>
  );
}

function TrafficLightButtons({ onMaximize, showMinimize = true, showMaximize = true }: { onMaximize?: () => void; showMinimize?: boolean; showMaximize?: boolean }) {
  const btnBase: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginRight: 8,
  };
  const disabledBtn: CSSProperties = {
    ...btnBase,
    backgroundColor: '#ccc',
    cursor: 'default',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
      <button style={{ ...btnBase, backgroundColor: '#FF5F57' }} title="Close" />
      {showMinimize ? (
        <button style={{ ...btnBase, backgroundColor: '#FEBC2E' }} title="Minimize" />
      ) : (
        <button style={disabledBtn} disabled />
      )}
      {showMaximize ? (
        <button style={{ ...btnBase, backgroundColor: '#28C840' }} title="Maximize" onClick={onMaximize} />
      ) : (
        <button style={disabledBtn} disabled />
      )}
    </div>
  );
}

const titleTextStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

export function ShellRenderer({ shellDef, projectId, children }: ShellRendererProps) {
  const theme = useTheme();
  const [maximized, setMaximized] = useState(shellDef.properties.windowState === 'Maximized');
  const toggleMaximize = useCallback(() => setMaximized((prev) => !prev), []);
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
  const showTitleBar = properties.showTitleBar;
  const titleBarHeight = theme.window.titleBar.height;
  const isTrafficLight = theme.window.titleBar.controlButtonsPosition === 'left';

  const titleBarStyle: CSSProperties = {
    height: titleBarHeight,
    background: theme.window.titleBar.background,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    color: theme.window.titleBar.foreground,
    font: theme.window.titleBar.font,
    userSelect: 'none',
    flexShrink: 0,
    borderRadius: theme.window.titleBar.borderRadius,
  };

  const windowButtonStyle: CSSProperties = {
    width: titleBarHeight,
    height: titleBarHeight,
    border: 'none',
    background: 'transparent',
    color: theme.window.titleBar.foreground,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  };

  const isSizable = !maximized && properties.formBorderStyle === 'Sizable';
  const baseHeight = showTitleBar ? properties.height + titleBarHeight : properties.height;

  const { width, height, resizeHandles } = useFormResize({
    initialWidth: properties.width,
    initialHeight: baseHeight,
    enabled: isSizable,
  });

  const borderStyle: CSSProperties =
    properties.formBorderStyle === 'None'
      ? { border: 'none' }
      : { border: theme.window.border };

  const containerStyle: CSSProperties = maximized
    ? {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }
    : {
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: theme.window.shadow,
        borderRadius: theme.window.borderRadius,
        overflow: 'hidden',
        position: 'relative',
        ...borderStyle,
      };

  const contentStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: properties.backgroundColor || theme.form.backgroundColor,
    color: theme.form.foreground,
    overflow: 'hidden',
    fontFamily: theme.form.fontFamily,
    fontSize: theme.form.fontSize,
    ...fontStyles,
  };

  const formAreaStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'auto',
    minHeight: 0,
  };

  const shellSize = { width: properties.width, height: properties.height };

  const renderShellControl = (ctrl: ControlDefinition) => (
    <ShellControlRenderer
      key={ctrl.id}
      definition={ctrl}
      projectId={projectId}
      shellDef={shellDef}
      parentSize={shellSize}
    />
  );

  return (
    <div className="wf-shell" style={containerStyle}>
      {resizeHandles}
      {showTitleBar && (
        <div
          className="wf-titlebar"
          style={titleBarStyle}
          onDoubleClick={properties.maximizeBox ? toggleMaximize : undefined}
        >
          {isTrafficLight && <TrafficLightButtons onMaximize={properties.maximizeBox ? toggleMaximize : undefined} showMinimize={properties.minimizeBox} showMaximize={properties.maximizeBox} />}
          <span style={titleTextStyle}>{properties.title}</span>
          {!isTrafficLight && (
            <>
              {properties.minimizeBox && (
                <button style={windowButtonStyle} title="Minimize">
                  &#x2500;
                </button>
              )}
              {properties.maximizeBox && (
                <button
                  style={windowButtonStyle}
                  title={maximized ? 'Restore' : 'Maximize'}
                  onClick={toggleMaximize}
                >
                  {maximized ? '\u29C9' : '\u25A1'}
                </button>
              )}
              <button style={{ ...windowButtonStyle, fontWeight: 'bold' }} title="Close">
                &#x2715;
              </button>
            </>
          )}
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
