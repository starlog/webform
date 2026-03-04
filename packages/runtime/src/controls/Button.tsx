import { useState, useRef, type CSSProperties, type ReactNode } from 'react';
import { ButtonView } from '@webform/common/views';

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
    <ButtonView
      text={text}
      backColor={backColor}
      foreColor={foreColor}
      interactive={enabled}
      pressed={pressed}
      disabled={!enabled}
      onClick={handleClick}
      className="wf-button"
      data-control-id={id}
      style={style}
    />
  );
}
