import { useState, useEffect } from 'react';
import type { DataSourceDefinition, DatabaseDialect } from '@webform/common';
import { styles, DEFAULT_PORTS } from './dataSourceStyles';
import { authHeaders, DESIGNER_API } from './dataSourceApi';
import { DatabaseFormFields } from './DatabaseFormFields';

export interface AddModalProps {
  onClose: () => void;
  onSubmit: (ds: Omit<DataSourceDefinition, 'id'>) => void;
}

type DsType = DataSourceDefinition['type'];

export function AddDataSourceModal({ onClose, onSubmit }: AddModalProps) {
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
              defaultPorts={DEFAULT_PORTS}
              showPlaceholders
            />
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
