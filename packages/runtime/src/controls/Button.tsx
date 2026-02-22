import type { CSSProperties, ReactNode } from 'react';

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

const baseStyle: CSSProperties = {
  backgroundColor: '#E1E1E1',
  border: '1px outset #D0D0D0',
  padding: '2px 8px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  cursor: 'pointer',
  boxSizing: 'border-box',
  textAlign: 'center',
};

export function Button({ id, text, style, enabled = true, onClick }: ButtonProps) {
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
