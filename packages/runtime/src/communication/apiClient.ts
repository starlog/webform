import type {
  FormDefinition,
  EventRequest,
  EventResponse,
  ApplicationShellDefinition,
  ShellEventRequest,
  AppLoadResponse,
} from '@webform/common';
import { getRuntimeAuthToken, clearRuntimeAuthToken } from './runtimeAuth';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async fetchForm(formId: string): Promise<FormDefinition> {
    const res = await fetch(`${this.baseUrl}/runtime/forms/${formId}`);
    if (!res.ok) throw new Error(`Failed to fetch form: ${res.status}`);
    return res.json();
  }

  async postEvent(formId: string, payload: EventRequest): Promise<EventResponse> {
    const res = await fetch(`${this.baseUrl}/runtime/forms/${formId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Event request failed: ${res.status}`);
    return res.json();
  }

  async queryDataSource(
    formId: string,
    dataSourceId: string,
    query?: Record<string, unknown>,
  ): Promise<unknown[]> {
    const res = await fetch(`${this.baseUrl}/runtime/forms/${formId}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataSourceId, query }),
    });
    if (!res.ok) throw new Error(`Data query failed: ${res.status}`);
    const json = await res.json();
    return json.data;
  }
  async mongoQuery(
    connectionString: string,
    database: string,
    collection: string,
    filter?: Record<string, unknown>,
    skip?: number,
    limit?: number,
  ): Promise<{ data: unknown[]; totalCount: number }> {
    const res = await fetch(`${this.baseUrl}/runtime/mongodb/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionString, database, collection, filter, skip, limit }),
    });
    if (!res.ok) throw new Error(`MongoDB query failed: ${res.status}`);
    const json = await res.json();
    return { data: json.data, totalCount: json.totalCount };
  }

  async mongoInsert(
    connectionString: string,
    database: string,
    collection: string,
    document: Record<string, unknown>,
  ): Promise<{ insertedId: string }> {
    const res = await fetch(`${this.baseUrl}/runtime/mongodb/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionString, database, collection, document }),
    });
    if (!res.ok) throw new Error(`MongoDB insert failed: ${res.status}`);
    return res.json();
  }

  async mongoUpdate(
    connectionString: string,
    database: string,
    collection: string,
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<{ modifiedCount: number }> {
    const res = await fetch(`${this.baseUrl}/runtime/mongodb/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionString, database, collection, filter, update }),
    });
    if (!res.ok) throw new Error(`MongoDB update failed: ${res.status}`);
    return res.json();
  }

  async mongoDelete(
    connectionString: string,
    database: string,
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<{ deletedCount: number }> {
    const res = await fetch(`${this.baseUrl}/runtime/mongodb/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionString, database, collection, filter }),
    });
    if (!res.ok) throw new Error(`MongoDB delete failed: ${res.status}`);
    return res.json();
  }
  async fetchApp(projectId: string, formId?: string): Promise<AppLoadResponse> {
    const params = formId ? `?formId=${encodeURIComponent(formId)}` : '';
    const headers: Record<string, string> = {};
    const token = getRuntimeAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseUrl}/runtime/app/${projectId}${params}`, { headers, credentials: 'include' });
    if (res.status === 401) {
      // Clear stale localStorage token (e.g. leftover from previous Google OAuth)
      clearRuntimeAuthToken();
      const body = await res.json();
      const err = new Error('Authentication required') as Error & {
        authRequired: boolean;
        loginUrl: string;
        authError?: string;
        provider?: string;
      };
      err.authRequired = body.authRequired ?? true;
      err.loginUrl = body.loginUrl ?? '';
      err.provider = body.provider;
      throw err;
    }
    if (!res.ok) throw new Error(`Failed to fetch app: ${res.status}`);
    return res.json();
  }

  async fetchShell(projectId: string): Promise<ApplicationShellDefinition | null> {
    const res = await fetch(`${this.baseUrl}/runtime/shells/${projectId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch shell: ${res.status}`);
    return res.json();
  }

  async loginWithPassword(
    projectId: string,
    username: string,
    password: string,
  ): Promise<{ token: string }> {
    // Clear any stale token from previous auth provider (e.g. Google OAuth)
    clearRuntimeAuthToken();
    const res = await fetch('/auth/password/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, username, password }),
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Login failed');
    }
    return res.json();
  }

  async postShellEvent(projectId: string, event: ShellEventRequest): Promise<EventResponse> {
    const res = await fetch(`${this.baseUrl}/runtime/shells/${projectId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`Shell event request failed: ${res.status}`);
    return res.json();
  }
}

export const apiClient = new ApiClient();
