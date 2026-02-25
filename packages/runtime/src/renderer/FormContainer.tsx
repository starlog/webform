import { useState, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import type { FormProperties } from '@webform/common';
import { useTheme } from '../theme/ThemeContext';
import { computeFontStyle } from './layoutUtils';
import { useFormResize } from './useFormResize';
import { useFormDrag } from './useFormDrag';

interface FormContainerProps {
  properties: FormProperties;
  enableDrag?: boolean;
  dockTop?: ReactNode;
  dockBottom?: ReactNode;
  dockLeft?: ReactNode;
  dockRight?: ReactNode;
  dockFill?: ReactNode;
  children: ReactNode;
}

const titleTextStyle: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
};

function TrafficLightButtons({ onMaximize }: { onMaximize?: () => void }) {
  const btnBase: CSSProperties = {
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    marginRight: 8,
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
      <button style={{ ...btnBase, backgroundColor: '#FF5F57' }} title="Close" />
      <button style={{ ...btnBase, backgroundColor: '#FEBC2E' }} title="Minimize" />
      <button style={{ ...btnBase, backgroundColor: '#28C840' }} title="Maximize" onClick={onMaximize} />
    </div>
  );
}

export function FormContainer({
  properties,
  enableDrag = false,
  dockTop,
  dockBottom,
  dockLeft,
  dockRight,
  dockFill,
  children,
}: FormContainerProps) {
  const theme = useTheme();
  const formRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(properties.windowState === 'Maximized');
  const isMaximized = maximized;
  const fontStyles = computeFontStyle(properties.font);

  const { position, onTitleBarMouseDown, resetPosition } = useFormDrag({
    enabled: enableDrag,
    isMaximized,
    formRef,
  });

  const toggleMaximize = useCallback(() => {
    setMaximized((prev) => {
      if (prev) resetPosition();
      return !prev;
    });
  }, [resetPosition]);

  const showTitleBar = properties.formBorderStyle !== 'None';

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

  const isSizable = !isMaximized && properties.formBorderStyle === 'Sizable';
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

  const containerStyle: CSSProperties = isMaximized
    ? {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }
    : {
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: theme.window.shadow,
        borderRadius: theme.window.borderRadius,
        overflow: 'hidden',
        position: enableDrag ? ('absolute' as const) : ('relative' as const),
        ...(enableDrag ? { left: position.x, top: position.y } : {}),
        ...borderStyle,
      };

  const contentStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    backgroundColor: properties.backgroundColor || theme.form.backgroundColor,
    color: theme.form.foreground,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: theme.form.fontFamily,
    fontSize: theme.form.fontSize,
    ...fontStyles,
  };

  const middleStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 0,
  };

  const centerStyle: CSSProperties = {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
  };

  return (
    <div ref={formRef} className="wf-form" style={containerStyle}>
      {resizeHandles}
      {showTitleBar && (
        <div
          className="wf-titlebar"
          style={{
            ...titleBarStyle,
            cursor: enableDrag && !isMaximized ? 'move' : 'default',
          }}
          onMouseDown={onTitleBarMouseDown}
          onDoubleClick={properties.maximizeBox ? toggleMaximize : undefined}
        >
          {isTrafficLight && <TrafficLightButtons onMaximize={properties.maximizeBox ? toggleMaximize : undefined} />}
          <span style={titleTextStyle}>{properties.title}</span>
          {!isTrafficLight && (
            <>
              {properties.minimizeBox && (
                <button style={windowButtonStyle} title="Minimize">&#x2500;</button>
              )}
              {properties.maximizeBox && (
                <button style={windowButtonStyle} title={isMaximized ? 'Restore' : 'Maximize'} onClick={toggleMaximize}>
                  {isMaximized ? '\u29C9' : '\u25A1'}
                </button>
              )}
              <button
                style={{ ...windowButtonStyle, fontWeight: 'bold' }}
                title="Close"
              >
                &#x2715;
              </button>
            </>
          )}
        </div>
      )}
      <div className="wf-content" style={contentStyle}>
        {dockTop}
        <div style={middleStyle}>
          {dockLeft}
          <div className="wf-center" style={centerStyle}>
            {dockFill}
            {children}
          </div>
          {dockRight}
        </div>
        {dockBottom}
      </div>
    </div>
  );
}
