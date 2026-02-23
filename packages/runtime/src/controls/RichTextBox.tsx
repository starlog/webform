import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

type ScrollBars = 'None' | 'Horizontal' | 'Vertical' | 'Both';

interface RichTextBoxProps {
  id: string;
  name: string;
  text?: string;
  readOnly?: boolean;
  scrollBars?: ScrollBars;
  style?: CSSProperties;
  enabled?: boolean;
  backColor?: string;
  foreColor?: string;
  font?: { family?: string; size?: number; bold?: boolean; italic?: boolean };
  onTextChanged?: () => void;
  onSelectionChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

function getOverflow(scrollBars: ScrollBars): { overflowX: string; overflowY: string } {
  switch (scrollBars) {
    case 'None':
      return { overflowX: 'hidden', overflowY: 'hidden' };
    case 'Horizontal':
      return { overflowX: 'auto', overflowY: 'hidden' };
    case 'Vertical':
      return { overflowX: 'hidden', overflowY: 'auto' };
    case 'Both':
    default:
      return { overflowX: 'auto', overflowY: 'auto' };
  }
}

export function RichTextBox({
  id,
  text = '',
  readOnly = false,
  scrollBars = 'Both',
  style,
  enabled = true,
  backColor,
  foreColor,
  font,
  onTextChanged,
  onSelectionChanged,
}: RichTextBoxProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const contentRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [underlineActive, setUnderlineActive] = useState(false);

  // 외부 text prop 변경 시만 innerHTML 동기화
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML !== text) {
      contentRef.current.innerHTML = text;
    }
  }, [text]);

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    if (contentRef.current) {
      updateControlState(id, 'text', contentRef.current.innerHTML);
      onTextChanged?.();
    }
  }, [id, updateControlState, onTextChanged]);

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !contentRef.current) return;
    if (!contentRef.current.contains(sel.anchorNode)) return;

    setBoldActive(document.queryCommandState('bold'));
    setItalicActive(document.queryCommandState('italic'));
    setUnderlineActive(document.queryCommandState('underline'));
    onSelectionChanged?.();
  }, [onSelectionChanged]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const execCommand = useCallback((command: string) => {
    document.execCommand(command, false);
    contentRef.current?.focus();
  }, []);

  const overflow = getOverflow(scrollBars);

  const mergedStyle: CSSProperties = {
    backgroundColor: backColor ?? '#FFFFFF',
    color: foreColor,
    border: '1px inset #D0D0D0',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: font?.family ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: font?.size ? `${font.size}pt` : '12px',
    boxSizing: 'border-box',
    opacity: enabled ? 1 : 0.6,
    ...style,
  };

  return (
    <div className="wf-richtextbox" data-control-id={id} style={mergedStyle}>
      {/* 서식 도구바 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 4px',
          borderBottom: '1px solid #E0E0E0',
          backgroundColor: '#FAFAFA',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => execCommand('bold')}
          disabled={readOnly || !enabled}
          style={{
            border: '1px solid #D0D0D0',
            backgroundColor: boldActive ? '#CCE4F7' : '#F0F0F0',
            fontWeight: 'bold',
            width: 22,
            height: 20,
            fontSize: '11px',
            cursor: readOnly || !enabled ? 'default' : 'pointer',
          }}
        >
          B
        </button>
        <button
          onClick={() => execCommand('italic')}
          disabled={readOnly || !enabled}
          style={{
            border: '1px solid #D0D0D0',
            backgroundColor: italicActive ? '#CCE4F7' : '#F0F0F0',
            fontStyle: 'italic',
            width: 22,
            height: 20,
            fontSize: '11px',
            cursor: readOnly || !enabled ? 'default' : 'pointer',
          }}
        >
          I
        </button>
        <button
          onClick={() => execCommand('underline')}
          disabled={readOnly || !enabled}
          style={{
            border: '1px solid #D0D0D0',
            backgroundColor: underlineActive ? '#CCE4F7' : '#F0F0F0',
            textDecoration: 'underline',
            width: 22,
            height: 20,
            fontSize: '11px',
            cursor: readOnly || !enabled ? 'default' : 'pointer',
          }}
        >
          U
        </button>
      </div>

      {/* 편집 가능한 콘텐츠 영역 */}
      <div
        ref={contentRef}
        contentEditable={!readOnly && enabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onCompositionStart={() => {
          isComposing.current = true;
        }}
        onCompositionEnd={() => {
          isComposing.current = false;
          handleInput();
        }}
        style={{
          flex: 1,
          padding: 4,
          overflowX: overflow.overflowX as CSSProperties['overflowX'],
          overflowY: overflow.overflowY as CSSProperties['overflowY'],
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          minHeight: 0,
        }}
      />
    </div>
  );
}
