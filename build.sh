#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

IMAGE_NAME="webform"
DESIGNER_IMAGE_NAME="webform-designer"
MCP_IMAGE_NAME="webform-mcp"
ENV_FILE=".env.docker"

# .env.docker 파일 생성 (없으면 시크릿 자동 생성)
ensure_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "🔑 $ENV_FILE 파일을 생성합니다..."
    JWT_SECRET=$(openssl rand -base64 48)
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    MCP_API_KEY=$(openssl rand -hex 32)
    cat > "$ENV_FILE" <<EOF
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
MCP_API_KEYS=${MCP_API_KEY}
EOF
    echo "  $ENV_FILE 생성 완료 (랜덤 시크릿 적용)"
    echo "  MCP API Key: ${MCP_API_KEY}"
  fi
}

# Docker 이미지 빌드
build() {
  echo "🔨 Docker 이미지를 빌드합니다..."
  docker build --target runner -t "$IMAGE_NAME:latest" .
  echo "✅ 빌드 완료: $IMAGE_NAME:latest"
  echo ""
  echo "🔨 Designer Docker 이미지를 빌드합니다..."
  docker build --target designer -t "$DESIGNER_IMAGE_NAME:latest" .
  echo "✅ 빌드 완료: $DESIGNER_IMAGE_NAME:latest"
  echo ""
  echo "🔨 MCP Docker 이미지를 빌드합니다..."
  docker build -f Dockerfile.mcp -t "$MCP_IMAGE_NAME:latest" .
  echo "✅ 빌드 완료: $MCP_IMAGE_NAME:latest"
}

# docker-compose up
up() {
  ensure_env
  echo "🚀 Docker Compose를 시작합니다..."
  docker compose up -d
  echo ""
  echo "서비스가 시작되었습니다:"
  echo "  Runtime:  http://localhost:4000/"
  echo "  Designer: http://localhost:4000/designer/"
  echo "  API:      http://localhost:4000/api"
  echo "  Health:   http://localhost:4000/health"
  echo "  Swagger:  http://localhost:4000/api-docs"
  echo "  MCP:      http://localhost:4100/mcp"
  echo ""
  echo "로그 확인: docker compose logs -f"
  echo "종료:      ./build.sh down"
}

# docker-compose down
down() {
  echo "🛑 Docker Compose를 종료합니다..."
  docker compose down
  echo "✅ 종료 완료"
}

# 사용법 출력
usage() {
  echo "사용법: ./build.sh [command]"
  echo ""
  echo "Commands:"
  echo "  (없음)    Docker 이미지 빌드만 수행"
  echo "  up        이미지 빌드 후 docker-compose up"
  echo "  down      docker-compose down"
  echo "  logs      컨테이너 로그 확인"
  echo "  restart   down 후 up"
}

case "${1:-}" in
  up)
    build
    up
    ;;
  down)
    down
    ;;
  logs)
    docker compose logs -f
    ;;
  restart)
    down
    build
    up
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    build
    ;;
esac
