import { useState, useEffect, useRef } from 'react';

interface TextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextEditor({ value, onChange }: TextEditorProps) {
  const [local, setLocal] = useState(value ?? '');
  const pendingRef = useRef<{ value: string; onChange: (v: string) => void } | null>(null);

  useEffect(() => {
    // Flush pending change before syncing with new prop value
    if (pendingRef.current) {
      pendingRef.current.onChange(pendingRef.current.value);
      pendingRef.current = null;
    }
    setLocal(value ?? '');
  }, [value]);

  // Flush pending change on unmount
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
      type="text"
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
