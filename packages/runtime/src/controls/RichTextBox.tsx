import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import DOMPurify from 'dompurify';
import {
  RichTextBoxView,
  richTextContentBaseStyle,
  type RichTextCommand,
} from '@webform/common/views';
import { computeFontStyle } from '../renderer/layoutUtils';
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

  // 외부 text prop 변경 시만 innerHTML 동기화 (XSS 방지를 위해 새니타이즈)
  useEffect(() => {
    if (!contentRef.current) return;
    const sanitized = DOMPurify.sanitize(text);
    if (contentRef.current.innerHTML !== sanitized) {
      contentRef.current.innerHTML = sanitized;
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

  const execCommand = useCallback((command: RichTextCommand) => {
    document.execCommand(command, false);
    contentRef.current?.focus();
  }, []);

  const overflow = getOverflow(scrollBars);
  const fontStyles = useMemo(() => computeFontStyle(font), [font]);

  return (
    <RichTextBoxView
      boldActive={boldActive}
      italicActive={italicActive}
      underlineActive={underlineActive}
      backColor={backColor}
      foreColor={foreColor}
      interactive
      disabled={!enabled}
      readOnly={readOnly}
      onCommand={execCommand}
      className="wf-richtextbox"
      data-control-id={id}
      style={{ ...fontStyles, ...style }}
    >
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
          ...richTextContentBaseStyle,
          overflowX: overflow.overflowX as CSSProperties['overflowX'],
          overflowY: overflow.overflowY as CSSProperties['overflowY'],
          outline: 'none',
        }}
      />
    </RichTextBoxView>
  );
}
