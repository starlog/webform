import type { DataSourceDefinition } from '@webform/common';
import { ensureAuth, getAuthToken } from '../../services/apiService';

export const DESIGNER_API = '/api';

export async function authHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  await ensureAuth();
  const token = getAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/** 서버 응답 원본 (meta 포함) */
export type RawDataSource = DataSourceDefinition & {
  meta?: { dialect?: string; baseUrl?: string };
};

/** 서버 응답의 _id를 id로 매핑 */
export function mapDs(raw: Record<string, unknown>): RawDataSource {
  return {
    id: (raw._id ?? raw.id) as string,
    name: raw.name as string,
    type: raw.type,
    config: raw.config,
    meta: raw.meta as RawDataSource['meta'],
  } as RawDataSource;
}

export async function fetchDataSources(
  projectId?: string,
): Promise<DataSourceDefinition[]> {
  const url = projectId
    ? `${DESIGNER_API}/datasources?projectId=${projectId}`
    : `${DESIGNER_API}/datasources`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch datasources: ${res.status}`);
  const json = await res.json();
  return (json.data as Record<string, unknown>[]).map(mapDs);
}

export async function createDataSource(
  input: Omit<DataSourceDefinition, 'id'>,
): Promise<DataSourceDefinition> {
  const res = await fetch(`${DESIGNER_API}/datasources`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create datasource: ${res.status}`);
  const json = await res.json();
  return mapDs(json.data as Record<string, unknown>);
}

export async function testConnection(
  id: string,
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/test`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Connection test failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchDataSource(id: string): Promise<DataSourceDefinition> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch datasource: ${res.status}`);
  const json = await res.json();
  return mapDs(json.data as Record<string, unknown>);
}

export async function updateDataSource(
  id: string,
  input: { name?: string; config?: DataSourceDefinition['config'] },
): Promise<DataSourceDefinition> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}`, {
    method: 'PUT',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update datasource: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function deleteDataSource(id: string): Promise<void> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to delete datasource: ${res.status}`);
}

export async function fetchTables(id: string): Promise<string[]> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/tables`, {
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch tables: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function previewData(
  id: string,
  table?: string,
  dialect?: string,
): Promise<unknown[]> {
  const query: Record<string, unknown> = { limit: 10 };
  if (table) {
    if (dialect === 'mongodb') {
      query.collection = table;
    } else {
      query.table = table;
    }
  }
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/query`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`Preview query failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function executeRawQuery(id: string, query: string): Promise<unknown[]> {
  const res = await fetch(`${DESIGNER_API}/datasources/${id}/raw-query`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const msg = json?.error || json?.message || `Query failed: ${res.status}`;
    throw new Error(msg);
  }
  const json = await res.json();
  return json.data;
}
