import { useState, useEffect, useCallback } from 'react';
import type { DataSourceDefinition, DatabaseDialect } from '@webform/common';
import {
  fetchDataSources,
  createDataSource,
  testConnection,
  fetchDataSource,
  updateDataSource,
  deleteDataSource,
  fetchTables,
  previewData,
  executeRawQuery,
  authHeaders,
  DESIGNER_API,
  type RawDataSource,
} from './dataSourceApi';
import { styles, DEFAULT_PORTS } from './dataSourceStyles';

interface AddModalProps {
  onClose: () => void;
  onSubmit: (ds: Omit<DataSourceDefinition, 'id'>) => void;
}

type DsType = DataSourceDefinition['type'];

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
      authHeaders()
        .then((hdrs) => fetch(`${DESIGNER_API}/datasources/dialects`, { headers: hdrs }))
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch dialects: ${res.status}`);
          return res.json();
        })
        .then((json) => {
          const list = json.data ?? [];
          setDialects(list);
          setDialectsLoaded(true);
          if (list.length > 0) {
            setDialect(list[0].dialect);
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

// ─── 편집 모달 컴포넌트 ─────────────────────────────

interface EditModalProps {
  ds: DataSourceDefinition;
  onClose: () => void;
  onSave: (id: string, data: { name?: string; config?: DataSourceDefinition['config'] }) => void;
  onDelete: (id: string) => void;
}

function EditDataSourceModal({ ds, onClose, onSave, onDelete }: EditModalProps) {
  const [name, setName] = useState(ds.name);
  const [loading, setLoading] = useState(true);
  const [idCopied, setIdCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // database config fields
  const [dialect, setDialect] = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [ssl, setSsl] = useState(false);

  // restApi config fields
  const [baseUrl, setBaseUrl] = useState('');

  // static config fields
  const [staticData, setStaticData] = useState('[]');

  // 상세 데이터 로드 (복호화된 config 포함)
  useEffect(() => {
    fetchDataSource(ds.id)
      .then((detail) => {
        const cfg = detail.config as unknown as Record<string, unknown>;
        const rawDetail = detail as RawDataSource;
        if (ds.type === 'database' && cfg) {
          const detectedDialect = (cfg.dialect as string) || rawDetail.meta?.dialect || '';
          setDialect(detectedDialect);
          if (detectedDialect === 'mongodb') {
            setConnectionString((cfg.connectionString as string) || '');
            setDatabase((cfg.database as string) || '');
          } else {
            setHost((cfg.host as string) || '');
            setPort(cfg.port != null ? String(cfg.port) : '');
            setUser((cfg.user as string) || '');
            setPassword((cfg.password as string) || '');
            setDatabase((cfg.database as string) || '');
            setSsl(!!cfg.ssl);
          }
        } else if (ds.type === 'restApi' && cfg) {
          setBaseUrl((cfg.baseUrl as string) || '');
        } else if (ds.type === 'static' && cfg) {
          setStaticData(JSON.stringify((cfg as { data: unknown[] }).data ?? [], null, 2));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ds.id, ds.type]);

  const handleSave = () => {
    if (!name.trim()) return;

    let config: DataSourceDefinition['config'];
    if (ds.type === 'database') {
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
    } else if (ds.type === 'restApi') {
      config = { baseUrl, headers: {}, auth: { type: 'none' } };
    } else {
      try {
        config = { data: JSON.parse(staticData) };
      } catch {
        config = { data: [] };
      }
    }

    onSave(ds.id, { name, config });
  };

  const handleDelete = () => {
    if (confirm(`"${ds.name}" 데이터 소스를 삭제하시겠습니까?`)) {
      onDelete(ds.id);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(ds.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalTitle}>데이터 소스 편집</div>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>로딩 중...</div>
        ) : (
          <>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>ID</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  style={{ ...styles.formInput, flex: 1, fontFamily: 'monospace', backgroundColor: '#f5f5f5' }}
                  value={ds.id}
                  readOnly
                />
                <button
                  style={{
                    ...styles.actionButton,
                    flex: 'none',
                    padding: '3px 8px',
                    fontSize: '11px',
                    minWidth: '44px',
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(ds.id);
                    setIdCopied(true);
                    setTimeout(() => setIdCopied(false), 2000);
                  }}
                >
                  {idCopied ? '복사됨' : '복사'}
                </button>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>이름</label>
              <input
                style={styles.formInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>유형</label>
              <input style={styles.formInput} value={ds.type} disabled />
            </div>

            {ds.type === 'database' && dialect === 'mongodb' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Dialect</label>
                  <input style={styles.formInput} value="MongoDB" disabled />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Connection String</label>
                  <input
                    style={styles.formInput}
                    value={connectionString}
                    onChange={(e) => setConnectionString(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Database</label>
                  <input
                    style={styles.formInput}
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                </div>
              </>
            )}

            {ds.type === 'database' && dialect && dialect !== 'mongodb' && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Dialect</label>
                  <input style={styles.formInput} value={dialect} disabled />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Host</label>
                  <input
                    style={styles.formInput}
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Port</label>
                  <input
                    style={styles.formInput}
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    type="number"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>User</label>
                  <input
                    style={styles.formInput}
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
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
                  />
                </div>
                <div style={styles.formCheckboxGroup}>
                  <input
                    type="checkbox"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    id="edit-ssl-checkbox"
                  />
                  <label htmlFor="edit-ssl-checkbox" style={styles.formLabel}>
                    SSL
                  </label>
                </div>
              </>
            )}

            {ds.type === 'restApi' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Base URL</label>
                <input
                  style={styles.formInput}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>
            )}

            {ds.type === 'static' && (
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Data (JSON)</label>
                <textarea
                  style={{ ...styles.formInput, height: '80px', resize: 'vertical' }}
                  value={staticData}
                  onChange={(e) => setStaticData(e.target.value)}
                />
              </div>
            )}

            {/* 연결 테스트 */}
            {testResult && (
              <div
                style={{
                  fontSize: '11px',
                  padding: '4px 0',
                  color: testResult.success ? '#107c10' : '#d13438',
                }}
              >
                {testResult.success ? '연결 성공' : `연결 실패: ${testResult.message}`}
              </div>
            )}

            <div style={{ ...styles.modalActions, justifyContent: 'space-between' }}>
              <button
                style={{ ...styles.actionButton, color: '#d13438', borderColor: '#d13438' }}
                onClick={handleDelete}
              >
                삭제
              </button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  style={styles.actionButton}
                  onClick={handleTest}
                  disabled={testing}
                >
                  {testing ? '테스트 중...' : '연결 테스트'}
                </button>
                <button style={styles.actionButton} onClick={onClose}>
                  취소
                </button>
                <button
                  style={{ ...styles.actionButton, backgroundColor: '#0078d7', color: '#fff' }}
                  onClick={handleSave}
                >
                  저장
                </button>
              </div>
            </div>
          </>
        )}
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

// ─── 미리보기 모달 컴포넌트 ──────────────────────────

interface PreviewModalProps {
  ds: RawDataSource;
  onClose: () => void;
}

function getQueryPlaceholder(dialect?: string): string {
  if (dialect === 'mongodb') {
    return '{ "collection": "employees", "filter": { "age": { "$gt": 30 } }, "limit": 10 }';
  }
  return 'SELECT * FROM employees LIMIT 10';
}

function PreviewDataSourceModal({ ds, onClose }: PreviewModalProps) {
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
        style={{ ...styles.modal, minWidth: '520px', maxWidth: '80vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={styles.modalTitle}>데이터 미리보기 — {ds.name}</div>

        {/* database 타입: 테이블 선택 */}
        {isDatabase && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
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
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  style={{ ...styles.actionButton, flex: 'none', backgroundColor: '#0078d7', color: '#fff' }}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '10px', color: '#999' }}>Ctrl+Enter로 실행</span>
              <button
                style={{ ...styles.actionButton, flex: 'none', backgroundColor: '#0078d7', color: '#fff' }}
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
          <button style={styles.actionButton} onClick={onClose}>닫기</button>
        </div>
      </div>
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
  const [editingDs, setEditingDs] = useState<DataSourceDefinition | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [previewingDs, setPreviewingDs] = useState<RawDataSource | null>(null);
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

  // 데이터 미리보기 모달 열기
  const handlePreview = useCallback(() => {
    if (!selectedId) return;
    const ds = dataSources.find((d) => d.id === selectedId) as RawDataSource | undefined;
    if (ds) setPreviewingDs(ds);
  }, [selectedId, dataSources]);

  // 데이터소스 수정
  const handleUpdate = useCallback(
    async (id: string, data: { name?: string; config?: DataSourceDefinition['config'] }) => {
      try {
        await updateDataSource(id, data);
        setEditingDs(null);
        await loadDataSources();
      } catch (err) {
        console.error('Failed to update datasource:', err);
      }
    },
    [loadDataSources],
  );

  // 데이터소스 삭제
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteDataSource(id);
        setEditingDs(null);
        setPreviewingDs(null);
        setSelectedId(null);
        setTestResult(null);
        await loadDataSources();
      } catch (err) {
        console.error('Failed to delete datasource:', err);
      }
    },
    [loadDataSources],
  );

  // 편집 모달 열기
  const handleEdit = useCallback(() => {
    if (!selectedId) return;
    const ds = dataSources.find((d) => d.id === selectedId);
    if (ds) setEditingDs(ds);
  }, [selectedId, dataSources]);

  // 선택 변경 시 결과 초기화
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setTestResult(null);
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
            onDoubleClick={() => setEditingDs(ds)}
          >
            <div>
              <div>{ds.name}</div>
              <div style={{ fontSize: '10px', color: '#999', fontFamily: 'monospace' }}>
                {ds.id.slice(-8)}
              </div>
            </div>
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
        <>
          <div style={styles.actions}>
            <button style={styles.actionButton} onClick={handleEdit} disabled={loading}>
              편집
            </button>
            <button style={styles.actionButton} onClick={handleTest} disabled={loading}>
              연결 테스트
            </button>
            <button style={styles.actionButton} onClick={handlePreview} disabled={loading}>
              미리보기
            </button>
          </div>
        </>
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

      {/* 추가 모달 */}
      {showAddModal && (
        <AddDataSourceModal onClose={() => setShowAddModal(false)} onSubmit={handleAdd} />
      )}

      {/* 편집 모달 */}
      {editingDs && (
        <EditDataSourceModal
          ds={editingDs}
          onClose={() => setEditingDs(null)}
          onSave={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* 미리보기 모달 */}
      {previewingDs && (
        <PreviewDataSourceModal
          ds={previewingDs}
          onClose={() => setPreviewingDs(null)}
        />
      )}
    </div>
  );
}
