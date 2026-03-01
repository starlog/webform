import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useDesignerStore } from '../../stores/designerStore';
import { buildFormContextTypes } from '../EventEditor/monacoHelpers';

type MonacoInstance = Parameters<OnMount>[1];

interface ItemScriptEditorProps {
  script: string;
  onSave: (code: string) => void;
  onClose: () => void;
}

export function ItemScriptEditor({ script, onSave, onClose }: ItemScriptEditorProps) {
  const [code, setCode] = useState(script);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const extraLibDisposableRef = useRef<{ dispose(): void } | null>(null);

  const controls = useDesignerStore((s) => s.controls);

  const controlsSignature = useMemo(
    () => controls.map((c) => `${c.name}:${c.type}`).join(','),
    [controls],
  );

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        strict: false,
        noEmit: true,
      });

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        diagnosticCodesToIgnore: [1108, 1345, 1375, 1378, 2451, 2683],
      });

      const currentControls = useDesignerStore.getState().controls;
      extraLibDisposableRef.current?.dispose();
      extraLibDisposableRef.current =
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          buildFormContextTypes(currentControls),
          'ts:filename/formContext.d.ts',
        );

      // Ctrl+S로 저장
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onSave(editor.getValue());
      });

      // Shift+Alt+F: Format Document
      editor.addCommand(
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        () => {
          editor.getAction('editor.action.formatDocument')?.run();
        },
      );

      editor.focus();
    },
    [onSave],
  );

  // 컨트롤 변경 시 타입 정의 갱신
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    extraLibDisposableRef.current?.dispose();
    extraLibDisposableRef.current =
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        buildFormContextTypes(controls),
        'ts:filename/formContext.d.ts',
      );
  }, [controlsSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // cleanup
  useEffect(() => {
    return () => {
      extraLibDisposableRef.current?.dispose();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 600,
          height: 480,
          backgroundColor: '#1e1e1e',
          border: '1px solid #555',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            backgroundColor: '#2d2d2d',
            borderBottom: '1px solid #555',
            fontWeight: 600,
            color: '#ccc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Item Script Editor</span>
          <span style={{ fontSize: 11, color: '#888' }}>Ctrl+S to save</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <Editor
            defaultLanguage="typescript"
            defaultValue={script}
            theme="vs-dark"
            onMount={handleMount}
            onChange={(value) => setCode(value ?? '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
              fixedOverflowWidgets: true,
            }}
          />
        </div>
        <div
          style={{
            padding: '6px 8px',
            borderTop: '1px solid #555',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 4,
          }}
        >
          <button type="button" onClick={() => onSave(code)} style={btnStyle}>
            OK
          </button>
          <button type="button" onClick={onClose} style={btnStyle}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '3px 12px',
  border: '1px solid #555',
  backgroundColor: '#3c3c3c',
  color: '#ccc',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
  borderRadius: 2,
};
