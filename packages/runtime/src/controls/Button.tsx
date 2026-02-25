import type { CSSProperties, ReactNode } from 'react';
import { useTheme } from '../theme/ThemeContext';

interface ButtonProps {
  id: string;
  name: string;
  text?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function Button({ id, text, style, enabled = true, onClick }: ButtonProps) {
  const theme = useTheme();

  const baseStyle: CSSProperties = {
    backgroundColor: theme.controls.button.background,
    border: theme.controls.button.border,
    padding: theme.controls.button.padding,
    borderRadius: theme.controls.button.borderRadius,
    color: theme.controls.button.foreground,
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
