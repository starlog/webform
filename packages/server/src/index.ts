import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/index.js';
import { connectMongo, disconnectMongo } from './db/mongodb.js';
import { connectRedis, disconnectRedis } from './db/redis.js';
import { closeAllMongoClients } from './services/adapters/MongoClientPool.js';
import { closeAllSqlAdapters } from './services/adapters/SqlAdapterPool.js';
import { initWebSocket } from './websocket/index.js';

async function main() {
  // 1. DB 연결
  await connectMongo();
  await connectRedis();

  // 2. HTTP 서버 생성
  const app = createApp();
  const server = http.createServer(app);

  // 3. WebSocket 서버 부착
  initWebSocket(server);

  // 4. 서버 시작
  server.listen(env.PORT, () => {
    console.log(`[server] listening on port ${env.PORT}`);
  });

  // 5. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close();
    await disconnectMongo();
    await closeAllMongoClients();
    await closeAllSqlAdapters();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
