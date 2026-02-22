import { useState, useEffect } from 'react';

interface NumberEditorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function NumberEditor({ value, onChange, min, max }: NumberEditorProps) {
  const [local, setLocal] = useState(String(value ?? 0));

  useEffect(() => {
    setLocal(String(value ?? 0));
  }, [value]);

  const commit = () => {
    let num = parseFloat(local);
    if (isNaN(num)) num = 0;
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    setLocal(String(num));
    onChange(num);
  };

  return (
    <input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          (e.target as HTMLInputElement).blur();
        }
      }}
      min={min}
      max={max}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '1px 2px',
        border: '1px solid #ccc',
        fontSize: 12,
        fontFamily: 'Segoe UI, sans-serif',
      }}
    />
  );
}
