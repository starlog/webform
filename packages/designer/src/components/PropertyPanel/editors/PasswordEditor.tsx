import { useState, useEffect, useRef } from 'react';

interface PasswordEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PasswordEditor({ value, onChange }: PasswordEditorProps) {
  const [local, setLocal] = useState(value ?? '');
  const pendingRef = useRef<{ value: string; onChange: (v: string) => void } | null>(null);

  useEffect(() => {
    if (pendingRef.current) {
      pendingRef.current.onChange(pendingRef.current.value);
      pendingRef.current = null;
    }
    setLocal(value ?? '');
  }, [value]);

  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        pendingRef.current.onChange(pendingRef.current.value);
        pendingRef.current = null;
      }
    };
  }, []);

  return (
    <input
      type="password"
      value={local}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        pendingRef.current = { value: v, onChange };
      }}
      onBlur={() => {
        pendingRef.current = null;
        onChange(local);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          pendingRef.current = null;
          onChange(local);
          (e.target as HTMLInputElement).blur();
        }
      }}
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
