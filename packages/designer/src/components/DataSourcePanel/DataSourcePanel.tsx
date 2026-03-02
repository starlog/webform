import { useState, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { DataSourceDefinition, DatabaseDialect } from '@webform/common';

const DESIGNER_API = '/api';

// ─── API 함수 ─────────────────────────────────────────

async function fetchDataSources(projectId?: string): Promise<DataSourceDefinition[]> {
  const url = projectId
    ? `${DESIGNER_API}/datasources?projectId=${projectId}`
    : `${DESIGNER_API}/datasources`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch datasources: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function createDataSource(
  input: Omit<DataSourceDefinition, 'id'>,
): Promise<DataSourceDefinition> {
  const res = await fetch(`${DESIGNER_API}/datasources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create datasource: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function testConnection(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/test`, { method: 'POST' });
  if (!res.ok) throw new Error(`Connection test failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function previewData(id: string): Promise<unknown[]> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 10 }),
  });
  if (!res.ok) throw new Error(`Preview query failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ─── 스타일 ───────────────────────────────────────────

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
    fontSize: '12px',
    backgroundColor: '#f5f5f5',
    borderLeft: '1px solid #d0d0d0',
  } as CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    backgroundColor: '#e8e8e8',
    borderBottom: '1px solid #d0d0d0',
    fontWeight: 600,
    fontSize: '13px',
  } as CSSProperties,
  addButton: {
    backgroundColor: '#0078d7',
    color: '#fff',
    border: 'none',
    borderRadius: '2px',
    padding: '2px 8px',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: '18px',
  } as CSSProperties,
  list: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  } as CSSProperties,
  listItem: {
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #e0e0e0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as CSSProperties,
  listItemSelected: {
    backgroundColor: '#cce4f7',
  } as CSSProperties,
  dsType: {
    fontSize: '11px',
    color: '#888',
  } as CSSProperties,
  actions: {
    display: 'flex',
    gap: '4px',
    padding: '6px 10px',
    borderTop: '1px solid #d0d0d0',
  } as CSSProperties,
  actionButton: {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid #a0a0a0',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    fontSize: '11px',
    borderRadius: '2px',
  } as CSSProperties,
  testResult: {
    padding: '6px 10px',
    fontSize: '11px',
  } as CSSProperties,
  previewTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '11px',
  } as CSSProperties,
  previewTh: {
    backgroundColor: '#e0e0e0',
    border: '1px solid #d0d0d0',
    padding: '3px 6px',
    textAlign: 'left' as const,
    fontWeight: 600,
  } as CSSProperties,
  previewTd: {
    border: '1px solid #d0d0d0',
    padding: '2px 6px',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,
  previewContainer: {
    maxHeight: '200px',
    overflow: 'auto',
    padding: '0 10px 10px',
  } as CSSProperties,
  // 모달 스타일
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  } as CSSProperties,
  modal: {
    backgroundColor: '#fff',
    border: '1px solid #a0a0a0',
    padding: '16px',
    minWidth: '360px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  } as CSSProperties,
  modalTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
  } as CSSProperties,
  formGroup: {
    marginBottom: '8px',
  } as CSSProperties,
  formLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '2px',
  } as CSSProperties,
  formInput: {
    width: '100%',
    padding: '3px 6px',
    border: '1px solid #a0a0a0',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  } as CSSProperties,
  formSelect: {
    width: '100%',
    padding: '3px 4px',
    border: '1px solid #a0a0a0',
    fontSize: '12px',
    boxSizing: 'border-box' as const,
  } as CSSProperties,
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '6px',
    marginTop: '12px',
  } as CSSProperties,
  formCheckboxGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  } as CSSProperties,
};

// ─── 추가 모달 컴포넌트 ──────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onSubmit: (ds: Omit<DataSourceDefinition, 'id'>) => void;
}

type DsType = DataSourceDefinition['type'];

const DEFAULT_PORTS: Record<string, string> = {
  postgresql: '5432',
  mysql: '3306',
  mssql: '1433',
};

function AddDataSourceModal({ onClose, onSubmit }: AddModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DsType>('database');
  const [connectionString, setConnectionString] = useState('');
  const [database, setDatabase] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [staticData, setStaticData] = useState('[]');

  // dialect 관련 상태
  const [dialects, setDialects] = useState<Array<{ dialect: string; displayName: string }>>([]);
  const [dialectsLoaded, setDialectsLoaded] = useState(false);
  const [dialect, setDialect] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);

  // type이 'database'로 변경될 때 dialect 목록 fetch
  useEffect(() => {
    if (type === 'database' && !dialectsLoaded) {
      fetch(`${DESIGNER_API}/datasources/dialects`)
        .then((res) => res.json())
        .then((json) => {
          setDialects(json.data);
          setDialectsLoaded(true);
          if (json.data.length > 0) {
            setDialect(json.data[0].dialect);
          }
        })
        .catch(console.error);
    }
  }, [type, dialectsLoaded]);

  const handleDialectChange = (newDialect: string) => {
    setDialect(newDialect);
    setPort(DEFAULT_PORTS[newDialect] || '');
    if (newDialect === 'mongodb') {
      setHost('');
      setUser('');
      setPassword('');
      setSsl(false);
    } else {
      setConnectionString('');
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    let config: DataSourceDefinition['config'];
    if (type === 'database') {
      if (dialect === 'mongodb') {
        config = { dialect: 'mongodb', connectionString, database };
      } else {
        config = {
          dialect: dialect as DatabaseDialect,
          host,
          port: port ? Number(port) : undefined,
          user,
          password,
          database,
          ssl,
        };
      }
    } else if (type === 'restApi') {
      config = { baseUrl, headers: {}, auth: { type: 'none' } };
    } else {
      try {
        config = { data: JSON.parse(staticData) };
      } catch {
        config = { data: [] };
      }
    }

    onSubmit({ name, type, config });
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalTitle}>새 데이터 소스 추가</div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>이름</label>
          <input
            style={styles.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="데이터 소스 이름"
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.formLabel}>유형</label>
          <select
            style={styles.formSelect}
            value={type}
            onChange={(e) => setType(e.target.value as DsType)}
          >
            <option value="database">Database</option>
            <option value="restApi">REST API</option>
            <option value="static">Static</option>
          </select>
        </div>

        {type === 'database' && (
          <>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Dialect</label>
              <select
                style={styles.formSelect}
                value={dialect}
                onChange={(e) => handleDialectChange(e.target.value)}
              >
                {dialects.map((d) => (
                  <option key={d.dialect} value={d.dialect}>
                    {d.displayName}
                  </option>
                ))}
              </select>
            </div>

            {dialect === 'mongodb' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Connection String</label>
                  <input
                    style={styles.formInput}
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                    placeholder="mongodb://localhost:27017"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Database</label>
                  <input
                    style={styles.formInput}
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    placeholder="mydb"
                  />
                </div>
              </>
            )}

            {dialect && dialect !== 'mongodb' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Host</label>
                  <input
                    style={styles.formInput}
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="localhost"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Port</label>
                  <input
                    style={styles.formInput}
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    placeholder={DEFAULT_PORTS[dialect] || ''}
                    type="number"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>User</label>
                  <input
                    style={styles.formInput}
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="sa"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Password</label>
                  <input
                    style={styles.formInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Database</label>
                  <input
                    style={styles.formInput}
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    placeholder="mydb"
                  />
                </div>
                <div style={styles.formCheckboxGroup}>
                  <input
                    type="checkbox"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    id="ssl-checkbox"
                  />
                  <label htmlFor="ssl-checkbox" style={styles.formLabel}>
                    SSL
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {type === 'restApi' && (
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Base URL</label>
            <input
              style={styles.formInput}
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com"
            />
          </div>
        )}

        {type === 'static' && (
          <div style={styles.formGroup}>
            <label style={styles.formLabel}>Data (JSON)</label>
            <textarea
              style={{ ...styles.formInput, height: '80px', resize: 'vertical' }}
              value={staticData}
              onChange={(e) => setStaticData(e.target.value)}
            />
          </div>
        )}

        <div style={styles.modalActions}>
          <button style={styles.actionButton} onClick={onClose}>
            취소
          </button>
          <button
            style={{ ...styles.actionButton, backgroundColor: '#0078d7', color: '#fff' }}
            onClick={handleSubmit}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 미리보기 테이블 ─────────────────────────────────

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

// ─── 메인 컴포넌트 ───────────────────────────────────

interface DataSourcePanelProps {
  projectId?: string;
}

export function DataSourcePanel({ projectId }: DataSourcePanelProps) {
  const [dataSources, setDataSources] = useState<DataSourceDefinition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [previewRows, setPreviewRows] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(false);

  // 데이터소스 목록 조회
  const loadDataSources = useCallback(async () => {
    try {
      const list = await fetchDataSources(projectId);
      setDataSources(list);
    } catch (err) {
      console.error('Failed to load datasources:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadDataSources();
  }, [loadDataSources]);

  // 새 데이터소스 추가
  const handleAdd = useCallback(
    async (input: Omit<DataSourceDefinition, 'id'>) => {
      try {
        await createDataSource(input);
        setShowAddModal(false);
        await loadDataSources();
      } catch (err) {
        console.error('Failed to create datasource:', err);
      }
    },
    [loadDataSources],
  );

  // 연결 테스트
  const handleTest = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setTestResult(null);
    try {
      const result = await testConnection(selectedId);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // 데이터 미리보기
  const handlePreview = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    setPreviewRows(null);
    try {
      const data = await previewData(selectedId);
      setPreviewRows(data);
    } catch (err) {
      console.error('Preview failed:', err);
      setPreviewRows([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // 선택 변경 시 결과 초기화
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setTestResult(null);
    setPreviewRows(null);
  }, []);

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <span>데이터 소스</span>
        <button style={styles.addButton} onClick={() => setShowAddModal(true)}>
          +
        </button>
      </div>

      {/* 데이터소스 목록 */}
      <div style={styles.list}>
        {dataSources.map((ds) => (
          <div
            key={ds.id}
            style={{
              ...styles.listItem,
              ...(selectedId === ds.id ? styles.listItemSelected : {}),
            }}
            onClick={() => handleSelect(ds.id)}
          >
            <span>{ds.name}</span>
            <span style={styles.dsType}>{ds.type}</span>
          </div>
        ))}
        {dataSources.length === 0 && (
          <div style={{ padding: '10px', color: '#888', textAlign: 'center' }}>
            데이터 소스가 없습니다.
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      {selectedId && (
        <div style={styles.actions}>
          <button style={styles.actionButton} onClick={handleTest} disabled={loading}>
            연결 테스트
          </button>
          <button style={styles.actionButton} onClick={handlePreview} disabled={loading}>
            데이터 미리보기
          </button>
        </div>
      )}

      {/* 연결 테스트 결과 */}
      {testResult && (
        <div
          style={{
            ...styles.testResult,
            color: testResult.success ? '#107c10' : '#d13438',
          }}
        >
          {testResult.success ? '연결 성공' : `연결 실패: ${testResult.message}`}
        </div>
      )}

      {/* 데이터 미리보기 */}
      {previewRows !== null && <PreviewTable data={previewRows} />}

      {/* 추가 모달 */}
      {showAddModal && (
        <AddDataSourceModal onClose={() => setShowAddModal(false)} onSubmit={handleAdd} />
      )}
    </div>
  );
}
