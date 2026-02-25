import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface GroupBoxProps {
  id: string;
  name: string;
  text?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function GroupBox({ id, text, backColor, foreColor, style, children }: GroupBoxProps) {
  const theme = useTheme();
  const colors = useControlColors('GroupBox', { backColor, foreColor });

  return (
    <div
      className="wf-groupbox"
      data-control-id={id}
      style={{
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <fieldset style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        border: theme.controls.groupBox.border,
        borderRadius: theme.controls.groupBox.borderRadius,
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}>
        {text && (
          <legend style={{
            padding: '0 4px',
            fontSize: 'inherit',
            color: colors.color,
            marginLeft: 8,
          }}>
            {text}
          </legend>
        )}
      </fieldset>
      {children}
    </div>
  );
}
