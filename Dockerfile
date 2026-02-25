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
