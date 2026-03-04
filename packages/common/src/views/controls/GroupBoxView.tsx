import type { CSSProperties, ReactNode } from 'react';
import { groupBoxFieldsetStyle, groupBoxLegendStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface GroupBoxViewProps {
  text?: string;
  backColor?: string;
  foreColor?: string;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function GroupBoxView({
  text,
  backColor,
  foreColor,
  children,
  style,
  className,
  'data-control-id': dataControlId,
}: GroupBoxViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('GroupBox', { backColor, foreColor });

  return (
    <div
      className={className}
      data-control-id={dataControlId}
      style={{
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        position: 'relative',
        ...style,
      }}
    >
      <fieldset style={groupBoxFieldsetStyle(theme)}>
        {text && <legend style={groupBoxLegendStyle(colors)}>{text}</legend>}
      </fieldset>
      {children}
    </div>
  );
}
