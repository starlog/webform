import { useState, useCallback } from 'react';
import type { ControlDefinition } from '@webform/common';
import { apiService } from '../../services/apiService';

interface DataSourceTestPanelProps {
  control: ControlDefinition;
}

export function DataSourceTestPanel({ control }: DataSourceTestPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [connStatus, setConnStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [connLoading, setConnLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<{ data: unknown[]; rowCount: number } | null>(
    null,
  );
  const [queryError, setQueryError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);

  const props = control.properties;
  const dsType = (props.dsType as string) || 'database';

  const buildConfig = useCallback((): Record<string, unknown> => {
    const config: Record<string, unknown> = { dsType };
    if (dsType === 'database') {
      config.dialect = props.dialect || 'postgresql';
      if (config.dialect === 'mongodb') {
        config.connectionString = props.connectionString;
        config.database = props.database;
      } else {
        config.host = props.host;
        config.port = props.port;
        config.user = props.user;
        config.password = props.password;
        config.database = props.database;
        config.ssl = props.ssl;
      }
    } else if (dsType === 'restApi') {
      config.baseUrl = props.baseUrl;
      config.headers = props.headers;
      config.authType = props.authType;
      config.authCredentials = props.authCredentials;
    }
    return config;
  }, [dsType, props]);

  const handleListTables = useCallback(async () => {
    setTablesLoading(true);
    setTables([]);
    try {
      const result = await apiService.listDataSourceTables(buildConfig());
      setTables(result.tables);
    } catch {
      // 실패 시 무시 — 연결 테스트에서 에러를 확인할 수 있음
    } finally {
      setTablesLoading(false);
    }
  }, [buildConfig]);

  const handleTableSelect = useCallback(
    (tableName: string) => {
      if (!tableName) return;
      const dialect = (props.dialect as string) || 'postgresql';
      if (dialect === 'mongodb') {
        setQuery(JSON.stringify({ collection: tableName, limit: 10 }));
      } else {
        setQuery(`SELECT * FROM ${tableName} LIMIT 10`);
      }
    },
    [props.dialect],
  );

  const handleTestConnection = useCallback(async () => {
    setConnLoading(true);
    setConnStatus(null);
    try {
      const result = await apiService.testDataSourceConnection(buildConfig());
      setConnStatus(result);
    } catch (err) {
      setConnStatus({ success: false, message: (err as Error).message });
    } finally {
      setConnLoading(false);
    }
  }, [buildConfig]);

  const handleRunQuery = useCallback(async () => {
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    try {
      const config = buildConfig();
      config.query = query;
      if (dsType === 'static') {
        config.data = props.data;
      }
      const result = await apiService.queryDataSource(config);
      setQueryResult({ data: result.data, rowCount: result.rowCount });
    } catch (err) {
      setQueryError((err as Error).message);
    } finally {
      setQueryLoading(false);
    }
  }, [buildConfig, query, dsType, props.data]);

  const placeholder =
    dsType === 'database'
      ? (props.dialect === 'mongodb'
          ? '{"collection":"users","limit":10}'
          : 'SELECT * FROM table_name LIMIT 10')
      : dsType === 'restApi'
        ? '{"method":"GET","path":"/endpoint"}'
        : '';

  return (
    <div role="region" aria-label="Testing" style={{ borderBottom: '1px solid #e0e0e0' }}>
      {/* 카테고리 헤더 */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 4px',
          backgroundColor: '#f0f0f0',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          userSelect: 'none',
          borderBottom: '1px solid #ddd',
        }}
      >
        <span style={{ fontSize: 10 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        Testing
      </div>

      {!collapsed && (
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Test Connection */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={connLoading}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: connLoading ? 'wait' : 'pointer',
              borderRadius: 2,
            }}
          >
            {connLoading ? 'Testing...' : 'Test Connection'}
          </button>
          {connStatus && (
            <div
              style={{
                fontSize: 11,
                color: connStatus.success ? '#2e7d32' : '#c62828',
                padding: '2px 4px',
                background: connStatus.success ? '#e8f5e9' : '#ffebee',
                borderRadius: 2,
              }}
            >
              {connStatus.success ? '\u2713' : '\u2717'} {connStatus.message}
            </div>
          )}

          {/* List Tables (database only) */}
          {dsType === 'database' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                type="button"
                onClick={handleListTables}
                disabled={tablesLoading}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  border: '1px solid #ccc',
                  background: '#f5f5f5',
                  cursor: tablesLoading ? 'wait' : 'pointer',
                  borderRadius: 2,
                }}
              >
                {tablesLoading ? 'Loading...' : 'List Tables'}
              </button>
              {tables.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => handleTableSelect(e.target.value)}
                  style={{
                    fontSize: 11,
                    padding: '3px 4px',
                    border: '1px solid #ccc',
                    borderRadius: 2,
                  }}
                >
                  <option value="" disabled>
                    Select table ({tables.length})
                  </option>
                  {tables.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Query input */}
          {dsType !== 'static' && (
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              rows={3}
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                padding: '4px',
                border: '1px solid #ccc',
                borderRadius: 2,
                resize: 'vertical',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          )}

          {/* Run Query */}
          <button
            type="button"
            onClick={handleRunQuery}
            disabled={queryLoading || (dsType !== 'static' && !query.trim())}
            style={{
              padding: '4px 8px',
              fontSize: 11,
              border: '1px solid #ccc',
              background: '#f5f5f5',
              cursor: queryLoading ? 'wait' : 'pointer',
              borderRadius: 2,
            }}
          >
            {queryLoading ? 'Running...' : 'Run Query'}
          </button>
          {queryError && (
            <div
              style={{
                fontSize: 11,
                color: '#c62828',
                padding: '2px 4px',
                background: '#ffebee',
                borderRadius: 2,
              }}
            >
              {queryError}
            </div>
          )}
        </div>
      )}

      {/* 결과 다이얼로그 */}
      {queryResult && (
        <QueryResultDialog
          data={queryResult.data}
          rowCount={queryResult.rowCount}
          onClose={() => setQueryResult(null)}
        />
      )}
    </div>
  );
}

function QueryResultDialog({
  data,
  rowCount,
  onClose,
}: {
  data: unknown[];
  rowCount: number;
  onClose: () => void;
}) {
  const columns =
    data.length > 0 && typeof data[0] === 'object' && data[0] !== null
      ? Object.keys(data[0] as Record<string, unknown>)
      : [];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
          minWidth: 400,
          maxWidth: '80vw',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid #ddd',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <span>Query Result — {rowCount} rows</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 16,
              cursor: 'pointer',
              color: '#666',
            }}
          >
            {'\u2715'}
          </button>
        </div>

        {/* 테이블 본문 */}
        <div style={{ overflow: 'auto', maxHeight: 400, padding: '0 4px 4px' }}>
          {columns.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: '#888' }}>
              {data.length === 0 ? 'No data returned.' : JSON.stringify(data, null, 2)}
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            >
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      style={{
                        position: 'sticky',
                        top: 0,
                        background: '#f5f5f5',
                        textAlign: 'left',
                        padding: '4px 6px',
                        borderBottom: '2px solid #ccc',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const obj = row as Record<string, unknown>;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      {columns.map((col) => (
                        <td
                          key={col}
                          style={{
                            padding: '3px 6px',
                            borderBottom: '1px solid #eee',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={String(obj[col] ?? '')}
                        >
                          {obj[col] === null
                            ? 'null'
                            : typeof obj[col] === 'object'
                              ? JSON.stringify(obj[col])
                              : String(obj[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
