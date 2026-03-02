import { useState, useCallback, useRef, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useSelectionStore } from '../../../stores/selectionStore';
import { useDesignerStore } from '../../../stores/designerStore';

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
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const controls = useDesignerStore((s) => s.controls);
  const updateControl = useDesignerStore((s) => s.updateControl);

  const selectedControl = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return controls.find((c) => c.id === id) ?? null;
  }, [selectedIds, controls]);

  const specSource = (selectedControl?.properties.specSource as string) || 'yaml';
  const specUrl = (selectedControl?.properties.specUrl as string) || '';

  const setProperty = useCallback(
    (key: string, val: unknown) => {
      if (!selectedControl) return;
      updateControl(selectedControl.id, {
        properties: { ...selectedControl.properties, [key]: val },
      });
    },
    [selectedControl, updateControl],
  );

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

  const handleFetch = useCallback(async () => {
    if (!specUrl.trim()) return;
    setFetchLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/swagger/fetch-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: specUrl }),
      });
      const result = await res.json();
      if (!res.ok) {
        setFetchError(result.error || `Error: ${res.status}`);
        return;
      }
      onChange(result.specYaml);
      validate(result.specYaml);
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setFetchLoading(false);
    }
  }, [specUrl, onChange, validate]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    border: '1px solid #ccc',
    borderBottom: active ? '1px solid #fff' : '1px solid #ccc',
    borderRadius: '3px 3px 0 0',
    backgroundColor: active ? '#fff' : '#f0f0f0',
    color: active ? '#0078d4' : '#666',
    fontSize: 10,
    fontWeight: active ? 600 : 400,
    padding: '2px 8px',
    cursor: 'pointer',
    marginBottom: -1,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* 탭 + 액션 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button type="button" style={tabStyle(specSource === 'yaml')} onClick={() => setProperty('specSource', 'yaml')}>
          YAML
        </button>
        <button type="button" style={tabStyle(specSource === 'url')} onClick={() => setProperty('specSource', 'url')}>
          URL
        </button>
        <div style={{ flex: 1 }} />
        {validationInfo && (
          <span style={{ fontSize: 10, color: '#2e7d32' }}>{validationInfo}</span>
        )}
        {specSource === 'yaml' && (
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
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleFileImport}
          style={{ display: 'none' }}
        />
      </div>

      {/* YAML 모드 */}
      {specSource === 'yaml' && (
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
      )}

      {/* URL 모드 */}
      {specSource === 'url' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              type="text"
              value={specUrl}
              onChange={(e) => setProperty('specUrl', e.target.value)}
              placeholder="https://example.com/api-docs/"
              style={{
                flex: 1,
                border: '1px solid #ddd',
                borderRadius: 2,
                padding: '3px 6px',
                fontSize: 11,
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={handleFetch}
              disabled={fetchLoading || !specUrl.trim()}
              style={{
                border: '1px solid #0078d4',
                borderRadius: 2,
                backgroundColor: fetchLoading ? '#ccc' : '#0078d4',
                color: '#fff',
                fontSize: 10,
                padding: '2px 8px',
                cursor: fetchLoading ? 'default' : 'pointer',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {fetchLoading ? 'Fetching...' : 'Fetch'}
            </button>
          </div>
          {fetchError && (
            <div style={{ fontSize: 10, color: '#d32f2f', padding: '2px 4px', backgroundColor: '#fce4ec', borderRadius: 2 }}>
              {fetchError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
