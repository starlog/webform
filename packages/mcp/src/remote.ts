/**
 * Remote MCP Server — Streamable HTTP transport with API key authentication.
 *
 * Environment variables:
 *   MCP_PORT          – HTTP listen port (default: 4100)
 *   MCP_HOST          – Bind address (default: 0.0.0.0)
 *   MCP_API_KEYS      – Comma-separated list of allowed API keys (required)
 *   WEBFORM_API_URL   – Backend API URL (default: http://localhost:4000)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import express from 'express';

// Load .env file from packages/mcp/.env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env file not found — rely on environment variables
}
import type { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools, registerResources, registerPrompts } from './server.js';
import { apiClient } from './utils/apiClient.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MCP_PORT = parseInt(process.env.MCP_PORT || '4100', 10);
const MCP_HOST = process.env.MCP_HOST || '0.0.0.0';
const MCP_API_KEYS = (process.env.MCP_API_KEYS || '')
  .split(',')
  .map((k) => k.trim())
  .filter(Boolean);

if (MCP_API_KEYS.length === 0) {
  console.error('[mcp-remote] MCP_API_KEYS 환경 변수가 설정되지 않았습니다.');
  console.error('[mcp-remote] 예: MCP_API_KEYS=key1,key2');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API Key Authentication Middleware
// ---------------------------------------------------------------------------

function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header with Bearer token required' });
    return;
  }

  const token = authHeader.slice(7);
  if (!MCP_API_KEYS.includes(token)) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

await apiClient.init();

const app = express();

// Per-session transport map (stateful mode)
const transports = new Map<string, StreamableHTTPServerTransport>();

app.use('/mcp', requireApiKey);

app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    // Existing session
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (sessionId && !transports.has(sessionId)) {
    res.status(404).json({ error: 'Session not found. Start a new session without mcp-session-id header.' });
    return;
  }

  // New session – create MCP server + transport
  const server = new McpServer({
    name: 'webform',
    version: '1.0.0',
    description: 'WebForm SDUI 플랫폼 — 폼/프로젝트 관리, 컨트롤 배치, 이벤트 핸들링, 데이터 바인딩',
  });

  registerTools(server);
  registerResources(server);
  registerPrompts(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      transports.delete(transport.sessionId);
    }
  };

  await server.connect(transport);

  if (transport.sessionId) {
    transports.set(transport.sessionId, transport);
  }

  await transport.handleRequest(req, res, req.body);
});

// GET for SSE streaming (server→client notifications)
app.get('/mcp', requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: 'Valid mcp-session-id header required for GET' });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// DELETE to close a session
app.delete('/mcp', requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// Health check (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    activeSessions: transports.size,
    availableKeys: MCP_API_KEYS.length,
  });
});

app.listen(MCP_PORT, MCP_HOST, () => {
  console.log(`[mcp-remote] MCP 원격 서버 시작: http://${MCP_HOST}:${MCP_PORT}/mcp`);
  console.log(`[mcp-remote] 등록된 API 키: ${MCP_API_KEYS.length}개`);
  console.log(`[mcp-remote] 헬스체크: http://${MCP_HOST}:${MCP_PORT}/health`);
});
