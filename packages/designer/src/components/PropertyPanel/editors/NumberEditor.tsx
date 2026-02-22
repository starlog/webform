import { useState, useEffect, useRef } from 'react';

interface NumberEditorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function NumberEditor({ value, onChange, min, max }: NumberEditorProps) {
  const [local, setLocal] = useState(String(value ?? 0));
  const pendingRef = useRef<{ value: string; onChange: (v: number) => void } | null>(null);

  useEffect(() => {
    // Flush pending change before syncing with new prop value
    if (pendingRef.current) {
      flushPending(pendingRef.current, min, max);
      pendingRef.current = null;
    }
    setLocal(String(value ?? 0));
  }, [value, min, max]);

  // Flush pending change on unmount
  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        flushPending(pendingRef.current, min, max);
        pendingRef.current = null;
      }
    };
  }, [min, max]);

  const commit = () => {
    pendingRef.current = null;
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
      onChange={(e) => {
        setLocal(e.target.value);
        pendingRef.current = { value: e.target.value, onChange };
      }}
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

function flushPending(
  pending: { value: string; onChange: (v: number) => void },
  min?: number,
  max?: number,
) {
  let num = parseFloat(pending.value);
  if (isNaN(num)) num = 0;
  if (min !== undefined && num < min) num = min;
  if (max !== undefined && num > max) num = max;
  pending.onChange(num);
}
