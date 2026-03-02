import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { TraceEntry, LineVariableSnapshot, ContextMenuState } from './debugUtils';
import { getValueType, getValueColor, tryParseJson } from './debugUtils';

type VariableContextMenuHandler = (e: React.MouseEvent, name: string, value: string) => void;

/** 펼쳐진 객체/배열 속성 행 (재귀 가능) */
export function ExpandedObjectEntries({
  value,
  depth,
  onContextMenu,
}: {
  value: unknown;
  depth: number;
  onContextMenu?: VariableContextMenuHandler;
}) {
  if (value === null || typeof value !== 'object') return null;

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <>
      {entries.map(([key, val]) => (
        <ExpandedPropertyRow
          key={key}
          propKey={key}
          propValue={val}
          depth={depth}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

/** 펼쳐진 속성 단일 행 */
function ExpandedPropertyRow({
  propKey,
  propValue,
  depth,
  onContextMenu,
}: {
  propKey: string;
  propValue: unknown;
  depth: number;
  onContextMenu?: VariableContextMenuHandler;
}) {
  const [expanded, setExpanded] = useState(false);
  const isObject = typeof propValue === 'object' && propValue !== null;
  const strVal = isObject ? JSON.stringify(propValue) : String(propValue);
  const childType =
    propValue === null
      ? 'null'
      : typeof propValue === 'object'
        ? Array.isArray(propValue)
          ? 'array'
          : 'object'
        : typeof propValue;

  return (
    <>
      <div
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, propKey, strVal) : undefined}
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
        <span
          style={{
            flex: 2,
            minWidth: 100,
            color: '#9cdcfe',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
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
        <span
          style={{
            flex: 3,
            minWidth: 150,
            color: getValueColor(childType),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {strVal}
        </span>
        <span style={{ minWidth: 60, textAlign: 'right', color: '#666', fontSize: 11 }}>
          {childType}
        </span>
      </div>
      {expanded && isObject && (
        <ExpandedObjectEntries value={propValue} depth={depth + 1} onContextMenu={onContextMenu} />
      )}
    </>
  );
}

/** 변수 행 컴포넌트 */
function VariableRow({
  name,
  value,
  type,
  isChanged,
  parsedObj,
  onContextMenu,
}: {
  name: string;
  value: string;
  type: string;
  isChanged: boolean;
  parsedObj: unknown | null;
  onContextMenu: (e: React.MouseEvent, name: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = parsedObj !== null;

  return (
    <>
      <div
        onContextMenu={(e) => onContextMenu(e, name, value)}
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
        <span
          style={{
            flex: 2,
            minWidth: 100,
            color: '#9cdcfe',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
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
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#ffeb3b',
                flexShrink: 0,
              }}
            />
          )}
        </span>

        {/* Value */}
        <span
          style={{
            flex: 3,
            minWidth: 150,
            color: getValueColor(type),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </span>

        {/* Type */}
        <span
          style={{
            minWidth: 60,
            textAlign: 'right',
            color: '#666',
            fontSize: 11,
          }}
        >
          {type}
        </span>
      </div>

      {/* 펼친 객체 내부 */}
      {expanded && hasChildren && (
        <div
          style={{
            borderBottom: '1px solid #2a2a2a',
            backgroundColor: '#1a1a2e',
          }}
        >
          <ExpandedObjectEntries value={parsedObj} depth={1} onContextMenu={onContextMenu} />
        </div>
      )}
    </>
  );
}

/** Variables 패널 */
export function VariablesPanel({
  traces,
  onLineClick,
  selectedLineOverride,
}: {
  traces: TraceEntry[];
  onLineClick: (line: number) => void;
  selectedLineOverride?: number;
}) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, name: string, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, name, value });
  }, []);

  const handleCopyValue = useCallback(() => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.value);
    setContextMenu(null);
  }, [contextMenu]);

  const handleCopyName = useCallback(() => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(contextMenu.name);
    setContextMenu(null);
  }, [contextMenu]);

  const handleCopyAll = useCallback(() => {
    if (!contextMenu) return;
    navigator.clipboard.writeText(`${contextMenu.name} = ${contextMenu.value}`);
    setContextMenu(null);
  }, [contextMenu]);

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

  const handleLineClick = useCallback(
    (line: number) => {
      setSelectedLine(line);
      onLineClick(line);
    },
    [onLineClick],
  );

  const selectedSnapshot = lineSnapshots.find((s) => s.line === selectedLine);
  const changedVars = selectedLine != null ? changedVarsMap.get(selectedLine) : undefined;

  if (traces.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1e1e1e',
          color: '#666',
          fontStyle: 'italic',
          fontSize: 12,
          fontFamily: 'Consolas, monospace',
        }}
      >
        No trace data. Click Run or press F5 to execute with tracing.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
      }}
    >
      {/* 좌측: 줄 번호 목록 */}
      <div
        style={{
          width: 80,
          borderRight: '1px solid #333',
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: '4px 8px',
            backgroundColor: '#252526',
            color: '#888',
            fontSize: 10,
            fontFamily: 'Segoe UI, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            borderBottom: '1px solid #333',
          }}
        >
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
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#4caf50',
                flexShrink: 0,
              }}
            />
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
        <div
          style={{
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
          }}
        >
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
                onContextMenu={handleContextMenu}
              />
            );
          })
        ) : (
          <div
            style={{
              padding: '12px 8px',
              color: '#666',
              fontSize: 12,
              fontStyle: 'italic',
              fontFamily: 'Consolas, monospace',
            }}
          >
            Select a line to view variables.
          </div>
        )}
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: '#252526',
            border: '1px solid #454545',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            zIndex: 10000,
            minWidth: 160,
            padding: '4px 0',
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: 12,
          }}
        >
          <div
            onClick={handleCopyValue}
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              color: '#ccc',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#094771')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Copy Value
          </div>
          <div
            onClick={handleCopyName}
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              color: '#ccc',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#094771')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Copy Name
          </div>
          <div style={{ height: 1, backgroundColor: '#454545', margin: '4px 0' }} />
          <div
            onClick={handleCopyAll}
            style={{
              padding: '6px 16px',
              cursor: 'pointer',
              color: '#ccc',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#094771')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Copy Name = Value
          </div>
        </div>
      )}
    </div>
  );
}
