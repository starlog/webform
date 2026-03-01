export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public method: string,
    public path: string,
    public detail?: string,
  ) {
    const msg = detail || getDefaultMessage(status, path);
    super(`API 오류 [${status}] ${method} ${path}: ${msg}`);
    this.name = 'ApiError';
  }
}

function getDefaultMessage(status: number, path: string): string {
  switch (status) {
    case 400:
      return '잘못된 요청입니다';
    case 401:
      return '인증 토큰이 만료되었거나 유효하지 않습니다';
    case 404:
      return `리소스를 찾을 수 없습니다: ${path}`;
    case 409:
      return '버전 충돌이 발생했습니다. 최신 버전을 조회 후 다시 시도하세요';
    case 500:
      return '서버 내부 오류가 발생했습니다';
    default:
      return `HTTP ${status}`;
  }
}

export class WebFormApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.WEBFORM_API_URL || 'http://localhost:4000';
  }

  async init(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/dev-token`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(`토큰 발급 실패: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { token: string };
    this.token = data.token;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>('DELETE', path);
  }

  private getHeaders(hasBody: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const hasBody = body !== undefined;

    const res = await fetch(url, {
      method,
      headers: this.getHeaders(hasBody),
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      await this.handleError(res, method, path);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  private async handleError(res: Response, method: string, path: string): Promise<never> {
    let detail: string | undefined;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message;
    } catch {
      // JSON 파싱 실패 시 무시
    }
    throw new ApiError(res.status, res.statusText, method, path, detail);
  }
}

export const apiClient = new WebFormApiClient();
