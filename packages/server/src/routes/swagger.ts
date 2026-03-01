import { Router } from 'express';

export const swaggerRouter = Router();

/**
 * POST /api/swagger/test — Swagger API 테스트 프록시
 *
 * 디자이너에서 Swagger API를 서버사이드로 테스트.
 * SandboxRunner와 동일한 방식으로 HTTP 요청 수행.
 */
swaggerRouter.post('/test', async (req, res, _next) => {
  try {
    const { url, method, headers, body, timeout } = req.body as {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: unknown;
      timeout?: number;
    };

    if (!url || !method) {
      res.status(400).json({ error: 'url and method are required' });
      return;
    }

    const reqHeaders: Record<string, string> = { ...(headers || {}) };
    if (body !== undefined && !reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout || 10000),
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    res.json({
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    });
  } catch (err) {
    const message = (err as Error).message || 'Request failed';
    res.status(502).json({ error: message });
  }
});
