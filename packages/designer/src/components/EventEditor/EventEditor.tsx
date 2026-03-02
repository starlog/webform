import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useDesignerStore } from '../../stores/designerStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { buildFormContextTypes } from './monacoHelpers';
import { getSampleCode } from './sampleCode';
import {
  type DebugLogEntry,
  type TraceEntry,
  type ExecutionSummary,
  escapeCssContent,
} from './debugUtils';
import { DebugConsole, DebugTabButton } from './DebugConsole';
import { WatchPanel } from './WatchPanel';
import { VariablesPanel } from './VariablesPanel';

type MonacoInstance = Parameters<OnMount>[1];

interface EventEditorProps {
  controlId: string;
  eventName: string;
  handlerName: string;
  onClose: () => void;
  onSaveToServer?: () => void;
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
              fixedOverflowWidgets: true,
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
