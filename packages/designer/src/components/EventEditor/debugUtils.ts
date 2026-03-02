export interface DebugLogEntry {
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

export interface TraceEntry {
  line: number;
  column: number;
  timestamp: number;
  variables: Record<string, string>;
  duration?: number;
  ctxControls?: Record<string, string>;
}

export interface ExecutionSummary {
  executedLines: number;
  totalLines: number;
  executionTime: number;
  trackedVars: number;
}

export interface LineVariableSnapshot {
  line: number;
  variables: Record<string, string>;
}

export interface ContextMenuState {
  x: number;
  y: number;
  name: string;
  value: string;
}

export const LOG_COLORS: Record<string, string> = {
  log: '#d4d4d4',
  info: '#3794ff',
  warn: '#cca700',
  error: '#f14c4c',
};

/** CSS content 속성에 사용할 문자열 이스케이프 */
export function escapeCssContent(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\27 ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

/** JSON 파싱 시도하여 객체/배열이면 반환, 아니면 null */
export function tryParseJson(value: string): unknown | null {
  if ((!value.startsWith('{') && !value.startsWith('[')) || value.length < 2) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** 값의 타입 문자열 반환 */
export function getValueType(value: string): string {
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
export function getValueColor(type: string): string {
  switch (type) {
    case 'number':
      return '#b5cea8';
    case 'string':
      return '#ce9178';
    case 'boolean':
      return '#569cd6';
    case 'null':
    case 'undefined':
      return '#569cd6';
    case 'object':
    case 'array':
      return '#4ec9b0';
    default:
      return '#d4d4d4';
  }
}

/** 객체 내부 경로를 탐색하여 값을 반환 */
export function navigatePath(
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
export function resolveExpression(
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
