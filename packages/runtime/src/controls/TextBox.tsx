import type { CSSProperties, ReactNode } from 'react';
import { TextBoxView } from '@webform/common/views';
import { useRuntimeStore } from '../stores/runtimeStore';

interface TextBoxProps {
  id: string;
  name: string;
  text?: string;
  multiline?: boolean;
  readOnly?: boolean;
  passwordChar?: string;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  enabled?: boolean;
  onTextChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

export function TextBox({
  id, text = '', multiline = false, readOnly = false, passwordChar,
  backColor, foreColor, style, enabled = true, onTextChanged,
}: TextBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateControlState(id, 'text', e.target.value);
    onTextChanged?.();
  };

  return (
    <TextBoxView
      text={text}
      multiline={multiline}
      readOnly={readOnly}
      passwordChar={passwordChar}
      interactive={enabled}
      disabled={!enabled}
      onChange={handleChange}
      backColor={backColor}
      foreColor={foreColor}
      className="wf-textbox"
      data-control-id={id}
      style={style}
    />
  );
}
