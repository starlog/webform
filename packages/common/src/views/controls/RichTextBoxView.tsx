import type { CSSProperties, ReactNode } from 'react';
import { useSharedTheme } from '../theme/ThemeContext.js';
import { useViewControlColors } from '../theme/useControlColors.js';

export type RichTextCommand = 'bold' | 'italic' | 'underline';

export interface RichTextBoxViewProps {
  boldActive?: boolean;
  italicActive?: boolean;
  underlineActive?: boolean;
  backColor?: string;
  foreColor?: string;
  interactive?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onCommand?: (command: RichTextCommand) => void;
  /** 콘텐츠 영역 (runtime: contentEditable div, designer: 정적 텍스트) */
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  'data-control-id'?: string;
}

/** 콘텐츠 영역 공통 베이스 스타일 (호출 측에서 overflow 등을 덧붙여 사용) */
export const richTextContentBaseStyle: CSSProperties = {
  flex: 1,
  padding: 4,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  minHeight: 0,
};

export function RichTextBoxView({
  boldActive = false,
  italicActive = false,
  underlineActive = false,
  backColor,
  foreColor,
  interactive = false,
  disabled = false,
  readOnly = false,
  onCommand,
  children,
  style,
  className,
  'data-control-id': dataControlId,
}: RichTextBoxViewProps) {
  const theme = useSharedTheme();
  const colors = useViewControlColors('RichTextBox', { backColor, foreColor });
  const clickable = interactive && !disabled && !readOnly;

  const rootStyle: CSSProperties = {
    background: colors.background,
    color: colors.color,
    border: theme.controls.textInput.border,
    borderRadius: theme.controls.textInput.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'hidden',
    opacity: disabled ? 0.6 : 1,
    ...style,
  };

  const commandButton = (command: RichTextCommand, active: boolean, textStyle: CSSProperties, label: string) => (
    <button
      onClick={clickable ? () => onCommand?.(command) : undefined}
      disabled={!clickable}
      style={{
        border: theme.controls.textInput.border,
        backgroundColor: active ? theme.accent.primary : theme.controls.panel.background,
        color: active ? theme.accent.primaryForeground : theme.form.foreground,
        width: 22,
        height: 20,
        fontSize: '11px',
        cursor: clickable ? 'pointer' : 'default',
        ...textStyle,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className={className} data-control-id={dataControlId} style={rootStyle}>
      {/* 서식 도구바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 4px',
          borderBottom: theme.controls.textInput.border,
          backgroundColor: theme.controls.panel.background,
          flexShrink: 0,
        }}
      >
        {commandButton('bold', boldActive, { fontWeight: 'bold' }, 'B')}
        {commandButton('italic', italicActive, { fontStyle: 'italic' }, 'I')}
        {commandButton('underline', underlineActive, { textDecoration: 'underline' }, 'U')}
      </div>

      {/* 콘텐츠 영역 */}
      {children}
    </div>
  );
}
