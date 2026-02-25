import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';
import { useTheme } from '../theme/ThemeContext';
import { useControlColors } from '../theme/useControlColors';

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
  id,
  text = '',
  multiline = false,
  readOnly = false,
  passwordChar,
  backColor,
  foreColor,
  style,
  enabled = true,
  onTextChanged,
}: TextBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const theme = useTheme();
  const colors = useControlColors('TextBox', { backColor, foreColor });

  const baseStyle: CSSProperties = {
    backgroundColor: colors.backgroundColor,
    border: theme.controls.textInput.border,
    padding: theme.controls.textInput.padding,
    borderRadius: theme.controls.textInput.borderRadius,
    color: colors.color,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
  };

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

  const inputType = passwordChar ? 'password' : 'text';

  return (
    <input
      type={inputType}
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
