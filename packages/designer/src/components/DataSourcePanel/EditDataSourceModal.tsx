import { useState, useEffect } from 'react';
import type { DataSourceDefinition, DatabaseDialect } from '@webform/common';
import { styles } from './dataSourceStyles';
import { fetchDataSource, testConnection, type RawDataSource } from './dataSourceApi';
import { DatabaseFormFields } from './DatabaseFormFields';

export interface EditModalProps {
  ds: DataSourceDefinition;
  onClose: () => void;
  onSave: (id: string, data: { name?: string; config?: DataSourceDefinition['config'] }) => void;
  onDelete: (id: string) => void;
}

export function EditDataSourceModal({ ds, onClose, onSave, onDelete }: EditModalProps) {
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
                  style={{
                    ...styles.formInput,
                    flex: 1,
                    fontFamily: 'monospace',
                    backgroundColor: '#f5f5f5',
                  }}
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

            {ds.type === 'database' && dialect && (
              <>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Dialect</label>
                  <input
                    style={styles.formInput}
                    value={dialect === 'mongodb' ? 'MongoDB' : dialect}
                    disabled
                  />
                </div>
                <DatabaseFormFields
                  dialect={dialect}
                  connectionString={connectionString}
                  onConnectionStringChange={setConnectionString}
                  host={host}
                  onHostChange={setHost}
                  port={port}
                  onPortChange={setPort}
                  user={user}
                  onUserChange={setUser}
                  password={password}
                  onPasswordChange={setPassword}
                  database={database}
                  onDatabaseChange={setDatabase}
                  ssl={ssl}
                  onSslChange={setSsl}
                  styles={styles}
                />
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
                <button style={styles.actionButton} onClick={handleTest} disabled={testing}>
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
