import { useState, useCallback, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRuntimeStore } from '../stores/runtimeStore';

interface FontDef {
  family?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

interface JsonEditorProps {
  id: string;
  name: string;
  value?: unknown;
  readOnly?: boolean;
  expandDepth?: number;
  backColor?: string;
  font?: FontDef;
  style?: CSSProperties;
  enabled?: boolean;
  onValueChanged?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

interface JsonNodeProps {
  label: string;
  value: unknown;
  path: string[];
  depth: number;
  expandDepth: number;
  readOnly: boolean;
  enabled: boolean;
  onChange: (path: string[], newValue: unknown) => void;
}

function getValueType(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function JsonNode({ label, value, path, depth, expandDepth, readOnly, enabled, onChange }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(depth >= expandDepth);
  const type = getValueType(value);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  if (type === 'object' || type === 'array') {
    const entries = type === 'array'
      ? (value as unknown[]).map((v, i) => [`[${i}]`, v] as const)
      : Object.entries(value as Record<string, unknown>);
    const bracketOpen = type === 'array' ? '[' : '{';
    const bracketClose = type === 'array' ? ']' : '}';

    return (
      <div style={{ paddingLeft: depth > 0 ? 14 : 0 }}>
        <div style={styles.row}>
          <span style={styles.toggle} onClick={toggle}>
            {collapsed ? '\u25B6' : '\u25BC'}
          </span>
          <span style={styles.key}>{label}</span>
          <span style={styles.colon}>:</span>
          {collapsed ? (
            <span style={styles.bracket}>
              {bracketOpen} {entries.length} items {bracketClose}
            </span>
          ) : (
            <span style={styles.bracket}>{bracketOpen}</span>
          )}
        </div>
        {!collapsed && (
          <>
            {entries.map(([k, v]) => (
              <JsonNode
                key={k}
                label={String(k)}
                value={v}
                path={[...path, String(k)]}
                depth={depth + 1}
                expandDepth={expandDepth}
                readOnly={readOnly}
                enabled={enabled}
                onChange={onChange}
              />
            ))}
            <div style={{ paddingLeft: 14 + depth * 14 }}>
              <span style={styles.bracket}>{bracketClose}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  // Leaf nodes
  return (
    <div style={{ ...styles.row, paddingLeft: depth > 0 ? 14 : 0 }}>
      <span style={{ ...styles.toggle, visibility: 'hidden' }}>{'\u25B6'}</span>
      <span style={styles.key}>{label}</span>
      <span style={styles.colon}>:</span>
      {type === 'boolean' ? (
        <input
          type="checkbox"
          checked={value as boolean}
          disabled={readOnly || !enabled}
          onChange={(e) => onChange(path, e.target.checked)}
          style={styles.checkbox}
        />
      ) : type === 'number' ? (
        <input
          type="number"
          value={value as number}
          disabled={readOnly || !enabled}
          onChange={(e) => onChange(path, e.target.value === '' ? 0 : Number(e.target.value))}
          style={styles.input}
        />
      ) : type === 'null' ? (
        <span style={styles.nullValue}>null</span>
      ) : (
        <input
          type="text"
          value={String(value)}
          disabled={readOnly || !enabled}
          onChange={(e) => onChange(path, e.target.value)}
          style={styles.input}
        />
      )}
    </div>
  );
}

function parseValue(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (raw !== null && typeof raw === 'object') return raw;
  return {};
}

export function JsonEditor({
  id,
  value: rawValue,
  readOnly = false,
  expandDepth = 1,
  backColor,
  font,
  style,
  enabled = true,
  onValueChanged,
}: JsonEditorProps) {
  const updateControlState = useRuntimeStore((s) => s.updateControlState);
  const parsed = useMemo(() => parseValue(rawValue), [rawValue]);

  const fontStyle = useMemo<CSSProperties>(() => {
    if (!font) return {};
    const textDecoration = [
      font.underline ? 'underline' : '',
      font.strikethrough ? 'line-through' : '',
    ].filter(Boolean).join(' ');
    return {
      fontFamily: font.family || undefined,
      fontSize: font.size ? `${font.size}pt` : undefined,
      fontWeight: font.bold ? 'bold' : undefined,
      fontStyle: font.italic ? 'italic' : undefined,
      textDecoration: textDecoration || undefined,
    };
  }, [font]);

  const handleChange = useCallback(
    (path: string[], newLeafValue: unknown) => {
      const updated = structuredClone(parsed);
      // Navigate to parent and set value
      let current: unknown = updated;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (Array.isArray(current)) {
          const idx = key.startsWith('[') ? Number(key.slice(1, -1)) : Number(key);
          current = (current as unknown[])[idx];
        } else {
          current = (current as Record<string, unknown>)[key];
        }
      }
      const lastKey = path[path.length - 1];
      if (Array.isArray(current)) {
        const idx = lastKey.startsWith('[') ? Number(lastKey.slice(1, -1)) : Number(lastKey);
        (current as unknown[])[idx] = newLeafValue;
      } else {
        (current as Record<string, unknown>)[lastKey] = newLeafValue;
      }
      updateControlState(id, 'value', updated);
      onValueChanged?.();
    },
    [parsed, id, updateControlState, onValueChanged],
  );

  const type = getValueType(parsed);
  const isRoot = type === 'object' || type === 'array';

  return (
    <div
      className="wf-json-editor"
      data-control-id={id}
      style={{
        ...baseStyle,
        backgroundColor: backColor || '#ffffff',
        ...fontStyle,
        ...style,
      }}
    >
      {isRoot ? (
        Object.entries(
          type === 'array'
            ? Object.fromEntries((parsed as unknown[]).map((v, i) => [`[${i}]`, v]))
            : (parsed as Record<string, unknown>),
        ).map(([k, v]) => (
          <JsonNode
            key={k}
            label={k}
            value={v}
            path={[k]}
            depth={0}
            expandDepth={expandDepth}
            readOnly={readOnly}
            enabled={enabled}
            onChange={handleChange}
          />
        ))
      ) : (
        <span style={styles.nullValue}>{String(parsed)}</span>
      )}
    </div>
  );
}

const baseStyle: CSSProperties = {
  border: '1px solid #a0a0a0',
  padding: 6,
  overflow: 'auto',
  fontFamily: 'Consolas, monospace',
  fontSize: 12,
  boxSizing: 'border-box',
};

const styles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
    whiteSpace: 'nowrap',
  },
  toggle: {
    cursor: 'pointer',
    fontSize: 9,
    width: 12,
    textAlign: 'center',
    color: '#666',
    flexShrink: 0,
    userSelect: 'none',
  },
  key: {
    color: '#0451a5',
    fontWeight: 600,
    flexShrink: 0,
  },
  colon: {
    color: '#666',
    flexShrink: 0,
  },
  bracket: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 11,
  },
  input: {
    border: '1px solid #ccc',
    borderRadius: 2,
    padding: '1px 4px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    minWidth: 60,
    flex: 1,
    maxWidth: 200,
  },
  checkbox: {
    margin: 0,
  },
  nullValue: {
    color: '#999',
    fontStyle: 'italic',
  },
};
