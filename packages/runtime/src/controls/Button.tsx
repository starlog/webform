import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

interface ButtonProps {
  id: string;
  name: string;
  text?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Button({ id, text, backColor, foreColor, style, enabled = true, onClick }: ButtonProps) {
  const theme = useTheme();
  const colors = useControlColors('Button', { backColor, foreColor });

  const baseStyle: CSSProperties = {
    backgroundColor: colors.backgroundColor,
    border: theme.controls.button.border,
    padding: theme.controls.button.padding,
    borderRadius: theme.controls.button.borderRadius,
    color: colors.color,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    boxSizing: 'border-box',
    textAlign: 'center',
  };

  return (
    <button
      className="wf-button"
      data-control-id={id}
      style={{ ...baseStyle, ...style }}
      disabled={!enabled}
      onClick={onClick}
    >
      {text}
    </button>
  );
}
