import type { CSSProperties, ReactNode } from 'react';

interface GroupBoxProps {
  id: string;
  name: string;
  text?: string;
  style?: CSSProperties;
  enabled?: boolean;
  children?: ReactNode;
  [key: string]: unknown;
}

export function GroupBox({ id, text, style, children }: GroupBoxProps) {
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
        border: '1px solid #D0D0D0',
        borderRadius: '2px',
        padding: 0,
        margin: 0,
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }}>
        {text && (
          <legend style={{
            padding: '0 4px',
            fontSize: 'inherit',
            color: '#000',
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
