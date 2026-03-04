import type { CSSProperties } from 'react';
import { textInputBaseStyle } from '../../styles/controlStyles.js';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export interface TextBoxViewProps {
  text?: string;
  multiline?: boolean;
  readOnly?: boolean;
  passwordChar?: string;
  interactive?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  backColor?: string;
  foreColor?: string;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

export function TextBoxView({
  text = '',
  multiline = false,
  readOnly = false,
  passwordChar,
  interactive = false,
  disabled,
  onChange,
  backColor,
  foreColor,
  style,
  className,
  'data-control-id': dataControlId,
}: TextBoxViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('TextBox', { backColor, foreColor });

  const baseStyle: CSSProperties = {
    ...textInputBaseStyle(theme, colors),
    pointerEvents: interactive ? 'auto' : 'none',
    ...style,
  };

  if (multiline) {
    return (
      <textarea
        className={className}
        data-control-id={dataControlId}
        style={{ ...baseStyle, resize: 'none' }}
        value={text}
        readOnly={readOnly || !interactive}
        disabled={disabled}
        onChange={interactive ? onChange : undefined}
      />
    );
  }

  const inputType = passwordChar ? 'password' : 'text';

  return (
    <input
      type={inputType}
      className={className}
      data-control-id={dataControlId}
      style={baseStyle}
      value={text}
      readOnly={readOnly || !interactive}
      disabled={disabled}
      onChange={interactive ? onChange : undefined}
    />
  );
}
