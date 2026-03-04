import type { CSSProperties } from 'react';
import { buttonBaseStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface ButtonViewProps {
  text?: string;
  backColor?: string;
  foreColor?: string;
  interactive?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function ButtonView({
  text = 'Button',
  backColor,
  foreColor,
  interactive = false,
  pressed = false,
  disabled,
  onClick,
  style,
  className,
  'data-control-id': dataControlId,
}: ButtonViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('Button', { backColor, foreColor });

  return (
    <button
      className={className}
      data-control-id={dataControlId}
      style={{
        ...buttonBaseStyle(theme, colors),
        cursor: interactive ? 'pointer' : 'default',
        pointerEvents: interactive ? 'auto' : 'none',
        transition: interactive ? 'transform 0.1s, box-shadow 0.1s, filter 0.1s' : undefined,
        ...(pressed ? { transform: 'scale(0.96)', filter: 'brightness(0.9)' } : {}),
        ...style,
      }}
      disabled={disabled}
      onClick={interactive ? onClick : undefined}
    >
      {text}
    </button>
  );
}
