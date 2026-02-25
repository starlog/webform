import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useDesignerStore } from '../../stores/designerStore';
import type { ControlDefinition } from '@webform/common';
import { CONTROL_PROPERTY_META, type PropertyMeta } from '../PropertyPanel/controlProperties';
import { useFocusTrap } from '../../hooks/useFocusTrap';

type MonacoInstance = Parameters<OnMount>[1];

interface DebugLogEntry {
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

interface TraceEntry {
  line: number;
  column: number;
  timestamp: number;
  variables: Record<string, string>;
  duration?: number;
  ctxControls?: Record<string, string>;
}

interface ExecutionSummary {
  executedLines: number;
  totalLines: number;
  executionTime: number;
  trackedVars: number;
}

interface EventEditorProps {
  controlId: string;
  eventName: string;
  handlerName: string;
  onClose: () => void;
  onSaveToServer?: () => void;
}

const FORM_CONTEXT_BASE_TYPES = `
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

interface Console {
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
}
`;

function metaToTsType(meta: PropertyMeta): string {
  switch (meta.editorType) {
    case 'text': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'color': return 'string';
    case 'font': return '{ family: string; size: number; bold: boolean; italic: boolean }';
    case 'dropdown':
      return meta.options?.length
        ? meta.options.map((o) => `'${o}'`).join(' | ')
        : 'string';
    case 'collection': return 'any[]';
    default: return 'any';
  }
}

function buildControlTypeInterface(controlType: string): { name: string; body: string } {
  const metas = CONTROL_PROPERTY_META[controlType as keyof typeof CONTROL_PROPERTY_META] ?? [];
  const props: string[] = [];

  for (const meta of metas) {
    if (meta.name.startsWith('properties.')) {
      const propName = meta.name.slice('properties.'.length);
      props.push(`  ${propName}: ${metaToTsType(meta)};`);
    }
  }
  props.push('  visible: boolean;');
  props.push('  enabled: boolean;');
  props.push('  [key: string]: any;');

  const ifaceName = `__${controlType}Props`;
  return { name: ifaceName, body: `interface ${ifaceName} {\n${props.join('\n')}\n}` };
}

function buildFormContextTypes(controls: ControlDefinition[]): string {
  const typeInterfaces = new Map<string, string>();
  const controlEntries: string[] = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      const { name: ifaceName, body } = buildControlTypeInterface(ctrl.type);
      if (!typeInterfaces.has(ifaceName)) {
        typeInterfaces.set(ifaceName, body);
      }
      controlEntries.push(`  ${ctrl.name}: ${ifaceName};`);
      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);

  const dynamicInterfaces = [...typeInterfaces.values()].join('\n\n');
  const formControlsIface = controlEntries.length
    ? `interface FormControls {\n${controlEntries.join('\n')}\n  [name: string]: ControlProxy;\n}`
    : 'interface FormControls { [name: string]: ControlProxy; }';

  return `${FORM_CONTEXT_BASE_TYPES}
${dynamicInterfaces}

${formControlsIface}

interface FormContext {
  formId: string;
  controls: FormControls;
  dataSources: Record<string, DataSourceProxy>;
  http: HttpClient;
  showMessage(text: string, title?: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
  showDialog(formId: string, params?: Record<string, unknown>): Promise<DialogResult>;
  navigate(formId: string, params?: Record<string, unknown>): void;
  close(dialogResult?: 'OK' | 'Cancel'): void;
  getRadioGroupValue(groupName: string): string | null;
}

declare const ctx: FormContext;
declare const sender: ControlProxy;
declare const console: Console;
`;
}

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
const value = sender.text;
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
const value = sender.text;
if (!value) {
  ctx.controls.lblStatus.text = "필수 입력 항목입니다.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
`,

    'TextBox.Validating': `${header}// 유효성 검사 (포커스 이동 전)
const text = sender.text;
if (text.length < 2) {
  ctx.controls.lblStatus.text = "2자 이상 입력해주세요.";
  ctx.controls.lblStatus.foreColor = "#d32f2f";
}
`,

    // CheckBox
    'CheckBox.CheckedChanged': `${header}// 체크 상태가 변경될 때
const checked = sender.checked;
ctx.controls.lblStatus.text = checked ? "동의함" : "동의 안 함";

// 다른 컨트롤 활성화/비활성화 예시
// ctx.controls.btnSubmit.enabled = checked;
`,

    'CheckBox.Click': `${header}// 체크박스 클릭 시
const checked = sender.checked;
ctx.controls.lblStatus.text = \`체크 상태: \${checked}\`;
`,

    // ComboBox
    'ComboBox.SelectedIndexChanged': `${header}// 선택 항목이 변경될 때
const index = sender.selectedIndex;
const items = sender.items;
if (index >= 0 && items[index]) {
  ctx.controls.lblStatus.text = \`선택: \${items[index]}\`;
}
`,

    // NumericUpDown
    'NumericUpDown.ValueChanged': `${header}// 값이 변경될 때
const value = sender.value;
ctx.controls.lblStatus.text = \`값: \${value}\`;

// 프로그레스바 연동 예시
// ctx.controls.progressBar1.value = value;
`,

    // DateTimePicker
    'DateTimePicker.ValueChanged': `${header}// 날짜가 변경될 때
const date = sender.value;
ctx.controls.lblStatus.text = \`선택한 날짜: \${date}\`;
`,

    // ListBox
    'ListBox.SelectedIndexChanged': `${header}// 목록 선택이 변경될 때
const index = sender.selectedIndex;
const items = sender.items;
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
const tabIndex = sender.selectedIndex;
ctx.controls.lblStatus.text = \`현재 탭: \${tabIndex}\`;
`,

    // SpreadsheetView
    'SpreadsheetView.CellChanged': `${header}// 셀 값이 변경될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`셀 값 변경됨\`;
`,

    'SpreadsheetView.RowAdded': `${header}// 새 행이 추가될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`행 추가됨 (총 \${data.length}행)\`;
`,

    'SpreadsheetView.RowDeleted': `${header}// 행이 삭제될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`행 삭제됨 (총 \${data.length}행)\`;
`,

    'SpreadsheetView.SelectionChanged': `${header}// 셀 선택이 변경될 때
// ctx.controls.lblStatus.text = "선택 변경됨";
`,

    'SpreadsheetView.DataLoaded': `${header}// 데이터가 로드될 때
// const data = sender.data;
// ctx.controls.lblStatus.text = \`데이터 로드됨 (\${data.length}행)\`;
`,

    // Form events
    'Form.OnLoading': `${header}// 폼이 로드될 때 실행 — 컨트롤 초기화에 적합
// ctx.controls.lblTitle.text = "환영합니다!";
// ctx.controls.comboBox1.items = ["옵션1", "옵션2", "옵션3"];
// ctx.controls.comboBox1.selectedIndex = 0;
`,

    'Form.BeforeLeaving': `${header}// 폼을 떠나기 전 실행 — 저장, 정리에 적합
// const unsaved = ctx.controls.txtContent.text;
// if (unsaved) {
//   ctx.showMessage("저장되지 않은 변경사항이 있습니다.", "경고", "warning");
// }
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

/** CSS content 속성에 사용할 문자열 이스케이프 */
function escapeCssContent(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\27 ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

export function EventEditor({ controlId, eventName, handlerName, onClose, onSaveToServer }: EventEditorProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const traceDecorationIdsRef = useRef<string[]>([]);
  const debugStyleRef = useRef<HTMLStyleElement | null>(null);
  const updateControl = useDesignerStore((s) => s.updateControl);
  const controls = useDesignerStore((s) => s.controls);

  // 드래그 이동 상태
  const [dialogPos, setDialogPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const activeDragListeners = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true);

  // 드래그 중 언마운트 시 document 리스너 안전 정리
  useEffect(() => {
    return () => {
      const { move, up } = activeDragListeners.current;
      if (move) document.removeEventListener('mousemove', move);
      if (up) document.removeEventListener('mouseup', up);
    };
  }, []);

  const [debugPanelHeight, setDebugPanelHeight] = useState(200);
  const [isDirty, setIsDirty] = useState(false);
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runStatus, setRunStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [debugTab, setDebugTab] = useState<'console' | 'variables' | 'watch'>('console');
  const [watchExpressions, setWatchExpressions] = useState<string[]>([]);

  // Breakpoint & Step-Through 디버거 상태
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [debugState, setDebugState] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [stepIndex, setStepIndex] = useState<number>(0);
  const breakpointDecorationIdsRef = useRef<string[]>([]);
  const allTracesRef = useRef<TraceEntry[]>([]);
  const allLogsRef = useRef<DebugLogEntry[]>([]);
  const allExecutionTimeRef = useRef<number>(0);

  // Monaco extraLib 동적 갱신용
  const extraLibDisposableRef = useRef<{ dispose(): void } | null>(null);

  // Monaco command handler용 refs (stale closure 방지)
  const debugStateRef = useRef<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const stepIndexRef = useRef<number>(0);
  const breakpointsRef = useRef<Set<number>>(new Set());

  const isFormEvent = controlId === '__form__';
  const control = isFormEvent ? null : controls.find((c) => c.id === controlId);

  const formEventHandlers = useDesignerStore((s) => s.formEventHandlers);
  const formEventCode = useDesignerStore((s) => s.formEventCode);
  const setFormEventHandler = useDesignerStore((s) => s.setFormEventHandler);
  const setFormEventCode = useDesignerStore((s) => s.setFormEventCode);

  const existingHandlers = useMemo(
    () => isFormEvent
      ? formEventHandlers
      : (control?.properties._eventHandlers ?? {}) as Record<string, string>,
    [isFormEvent, formEventHandlers, control?.properties._eventHandlers],
  );
  const existingCode = useMemo(
    () => isFormEvent
      ? formEventCode
      : (control?.properties._eventCode ?? {}) as Record<string, string>,
    [isFormEvent, formEventCode, control?.properties._eventCode],
  );

  const initialCode = existingCode[handlerName] ??
    getSampleCode(
      isFormEvent ? 'Form' : (control?.name ?? controlId),
      isFormEvent ? 'Form' : (control?.type ?? 'Button'),
      eventName,
      handlerName,
    );

  // 동적 CSS 스타일 엘리먼트 정리
  useEffect(() => {
    return () => {
      if (debugStyleRef.current) {
        debugStyleRef.current.remove();
        debugStyleRef.current = null;
      }
    };
  }, []);

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

  /** trace 데코레이션 + 동적 CSS + 실행 요약 초기화 */
  const clearDebugDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      traceDecorationIdsRef.current = editor.deltaDecorations(traceDecorationIdsRef.current, []);
    }
    if (debugStyleRef.current) {
      debugStyleRef.current.textContent = '';
    }
    setExecutionSummary(null);
  }, []);

  // state와 ref를 함께 업데이트하는 헬퍼
  const updateDebugState = useCallback((state: 'idle' | 'running' | 'paused' | 'completed') => {
    debugStateRef.current = state;
    setDebugState(state);
  }, []);

  const updateStepIndex = useCallback((idx: number) => {
    stepIndexRef.current = idx;
    setStepIndex(idx);
  }, []);

  /** 모든 디버그 시각화 초기화 (Clear Debug 버튼용) */
  const clearAllDebug = useCallback(() => {
    clearMarkers();
    clearDebugDecorations();
    setRunStatus('idle');
    setTraces([]);
    updateDebugState('idle');
    updateStepIndex(0);
    allTracesRef.current = [];
    allLogsRef.current = [];
  }, [clearMarkers, clearDebugDecorations, updateDebugState, updateStepIndex]);

  /** 브레이크포인트 데코레이션 적용 (trace 데코레이션과 독립) */
  const applyBreakpointDecorations = useCallback((bps: Set<number>) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const decorations = Array.from(bps).map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'debug-breakpoint-glyph',
      },
    }));

    breakpointDecorationIdsRef.current = editor.deltaDecorations(
      breakpointDecorationIdsRef.current,
      decorations,
    );
  }, []);

  /** 브레이크포인트 토글 */
  const toggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      breakpointsRef.current = next;
      applyBreakpointDecorations(next);
      return next;
    });
  }, [applyBreakpointDecorations]);

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

  /** trace 데이터를 기반으로 인라인 변수값, 실행 흐름, 느린 줄 데코레이션 적용
   * @param upToIndex - 이 인덱스까지의 trace만 반영 (stepping 모드용)
   * @param currentStepLine - 현재 step 줄 번호 (노란 화살표 표시용)
   */
  const applyTraceDecorations = useCallback((
    traces: TraceEntry[],
    executionTime: number,
    upToIndex?: number,
    currentStepLine?: number,
  ) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || traces.length === 0) return;
    const model = editor.getModel();
    if (!model) return;

    const visibleTraces = upToIndex != null ? traces.slice(0, upToIndex + 1) : traces;

    // 줄별 변수 집계 (마지막 trace가 우선)
    const lineVars = new Map<number, Record<string, string>>();
    const lineDuration = new Map<number, number>();
    const allVarNames = new Set<string>();

    for (const trace of visibleTraces) {
      const prev = lineVars.get(trace.line) ?? {};
      lineVars.set(trace.line, { ...prev, ...trace.variables });
      if (trace.duration != null) {
        lineDuration.set(trace.line, Math.max(lineDuration.get(trace.line) ?? 0, trace.duration));
      }
      for (const v of Object.keys(trace.variables)) allVarNames.add(v);
    }

    const totalLines = model.getLineCount();
    const executedLineNums = new Set(lineVars.keys());

    // 코드 줄 수 계산 (빈 줄, 순수 주석 줄 제외)
    let codeLineCount = 0;
    for (let i = 1; i <= totalLines; i++) {
      const content = model.getLineContent(i).trim();
      if (content && !content.startsWith('//')) codeLineCount++;
    }

    setExecutionSummary({
      executedLines: executedLineNums.size,
      totalLines: codeLineCount,
      executionTime,
      trackedVars: allVarNames.size,
    });

    // 데코레이션 및 CSS 규칙 구성
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decorations: Array<{ range: any; options: any }> = [];
    const cssRules: string[] = [];

    for (let line = 1; line <= totalLines; line++) {
      const lineContent = model.getLineContent(line).trim();
      if (!lineContent) continue; // 빈 줄 건너뛰기

      if (executedLineNums.has(line)) {
        if (currentStepLine != null && line === currentStepLine) {
          // 현재 step 줄: 노란 화살표 glyph + 노란 배경
          decorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: true,
              className: 'debug-current-line',
              glyphMarginClassName: 'debug-current-line-glyph',
            },
          });
        } else {
          // 실행된 줄: 녹색 glyph
          decorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              isWholeLine: false,
              glyphMarginClassName: 'debug-executed-glyph',
            },
          });
        }

        // 인라인 변수값 표시
        const vars = lineVars.get(line)!;
        const entries = Object.entries(vars);
        if (entries.length > 0) {
          const text = entries.map(([k, v]) => `${k} = ${v}`).join(', ');
          const escaped = escapeCssContent(text);
          const className = `debug-inline-val-L${line}`;
          cssRules.push(
            `.monaco-editor .${className}::after { content: '  ${escaped}'; }`,
          );

          decorations.push({
            range: new monaco.Range(
              line,
              model.getLineMaxColumn(line),
              line,
              model.getLineMaxColumn(line),
            ),
            options: {
              afterContentClassName: className,
            },
          });
        }

        // 느린 줄 하이라이트 (100ms 초과) - 현재 step 줄이 아닌 경우에만
        if (currentStepLine == null || line !== currentStepLine) {
          const dur = lineDuration.get(line);
          if (dur && dur > 100) {
            decorations.push({
              range: new monaco.Range(line, 1, line, 1),
              options: {
                isWholeLine: true,
                className: 'debug-slow-line',
              },
            });
          }
        }
      } else if (!lineContent.startsWith('//') && currentStepLine == null) {
        // 실행되지 않은 코드 줄: 회색 배경 (stepping 모드가 아닐 때만)
        decorations.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'debug-unexecuted-line',
          },
        });
      }
    }

    // 동적 CSS 주입
    if (!debugStyleRef.current) {
      debugStyleRef.current = document.createElement('style');
      debugStyleRef.current.setAttribute('data-debug-inline', 'true');
      document.head.appendChild(debugStyleRef.current);
    }
    debugStyleRef.current.textContent = cssRules.join('\n');

    // 데코레이션 적용
    traceDecorationIdsRef.current = editor.deltaDecorations(
      traceDecorationIdsRef.current,
      decorations,
    );
  }, []);

  /** trace를 특정 인덱스까지 표시하고 paused 상태로 유지 */
  const showTracesUpTo = useCallback((idx: number) => {
    const allTraces = allTracesRef.current;
    if (allTraces.length === 0) return;

    const clampedIdx = Math.min(idx, allTraces.length - 1);
    updateStepIndex(clampedIdx);

    const currentLine = allTraces[clampedIdx].line;
    const visibleTraces = allTraces.slice(0, clampedIdx + 1);

    applyTraceDecorations(allTraces, allExecutionTimeRef.current, clampedIdx, currentLine);
    setTraces(visibleTraces);

    // 현재 step timestamp 이전 logs만 표시
    const currentTimestamp = allTraces[clampedIdx].timestamp;
    const filteredLogs = allLogsRef.current.filter((log) => log.timestamp <= currentTimestamp);
    setLogs(filteredLogs);
  }, [applyTraceDecorations, updateStepIndex]);

  /** 디버깅 완료: 전체 결과 표시 */
  const finishDebug = useCallback(() => {
    updateDebugState('completed');
    const allTraces = allTracesRef.current;
    applyTraceDecorations(allTraces, allExecutionTimeRef.current);
    setTraces(allTraces);
    setLogs(allLogsRef.current);
  }, [updateDebugState, applyTraceDecorations]);

  /** Step Over (F10): 다음 trace로 이동 */
  const stepOver = useCallback(() => {
    if (debugStateRef.current !== 'paused') return;
    const allTraces = allTracesRef.current;
    const currentIdx = stepIndexRef.current;

    if (currentIdx + 1 >= allTraces.length) {
      finishDebug();
      return;
    }

    showTracesUpTo(currentIdx + 1);
  }, [finishDebug, showTracesUpTo]);

  /** Continue (F5 in paused): 다음 브레이크포인트까지 진행 */
  const continueDebug = useCallback(() => {
    if (debugStateRef.current !== 'paused') return;
    const allTraces = allTracesRef.current;
    const bps = breakpointsRef.current;
    const currentIdx = stepIndexRef.current;

    // 다음 브레이크포인트 찾기
    for (let i = currentIdx + 1; i < allTraces.length; i++) {
      if (bps.has(allTraces[i].line)) {
        showTracesUpTo(i);
        return;
      }
    }

    // 브레이크포인트 없으면 끝까지 실행
    finishDebug();
  }, [finishDebug, showTracesUpTo]);

  /** Stop Debugging (Shift+F5): 디버깅 종료, 전체 결과 표시 */
  const stopDebug = useCallback(() => {
    if (debugStateRef.current !== 'paused') return;
    finishDebug();
  }, [finishDebug]);

  const save = useCallback(() => {
    if (!editorRef.current) return;
    const code = editorRef.current.getValue();

    if (isFormEvent) {
      setFormEventHandler(eventName, handlerName);
      setFormEventCode(handlerName, code);
    } else {
      if (!control) return;
      const updatedCode = { ...existingCode, [handlerName]: code };
      const updatedHandlers = { ...existingHandlers, [eventName]: handlerName };

      updateControl(controlId, {
        properties: {
          ...control.properties,
          _eventHandlers: updatedHandlers,
          _eventCode: updatedCode,
        },
      });
    }
    setIsDirty(false);

    // 서버에 즉시 저장 (auto-save 30초 대기 없이)
    if (onSaveToServer) {
      // store를 업데이트한 후 다음 틱에서 save 실행
      setTimeout(() => onSaveToServer(), 0);
    }
  }, [controlId, control, isFormEvent, eventName, handlerName, existingCode, existingHandlers, updateControl, setFormEventHandler, setFormEventCode, onSaveToServer]);

  const runCode = useCallback(async () => {
    if (!editorRef.current || isRunning) return;
    setIsRunning(true);
    setRunStatus('idle');
    // 디버그 패널은 항상 표시됨

    // 이전 마커/데코레이션 제거
    clearMarkers();
    clearDebugDecorations();

    const code = editorRef.current.getValue();

    // 디자이너의 컨트롤 정의에서 formState 구성
    const formState: Record<string, Record<string, unknown>> = {};
    for (const ctrl of controls) {
      formState[ctrl.name] = { ...ctrl.properties };
    }

    try {
      const res = await fetch('/api/debug/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, formState, controlId: controlId, debugMode: true, controls }),
      });
      const data = await res.json();

      if (data.success) {
        const newLogs: DebugLogEntry[] = Array.isArray(data.logs) ? data.logs : [];

        // showMessage() 호출 결과를 콘솔 로그로 표시
        const messageLogs: DebugLogEntry[] = Array.isArray(data.messages)
          ? data.messages.map((msg: { text?: string; title?: string; dialogType?: string }) => ({
              type: 'info' as const,
              args: [`[showMessage] ${msg.title ? `${msg.title}: ` : ''}${msg.text ?? ''} (${msg.dialogType ?? 'info'})`],
              timestamp: Date.now(),
            }))
          : [];

        const allNewLogs = [...newLogs, ...messageLogs];
        allLogsRef.current = allNewLogs;
        setRunStatus('success');

        // trace 데코레이션 적용
        const newTraces: TraceEntry[] = Array.isArray(data.traces) ? data.traces : [];
        allTracesRef.current = newTraces;
        allExecutionTimeRef.current = data.executionTime ?? 0;

        if (newTraces.length > 0) {
          // 브레이크포인트 체크
          const bps = breakpointsRef.current;
          let firstBpIndex = -1;
          if (bps.size > 0) {
            firstBpIndex = newTraces.findIndex((t) => bps.has(t.line));
          }

          if (firstBpIndex >= 0) {
            // 브레이크포인트 hit → paused 모드
            updateDebugState('paused');
            showTracesUpTo(firstBpIndex);
          } else {
            // 브레이크포인트 없거나 hit 없음 → 전체 표시
            updateDebugState('completed');
            setTraces(newTraces);
            setLogs((prev) => [...prev, ...allNewLogs]);
            applyTraceDecorations(newTraces, data.executionTime ?? 0);
          }
        } else {
          updateDebugState('completed');
          setLogs((prev) => [...prev, ...allNewLogs]);
          setSuccessDecoration();
        }
      } else {
        const errorLog: DebugLogEntry = {
          type: 'error',
          args: [data.error ?? 'Unknown error'],
          timestamp: Date.now(),
        };
        const newLogs: DebugLogEntry[] = Array.isArray(data.logs) ? [...data.logs, errorLog] : [errorLog];
        setLogs((prev) => [...prev, ...newLogs]);
        setRunStatus('error');
        updateDebugState('completed');

        // trace 데코레이션 적용 (에러 전까지 실행된 부분)
        const newTraces: TraceEntry[] = Array.isArray(data.traces) ? data.traces : [];
        allTracesRef.current = newTraces;
        setTraces(newTraces);
        if (newTraces.length > 0) {
          applyTraceDecorations(newTraces, data.executionTime ?? 0);
        }

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
      updateDebugState('idle');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, controls, controlId, clearMarkers, clearDebugDecorations, setErrorMarker, setSuccessDecoration, applyTraceDecorations, updateDebugState, showTracesUpTo]);

  const formatCode = useCallback(() => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  // Monaco command handler에서 최신 함수를 호출하기 위한 refs
  const runCodeRef = useRef<() => void>(() => {});
  const continueDebugRef = useRef<() => void>(() => {});
  const stepOverRef = useRef<() => void>(() => {});
  const stopDebugRef = useRef<() => void>(() => {});
  const toggleBreakpointRef = useRef<(line: number) => void>(() => {});
  runCodeRef.current = runCode;
  continueDebugRef.current = continueDebug;
  stepOverRef.current = stepOver;
  stopDebugRef.current = stopDebug;
  toggleBreakpointRef.current = toggleBreakpoint;

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

    // top-level return 등 진단 오류 억제
    // 1108: return outside function, 1345: void truthiness, 1375/1378: await outside async
    // 2451: duplicate identifier, 2683: implicit this
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      diagnosticCodesToIgnore: [1108, 1345, 1375, 1378, 2451, 2683],
    });

    // TypeScript 타입 힌트 추가 (동적 — 컨트롤 변경 시 useEffect에서 갱신)
    const currentControls = useDesignerStore.getState().controls;
    extraLibDisposableRef.current?.dispose();
    extraLibDisposableRef.current = monaco.languages.typescript.typescriptDefaults.addExtraLib(
      buildFormContextTypes(currentControls),
      'ts:filename/formContext.d.ts',
    );

    // Ctrl+S로 저장
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      save();
    });

    // F5: paused 상태면 Continue, 아니면 Run
    editor.addCommand(monaco.KeyCode.F5, () => {
      if (debugStateRef.current === 'paused') {
        continueDebugRef.current();
      } else {
        runCodeRef.current();
      }
    });

    // F10: Step Over
    editor.addCommand(monaco.KeyCode.F10, () => {
      stepOverRef.current();
    });

    // Shift+F5: Stop Debugging
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F5, () => {
      stopDebugRef.current();
    });

    // Shift+Alt+F: Format Document
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    // Glyph margin 클릭으로 브레이크포인트 토글
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.onMouseDown((e: any) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) toggleBreakpointRef.current(line);
      }
    });

    // 코드 편집 시 dirty 플래그 + 디버그 데코레이션 제거 + stepping 상태 초기화
    editor.onDidChangeModelContent(() => {
      setIsDirty(true);
      const ed = editorRef.current;
      if (ed) {
        traceDecorationIdsRef.current = ed.deltaDecorations(traceDecorationIdsRef.current, []);
        decorationIdsRef.current = ed.deltaDecorations(decorationIdsRef.current, []);
      }
      if (debugStyleRef.current) {
        debugStyleRef.current.textContent = '';
      }
      const m = monacoRef.current;
      if (m) {
        const model = ed?.getModel();
        if (model) m.editor.setModelMarkers(model, 'debugger', []);
      }
      setExecutionSummary(null);
      setRunStatus('idle');
      setTraces([]);
      // stepping 상태 초기화 (브레이크포인트는 유지)
      debugStateRef.current = 'idle';
      setDebugState('idle');
      stepIndexRef.current = 0;
      setStepIndex(0);
      allTracesRef.current = [];
      allLogsRef.current = [];
    });

    editor.focus();
  }, [save]);

  // 컨트롤 이름/타입 변경 시 Monaco 타입 정의 갱신
  const controlsSignature = useMemo(
    () => controls.map((c) => `${c.name}:${c.type}`).join(','),
    [controls],
  );

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    extraLibDisposableRef.current?.dispose();
    extraLibDisposableRef.current = monaco.languages.typescript.typescriptDefaults.addExtraLib(
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

  // 헤더 드래그로 창 이동
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // 버튼 클릭은 드래그 시작하지 않음
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // 첫 드래그 시 현재 위치를 기준으로 초기화
    const origX = dialogPos?.x ?? rect.left;
    const origY = dialogPos?.y ?? rect.top;
    if (!dialogPos) setDialogPos({ x: origX, y: origY });
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX, origY };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setDialogPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      activeDragListeners.current = { move: null, up: null };
    };
    activeDragListeners.current = { move: handleMouseMove, up: handleMouseUp };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dialogPos]);

  // 현재 step 줄 번호 (paused 모드에서 사용)
  const currentStepLine = debugState === 'paused' && allTracesRef.current.length > 0
    ? allTracesRef.current[stepIndex]?.line
    : undefined;

  // Watch 패널용: 현재 보이는 traces의 모든 변수를 누적 병합한 최종 스냅샷
  const currentVariables = useMemo(() => {
    const result: Record<string, string> = {};
    for (const t of traces) {
      Object.assign(result, t.variables);
    }
    return result;
  }, [traces]);

  // Watch 패널용: 현재 시점의 ctx.controls 상태 (마지막 trace의 스냅샷)
  const currentCtxControls = useMemo(() => {
    if (traces.length === 0) return {};
    return traces[traces.length - 1].ctxControls ?? {};
  }, [traces]);

  const statusBarColor =
    debugState === 'paused' ? '#b8860b' :
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
        .debug-executed-glyph {
          background-color: #4caf50;
          border-radius: 50%;
          margin-left: 4px;
          width: 6px !important;
          height: 6px !important;
          margin-top: 7px;
        }
        .debug-unexecuted-line {
          background-color: rgba(128, 128, 128, 0.1);
        }
        .debug-slow-line {
          background-color: rgba(255, 193, 7, 0.15);
        }
        .monaco-editor [class*="debug-inline-val-L"]::after {
          color: rgba(136, 136, 136, 0.8);
          font-style: italic;
          padding-left: 16px;
          font-size: 12px;
        }
        .debug-breakpoint-glyph {
          background: #e51400;
          border-radius: 50%;
          width: 10px !important;
          height: 10px !important;
          margin-left: 3px;
          margin-top: 5px;
          cursor: pointer;
        }
        .debug-current-line-glyph {
          border-left: 6px solid #ffcc00;
          border-top: 4px solid transparent;
          border-bottom: 4px solid transparent;
          width: 0 !important;
          height: 0 !important;
          margin-left: 5px;
          margin-top: 4px;
        }
        .debug-current-line {
          background-color: rgba(255, 204, 0, 0.15);
        }
        .event-editor-dialog::-webkit-resizable {
          background-color: #555;
        }
      `}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-editor-title"
        style={{
          width: '80vw',
          height: '70vh',
          minWidth: 480,
          minHeight: 320,
          maxWidth: '98vw',
          maxHeight: '98vh',
          backgroundColor: '#1e1e1e',
          border: '1px solid #555',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          resize: 'both',
          overflow: 'hidden',
          ...(dialogPos ? {
            position: 'fixed',
            left: dialogPos.x,
            top: dialogPos.y,
          } : {}),
        }}
      >
        {/* 헤더 (드래그로 이동) */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            backgroundColor: '#2d2d2d',
            color: '#ccc',
            fontSize: 13,
            fontFamily: 'Segoe UI, sans-serif',
            cursor: 'move',
            userSelect: 'none',
          }}
        >
          <span id="event-editor-title">
            {handlerName} — {eventName} ({control?.name ?? controlId})
            {isDirty && <span style={{ color: '#e8ab53', marginLeft: 6 }} title="Unsaved changes">●</span>}
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
              onClick={clearAllDebug}
              style={headerBtnStyle}
            >
              Clear Debug
            </button>
            <button
              type="button"
              onClick={formatCode}
              style={headerBtnStyle}
              title="Format Document (Shift+Alt+F)"
            >
              Format
            </button>
            <button
              type="button"
              onClick={() => setDebugPanelHeight((h) => h === 120 ? 200 : 120)}
              style={headerBtnStyle}
              title="Toggle debug panel size"
            >
              {debugPanelHeight > 120 ? '▼ Panel' : '▲ Panel'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!isDirty}
              style={{
                ...headerBtnStyle,
                ...(isDirty ? { backgroundColor: '#0e639c', color: '#fff', border: '1px solid #1177bb' } : { opacity: 0.5 }),
              }}
            >
              Save
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
        <div style={{ flex: 1, minHeight: 100, overflow: 'hidden' }}>
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

        {/* 디버그 패널 (탭: Console / Variables / Watch) */}
        <div style={{ flex: 0, flexBasis: debugPanelHeight, minHeight: 120, display: 'flex', flexDirection: 'column', borderTop: '1px solid #555' }}>
            {/* 탭 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#252526',
              borderBottom: '1px solid #1e1e1e',
            }}>
              <DebugTabButton
                label="Console"
                active={debugTab === 'console'}
                onClick={() => setDebugTab('console')}
              />
              <DebugTabButton
                label="Variables"
                active={debugTab === 'variables'}
                onClick={() => setDebugTab('variables')}
                badge={traces.length > 0 ? new Set(traces.map((t) => t.line)).size : undefined}
              />
              <DebugTabButton
                label="Watch"
                active={debugTab === 'watch'}
                onClick={() => setDebugTab('watch')}
                badge={watchExpressions.length > 0 ? watchExpressions.length : undefined}
              />
              <div style={{ flex: 1 }} />
              {debugTab === 'console' && (
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  style={{
                    padding: '1px 8px',
                    border: '1px solid #555',
                    backgroundColor: '#3c3c3c',
                    color: '#ccc',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'Segoe UI, sans-serif',
                    marginRight: 6,
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {debugTab === 'console' && <DebugConsole logs={logs} executionSummary={executionSummary} />}
            {debugTab === 'variables' && (
              <VariablesPanel
                traces={traces}
                onLineClick={(line) => {
                  const editor = editorRef.current;
                  if (editor) {
                    editor.setPosition({ lineNumber: line, column: 1 });
                    editor.revealLineInCenter(line);
                    editor.focus();
                  }
                }}
                selectedLineOverride={currentStepLine}
              />
            )}
            {debugTab === 'watch' && (
              <WatchPanel
                watchExpressions={watchExpressions}
                onAddExpression={(expr) => {
                  if (expr.trim() && !watchExpressions.includes(expr.trim())) {
                    setWatchExpressions((prev) => [...prev, expr.trim()]);
                  }
                }}
                onRemoveExpression={(index) => {
                  setWatchExpressions((prev) => prev.filter((_, i) => i !== index));
                }}
                variables={currentVariables}
                ctxControls={currentCtxControls}
              />
            )}
          </div>

        {/* 디버그 툴바 (paused 상태에서만 표시) */}
        {debugState === 'paused' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              backgroundColor: '#3c3c3c',
              borderTop: '1px solid #555',
              fontFamily: 'Segoe UI, sans-serif',
              fontSize: 12,
            }}
          >
            <button
              type="button"
              onClick={continueDebug}
              style={{ ...debugToolbarBtnStyle, backgroundColor: '#0e639c', border: '1px solid #1177bb' }}
              title="Continue (F5)"
            >
              ▶ Continue
            </button>
            <button
              type="button"
              onClick={stepOver}
              style={debugToolbarBtnStyle}
              title="Step Over (F10)"
            >
              ⏭ Step Over
            </button>
            <button
              type="button"
              onClick={stopDebug}
              style={{ ...debugToolbarBtnStyle, backgroundColor: '#6c1919', border: '1px solid #8b2222' }}
              title="Stop (Shift+F5)"
            >
              ⏹ Stop
            </button>
            <span style={{ color: '#888', marginLeft: 8, fontSize: 11 }}>
              Step {stepIndex + 1}/{allTracesRef.current.length}
              {currentStepLine != null && ` | Line ${currentStepLine}`}
            </span>
          </div>
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
          <span>
            {debugState === 'paused'
              ? 'F5: Continue | F10: Step Over | Shift+F5: Stop'
              : 'Ctrl+S: Save | Shift+Alt+F: Format | Escape: Close | F5: Run'}
          </span>
          <span style={{ display: 'flex', gap: 12 }}>
            {isDirty && <span style={{ color: '#ffd54f' }}>● Modified</span>}
            {debugState === 'paused' && <span>● Paused at breakpoint</span>}
            {debugState !== 'paused' && runStatus === 'success' && <span>✓ Execution completed</span>}
            {debugState !== 'paused' && runStatus === 'error' && <span>✗ Execution failed</span>}
          </span>
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

/** 디버그 탭 버튼 */
function DebugTabButton({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 14px',
        border: 'none',
        borderBottom: active ? '2px solid #007acc' : '2px solid transparent',
        backgroundColor: 'transparent',
        color: active ? '#fff' : '#888',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'Segoe UI, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {label}
      {badge != null && badge > 0 && (
        <span
          style={{
            backgroundColor: '#007acc',
            color: '#fff',
            borderRadius: 8,
            padding: '0 5px',
            fontSize: 10,
            lineHeight: '16px',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function DebugConsole({
  logs,
  executionSummary,
}: {
  logs: DebugLogEntry[];
  executionSummary: ExecutionSummary | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <>
      {/* 실행 요약 */}
      {executionSummary && (
        <div
          style={{
            padding: '4px 10px',
            backgroundColor: '#1a3a1a',
            color: '#8cc88c',
            fontSize: 11,
            fontFamily: 'Consolas, monospace',
            borderBottom: '1px solid #333',
            display: 'flex',
            gap: 16,
          }}
        >
          <span>
            {executionSummary.executedLines}/{executionSummary.totalLines} lines executed
          </span>
          <span>|</span>
          <span>{executionSummary.executionTime}ms</span>
          <span>|</span>
          <span>{executionSummary.trackedVars} variables tracked</span>
        </div>
      )}

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
    </>
  );
}

/** 객체 내부 경로를 탐색하여 값을 반환 */
function navigatePath(
  root: unknown,
  pathParts: string[],
): { value: string; resolved: boolean } {
  let current: unknown = root;
  for (const part of pathParts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { value: '<not available>', resolved: false };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current = (current as any)[part];
  }
  if (current === undefined) return { value: '<not available>', resolved: false };
  try {
    return { value: JSON.stringify(current), resolved: true };
  } catch {
    return { value: String(current), resolved: true };
  }
}

/** 표현식을 변수 스냅샷 + ctx.controls에서 조회 */
function resolveExpression(
  expr: string,
  variables: Record<string, string>,
  ctxControls?: Record<string, string>,
): { value: string; resolved: boolean } {
  const parts = expr.split(/\.|\[|\]/).filter(Boolean);
  if (parts.length === 0) return { value: '<not available>', resolved: false };

  const rootName = parts[0];

  // ctx.* 표현식: ctxControls 데이터에서 해석
  if (rootName === 'ctx' && ctxControls) {
    const controls: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ctxControls)) {
      controls[k] = tryParseJson(v) ?? v;
    }
    return navigatePath({ controls }, parts.slice(1));
  }

  // 로컬 변수 해석
  const rawValue = variables[rootName];
  if (rawValue === undefined) return { value: '<not available>', resolved: false };
  if (parts.length === 1) return { value: rawValue, resolved: true };

  const parsed = tryParseJson(rawValue);
  if (parsed === null) return { value: '<not available>', resolved: false };
  return navigatePath(parsed, parts.slice(1));
}

/** Watch 패널 */
function WatchPanel({
  watchExpressions,
  onAddExpression,
  onRemoveExpression,
  variables,
  ctxControls,
}: {
  watchExpressions: string[];
  onAddExpression: (expr: string) => void;
  onRemoveExpression: (index: number) => void;
  variables: Record<string, string>;
  ctxControls: Record<string, string>;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onAddExpression(inputValue);
      setInputValue('');
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e1e1e',
      overflow: 'hidden',
    }}>
      {/* 입력 필드 */}
      <div style={{
        padding: '4px 8px',
        borderBottom: '1px solid #333',
        backgroundColor: '#252526',
      }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add expression (e.g. user.name, items[0])"
          style={{
            width: '100%',
            padding: '3px 6px',
            backgroundColor: '#3c3c3c',
            border: '1px solid #555',
            color: '#d4d4d4',
            fontSize: 12,
            fontFamily: 'Consolas, monospace',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 테이블 헤더 */}
      <div style={{
        display: 'flex',
        padding: '4px 8px',
        backgroundColor: '#252526',
        borderBottom: '1px solid #333',
        fontSize: 10,
        fontFamily: 'Segoe UI, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        color: '#888',
      }}>
        <span style={{ width: 22, flexShrink: 0 }} />
        <span style={{ flex: 2, minWidth: 100 }}>Name</span>
        <span style={{ flex: 3, minWidth: 150 }}>Value</span>
        <span style={{ minWidth: 60, textAlign: 'right' }}>Type</span>
      </div>

      {/* 표현식 목록 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {watchExpressions.length === 0 ? (
          <div style={{
            padding: '24px 8px',
            color: '#666',
            fontStyle: 'italic',
            fontSize: 12,
            fontFamily: 'Consolas, monospace',
            textAlign: 'center',
          }}>
            Add expressions to watch. Type a variable name or path (e.g. user.name)
          </div>
        ) : (
          watchExpressions.map((expr, index) => {
            const { value, resolved } = resolveExpression(expr, variables, ctxControls);
            const type = resolved ? getValueType(value) : '\u2014';
            const parsedObj = resolved ? tryParseJson(value) : null;

            return (
              <WatchExpressionRow
                key={`${expr}-${index}`}
                expr={expr}
                value={value}
                type={type}
                resolved={resolved}
                parsedObj={parsedObj}
                onRemove={() => onRemoveExpression(index)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/** Watch 표현식 행 */
function WatchExpressionRow({
  expr,
  value,
  type,
  resolved,
  parsedObj,
  onRemove,
}: {
  expr: string;
  value: string;
  type: string;
  resolved: boolean;
  parsedObj: unknown | null;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = parsedObj !== null;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderBottom: '1px solid #2a2a2a',
          fontSize: 12,
          fontFamily: 'Consolas, monospace',
          minHeight: 22,
        }}
      >
        {/* 삭제 버튼 */}
        <span
          onClick={onRemove}
          style={{
            width: 18,
            flexShrink: 0,
            cursor: 'pointer',
            color: '#888',
            fontSize: 11,
            textAlign: 'center',
            lineHeight: '22px',
          }}
          title="Remove expression"
        >
          ✕
        </span>

        {/* Name */}
        <span style={{
          flex: 2,
          minWidth: 100,
          color: '#9cdcfe',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 4,
        }}>
          {hasChildren && (
            <span
              onClick={() => setExpanded(!expanded)}
              style={{ cursor: 'pointer', color: '#888', userSelect: 'none', fontSize: 10 }}
            >
              {expanded ? '▼' : '▶'}
            </span>
          )}
          {expr}
        </span>

        {/* Value */}
        <span style={{
          flex: 3,
          minWidth: 150,
          color: resolved ? getValueColor(type) : '#666',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: resolved ? 'normal' : 'italic',
        }}>
          {value}
        </span>

        {/* Type */}
        <span style={{
          minWidth: 60,
          textAlign: 'right',
          color: '#666',
          fontSize: 11,
        }}>
          {type}
        </span>
      </div>

      {/* 펼친 객체 내부 */}
      {expanded && hasChildren && (
        <div style={{
          borderBottom: '1px solid #2a2a2a',
          backgroundColor: '#1a1a2e',
        }}>
          <ExpandedObjectEntries value={parsedObj} depth={1} />
        </div>
      )}
    </>
  );
}

/** 줄별 변수 스냅샷 */
interface LineVariableSnapshot {
  line: number;
  variables: Record<string, string>;
}

/** JSON 파싱 시도하여 객체/배열이면 반환, 아니면 null */
function tryParseJson(value: string): unknown | null {
  if ((!value.startsWith('{') && !value.startsWith('[')) || value.length < 2) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** 값의 타입 문자열 반환 */
function getValueType(value: string): string {
  if (value === 'undefined') return 'undefined';
  if (value === 'null') return 'null';
  if (value === 'true' || value === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(value)) return 'number';
  if (value.startsWith('"') && value.endsWith('"')) return 'string';
  if (value.startsWith('{')) return 'object';
  if (value.startsWith('[')) return 'array';
  return 'string';
}

/** 값 표시용 색상 */
function getValueColor(type: string): string {
  switch (type) {
    case 'number': return '#b5cea8';
    case 'string': return '#ce9178';
    case 'boolean': return '#569cd6';
    case 'null':
    case 'undefined': return '#569cd6';
    case 'object':
    case 'array': return '#4ec9b0';
    default: return '#d4d4d4';
  }
}

/** 펼쳐진 객체/배열 속성 행 (재귀 가능) */
function ExpandedObjectEntries({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || typeof value !== 'object') return null;

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <>
      {entries.map(([key, val]) => (
        <ExpandedPropertyRow key={key} propKey={key} propValue={val} depth={depth} />
      ))}
    </>
  );
}

/** 펼쳐진 속성 단일 행 */
function ExpandedPropertyRow({
  propKey,
  propValue,
  depth,
}: {
  propKey: string;
  propValue: unknown;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isObject = typeof propValue === 'object' && propValue !== null;
  const strVal = isObject ? JSON.stringify(propValue) : String(propValue);
  const childType = propValue === null
    ? 'null'
    : typeof propValue === 'object'
      ? (Array.isArray(propValue) ? 'array' : 'object')
      : typeof propValue;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: `2px 8px 2px ${depth * 16}px`,
          fontSize: 12,
          fontFamily: 'Consolas, monospace',
          borderBottom: '1px solid #252525',
          minHeight: 20,
        }}
      >
        <span style={{ flex: 2, minWidth: 100, color: '#9cdcfe', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isObject && (
            <span
              onClick={() => setExpanded(!expanded)}
              style={{ cursor: 'pointer', color: '#888', userSelect: 'none', fontSize: 10 }}
            >
              {expanded ? '▼' : '▶'}
            </span>
          )}
          {propKey}
        </span>
        <span style={{
          flex: 3,
          minWidth: 150,
          color: getValueColor(childType),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {strVal}
        </span>
        <span style={{ minWidth: 60, textAlign: 'right', color: '#666', fontSize: 11 }}>
          {childType}
        </span>
      </div>
      {expanded && isObject && (
        <ExpandedObjectEntries value={propValue} depth={depth + 1} />
      )}
    </>
  );
}

/** Variables 패널 */
function VariablesPanel({
  traces,
  onLineClick,
  selectedLineOverride,
}: {
  traces: TraceEntry[];
  onLineClick: (line: number) => void;
  selectedLineOverride?: number;
}) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  // 줄별 변수 스냅샷 계산
  const lineSnapshots = useMemo<LineVariableSnapshot[]>(() => {
    if (traces.length === 0) return [];

    const lineMap = new Map<number, Record<string, string>>();
    for (const trace of traces) {
      const prev = lineMap.get(trace.line) ?? {};
      lineMap.set(trace.line, { ...prev, ...trace.variables });
    }

    return Array.from(lineMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([line, variables]) => ({ line, variables }));
  }, [traces]);

  // 이전 줄 대비 변경된 변수 계산
  const changedVarsMap = useMemo<Map<number, Set<string>>>(() => {
    const result = new Map<number, Set<string>>();
    for (let i = 0; i < lineSnapshots.length; i++) {
      const current = lineSnapshots[i];
      const prev = i > 0 ? lineSnapshots[i - 1] : null;
      const changed = new Set<string>();

      for (const [name, value] of Object.entries(current.variables)) {
        if (!prev || prev.variables[name] !== value) {
          changed.add(name);
        }
      }
      result.set(current.line, changed);
    }
    return result;
  }, [lineSnapshots]);

  // selectedLineOverride가 있으면 자동 선택
  useEffect(() => {
    if (selectedLineOverride != null) {
      setSelectedLine(selectedLineOverride);
    }
  }, [selectedLineOverride]);

  // 선택된 줄 자동 설정
  useEffect(() => {
    if (selectedLineOverride != null) return; // override가 있으면 건너뛰기
    if (selectedLine === null && lineSnapshots.length > 0) {
      setSelectedLine(lineSnapshots[0].line);
    }
  }, [lineSnapshots, selectedLine, selectedLineOverride]);

  // traces가 변경되면 선택 초기화
  useEffect(() => {
    if (lineSnapshots.length > 0) {
      setSelectedLine(lineSnapshots[0].line);
    } else {
      setSelectedLine(null);
    }
  }, [traces]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLineClick = useCallback((line: number) => {
    setSelectedLine(line);
    onLineClick(line);
  }, [onLineClick]);

  const selectedSnapshot = lineSnapshots.find((s) => s.line === selectedLine);
  const changedVars = selectedLine != null ? changedVarsMap.get(selectedLine) : undefined;

  if (traces.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e1e1e',
        color: '#666',
        fontStyle: 'italic',
        fontSize: 12,
        fontFamily: 'Consolas, monospace',
      }}>
        No trace data. Click Run or press F5 to execute with tracing.
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      backgroundColor: '#1e1e1e',
      overflow: 'hidden',
    }}>
      {/* 좌측: 줄 번호 목록 */}
      <div style={{
        width: 80,
        borderRight: '1px solid #333',
        overflow: 'auto',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '4px 8px',
          backgroundColor: '#252526',
          color: '#888',
          fontSize: 10,
          fontFamily: 'Segoe UI, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          borderBottom: '1px solid #333',
        }}>
          Lines
        </div>
        {lineSnapshots.map((snapshot) => (
          <div
            key={snapshot.line}
            onClick={() => handleLineClick(snapshot.line)}
            style={{
              padding: '3px 8px',
              cursor: 'pointer',
              backgroundColor: snapshot.line === selectedLine ? '#094771' : 'transparent',
              color: snapshot.line === selectedLine ? '#fff' : '#ccc',
              fontSize: 12,
              fontFamily: 'Consolas, monospace',
              borderBottom: '1px solid #2a2a2a',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#4caf50',
              flexShrink: 0,
            }} />
            <span>Line {snapshot.line}</span>
            <span style={{ color: '#666', fontSize: 10, marginLeft: 'auto' }}>
              {Object.keys(snapshot.variables).length}
            </span>
          </div>
        ))}
      </div>

      {/* 우측: 변수 테이블 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* 테이블 헤더 */}
        <div style={{
          display: 'flex',
          padding: '4px 8px',
          backgroundColor: '#252526',
          borderBottom: '1px solid #333',
          fontSize: 10,
          fontFamily: 'Segoe UI, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: '#888',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}>
          <span style={{ flex: 2, minWidth: 100 }}>Name</span>
          <span style={{ flex: 3, minWidth: 150 }}>Value</span>
          <span style={{ minWidth: 60, textAlign: 'right' }}>Type</span>
        </div>

        {selectedSnapshot ? (
          Object.entries(selectedSnapshot.variables).map(([name, value]) => {
            const type = getValueType(value);
            const isChanged = changedVars?.has(name);
            const parsedObj = tryParseJson(value);

            return (
              <VariableRow
                key={name}
                name={name}
                value={value}
                type={type}
                isChanged={!!isChanged}
                parsedObj={parsedObj}
              />
            );
          })
        ) : (
          <div style={{
            padding: '12px 8px',
            color: '#666',
            fontSize: 12,
            fontStyle: 'italic',
            fontFamily: 'Consolas, monospace',
          }}>
            Select a line to view variables.
          </div>
        )}
      </div>
    </div>
  );
}

/** 변수 행 컴포넌트 */
function VariableRow({
  name,
  value,
  type,
  isChanged,
  parsedObj,
}: {
  name: string;
  value: string;
  type: string;
  isChanged: boolean;
  parsedObj: unknown | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = parsedObj !== null;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderBottom: '1px solid #2a2a2a',
          fontSize: 12,
          fontFamily: 'Consolas, monospace',
          backgroundColor: isChanged ? 'rgba(255, 235, 59, 0.12)' : 'transparent',
          minHeight: 22,
        }}
      >
        {/* Name */}
        <span style={{
          flex: 2,
          minWidth: 100,
          color: '#9cdcfe',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          {hasChildren && (
            <span
              onClick={() => setExpanded(!expanded)}
              style={{ cursor: 'pointer', color: '#888', userSelect: 'none', fontSize: 10 }}
            >
              {expanded ? '▼' : '▶'}
            </span>
          )}
          {name}
          {isChanged && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#ffeb3b',
              flexShrink: 0,
            }} />
          )}
        </span>

        {/* Value */}
        <span style={{
          flex: 3,
          minWidth: 150,
          color: getValueColor(type),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>

        {/* Type */}
        <span style={{
          minWidth: 60,
          textAlign: 'right',
          color: '#666',
          fontSize: 11,
        }}>
          {type}
        </span>
      </div>

      {/* 펼친 객체 내부 */}
      {expanded && hasChildren && (
        <div style={{
          borderBottom: '1px solid #2a2a2a',
          backgroundColor: '#1a1a2e',
        }}>
          <ExpandedObjectEntries value={parsedObj} depth={1} />
        </div>
      )}
    </>
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

const debugToolbarBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  border: '1px solid #555',
  backgroundColor: '#3c3c3c',
  color: '#fff',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'Segoe UI, sans-serif',
};
