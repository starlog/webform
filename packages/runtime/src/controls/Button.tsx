import { useState, useRef, type CSSProperties, type ReactNode } from 'react';
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
  const [pressed, setPressed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleClick = () => {
    if (!enabled) return;
    setPressed(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPressed(false), 150);
    onClick?.();
  };

  return (
    <button
      className="wf-button"
      data-control-id={id}
      style={{
        ...buttonBaseStyle(theme, colors),
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s, filter 0.1s',
        ...(pressed
          ? { transform: 'scale(0.96)', filter: 'brightness(0.9)' }
          : {}),
        ...style,
      }}
      disabled={!enabled}
      onClick={handleClick}
    >
      {text}
    </button>
  );
}
