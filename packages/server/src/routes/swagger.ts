import { Router } from 'express';
import yaml from 'js-yaml';

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

/**
 * Swagger UI HTML에서 swagger-ui-init.js의 swaggerDoc JSON을 추출
 */
function extractSwaggerDocFromHtml(html: string, baseUrl: string): { initJsUrl: string } | null {
  // <script src="./swagger-ui-init.js"> 패턴 검색
  const scriptMatch = html.match(/<script\s+src=["']([^"']*swagger-ui-init[^"']*)["']/i);
  if (!scriptMatch) return null;
  const src = scriptMatch[1];
  // 상대 경로를 절대 URL로 변환
  const initJsUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
  return { initJsUrl };
}

function extractSwaggerDocFromInitJs(js: string): unknown | null {
  // "swaggerDoc": { ... } 패턴에서 JSON 추출
  const marker = '"swaggerDoc":';
  const idx = js.indexOf(marker);
  if (idx === -1) return null;

  // marker 이후부터 중괄호 매칭으로 JSON 추출
  const start = js.indexOf('{', idx + marker.length);
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}') depth--;
    if (depth === 0) {
      try {
        return JSON.parse(js.substring(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * POST /api/swagger/fetch-spec — URL에서 Swagger 스펙 가져오기
 *
 * CORS를 우회하여 서버에서 Swagger 문서 URL을 fetch.
 * JSON 응답이면 YAML로 변환, HTML(Swagger UI)이면 init.js에서 swaggerDoc 추출.
 */
swaggerRouter.post('/fetch-spec', async (req, res, _next) => {
  try {
    const { url } = req.body as { url: string };

    if (!url) {
      res.status(400).json({ error: 'url is required' });
      return;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch: ${response.status} ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    let specJson: unknown = null;

    // 1) JSON 응답
    if (contentType.includes('application/json')) {
      try {
        specJson = JSON.parse(text);
      } catch {
        // fall through
      }
    }

    // 2) HTML 응답 — Swagger UI 페이지에서 swaggerDoc 추출
    if (!specJson && (contentType.includes('text/html') || text.trimStart().startsWith('<'))) {
      const extracted = extractSwaggerDocFromHtml(text, url);
      if (extracted) {
        const initRes = await fetch(extracted.initJsUrl, {
          signal: AbortSignal.timeout(10000),
        });
        if (initRes.ok) {
          const initJs = await initRes.text();
          specJson = extractSwaggerDocFromInitJs(initJs);
        }
      }
      if (!specJson) {
        res.status(400).json({ error: 'Could not extract Swagger spec from HTML page' });
        return;
      }
    }

    // 3) JSON으로 직접 파싱 시도 (Content-Type이 부정확한 경우)
    if (!specJson) {
      try {
        specJson = JSON.parse(text);
      } catch {
        // not JSON
      }
    }

    // JSON → YAML 변환, 또는 YAML 그대로 사용
    let specYaml: string;
    if (specJson) {
      specYaml = yaml.dump(specJson, { lineWidth: -1 });
    } else {
      specYaml = text;
    }

    // YAML 유효성 검증
    try {
      yaml.load(specYaml);
    } catch {
      res.status(400).json({ error: 'Fetched content is not valid YAML/JSON' });
      return;
    }

    res.json({ specYaml });
  } catch (err) {
    const message = (err as Error).message || 'Request failed';
    res.status(502).json({ error: message });
  }
});
