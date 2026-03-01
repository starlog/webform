export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public method: string,
    public path: string,
    public detail?: string,
  ) {
    const msg = detail || getDefaultMessage(status, method, path);
    super(`API 오류 [${status}] ${method} ${path}: ${msg}`);
    this.name = 'ApiError';
  }
}

function getDefaultMessage(status: number, method: string, path: string): string {
  const resource = extractResourceInfo(path);
  switch (status) {
    case 400:
      return `잘못된 요청입니다. ${method} ${path}의 요청 데이터를 확인하세요`;
    case 401:
      return '인증 토큰이 만료되었거나 유효하지 않습니다. 서버를 재시작하거나 토큰을 재발급하세요';
    case 403:
      return `접근 권한이 없습니다: ${resource}`;
    case 404:
      return `해당 리소스가 존재하지 않습니다: ${resource}. ID를 확인해주세요`;
    case 409:
      return '버전 충돌이 발생했습니다. 최신 버전을 조회(get_form) 후 다시 시도하세요';
    case 422:
      return `요청 데이터의 형식이 올바르지 않습니다: ${resource}`;
    case 500:
      return '서버 내부 오류가 발생했습니다. 서버 로그를 확인하세요';
    case 502:
    case 503:
      return '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요';
    default:
      return `HTTP ${status} 오류가 발생했습니다: ${method} ${path}`;
  }
}

/**
 * API 경로에서 리소스 정보를 추출합니다.
 * 예: /api/forms/abc123 → "폼 (abc123)"
 */
function extractResourceInfo(path: string): string {
  const patterns: [RegExp, string][] = [
    [/\/api\/projects\/([a-f\d]{24})\/shell/, '프로젝트 Shell ($1)'],
    [/\/api\/projects\/([a-f\d]{24})/, '프로젝트 ($1)'],
    [/\/api\/forms\/([a-f\d]{24})\/versions\/(\d+)/, '폼 버전 (formId: $1, version: $2)'],
    [/\/api\/forms\/([a-f\d]{24})/, '폼 ($1)'],
    [/\/api\/datasources\/([a-f\d]{24})/, '데이터소스 ($1)'],
    [/\/api\/themes\/([a-f\d]{24})/, '테마 ($1)'],
    [/\/api\/runtime\/forms\/([a-f\d]{24})/, '런타임 폼 ($1)'],
    [/\/api\/runtime\/app\/([a-f\d]{24})/, '런타임 앱 ($1)'],
  ];
  for (const [pattern, template] of patterns) {
    const match = path.match(pattern);
    if (match) {
      let result = template;
      for (let i = 1; i < match.length; i++) {
        result = result.replace(`$${i}`, match[i]);
      }
      return result;
    }
  }
  return path;
}

/** 요청 타임아웃 (밀리초) */
const REQUEST_TIMEOUT_MS = 30_000;

export class WebFormApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.WEBFORM_API_URL || 'http://localhost:4000';
  }

  async init(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/dev-token`, {
      method: 'POST',
      keepalive: true,
    });
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
    const headers: Record<string, string> = {
      Connection: 'keep-alive',
    };
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers: this.getHeaders(hasBody),
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        keepalive: true,
      });

      if (!res.ok) {
        await this.handleError(res, method, path);
      }

      if (res.status === 204) {
        return undefined as T;
      }

      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(
          408,
          'Request Timeout',
          method,
          path,
          `요청이 ${REQUEST_TIMEOUT_MS / 1000}초 내에 완료되지 않았습니다. 서버 상태를 확인하세요`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
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
