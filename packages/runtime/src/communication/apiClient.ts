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
}

export const apiClient = new ApiClient();
