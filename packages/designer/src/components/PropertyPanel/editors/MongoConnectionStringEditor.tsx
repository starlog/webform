import { useState, useCallback } from 'react';
import { useDesignerStore } from '../../../stores/designerStore';
import { useSelectionStore } from '../../../stores/selectionStore';

interface MongoConnectionStringEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MongoConnectionStringEditor({ value, onChange }: MongoConnectionStringEditorProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = useCallback(async () => {
    // 현재 선택된 컨트롤에서 database 값 읽기
    const selectedIds = useSelectionStore.getState().selectedIds;
    if (selectedIds.size !== 1) return;
    const controlId = [...selectedIds][0];
    const control = useDesignerStore.getState().controls.find((c) => c.id === controlId);
    const database = (control?.properties?.database as string) || '';

    if (!value) {
      setResult({ success: false, message: 'ConnectionString을 입력하세요.' });
      return;
    }
    if (!database) {
      setResult({ success: false, message: 'Database를 먼저 입력하세요.' });
      return;
    }

    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/runtime/mongodb/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionString: value, database }),
      });
      const data = await res.json();
      setResult({ success: data.success, message: data.message });
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }, [value]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setResult(null);
          }}
          style={{
            width: 0,
            flex: '1 1 0',
            border: '1px solid #ccc',
            padding: '1px 2px',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        />
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          style={{
            border: '1px solid #0078d4',
            borderRadius: 2,
            backgroundColor: '#0078d4',
            color: '#fff',
            fontSize: 10,
            padding: '1px 6px',
            cursor: testing ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
          }}
        >
          {testing ? '...' : 'Test'}
        </button>
      </div>
      {result && (
        <div style={{
          marginTop: 2,
          fontSize: 10,
          padding: '2px 4px',
          borderRadius: 2,
          backgroundColor: result.success ? '#e8f5e9' : '#ffebee',
          color: result.success ? '#2e7d32' : '#c62828',
          wordBreak: 'break-all',
        }}>
          {result.success ? 'Connection OK' : result.message}
        </div>
      )}
    </div>
  );
}
