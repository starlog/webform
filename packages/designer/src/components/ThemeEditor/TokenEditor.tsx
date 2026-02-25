import { useState, useMemo, useCallback } from 'react';
import { useThemeEditorStore } from '../../stores/themeEditorStore';
import { TOKEN_GROUPS, getTokensByGroup } from './tokenMeta';
import type { TokenMeta } from './tokenMeta';

function resolveValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function TokenEditor() {
  const currentTheme = useThemeEditorStore((s) => s.currentTheme);
  const isCurrentPreset = useThemeEditorStore((s) => s.isCurrentPreset);
  const updateToken = useThemeEditorStore((s) => s.updateToken);
  const setCurrentThemeName = useThemeEditorStore((s) => s.setCurrentThemeName);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const isReadOnly = isCurrentPreset;
  const tokensByGroup = useMemo(() => getTokensByGroup(), []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  if (!currentTheme) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          fontSize: 13,
        }}
      >
        Select a theme to edit
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Theme Name */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid #ccc',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Name:</label>
        <input
          type="text"
          value={currentTheme.name}
          readOnly={isReadOnly}
          onChange={(e) => setCurrentThemeName(e.target.value)}
          style={{
            flex: 1,
            padding: '2px 4px',
            border: '1px solid #ccc',
            borderRadius: 2,
            fontSize: 12,
            backgroundColor: isReadOnly ? '#f0f0f0' : '#fff',
          }}
        />
        {isReadOnly && (
          <span style={{ fontSize: 10, color: '#999' }}>Read-only preset</span>
        )}
      </div>

      {/* Token Groups */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {TOKEN_GROUPS.map((group) => {
          const tokens = tokensByGroup.get(group);
          if (!tokens) return null;
          const isCollapsed = collapsedGroups.has(group);

          return (
            <div key={group}>
              <div
                onClick={() => toggleGroup(group)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#e8e8e8',
                  borderBottom: '1px solid #ddd',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  userSelect: 'none',
                }}
              >
                <span style={{ marginRight: 4 }}>{isCollapsed ? '\u25B6' : '\u25BC'}</span>
                {group}
              </div>
              {!isCollapsed && (
                <div>
                  {tokens.map((meta) => (
                    <TokenRow
                      key={meta.path}
                      meta={meta}
                      value={resolveValue(currentTheme, meta.path)}
                      readOnly={isReadOnly}
                      onChange={(val) => updateToken(meta.path, val)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TokenRow({
  meta,
  value,
  readOnly,
  onChange,
}: {
  meta: TokenMeta;
  value: unknown;
  readOnly: boolean;
  onChange: (value: unknown) => void;
}) {
  const strValue = value == null ? '' : String(value);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderBottom: '1px solid #eee',
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: '40%',
          color: '#555',
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={meta.path}
      >
        {meta.label}
      </span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        {meta.editorType === 'color' && (
          <>
            <input
              type="color"
              value={strValue.startsWith('#') ? strValue : '#000000'}
              disabled={readOnly}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: 24, height: 20, padding: 0, border: '1px solid #ccc', cursor: readOnly ? 'default' : 'pointer' }}
            />
            <input
              type="text"
              value={strValue}
              readOnly={readOnly}
              onChange={(e) => onChange(e.target.value)}
              style={{
                flex: 1,
                padding: '1px 4px',
                border: '1px solid #ccc',
                borderRadius: 2,
                fontSize: 11,
                fontFamily: 'monospace',
                backgroundColor: readOnly ? '#f0f0f0' : '#fff',
              }}
            />
          </>
        )}
        {meta.editorType === 'text' && (
          <input
            type="text"
            value={strValue}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              padding: '1px 4px',
              border: '1px solid #ccc',
              borderRadius: 2,
              fontSize: 11,
              fontFamily: 'monospace',
              backgroundColor: readOnly ? '#f0f0f0' : '#fff',
            }}
          />
        )}
        {meta.editorType === 'number' && (
          <input
            type="number"
            value={typeof value === 'number' ? value : 0}
            readOnly={readOnly}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{
              width: 60,
              padding: '1px 4px',
              border: '1px solid #ccc',
              borderRadius: 2,
              fontSize: 11,
              backgroundColor: readOnly ? '#f0f0f0' : '#fff',
            }}
          />
        )}
        {meta.editorType === 'dropdown' && (
          <select
            value={strValue}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              padding: '1px 4px',
              border: '1px solid #ccc',
              borderRadius: 2,
              fontSize: 11,
              backgroundColor: readOnly ? '#f0f0f0' : '#fff',
            }}
          >
            {meta.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
