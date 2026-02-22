# WebForm 모노레포 셋업 계획

## 1. 개요

WebForm 프로젝트를 **pnpm workspace** 기반 모노레포로 구성한다.
PRD에 정의된 4개 패키지(common, designer, runtime, server)를 독립적으로 개발·빌드·테스트할 수 있는 구조를 만든다.

### 최종 디렉토리 구조

```
webform/
├── package.json                  # 루트 (워크스페이스 관리)
├── pnpm-workspace.yaml           # pnpm 워크스페이스 설정
├── tsconfig.base.json            # 공유 TypeScript 설정
├── .gitignore
├── .eslintrc.js                  # ESLint 설정 (루트)
├── .prettierrc                   # Prettier 설정
├── PRD.md
├── tasks.json
├── plans/
│   └── monorepo-setup-plan.md
└── packages/
    ├── common/                   # @webform/common
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── index.ts
    │       ├── types/
    │       │   ├── form.ts
    │       │   ├── events.ts
    │       │   ├── datasource.ts
    │       │   └── protocol.ts
    │       └── utils/
    │           ├── validation.ts
    │           └── serialization.ts
    ├── designer/                 # @webform/designer
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   ├── vitest.config.ts
    │   ├── index.html
    │   └── src/
    │       └── main.tsx
    ├── runtime/                  # @webform/runtime
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.ts
    │   ├── vitest.config.ts
    │   ├── index.html
    │   └── src/
    │       └── main.tsx
    └── server/                   # @webform/server
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        └── src/
            └── index.ts
```

---

## 2. 루트 설정 파일

### 2.1 package.json

```json
{
  "name": "webform",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:designer": "pnpm --filter @webform/designer dev",
    "dev:runtime": "pnpm --filter @webform/runtime dev",
    "dev:server": "pnpm --filter @webform/server dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:watch": "pnpm -r --parallel test:watch",
    "lint": "pnpm -r lint",
    "lint:fix": "pnpm -r lint:fix",
    "format": "prettier --write \"packages/*/src/**/*.{ts,tsx}\"",
    "format:check": "prettier --check \"packages/*/src/**/*.{ts,tsx}\"",
    "typecheck": "pnpm -r typecheck",
    "clean": "pnpm -r clean && rm -rf node_modules"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "eslint": "^9.18.0",
    "@eslint/js": "^9.18.0",
    "typescript-eslint": "^8.20.0",
    "eslint-config-prettier": "^10.0.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.18",
    "prettier": "^3.4.0",
    "vitest": "^3.0.0",
    "globals": "^15.14.0"
  }
}
```

**설계 의도:**
- `private: true`로 루트 패키지 npm 배포 방지
- `packageManager` 필드로 pnpm 버전 고정
- 개별 패키지 dev 스크립트를 루트에서 `--filter`로 실행 가능
- 공통 devDependencies(TypeScript, ESLint, Prettier, Vitest)는 루트에 설치하여 버전 통일
- `clean` 스크립트로 전체 초기화 지원

### 2.2 pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
```

### 2.3 tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**설계 의도:**
- `ES2022`: 최신 JavaScript 기능 사용 (top-level await, Array.at() 등)
- `moduleResolution: "bundler"`: Vite와 호환되는 모듈 해석 방식
- `strict: true`: 타입 안전성 극대화
- `composite: true`: 프로젝트 레퍼런스를 통한 패키지 간 의존성 지원
- `declaration`/`declarationMap`: 패키지 간 타입 공유 지원

### 2.4 .gitignore

```gitignore
# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# Test
coverage/

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# pnpm
.ralph-logs/
```

### 2.5 .eslintrc.js (ESLint Flat Config)

ESLint v9 flat config 형식 (`eslint.config.js`)을 사용한다.

```js
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/designer/src/**/*.{ts,tsx}", "packages/runtime/src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["packages/server/src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier
);
```

**설계 의도:**
- ESLint v9 flat config 형식 사용 (`.eslintrc` 대신 `eslint.config.js`)
- `typescript-eslint`로 TypeScript 린팅
- React 패키지(designer, runtime)에만 React 관련 플러그인 적용
- server 패키지에는 Node.js globals 적용
- `eslint-config-prettier`로 Prettier와 충돌하는 규칙 비활성화

### 2.6 .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

---

## 3. 패키지별 설정

### 3.1 packages/common (@webform/common)

**역할:** FormDefinition, ControlDefinition, UIPatch 등 공유 타입과 유틸리티 함수 제공

#### package.json

```json
{
  "name": "@webform/common",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc --build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

**설계 의도:**
- `main`과 `types`를 소스 파일(`./src/index.ts`)로 직접 지정 → 워크스페이스 내에서 빌드 없이 바로 참조 가능
- devDependencies는 `workspace:*`로 루트의 버전 사용

#### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

#### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

---

### 3.2 packages/designer (@webform/designer)

**역할:** Visual Studio 스타일 폼 디자이너 React SPA (Vite 개발 서버 포트 3000)

#### package.json

```json
{
  "name": "@webform/designer",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3000",
    "build": "tsc --build && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-dnd": "^16.0.1",
    "react-dnd-html5-backend": "^16.0.1",
    "@monaco-editor/react": "^4.7.0",
    "zustand": "^5.0.0",
    "immer": "^10.1.0",
    "@webform/common": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "workspace:*",
    "vitest": "workspace:*",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0"
  }
}
```

**핵심 의존성 설명:**
| 패키지 | 용도 |
|---------|------|
| `react-dnd` | 도구상자 → 캔버스 드래그 앤 드롭 |
| `@monaco-editor/react` | 이벤트 핸들러 코드 편집기 (VS Code 에디터) |
| `zustand` | 디자이너 상태 관리 (캔버스, 선택, 히스토리) |
| `immer` | 불변성 관리를 위한 유틸 (zustand 미들웨어) |
| `@webform/common` | 공유 타입/유틸 참조 |

#### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "composite": false,
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src"],
  "references": [
    { "path": "../common" }
  ]
}
```

**설계 의도:**
- `jsx: "react-jsx"`: React 17+ 새로운 JSX 트랜스폼 사용
- `lib`에 DOM 추가: 브라우저 환경
- `references`로 common 패키지 연결
- `composite: false`: Vite가 빌드를 담당하므로 tsc의 composite 출력 불필요

#### vite.config.ts

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

**설계 의도:**
- 포트 3000 고정
- `/api`, `/ws` 경로를 서버(4000)로 프록시 → 개발 시 CORS 문제 해결
- WebSocket 프록시 설정 포함 (SDUI 실시간 통신용)

#### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
  },
});
```

#### index.html

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebForm Designer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### 3.3 packages/runtime (@webform/runtime)

**역할:** SDUI 렌더러 기반 폼 실행기 React SPA (Vite 개발 서버 포트 3001)

#### package.json

```json
{
  "name": "@webform/runtime",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3001",
    "build": "tsc --build && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^5.0.0",
    "@webform/common": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "typescript": "workspace:*",
    "vitest": "workspace:*",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0"
  }
}
```

**설계 의도:**
- designer에 비해 의존성이 적음 (react-dnd, monaco-editor 불필요)
- runtime은 폼 실행에 집중하므로 경량화

#### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "composite": false,
    "declaration": false,
    "declarationMap": false
  },
  "include": ["src"],
  "references": [
    { "path": "../common" }
  ]
}
```

#### vite.config.ts

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

#### vitest.config.ts

designer와 동일 구조.

#### index.html

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebForm Runtime</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### 3.4 packages/server (@webform/server)

**역할:** Node.js 백엔드 - 폼 CRUD API, 이벤트 엔진, 데이터소스 서비스 (포트 4000)

#### package.json

```json
{
  "name": "@webform/server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --build",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "helmet": "^8.0.0",
    "mongoose": "^8.9.0",
    "ioredis": "^5.4.0",
    "ws": "^8.18.0",
    "isolated-vm": "^5.0.0",
    "zod": "^3.24.0",
    "jsonwebtoken": "^9.0.0",
    "dotenv": "^16.4.0",
    "@webform/common": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/ws": "^8.5.0",
    "@types/jsonwebtoken": "^9.0.0",
    "tsx": "^4.19.0",
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

**핵심 의존성 설명:**
| 패키지 | 용도 |
|---------|------|
| `express` | REST API 프레임워크 |
| `cors`, `helmet` | 보안 미들웨어 (CORS, HTTP 헤더 보호) |
| `mongoose` | MongoDB ODM |
| `ioredis` | Redis 클라이언트 (세션/캐시) |
| `ws` | WebSocket 서버 (디자이너 동기화, 런타임 이벤트) |
| `isolated-vm` | 이벤트 핸들러 코드 샌드박스 실행 |
| `zod` | API 요청/응답 스키마 검증 |
| `jsonwebtoken` | JWT 인증 |
| `tsx` | 개발 시 TypeScript 직접 실행 (watch 모드 지원) |

#### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"],
    "module": "Node16",
    "moduleResolution": "Node16"
  },
  "include": ["src"],
  "references": [
    { "path": "../common" }
  ]
}
```

**설계 의도:**
- `module: "Node16"`, `moduleResolution: "Node16"`: Node.js ESM 환경에 맞는 모듈 해석
- 브라우저 lib 불포함 (서버 전용)

#### vitest.config.ts

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

---

## 4. 개발 워크플로우

### 4.1 포트 할당

| 서비스 | 포트 | 설명 |
|--------|------|------|
| Designer | 3000 | Vite dev server |
| Runtime | 3001 | Vite dev server |
| Server | 4000 | Express API + WebSocket |
| MongoDB | 27017 | 기본 포트 |
| Redis | 6379 | 기본 포트 |

### 4.2 주요 명령어

```bash
# 전체 개발 서버 시작
pnpm dev

# 개별 패키지 개발 서버
pnpm dev:designer
pnpm dev:runtime
pnpm dev:server

# 전체 빌드
pnpm build

# 전체 테스트
pnpm test

# 타입 체크
pnpm typecheck

# 린트 + 포맷
pnpm lint
pnpm format
```

### 4.3 패키지 간 의존성 그래프

```
@webform/common (의존성 없음)
    ↑
    ├── @webform/designer (common 참조)
    ├── @webform/runtime  (common 참조)
    └── @webform/server   (common 참조)
```

- `common`은 다른 모든 패키지가 의존하는 기반 패키지
- `designer`, `runtime`, `server`는 서로 직접 의존하지 않음
- 이 구조 덕분에 세 패키지를 병렬로 빌드/개발 가능

---

## 5. 구현 시 생성할 파일 목록

### 루트 (7개)
1. `package.json`
2. `pnpm-workspace.yaml`
3. `tsconfig.base.json`
4. `.gitignore`
5. `eslint.config.js`
6. `.prettierrc`
7. `.npmrc` (선택: `shamefully-hoist=false`, `strict-peer-dependencies=false`)

### packages/common (3개)
8. `packages/common/package.json`
9. `packages/common/tsconfig.json`
10. `packages/common/vitest.config.ts`

### packages/designer (5개)
11. `packages/designer/package.json`
12. `packages/designer/tsconfig.json`
13. `packages/designer/vite.config.ts`
14. `packages/designer/vitest.config.ts`
15. `packages/designer/index.html`

### packages/runtime (5개)
16. `packages/runtime/package.json`
17. `packages/runtime/tsconfig.json`
18. `packages/runtime/vite.config.ts`
19. `packages/runtime/vitest.config.ts`
20. `packages/runtime/index.html`

### packages/server (3개)
21. `packages/server/package.json`
22. `packages/server/tsconfig.json`
23. `packages/server/vitest.config.ts`

**총 23개 파일 생성**

---

## 6. 구현 후 검증 체크리스트

- [ ] `pnpm install` 성공 (lockfile 생성)
- [ ] `pnpm typecheck` 오류 없음
- [ ] `pnpm test` 전체 패키지 테스트 통과
- [ ] `pnpm dev:designer` → localhost:3000 접속 확인
- [ ] `pnpm dev:runtime` → localhost:3001 접속 확인
- [ ] `pnpm dev:server` → 서버 기동 확인
- [ ] `pnpm build` 전체 빌드 성공
- [ ] 패키지 간 import 동작 확인 (`@webform/common` → designer/runtime/server에서 참조)
