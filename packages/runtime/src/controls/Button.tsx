import type { CSSProperties, ReactNode } from 'react';
import { buttonBaseStyle } from '@webform/common';
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

  return (
    <button
      className="wf-button"
      data-control-id={id}
      style={{ ...buttonBaseStyle(theme, colors), cursor: 'pointer', ...style }}
      disabled={!enabled}
      onClick={onClick}
    >
      {text}
    </button>
  );
}
