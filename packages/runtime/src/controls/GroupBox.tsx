import type { CSSProperties, ReactNode } from 'react';
import { groupBoxFieldsetStyle, groupBoxLegendStyle } from '@webform/common';
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
      <fieldset style={groupBoxFieldsetStyle(theme)}>
        {text && (
          <legend style={groupBoxLegendStyle(colors)}>
            {text}
          </legend>
        )}
      </fieldset>
      {children}
    </div>
  );
}
