# CI/CD 인프라 설계 계획

## 현재 상태 분석

### 프로젝트 구조
- **모노레포**: pnpm 9.15.4 워크스페이스 (`packages/*`)
- **패키지**: common, server, designer, runtime (4개)
- **Node.js**: v22 (현재 시스템), `.nvmrc` 파일 없음
- **TypeScript**: ES2022 타겟, `tsconfig.base.json` 공유

### 기존 인프라 현황
| 항목 | 상태 |
|------|------|
| Dockerfile | **없음** |
| GitHub Actions | **없음** |
| `.env.example` | server만 존재 (`packages/server/.env.example`) |
| `.nvmrc` | **없음** |
| `docker-compose.yml` | **없음** (run.sh에서 Docker CLI로 Redis 실행) |

### 하드코딩된 환경 변수 (vitest.config)
`packages/server/vitest.config.ts`에 테스트용 환경 변수가 하드코딩:
```typescript
env: {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-key-that-is-at-least-32-characters-long',
  ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
  CORS_ORIGINS: 'http://localhost:3000',
  MONGODB_URI: 'mongodb://localhost:27017/webform-test',  // ← MongoMemoryReplSet이 덮어씀
  REDIS_URL: 'redis://localhost:6379',
}
```
- `MONGODB_URI`: 테스트 setup에서 `MongoMemoryReplSet`으로 실제로 덮어쓰므로 하드코딩 값은 폴백용
- `REDIS_URL`: 테스트에서 실제 Redis를 사용하는지 확인 필요 (CI에서 Redis 서비스 필요 가능성)
- designer/runtime vitest.config: 환경 변수 하드코딩 **없음** (jsdom 환경, 순수 프론트엔드 테스트)

### 빌드/테스트 스크립트
| 패키지 | build | test | dev |
|--------|-------|------|-----|
| common | `tsc --build` | `vitest run` | - |
| server | `tsc --build` | `vitest run` | `tsx watch src/index.ts` |
| designer | `tsc --build && vite build` | `vitest run` | `vite --port 3000` |
| runtime | `tsc --build && vite build` | `vitest run` | `vite --port 3001` |

루트 스크립트: `pnpm -r build`, `pnpm -r test`, `pnpm -r lint`, `pnpm -r typecheck`

---

## 수정 계획

### 1. `.nvmrc` 파일 생성

**파일**: `.nvmrc` (프로젝트 루트)
```
22
```
CI와 로컬 개발 환경의 Node.js 버전을 통일.

---

### 2. `docker-compose.yml` 생성

**파일**: `docker-compose.yml` (프로젝트 루트)

```yaml
services:
  # 개발용 인프라
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # 프로덕션 서버
  server:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    env_file:
      - ./packages/server/.env
    depends_on:
      - mongo
      - redis

volumes:
  mongo-data:
```

기존 `run.sh`의 Docker CLI Redis 실행을 대체. MongoDB도 포함하여 로컬 개발 환경을 원커맨드로 구성.

---

### 3. `Dockerfile` 생성 (멀티스테이지 빌드)

**파일**: `Dockerfile` (프로젝트 루트)

```dockerfile
# ============================================
# Stage 1: 의존성 설치 + 빌드
# ============================================
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# 의존성 캐시 레이어
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json packages/common/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --filter @webform/server...

# 소스 복사 및 빌드
COPY tsconfig.base.json ./
COPY packages/common/ packages/common/
COPY packages/server/ packages/server/

RUN pnpm --filter @webform/common build && \
    pnpm --filter @webform/server build

# ============================================
# Stage 2: 프로덕션 실행
# ============================================
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json packages/common/
COPY packages/server/package.json packages/server/

RUN pnpm install --frozen-lockfile --filter @webform/server... --prod

# 빌드 결과물 복사
COPY --from=builder /app/packages/common/dist packages/common/dist
COPY --from=builder /app/packages/server/dist packages/server/dist

EXPOSE 4000

CMD ["node", "packages/server/dist/index.js"]
```

**설계 포인트**:
- server만 프로덕션 실행 (designer/runtime은 Vite 빌드 → 정적 파일 → CDN/Nginx 배포)
- `--filter @webform/server...`로 server + common 의존성만 설치 (이미지 크기 최소화)
- `pnpm-lock.yaml` 캐시 레이어 분리로 빌드 속도 최적화
- `isolated-vm`은 네이티브 바이너리이므로 alpine에서 빌드 시 추가 패키지 필요할 수 있음 → `.dockerignore` 설정 및 빌드 테스트 필요

---

### 4. `.dockerignore` 생성

**파일**: `.dockerignore` (프로젝트 루트)

```
node_modules
dist
*.tsbuildinfo
.env
.env.local
.env.*.local
coverage
.git
.vscode
.idea
*.log
*.md
!README.md
forms/
plans/
*.json
!package.json
!pnpm-lock.yaml
!pnpm-workspace.yaml
!tsconfig.base.json
```

---

### 5. GitHub Actions CI 워크플로우

**파일**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Get pnpm store directory
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Cache pnpm store
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: pnpm-store-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: pnpm-store-${{ runner.os }}-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test
        env:
          NODE_ENV: test
          REDIS_URL: redis://localhost:6379

  docker:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: ci
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t webform-server:${{ github.sha }} .

      - name: Verify Docker image
        run: docker run --rm webform-server:${{ github.sha }} node -e "console.log('OK')"
```

**설계 포인트**:
- **concurrency**: 같은 브랜치의 이전 CI를 자동 취소하여 리소스 절약
- **Redis 서비스**: 서버 테스트에서 Redis 연결이 필요할 수 있으므로 GitHub Actions 서비스로 제공
- **MongoDB**: `MongoMemoryReplSet`이 인메모리 MongoDB를 사용하므로 별도 서비스 불필요
- **pnpm 캐시**: `pnpm store path`를 캐시하여 의존성 설치 시간 절약
- **Docker 빌드**: main 브랜치 push 시에만 실행, CI 통과 후 실행

### 파이프라인 순서
```
push/PR → Lint → Format Check → TypeCheck → Test → (main만) Docker Build
```

---

### 6. 루트 `.env.example` 생성

**파일**: `.env.example` (프로젝트 루트)

기존 `packages/server/.env.example`의 내용을 루트에도 배치하여 가시성 향상:

```env
# Server
NODE_ENV=development
PORT=4000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/webform

# Redis
REDIS_URL=redis://localhost:6379

# JWT (최소 32자 이상)
JWT_SECRET=change-me-to-a-secure-random-string-at-least-32-chars
JWT_EXPIRY=7d

# Encryption (32바이트 = 64자 hex 문자열, openssl rand -hex 32 로 생성)
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# CORS (콤마 구분)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Sandbox
SANDBOX_TIMEOUT_MS=5000
SANDBOX_MEMORY_LIMIT_MB=128
```

---

### 7. vitest.config 환경 변수 개선

**파일**: `packages/server/vitest.config.ts`

현재 하드코딩된 값을 `process.env` 폴백 패턴으로 변경:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-key-that-is-at-least-32-characters-long',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '0000000000000000000000000000000000000000000000000000000000000000',
      CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:3000',
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/webform-test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },
  },
});
```

**근거**:
- 로컬 개발 시에는 기존과 동일하게 기본값 사용
- CI 환경에서 `process.env`로 주입 가능 (GitHub Actions의 `env:` 섹션 활용)
- `MONGODB_URI`는 실제로 `MongoMemoryReplSet`이 덮어쓰므로 폴백 값만 있으면 충분

---

### 8. `.prettierrc` 확인 (변경 불필요)

현재 `.prettierrc`:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```
CI의 `format:check`에서 사용됨. 변경 불필요.

---

## 생성/수정 파일 요약

| 파일 | 액션 | 설명 |
|------|------|------|
| `.nvmrc` | **생성** | Node.js 22 버전 고정 |
| `Dockerfile` | **생성** | 멀티스테이지 빌드 (builder + runner) |
| `.dockerignore` | **생성** | Docker 빌드 컨텍스트 최적화 |
| `docker-compose.yml` | **생성** | 로컬 개발 인프라 (mongo, redis, server) |
| `.github/workflows/ci.yml` | **생성** | CI 파이프라인 (lint → format → typecheck → test → docker) |
| `.env.example` | **생성** | 루트 환경 변수 템플릿 |
| `packages/server/vitest.config.ts` | **수정** | 하드코딩 → `process.env` 폴백 패턴 |

---

## 추가 고려사항

### isolated-vm 네이티브 빌드
- `isolated-vm`은 C++ 네이티브 모듈로, Alpine Linux에서 빌드 시 `python3`, `make`, `g++` 설치가 필요할 수 있음
- Dockerfile의 builder 스테이지에 `RUN apk add --no-cache python3 make g++` 추가 필요 여부를 빌드 테스트로 확인

### 프론트엔드 배포 (추후)
- designer/runtime은 `vite build`로 정적 파일 생성 → CDN 또는 Nginx로 배포
- 필요 시 별도 Dockerfile 또는 GitHub Pages / Vercel / Cloudflare Pages 연동 고려

### CD 파이프라인 (추후)
- 현재 계획은 CI(빌드/테스트 자동화)까지만 포함
- Docker 이미지 레지스트리 Push (GHCR, ECR 등)
- 배포 자동화 (ArgoCD, ECS, K8s 등)는 인프라 결정 후 추가
