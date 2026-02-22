import { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useDesignerStore } from '../../stores/designerStore';

type MonacoInstance = Parameters<OnMount>[1];

interface DebugLogEntry {
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

interface EventEditorProps {
  controlId: string;
  eventName: string;
  handlerName: string;
  onClose: () => void;
}

const FORM_CONTEXT_TYPES = `
interface ControlProxy {
  [property: string]: any;
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

interface HttpResponse {
  status: number;
  ok: boolean;
  data: any;
}

interface HttpClient {
  get(url: string): HttpResponse;
  post(url: string, body?: unknown): HttpResponse;
  put(url: string, body?: unknown): HttpResponse;
  patch(url: string, body?: unknown): HttpResponse;
  delete(url: string): HttpResponse;
}

interface FormContext {
  formId: string;
  controls: Record<string, ControlProxy>;
  dataSources: Record<string, DataSourceProxy>;
  http: HttpClient;
  showMessage(text: string, title?: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
  showDialog(formName: string, params?: Record<string, unknown>): Promise<DialogResult>;
  navigate(formName: string, params?: Record<string, unknown>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
}

interface Console {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
}

declare const ctx: FormContext;
declare const sender: ControlProxy;
declare const console: Console;
`;

function getSampleCode(controlName: string, controlType: string, eventName: string, handlerName: string): string {
  const header = `// ${handlerName}(ctx: FormContext, sender: ControlProxy)\n// Control: ${controlName} (${controlType})\n// Event: ${eventName}\n\n`;

  // 컨트롤 타입 + 이벤트 조합별 샘플
  const key = `${controlType}.${eventName}`;
  const samples: Record<string, string> = {
    // Button
    'Button.Click': `${header}// 버튼 클릭 시 실행
const name = ctx.controls.txtName?.text;
if (!name) {
  ctx.controls.lblStatus.text = "이름을 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
  return;
}

ctx.controls.lblStatus.text = \`\${name}님, 환영합니다!\`;
ctx.controls.lblStatus.foreColor = "#2e7d32";
`,

    'Button.DoubleClick': `${header}// 버튼 더블클릭 시 실행
ctx.controls.lblStatus.text = "더블클릭 감지됨";
`,

    // TextBox
    'TextBox.TextChanged': `${header}// 텍스트가 변경될 때 실행
const value = sender.text as string;
ctx.controls.lblStatus.text = \`입력값: \${value} (\${value.length}자)\`;
`,

    'TextBox.KeyPress': `${header}// 키 입력 시 실행 (유효성 검사에 유용)
// 숫자만 허용하는 예시:
// const key = sender.keyChar as string;
// if (!/[0-9]/.test(key)) {
//   sender.handled = true;
// }
`,

    'TextBox.Enter': `${header}// 텍스트박스에 포커스가 들어올 때
sender.backColor = "#FFFDE7";
`,

    'TextBox.Leave': `${header}// 텍스트박스에서 포커스가 나갈 때
sender.backColor = "#FFFFFF";

// 필수 입력 검증 예시
const value = sender.text as string;
if (!value) {
  ctx.controls.lblStatus.text = "필수 입력 항목입니다.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
`,

    'TextBox.Validating': `${header}// 유효성 검사 (포커스 이동 전)
const text = sender.text as string;
if (text.length < 2) {
  ctx.controls.lblStatus.text = "2자 이상 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
`,

    // CheckBox
    'CheckBox.CheckedChanged': `${header}// 체크 상태가 변경될 때
const checked = sender.checked as boolean;
ctx.controls.lblStatus.text = checked ? "동의함" : "동의 안 함";

// 다른 컨트롤 활성화/비활성화 예시
// ctx.controls.btnSubmit.enabled = checked;
`,

    'CheckBox.Click': `${header}// 체크박스 클릭 시
const checked = sender.checked as boolean;
ctx.controls.lblStatus.text = \`체크 상태: \${checked}\`;
`,

    // ComboBox
    'ComboBox.SelectedIndexChanged': `${header}// 선택 항목이 변경될 때
const index = sender.selectedIndex as number;
const items = sender.items as string[];
if (index >= 0 && items[index]) {
  ctx.controls.lblStatus.text = \`선택: \${items[index]}\`;
}
`,

    // NumericUpDown
    'NumericUpDown.ValueChanged': `${header}// 값이 변경될 때
const value = sender.value as number;
ctx.controls.lblStatus.text = \`값: \${value}\`;

// 프로그레스바 연동 예시
// ctx.controls.progressBar1.value = value;
`,

    // DateTimePicker
    'DateTimePicker.ValueChanged': `${header}// 날짜가 변경될 때
const date = sender.value as string;
ctx.controls.lblStatus.text = \`선택한 날짜: \${date}\`;
`,

    // ListBox
    'ListBox.SelectedIndexChanged': `${header}// 목록 선택이 변경될 때
const index = sender.selectedIndex as number;
const items = sender.items as string[];
if (index >= 0) {
  ctx.controls.lblStatus.text = \`선택: \${items[index]}\`;
}
`,

    // DataGridView
    'DataGridView.CellClick': `${header}// 셀 클릭 시
// const row = sender.selectedRow as Record<string, unknown>;
// ctx.controls.txtName.text = row?.name ?? "";
`,

    'DataGridView.SelectionChanged': `${header}// 행 선택 변경 시
// const row = sender.selectedRow as Record<string, unknown>;
// if (row) {
//   ctx.controls.lblStatus.text = \`선택된 행: \${JSON.stringify(row)}\`;
// }
`,

    // TabControl
    'TabControl.SelectedIndexChanged': `${header}// 탭 변경 시
const tabIndex = sender.selectedIndex as number;
ctx.controls.lblStatus.text = \`현재 탭: \${tabIndex}\`;
`,
  };

  if (samples[key]) return samples[key];

  // 이벤트별 일반 샘플
  const genericSamples: Record<string, string> = {
    'Click': `${header}// 클릭 시 실행
ctx.controls.lblStatus.text = "${controlName} 클릭됨";
`,
    'DoubleClick': `${header}// 더블클릭 시 실행
ctx.controls.lblStatus.text = "${controlName} 더블클릭됨";
`,
    'MouseEnter': `${header}// 마우스가 들어올 때
// sender.backColor = "#E3F2FD";
`,
    'MouseLeave': `${header}// 마우스가 나갈 때
// sender.backColor = "#FFFFFF";
`,
    'Validating': `${header}// 유효성 검사
// 검증 실패 시 에러 표시
// ctx.controls.lblStatus.text = "유효하지 않은 값입니다.";
// ctx.controls.lblStatus.foreColor = "#d32f2f";
`,
  };

  if (genericSamples[eventName]) return genericSamples[eventName];

  return `${header}// TODO: 이벤트 핸들러 구현
`;
}

export function EventEditor({ controlId, eventName, handlerName, onClose }: EventEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const updateControl = useDesignerStore((s) => s.updateControl);
  const controls = useDesignerStore((s) => s.controls);

  const [consoleVisible, setConsoleVisible] = useState(false);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const control = controls.find((c) => c.id === controlId);
  const existingHandlers = (control?.properties._eventHandlers ?? {}) as Record<string, string>;
  const existingCode = (control?.properties._eventCode ?? {}) as Record<string, string>;

  const initialCode = existingCode[handlerName] ??
    getSampleCode(control?.name ?? controlId, control?.type ?? 'Button', eventName, handlerName);

  const clearMarkers = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, 'debugger', []);
    }
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
  }, []);

  const setErrorMarker = useCallback((line: number, message: string) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    // 에러 마커 (빨간 물결 밑줄)
    monaco.editor.setModelMarkers(model, 'debugger', [
      {
        severity: monaco.MarkerSeverity.Error,
        message,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
      },
    ]);

    // glyph margin 데코레이션 (빨간 원) + 줄 배경
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'debug-error-line',
          glyphMarginClassName: 'debug-error-glyph',
          glyphMarginHoverMessage: { value: message },
          overviewRuler: {
            color: '#f14c4c',
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      },
    ]);
  }, []);

  const setSuccessDecoration = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;

    monaco.editor.setModelMarkers(model, 'debugger', []);
    // 마지막 줄에 성공 glyph 표시
    const lastLine = model.getLineCount();
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, [
      {
        range: new monaco.Range(lastLine, 1, lastLine, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'debug-success-glyph',
          glyphMarginHoverMessage: { value: 'Execution completed successfully' },
        },
      },
    ]);
  }, []);

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

  const runCode = useCallback(async () => {
    if (!editorRef.current || isRunning) return;
    setIsRunning(true);
    setRunStatus('idle');
    if (!consoleVisible) setConsoleVisible(true);

    // 이전 마커/데코레이션 제거
    clearMarkers();

    const code = editorRef.current.getValue();
    try {
      const res = await fetch('/api/debug/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, formState: {} }),
      });
      const data = await res.json();

      if (data.success) {
        const newLogs: DebugLogEntry[] = Array.isArray(data.logs) ? data.logs : [];
        setLogs((prev) => [...prev, ...newLogs]);
        setRunStatus('success');
        setSuccessDecoration();
      } else {
        const errorLog: DebugLogEntry = {
          type: 'error',
          args: [data.error ?? 'Unknown error'],
          timestamp: Date.now(),
        };
        const newLogs: DebugLogEntry[] = Array.isArray(data.logs) ? [...data.logs, errorLog] : [errorLog];
        setLogs((prev) => [...prev, ...newLogs]);
        setRunStatus('error');

        // 에러 줄에 마커 및 데코레이션 설정
        if (typeof data.errorLine === 'number' && data.errorLine > 0) {
          setErrorMarker(data.errorLine, data.error ?? 'Runtime error');
        }
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          type: 'error',
          args: [err instanceof Error ? err.message : 'Network error'],
          timestamp: Date.now(),
        },
      ]);
      setRunStatus('error');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, consoleVisible, clearMarkers, setErrorMarker, setSuccessDecoration]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // TypeScript 컴파일러 옵션 설정
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      strict: false,
      noEmit: true,
    });

    // top-level return 등 진단 오류 억제 (TS1108)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      diagnosticCodesToIgnore: [1108, 1375, 1378],
    });

    // TypeScript 타입 힌트 추가
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      FORM_CONTEXT_TYPES,
      'ts:filename/formContext.d.ts',
    );

    // Ctrl+S로 저장
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      save();
    });

    // F5로 실행
    editor.addCommand(monaco.KeyCode.F5, () => {
      runCode();
    });

    editor.focus();
  }, [save, runCode]);

  // Escape 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const statusBarColor =
    runStatus === 'success' ? '#2e7d32' : runStatus === 'error' ? '#c62828' : '#007acc';

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
      {/* Monaco 데코레이션용 CSS */}
      <style>{`
        .debug-error-glyph {
          background-color: #f14c4c;
          border-radius: 50%;
          margin-left: 4px;
          width: 8px !important;
          height: 8px !important;
          margin-top: 6px;
        }
        .debug-error-line {
          background-color: rgba(241, 76, 76, 0.15);
        }
        .debug-success-glyph {
          background-color: #4caf50;
          border-radius: 50%;
          margin-left: 4px;
          width: 8px !important;
          height: 8px !important;
          margin-top: 6px;
        }
      `}</style>
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
              onClick={runCode}
              disabled={isRunning}
              style={{
                ...headerBtnStyle,
                backgroundColor: '#0e639c',
                color: '#fff',
                border: '1px solid #1177bb',
              }}
            >
              {isRunning ? 'Running...' : '▶ Run'}
            </button>
            <button
              type="button"
              onClick={() => setConsoleVisible((v) => !v)}
              style={headerBtnStyle}
            >
              {consoleVisible ? 'Hide Console' : 'Show Console'}
            </button>
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
        <div style={{ flex: consoleVisible ? 7 : 1 }}>
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
              glyphMargin: true,
            }}
          />
        </div>

        {/* 디버그 콘솔 */}
        {consoleVisible && (
          <DebugConsole logs={logs} onClear={() => setLogs([])} />
        )}

        {/* 하단 상태 바 */}
        <div
          style={{
            padding: '4px 10px',
            backgroundColor: statusBarColor,
            color: '#fff',
            fontSize: 11,
            fontFamily: 'Segoe UI, sans-serif',
            display: 'flex',
            justifyContent: 'space-between',
            transition: 'background-color 0.3s',
          }}
        >
          <span>Ctrl+S: Save | Escape: Close | F5: Run</span>
          {runStatus === 'success' && <span>✓ Execution completed</span>}
          {runStatus === 'error' && <span>✗ Execution failed</span>}
        </div>
      </div>
    </div>
  );
}

const LOG_COLORS: Record<string, string> = {
  log: '#d4d4d4',
  info: '#3794ff',
  warn: '#cca700',
  error: '#f14c4c',
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function DebugConsole({ logs, onClear }: { logs: DebugLogEntry[]; onClear: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      style={{
        flex: 3,
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid #555',
      }}
    >
      {/* 콘솔 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 10px',
          backgroundColor: '#252526',
          color: '#ccc',
          fontSize: 11,
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        <span>Debug Console</span>
        <button
          type="button"
          onClick={onClear}
          style={{
            padding: '1px 8px',
            border: '1px solid #555',
            backgroundColor: '#3c3c3c',
            color: '#ccc',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'Segoe UI, sans-serif',
          }}
        >
          Clear
        </button>
      </div>

      {/* 로그 목록 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 10px',
          backgroundColor: '#1e1e1e',
          fontFamily: 'Consolas, monospace',
          fontSize: 12,
          lineHeight: '18px',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#666', fontStyle: 'italic' }}>
            No output. Click Run or press F5 to execute.
          </div>
        ) : (
          logs.map((entry, i) => (
            <div
              key={i}
              style={{
                color: LOG_COLORS[entry.type] ?? '#d4d4d4',
                display: 'flex',
                gap: 8,
                borderBottom: '1px solid #2a2a2a',
                padding: '1px 0',
              }}
            >
              <span style={{ color: '#666', flexShrink: 0 }}>
                {formatTimestamp(entry.timestamp)}
              </span>
              <span style={{ color: '#666', flexShrink: 0, minWidth: 36 }}>
                [{entry.type}]
              </span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.args.join(' ')}
              </span>
            </div>
          ))
        )}
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
