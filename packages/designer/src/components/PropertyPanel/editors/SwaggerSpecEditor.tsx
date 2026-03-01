import { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';

interface SwaggerSpecEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

export function SwaggerSpecEditor({ value, onChange }: SwaggerSpecEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationInfo, setValidationInfo] = useState<string>('');

  const validate = useCallback((yaml: string) => {
    if (!yaml.trim()) {
      setValidationInfo('');
      return;
    }
    const titleMatch = yaml.match(/title:\s*['"]?([^'"\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
    const endpoints = (yaml.match(/^\s+(get|post|put|patch|delete):/gm) || []).length;
    setValidationInfo(`${title} — ${endpoints} endpoints`);
  }, []);

  const handleEditorChange = useCallback(
    (val: string | undefined) => {
      const newVal = val ?? '';
      onChange(newVal);
      validate(newVal);
    },
    [onChange, validate],
  );

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        onChange(text);
        validate(text);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onChange, validate],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {validationInfo && (
          <span style={{ fontSize: 10, color: '#2e7d32', flex: 1 }}>{validationInfo}</span>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '1px solid #0078d4',
            borderRadius: 2,
            backgroundColor: '#0078d4',
            color: '#fff',
            fontSize: 10,
            padding: '1px 6px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleFileImport}
          style={{ display: 'none' }}
        />
      </div>
      <Editor
        height={200}
        language="yaml"
        value={value}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          lineNumbers: 'off',
          fontSize: 11,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
        }}
      />
    </div>
  );
}
