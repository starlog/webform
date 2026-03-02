import type { CSSProperties } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';
import type { DesignerControlProps } from './registry';

export function BindingNavigatorControl({ properties, size }: DesignerControlProps) {
  const theme = useTheme();
  const showAddButton = (properties.showAddButton as boolean) ?? true;
  const showDeleteButton = (properties.showDeleteButton as boolean) ?? true;
  const colors = useControlColors('BindingNavigator', {
    backColor: properties.backColor as string | undefined,
  });

  const btnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 22,
    fontSize: 12,
    cursor: 'default',
    borderRadius: 2,
    border: 'none',
    background: 'transparent',
    padding: 0,
  };

  const sepStyle: CSSProperties = {
    width: 1,
    height: 16,
    backgroundColor: theme.controls.toolStrip.separator,
    margin: '0 3px',
    flexShrink: 0,
  };

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        background: colors.background,
        color: colors.color,
        borderBottom: theme.controls.toolStrip.border,
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        fontSize: '12px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        paddingLeft: 2,
        paddingRight: 2,
        gap: 1,
      }}
    >
      <button style={btnStyle} title="Move first">|&#9664;</button>
      <button style={btnStyle} title="Move previous">&#9664;</button>
      <div style={sepStyle} />
      <input
        type="text"
        value="0"
        readOnly
        style={{
          width: 40,
          height: 18,
          textAlign: 'center',
          fontSize: 11,
          border: theme.controls.textInput.border,
          padding: 0,
        }}
      />
      <span style={{ fontSize: 11, margin: '0 2px' }}>/ 0</span>
      <div style={sepStyle} />
      <button style={btnStyle} title="Move next">&#9654;</button>
      <button style={btnStyle} title="Move last">&#9654;|</button>
      {(showAddButton || showDeleteButton) && <div style={sepStyle} />}
      {showAddButton && <button style={btnStyle} title="Add new">&#10010;</button>}
      {showDeleteButton && <button style={btnStyle} title="Delete">&#10005;</button>}
    </div>
  );
}
