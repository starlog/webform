import { useState, useEffect } from 'react';
import { styles } from './dataSourceStyles';
import { fetchTables, previewData, executeRawQuery, type RawDataSource } from './dataSourceApi';

function PreviewTable({ data }: { data: unknown[] }) {
  if (data.length === 0) {
    return <div style={{ padding: '10px', color: '#888' }}>데이터가 없습니다.</div>;
  }

  const rows = data as Record<string, unknown>[];
  const columns = Object.keys(rows[0]).filter((k) => !k.startsWith('_'));

  return (
    <div style={styles.previewContainer}>
      <table style={styles.previewTable}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={styles.previewTh}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} style={styles.previewTd}>
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getQueryPlaceholder(dialect?: string): string {
  if (dialect === 'mongodb') {
    return '{ "collection": "employees", "filter": { "age": { "$gt": 30 } }, "limit": 10 }';
  }
  return 'SELECT * FROM employees LIMIT 10';
}

export interface PreviewModalProps {
  ds: RawDataSource;
  onClose: () => void;
}

export function PreviewDataSourceModal({ ds, onClose }: PreviewModalProps) {
  const isDatabase = ds.type === 'database';
  const dialect = (ds as RawDataSource).meta?.dialect;

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tablesLoading, setTablesLoading] = useState(false);
  const [rows, setRows] = useState<unknown[] | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState('');
  const [rawQuery, setRawQuery] = useState('');

  // database 타입이면 테이블 목록 로드, 아니면 바로 쿼리
  useEffect(() => {
    if (isDatabase) {
      setTablesLoading(true);
      fetchTables(ds.id)
        .then((list) => {
          setTables(list);
          setSelectedTable(list[0] || '');
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => setTablesLoading(false));
    } else {
      setQuerying(true);
      previewData(ds.id)
        .then((data) => setRows(data))
        .catch((err) => {
          setError(err instanceof Error ? err.message : String(err));
          setRows([]);
        })
        .finally(() => setQuerying(false));
    }
  }, [ds.id, isDatabase]);

  const handleTableQuery = async () => {
    if (!selectedTable) return;
    setQuerying(true);
    setError('');
    setRows(null);
    try {
      const data = await previewData(ds.id, selectedTable, dialect);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setQuerying(false);
    }
  };

  const handleRawQuery = async () => {
    if (!rawQuery.trim()) return;
    setQuerying(true);
    setError('');
    setRows(null);
    try {
      const data = await executeRawQuery(ds.id, rawQuery.trim());
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div
        style={{
          ...styles.modal,
          minWidth: '520px',
          maxWidth: '80vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={styles.modalTitle}>데이터 미리보기 — {ds.name}</div>

        {/* database 타입: 테이블 선택 */}
        {isDatabase && (
          <div
            style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}
          >
            {tablesLoading ? (
              <span style={{ fontSize: '11px', color: '#888' }}>테이블 로딩...</span>
            ) : (
              <>
                <label style={{ ...styles.formLabel, marginBottom: 0, whiteSpace: 'nowrap' }}>
                  {dialect === 'mongodb' ? 'Collection' : 'Table'}
                </label>
                <select
                  style={{ ...styles.formSelect, flex: 1 }}
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                >
                  {tables.length === 0 && <option value="">없음</option>}
                  {tables.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  style={{
                    ...styles.actionButton,
                    flex: 'none',
                    backgroundColor: '#0078d7',
                    color: '#fff',
                  }}
                  onClick={handleTableQuery}
                  disabled={querying || !selectedTable}
                >
                  조회
                </button>
              </>
            )}
          </div>
        )}

        {/* database 타입: 테스트 쿼리 입력 */}
        {isDatabase && (
          <div style={{ marginBottom: '8px' }}>
            <label style={styles.formLabel}>
              테스트 쿼리 {dialect === 'mongodb' ? '(JSON)' : '(SQL)'}
            </label>
            <textarea
              style={{
                ...styles.formInput,
                height: '64px',
                resize: 'vertical',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '11px',
              }}
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder={getQueryPlaceholder(dialect)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleRawQuery();
                }
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '4px',
              }}
            >
              <span style={{ fontSize: '10px', color: '#999' }}>Ctrl+Enter로 실행</span>
              <button
                style={{
                  ...styles.actionButton,
                  flex: 'none',
                  backgroundColor: '#0078d7',
                  color: '#fff',
                }}
                onClick={handleRawQuery}
                disabled={querying || !rawQuery.trim()}
              >
                실행
              </button>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div style={{ fontSize: '11px', color: '#d13438', marginBottom: '6px' }}>{error}</div>
        )}

        {/* 로딩 */}
        {querying && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>조회 중...</div>
        )}

        {/* 결과 테이블 */}
        {rows !== null && !querying && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <PreviewTable data={rows} />
          </div>
        )}

        <div style={{ ...styles.modalActions, marginTop: '12px' }}>
          <button style={styles.actionButton} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
