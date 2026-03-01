#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# pnpm 설치 확인
if ! command -v pnpm &>/dev/null; then
  echo "pnpm이 설치되어 있지 않습니다. 설치 중..."
  npm install -g pnpm@9
fi

# 의존성 설치
if [ ! -d "node_modules" ]; then
  echo "의존성을 설치합니다..."
  pnpm install
fi

# Redis Docker 컨테이너 실행
if ! docker ps --format '{{.Names}}' | grep -q '^webform-redis$'; then
  if docker ps -a --format '{{.Names}}' | grep -q '^webform-redis$'; then
    echo "Redis 컨테이너를 시작합니다..."
    docker start webform-redis
  else
    echo "Redis 컨테이너를 생성합니다..."
    docker run -d --name webform-redis -p 6379:6379 redis:7-alpine
  fi
  echo "  Redis: localhost:6379"
else
  echo "Redis 컨테이너가 이미 실행 중입니다."
fi

# 서버 .env 파일 생성 (없으면 .env.example 기반으로 자동 생성)
if [ ! -f "packages/server/.env" ]; then
  echo "서버 .env 파일을 생성합니다..."
  JWT_SECRET=$(openssl rand -base64 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  sed \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" \
    -e "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${ENCRYPTION_KEY}|" \
    packages/server/.env.example > packages/server/.env
  echo "  packages/server/.env 생성 완료 (랜덤 시크릿 적용)"
fi

# MCP 원격 서버 API 키 생성 (없으면 자동 생성)
MCP_ENV_FILE="packages/mcp/.env"
if [ ! -f "$MCP_ENV_FILE" ]; then
  echo "MCP 원격 서버 .env 파일을 생성합니다..."
  MCP_API_KEY=$(openssl rand -hex 32)
  cat > "$MCP_ENV_FILE" <<EOF
MCP_API_KEYS=${MCP_API_KEY}
MCP_PORT=4100
MCP_HOST=0.0.0.0
WEBFORM_API_URL=http://localhost:4000
EOF
  echo "  ${MCP_ENV_FILE} 생성 완료"
  echo "  MCP API Key: ${MCP_API_KEY}"
fi

# 샘플 데이터 시드 (--seed 옵션)
if [ "${1:-}" = "--seed" ]; then
  echo "샘플 데이터를 생성합니다..."
  pnpm --filter @webform/server seed
fi

# 전체 프로젝트 실행 (designer :3000, runtime :3001, server :4000, mcp-remote :4100)
echo "프로젝트를 시작합니다..."
echo "  Designer:   http://localhost:3000"
echo "  Runtime:    http://localhost:3001"
echo "  Server:     http://localhost:4000"
echo "  MCP Remote: http://localhost:4100/mcp"
echo ""
pnpm dev & DEV_PID=$!
sleep 3
pnpm dev:mcp-remote &
wait $DEV_PID
