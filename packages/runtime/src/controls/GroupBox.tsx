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
    <fieldset
      className="wf-groupbox"
      data-control-id={id}
      style={{
        position: 'relative',
        border: '1px solid #D0D0D0',
        padding: '8px',
        margin: 0,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {text && <legend style={{ padding: '0 4px', fontSize: 'inherit' }}>{text}</legend>}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>{children}</div>
    </fieldset>
  );
}
