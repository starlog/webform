import { useRef, useCallback, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useDesignerStore } from '../../stores/designerStore';

interface EventEditorProps {
  controlId: string;
  eventName: string;
  handlerName: string;
  onClose: () => void;
}

const FORM_CONTEXT_TYPES = `
interface ControlProxy {
  [property: string]: unknown;
}

interface CollectionProxy {
  find(filter?: Record<string, unknown>): Promise<unknown[]>;
  findOne(filter?: Record<string, unknown>): Promise<unknown | null>;
  insertOne(doc: Record<string, unknown>): Promise<{ insertedId: string }>;
  updateOne(filter: Record<string, unknown>, update: Record<string, unknown>): Promise<{ modifiedCount: number }>;
  deleteOne(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

interface DataSourceProxy {
  collection(name: string): CollectionProxy;
}

interface DialogResult {
  dialogResult: 'OK' | 'Cancel';
  data: Record<string, unknown>;
}

interface FormContext {
  formId: string;
  controls: Record<string, ControlProxy>;
  dataSources: Record<string, DataSourceProxy>;
  showDialog(formName: string, params?: Record<string, unknown>): Promise<DialogResult>;
  navigate(formName: string, params?: Record<string, unknown>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
}

declare const ctx: FormContext;
declare const sender: ControlProxy;
`;

export function EventEditor({ controlId, eventName, handlerName, onClose }: EventEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const updateControl = useDesignerStore((s) => s.updateControl);
  const controls = useDesignerStore((s) => s.controls);

  const control = controls.find((c) => c.id === controlId);
  const existingHandlers = (control?.properties._eventHandlers ?? {}) as Record<string, string>;
  const existingCode = (control?.properties._eventCode ?? {}) as Record<string, string>;

  const initialCode = existingCode[handlerName] ??
    `// ${handlerName}(ctx: FormContext, sender: ControlProxy)\n// Event: ${eventName}\n\n`;

  const save = useCallback(() => {
    if (!editorRef.current || !control) return;
    const code = editorRef.current.getValue();

    const updatedCode = { ...existingCode, [handlerName]: code };
    const updatedHandlers = { ...existingHandlers, [eventName]: handlerName };

    updateControl(controlId, {
      properties: {
        ...control.properties,
        _eventHandlers: updatedHandlers,
        _eventCode: updatedCode,
      },
    });
  }, [controlId, control, eventName, handlerName, existingCode, existingHandlers, updateControl]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // TypeScript 타입 힌트 추가
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      FORM_CONTEXT_TYPES,
      'ts:filename/formContext.d.ts',
    );

    // Ctrl+S로 저장
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      save();
    });

    editor.focus();
  }, [save]);

  // Escape 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          width: '80vw',
          height: '70vh',
          backgroundColor: '#1e1e1e',
          border: '1px solid #555',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            backgroundColor: '#2d2d2d',
            color: '#ccc',
            fontSize: 13,
            fontFamily: 'Segoe UI, sans-serif',
          }}
        >
          <span>
            {handlerName} — {eventName} ({control?.name ?? controlId})
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => { save(); onClose(); }}
              style={headerBtnStyle}
            >
              Save & Close
            </button>
            <button
              type="button"
              onClick={onClose}
              style={headerBtnStyle}
            >
              Close
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <div style={{ flex: 1 }}>
          <Editor
            defaultLanguage="typescript"
            defaultValue={initialCode}
            theme="vs-dark"
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              tabSize: 2,
            }}
          />
        </div>

        {/* 하단 상태 바 */}
        <div
          style={{
            padding: '4px 10px',
            backgroundColor: '#007acc',
            color: '#fff',
            fontSize: 11,
            fontFamily: 'Segoe UI, sans-serif',
          }}
        >
          Ctrl+S: Save | Escape: Close
        </div>
      </div>
    </div>
  );
}

const headerBtnStyle: React.CSSProperties = {
  padding: '2px 10px',
  border: '1px solid #555',
  backgroundColor: '#3c3c3c',
  color: '#ccc',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};
