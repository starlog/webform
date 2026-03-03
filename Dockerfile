# ============================================
# Stage 1: 전체 빌드 (common + server + designer + runtime)
# ============================================
FROM node:22-alpine AS builder

RUN apk add --no-cache build-base python3
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# 의존성 캐시 레이어
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/common/package.json packages/common/
COPY packages/server/package.json packages/server/
COPY packages/designer/package.json packages/designer/
COPY packages/runtime/package.json packages/runtime/

RUN pnpm install --frozen-lockfile

# 소스 복사 및 빌드
COPY tsconfig.base.json ./
COPY packages/common/ packages/common/
COPY packages/server/ packages/server/
COPY packages/designer/ packages/designer/
COPY packages/runtime/ packages/runtime/

RUN pnpm --filter @webform/common build
RUN pnpm --filter @webform/server build
RUN pnpm --filter @webform/designer build
RUN pnpm --filter @webform/runtime build

# ============================================
# Stage 2: Designer (nginx)
# ============================================
FROM nginx:alpine AS designer

COPY --from=builder /app/packages/designer/dist /usr/share/nginx/html
COPY nginx-designer.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# ============================================
# Stage 3: 프로덕션 실행 (server + runtime)
# ============================================
FROM node:22-alpine AS runner

RUN apk add --no-cache build-base python3
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
COPY --from=builder /app/packages/runtime/dist packages/runtime/dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "packages/server/dist/index.js"]
