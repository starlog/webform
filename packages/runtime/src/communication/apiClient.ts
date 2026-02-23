import type { FormDefinition, EventRequest, EventResponse } from '@webform/common';

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
}

export const apiClient = new ApiClient();
