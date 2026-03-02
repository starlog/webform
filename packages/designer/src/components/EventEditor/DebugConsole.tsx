import { useRef, useEffect } from 'react';
import type { DebugLogEntry, ExecutionSummary } from './debugUtils';
import { LOG_COLORS, formatTimestamp } from './debugUtils';

/** 디버그 탭 버튼 */
export function DebugTabButton({
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

export function DebugConsole({
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
