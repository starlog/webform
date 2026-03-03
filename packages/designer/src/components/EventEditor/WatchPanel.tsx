import { useState, useCallback, useEffect, useRef } from 'react';
import type { ContextMenuState } from './debugUtils';
import { resolveExpression, getValueType, getValueColor, tryParseJson } from './debugUtils';
import { ExpandedObjectEntries } from './VariablesPanel';

/** Watch 패널 */
export function WatchPanel({
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      onAddExpression(inputValue);
      setInputValue('');
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1e1e1e',
        overflow: 'hidden',
      }}
    >
      {/* 입력 필드 */}
      <div
        style={{
          padding: '4px 8px',
          borderBottom: '1px solid #333',
          backgroundColor: '#252526',
        }}
      >
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
        }}
      >
        <span style={{ width: 22, flexShrink: 0 }} />
        <span style={{ flex: 2, minWidth: 100 }}>Name</span>
        <span style={{ flex: 3, minWidth: 150 }}>Value</span>
        <span style={{ minWidth: 60, textAlign: 'right' }}>Type</span>
      </div>

      {/* 표현식 목록 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {watchExpressions.length === 0 ? (
          <div
            style={{
              padding: '24px 8px',
              color: '#666',
              fontStyle: 'italic',
              fontSize: 12,
              fontFamily: 'Consolas, monospace',
              textAlign: 'center',
            }}
          >
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
                onContextMenu={handleContextMenu}
              />
            );
          })
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

/** Watch 표현식 행 */
function WatchExpressionRow({
  expr,
  value,
  type,
  resolved,
  parsedObj,
  onRemove,
  onContextMenu,
}: {
  expr: string;
  value: string;
  type: string;
  resolved: boolean;
  parsedObj: unknown | null;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent, name: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = parsedObj !== null;

  return (
    <>
      <div
        onContextMenu={(e) => onContextMenu(e, expr, value)}
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
        <span
          style={{
            flex: 2,
            minWidth: 100,
            color: '#9cdcfe',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 4,
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
          {expr}
        </span>

        {/* Value */}
        <span
          style={{
            flex: 3,
            minWidth: 150,
            color: resolved ? getValueColor(type) : '#666',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontStyle: resolved ? 'normal' : 'italic',
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
