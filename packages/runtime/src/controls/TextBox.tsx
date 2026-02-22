import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface TextBoxProps {
  id: string;
  name: string;
  text?: string;
  multiline?: boolean;
  readOnly?: boolean;
  style?: CSSProperties;
  enabled?: boolean;
  onTextChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

const baseStyle: CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: '1px inset #A0A0A0',
  padding: '2px 4px',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  boxSizing: 'border-box',
};

export function TextBox({
  id,
  text = '',
  multiline = false,
  readOnly = false,
  style,
  enabled = true,
  onTextChanged,
}: TextBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateControlState(id, 'text', e.target.value);
    onTextChanged?.();
  };

  const mergedStyle: CSSProperties = {
    ...baseStyle,
    ...style,
    resize: multiline ? 'none' : undefined,
  };

  if (multiline) {
    return (
      <textarea
        className="wf-textbox"
        data-control-id={id}
        style={mergedStyle}
        value={text}
        readOnly={readOnly}
        disabled={!enabled}
        onChange={handleChange}
      />
    );
  }

  return (
    <input
      type="text"
      className="wf-textbox"
      data-control-id={id}
      style={mergedStyle}
      value={text}
      readOnly={readOnly}
      disabled={!enabled}
      onChange={handleChange}
    />
  );
}
