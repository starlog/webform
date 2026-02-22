import { useState, useEffect } from 'react';
import type { FontDefinition } from '@webform/common';

interface FontPickerProps {
  value: FontDefinition | undefined;
  onChange: (value: FontDefinition) => void;
}

const DEFAULT_FONT: FontDefinition = {
  family: 'Segoe UI',
  size: 9,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
};

const FONT_FAMILIES = [
  'Segoe UI', 'Arial', 'Verdana', 'Tahoma',
  'Times New Roman', 'Georgia', 'Courier New',
  'Consolas', 'Malgun Gothic',
];

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const font = value ?? DEFAULT_FONT;

  const update = (partial: Partial<FontDefinition>) => {
    onChange({ ...font, ...partial });
  };

  const summary = `${font.family}, ${font.size}pt${font.bold ? ', Bold' : ''}${font.italic ? ', Italic' : ''}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '1px 2px',
          border: '1px solid #ccc',
          background: '#fff',
          fontSize: 12,
          fontFamily: 'Segoe UI, sans-serif',
          cursor: 'pointer',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {summary}
      </button>
      {expanded && (
        <div style={{ padding: 4, border: '1px solid #ddd', marginTop: 2, backgroundColor: '#fafafa' }}>
          <div style={{ marginBottom: 4 }}>
            <select
              value={font.family}
              onChange={(e) => update({ family: e.target.value })}
              style={{ width: '100%', fontSize: 12 }}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 11 }}>Size:</label>
            <FontSizeInput value={font.size} onChange={(size) => update({ size })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ fontSize: 11 }}>
              <input type="checkbox" checked={font.bold} onChange={(e) => update({ bold: e.target.checked })} />
              B
            </label>
            <label style={{ fontSize: 11 }}>
              <input type="checkbox" checked={font.italic} onChange={(e) => update({ italic: e.target.checked })} />
              I
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function FontSizeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(value));

  useEffect(() => {
    setLocal(String(value));
  }, [value]);

  const commit = () => {
    let num = parseFloat(local);
    if (isNaN(num) || num < 1) num = 1;
    if (num > 200) num = 200;
    setLocal(String(num));
    onChange(num);
  };

  return (
    <input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      min={1}
      max={200}
      style={{ width: 50, fontSize: 12, border: '1px solid #ccc', padding: '1px 2px' }}
    />
  );
}
