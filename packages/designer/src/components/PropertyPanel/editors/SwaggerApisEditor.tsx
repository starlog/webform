import { useState, useCallback, useMemo } from 'react';
import { useSelectionStore } from '../../../stores/selectionStore';
import { useDesignerStore } from '../../../stores/designerStore';
import { parseSwaggerSpec, type SwaggerOperation } from '../../../utils/swaggerParser';
import { METHOD_COLORS } from './SwaggerSpecEditor';

interface SwaggerApisEditorProps {
  value: string;
}

export function SwaggerApisEditor({ value }: SwaggerApisEditorProps) {
  const [testingOp, setTestingOp] = useState<string | null>(null);

  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const controls = useDesignerStore((s) => s.controls);
  const selectedControl = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    return controls.find((c) => c.id === id) ?? null;
  }, [selectedIds, controls]);

  const controlBaseUrl = (selectedControl?.properties.baseUrl as string) || '';
  const controlHeaders = (selectedControl?.properties.defaultHeaders as string) || '{}';

  const parsed = useMemo(() => {
    if (!value.trim()) return null;
    return parseSwaggerSpec(value);
  }, [value]);

  const effectiveBaseUrl = controlBaseUrl || parsed?.baseUrl || '';

  if (!parsed || parsed.operations.length === 0) {
    return (
      <div style={{ padding: '4px 6px', fontSize: 11, color: '#999' }}>
        No APIs found. Import a Swagger spec first.
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 400, overflow: 'auto' }}>
      {parsed.operations.map((op) => (
        <ApiRow
          key={`${op.method}-${op.path}`}
          operation={op}
          baseUrl={effectiveBaseUrl}
          defaultHeaders={controlHeaders}
          isExpanded={testingOp === op.operationId}
          onToggleTest={() =>
            setTestingOp(testingOp === op.operationId ? null : op.operationId)
          }
        />
      ))}
    </div>
  );
}

interface ApiRowProps {
  operation: SwaggerOperation;
  baseUrl: string;
  defaultHeaders: string;
  isExpanded: boolean;
  onToggleTest: () => void;
}

function ApiRow({ operation, baseUrl, defaultHeaders, isExpanded, onToggleTest }: ApiRowProps) {
  const { method, path, operationId, summary, pathParams, queryParams, hasRequestBody } = operation;
  const color = METHOD_COLORS[method] || '#999';

  return (
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 6px',
          fontSize: 11,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundColor: color,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 4px',
            borderRadius: 2,
            width: 36,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          {method}
        </span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#333',
          }}
          title={`${path} (${operationId})`}
        >
          {path}
        </span>
        <button
          type="button"
          onClick={onToggleTest}
          style={{
            border: '1px solid #ccc',
            borderRadius: 2,
            backgroundColor: isExpanded ? '#e3f2fd' : '#fafafa',
            color: isExpanded ? '#0078d4' : '#666',
            fontSize: 9,
            padding: '1px 5px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Test
        </button>
      </div>
      {summary && (
        <div style={{ padding: '0 6px 2px 48px', fontSize: 9, color: '#888' }}>{summary}</div>
      )}
      {isExpanded && (
        <ApiTestPanel
          operation={operation}
          baseUrl={baseUrl}
          defaultHeaders={defaultHeaders}
          pathParams={pathParams}
          queryParams={queryParams}
          hasRequestBody={hasRequestBody}
        />
      )}
    </div>
  );
}

interface ApiTestPanelProps {
  operation: SwaggerOperation;
  baseUrl: string;
  defaultHeaders: string;
  pathParams: string[];
  queryParams: string[];
  hasRequestBody: boolean;
}

function ApiTestPanel({
  operation,
  baseUrl,
  defaultHeaders,
  pathParams,
  queryParams,
  hasRequestBody,
}: ApiTestPanelProps) {
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [bodyValue, setBodyValue] = useState('');
  const [headerValue, setHeaderValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      let targetUrl = (baseUrl || '') + operation.path;
      for (const param of pathParams) {
        const val = pathValues[param] || '';
        targetUrl = targetUrl.replace(`{${param}}`, encodeURIComponent(val));
      }

      const qp = new URLSearchParams();
      for (const param of queryParams) {
        const val = queryValues[param];
        if (val) qp.set(param, val);
      }
      const qs = qp.toString();
      if (qs) targetUrl += '?' + qs;

      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(defaultHeaders || '{}');
      } catch {
        // ignore
      }
      if (headerValue.trim()) {
        try {
          Object.assign(headers, JSON.parse(headerValue));
        } catch {
          // ignore
        }
      }

      let parsedBody: unknown = undefined;
      if (hasRequestBody && bodyValue.trim()) {
        try {
          parsedBody = JSON.parse(bodyValue);
        } catch {
          parsedBody = bodyValue;
        }
      }

      const res = await fetch('/api/swagger/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          method: operation.method,
          headers,
          body: parsedBody,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        const errMsg =
          typeof result.error === 'string'
            ? result.error
            : typeof result.message === 'string'
              ? result.message
              : JSON.stringify(result.error || result);
        setError(errMsg || `Server error: ${res.status}`);
        return;
      }

      const formatted =
        typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);

      setResponse({ status: result.status, body: formatted });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [
    baseUrl,
    operation,
    pathParams,
    queryParams,
    pathValues,
    queryValues,
    bodyValue,
    headerValue,
    defaultHeaders,
    hasRequestBody,
  ]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #ddd',
    borderRadius: 2,
    padding: '2px 4px',
    fontSize: 10,
    fontFamily: 'monospace',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        padding: '6px',
        backgroundColor: '#fafafa',
        borderTop: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ fontSize: 9, color: '#888', fontFamily: 'monospace' }}>
        {operation.method} {baseUrl || '(no base URL)'}
        {operation.path}
      </div>

      {pathParams.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#555', marginBottom: 2 }}>
            Path Params
          </div>
          {pathParams.map((p) => (
            <div
              key={p}
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
            >
              <span style={{ fontSize: 10, color: '#666', width: 60, flexShrink: 0 }}>{p}:</span>
              <input
                style={inputStyle}
                placeholder={p}
                value={pathValues[p] || ''}
                onChange={(e) => setPathValues({ ...pathValues, [p]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {queryParams.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#555', marginBottom: 2 }}>
            Query Params
          </div>
          {queryParams.map((p) => (
            <div
              key={p}
              style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}
            >
              <span style={{ fontSize: 10, color: '#666', width: 60, flexShrink: 0 }}>{p}:</span>
              <input
                style={inputStyle}
                placeholder={p}
                value={queryValues[p] || ''}
                onChange={(e) => setQueryValues({ ...queryValues, [p]: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      {hasRequestBody && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#555', marginBottom: 2 }}>Body</div>
          <textarea
            style={{ ...inputStyle, height: 50, resize: 'vertical' }}
            placeholder='{"key": "value"}'
            value={bodyValue}
            onChange={(e) => setBodyValue(e.target.value)}
          />
        </div>
      )}

      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#555', marginBottom: 2 }}>
          Headers (JSON)
        </div>
        <input
          style={inputStyle}
          placeholder='{"Authorization": "Bearer ..."}'
          value={headerValue}
          onChange={(e) => setHeaderValue(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={handleSend}
        disabled={loading}
        style={{
          border: '1px solid #0078d4',
          borderRadius: 3,
          backgroundColor: loading ? '#ccc' : '#0078d4',
          color: '#fff',
          fontSize: 10,
          padding: '3px 8px',
          cursor: loading ? 'default' : 'pointer',
          fontWeight: 600,
          alignSelf: 'flex-start',
        }}
      >
        {loading ? 'Sending...' : 'Send'}
      </button>

      {response && (
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: response.status < 400 ? '#2e7d32' : '#d32f2f',
              marginBottom: 2,
            }}
          >
            Response — {response.status}
          </div>
          <pre
            style={{
              margin: 0,
              padding: 4,
              backgroundColor: '#fff',
              border: '1px solid #ddd',
              borderRadius: 2,
              fontSize: 9,
              fontFamily: 'monospace',
              maxHeight: 150,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {response.body}
          </pre>
        </div>
      )}

      {error && (
        <div
          style={{
            fontSize: 9,
            color: '#d32f2f',
            padding: 4,
            backgroundColor: '#fce4ec',
            borderRadius: 2,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
