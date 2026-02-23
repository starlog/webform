import { useState, useCallback, useMemo } from 'react';
import { useDesignerStore } from '../../../stores/designerStore';
import { useSelectionStore } from '../../../stores/selectionStore';

interface MongoColumnsEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MongoColumnsEditor({ value, onChange }: MongoColumnsEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [fetchedCols, setFetchedCols] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const controls = useDesignerStore((s) => s.controls);

  const control = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return controls.find((c) => c.id === id) ?? null;
  }, [selectedIds, controls]);

  const connStr = (control?.properties?.connectionString as string) || '';
  const db = (control?.properties?.database as string) || '';
  const coll = (control?.properties?.collection as string) || '';

  const selectedCols = useMemo(
    () => (value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []),
    [value],
  );

  const handleFetch = useCallback(async () => {
    if (!connStr || !db || !coll) {
      setFetchError('ConnectionString, Database, Collection을 먼저 설정하세요.');
      return;
    }
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch('/api/runtime/mongodb/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionString: connStr,
          database: db,
          collection: coll,
          limit: 10,
        }),
      });
      if (!res.ok) throw new Error(`Query failed: ${res.status}`);
      const json = await res.json();
      const docs = json.data as Record<string, unknown>[];
      if (docs.length === 0) {
        setFetchError('No documents found.');
        setFetchedCols([]);
        return;
      }
      // Collect all unique keys across all sample docs
      const keySet = new Set<string>();
      for (const doc of docs) {
        for (const k of Object.keys(doc)) {
          if (k !== '__v') keySet.add(k);
        }
      }
      setFetchedCols([...keySet]);
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setFetching(false);
    }
  }, [connStr, db, coll]);

  const toggleCol = useCallback(
    (col: string) => {
      // If nothing is selected, treat as "all" — start with all fetched selected, then remove
      const effective =
        selectedCols.length > 0 ? new Set(selectedCols) : new Set(fetchedCols);
      if (effective.has(col)) {
        effective.delete(col);
      } else {
        effective.add(col);
      }
      // If all fetched cols are selected, clear to mean "all"
      if (
        fetchedCols.length > 0 &&
        fetchedCols.every((c) => effective.has(c))
      ) {
        onChange('');
      } else {
        onChange([...effective].join(','));
      }
    },
    [selectedCols, fetchedCols, onChange],
  );

  const handleSelectAll = useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleClearAll = useCallback(() => {
    if (fetchedCols.length > 0) {
      onChange('_id');
    }
  }, [fetchedCols, onChange]);

  const summary = value || '(all columns)';

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
        <div
          style={{
            padding: 4,
            border: '1px solid #ddd',
            marginTop: 2,
            backgroundColor: '#fafafa',
          }}
        >
          {/* Manual input */}
          <div style={{ marginBottom: 4 }}>
            <input
              type="text"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="col1,col2,... (empty = all)"
              style={{
                width: '100%',
                fontSize: 11,
                border: '1px solid #ccc',
                padding: '2px 4px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Fetch button */}
          <div style={{ marginBottom: 4, display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={handleFetch}
              disabled={fetching}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                cursor: fetching ? 'wait' : 'pointer',
                border: '1px solid #ccc',
                background: '#fff',
                borderRadius: 2,
              }}
            >
              {fetching ? 'Fetching...' : 'Fetch Columns'}
            </button>
          </div>

          {fetchError && (
            <div style={{ fontSize: 10, color: '#c00', marginBottom: 4 }}>
              {fetchError}
            </div>
          )}

          {/* Checkbox list */}
          {fetchedCols.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 4,
                  fontSize: 10,
                }}
              >
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    fontSize: 10,
                    padding: '1px 4px',
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    background: '#fff',
                    borderRadius: 2,
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    fontSize: 10,
                    padding: '1px 4px',
                    cursor: 'pointer',
                    border: '1px solid #ccc',
                    background: '#fff',
                    borderRadius: 2,
                  }}
                >
                  Clear
                </button>
              </div>
              <div
                style={{
                  maxHeight: 160,
                  overflow: 'auto',
                  border: '1px solid #ddd',
                  padding: 4,
                  backgroundColor: '#fff',
                }}
              >
                {fetchedCols.map((col) => {
                  const isChecked =
                    selectedCols.length === 0 || selectedCols.includes(col);
                  return (
                    <label
                      key={col}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: '1px 0',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCol(col)}
                        style={{ margin: 0 }}
                      />
                      <span
                        style={{
                          fontFamily:
                            col === '_id' ? 'monospace' : 'inherit',
                          color: col === '_id' ? '#888' : '#333',
                        }}
                      >
                        {col}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
