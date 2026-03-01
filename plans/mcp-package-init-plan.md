# MCP 패키지 초기화 계획

## 개요

`packages/mcp` — WebForm SDUI 플랫폼의 MCP(Model Context Protocol) 서버 패키지를 초기화한다.
MCP-SERVER.md 섹션 1.1~1.4에 따라 패키지 구조, 의존성, 빌드 설정, 엔트리포인트를 구성한다.

## 1. 디렉토리 구조 생성

```
packages/mcp/
├── src/
│   ├── index.ts          # McpServer + StdioServerTransport 엔트리포인트
│   ├── server.ts         # registerTools, registerResources, registerPrompts 초기화
│   ├── tools/            # Tool 핸들러 (Phase 1~3에서 파일 추가)
│   │   └── .gitkeep
│   ├── resources/        # Resource 핸들러
│   │   └── .gitkeep
│   ├── prompts/          # Prompt 템플릿
│   │   └── .gitkeep
│   └── utils/            # apiClient, validators 등
│       └── .gitkeep
├── package.json
└── tsconfig.json
```

## 2. package.json

```json
{
  "name": "@webform/mcp",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --build",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "@webform/common": "workspace:*",
    "node-fetch": "^3.3.2",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "@types/node": "^22.0.0"
  }
}
```

### 의존성 설명

| 패키지 | 용도 |
|--------|------|
| `@modelcontextprotocol/sdk` | MCP 서버 SDK (`McpServer`, `StdioServerTransport`) |
| `@webform/common` | 공유 타입 (`ControlType`, `FormDefinition` 등) |
| `zod` | Tool 입력 스키마 검증 (SDK 내장 지원) |
| `node-fetch` | Express 서버(localhost:4000) REST API 호출용 HTTP 클라이언트 |
| `tsx` | 개발 시 TypeScript 직접 실행 + watch 모드 |

### scripts 설명

- `dev`: tsx watch로 src/index.ts 실행 (개발 중 자동 재시작)
- `build`: tsc로 dist/ 빌드
- `start`: 빌드된 dist/index.js 실행 (Claude Desktop/Code 연동 시 사용)
- `typecheck`: 타입 체크만 수행
- `clean`: 빌드 산출물 삭제

## 3. tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
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

### 설정 근거

- `extends: ../../tsconfig.base.json`: 프로젝트 공통 설정 상속 (strict, ES2022 target 등)
- `module: NodeNext` / `moduleResolution: NodeNext`: Node.js ESM 환경. `@modelcontextprotocol/sdk`가 ESM export를 사용하므로 NodeNext가 적합. (server 패키지는 Node16을 쓰지만 NodeNext가 상위 호환)
- `composite: false`: 라이브러리가 아닌 실행 패키지이므로 declaration 불필요
- `references: [../common]`: @webform/common 타입 참조

## 4. src/index.ts — 엔트리포인트

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools, registerResources, registerPrompts } from './server.js';

const server = new McpServer({
  name: 'webform',
  version: '1.0.0',
  description: 'WebForm SDUI 플랫폼 — 폼/프로젝트 관리, 컨트롤 배치, 이벤트 핸들링, 데이터 바인딩',
});

registerTools(server);
registerResources(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 핵심 포인트

- **stdio transport**: Claude Code/Desktop과 stdin/stdout으로 통신
- **top-level await**: `"type": "module"` + ES2022 target이므로 사용 가능
- Tool/Resource/Prompt 등록은 `server.ts`에 위임하여 엔트리포인트를 깔끔하게 유지

## 5. src/server.ts — 초기화 구조

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerTools(server: McpServer): void {
  // Phase 1: 프로젝트/폼 관리 Tools
  // registerProjectTools(server);
  // registerFormTools(server);

  // Phase 2: 컨트롤/이벤트 Tools
  // registerControlTools(server);
  // registerEventTools(server);

  // Phase 3: 데이터소스/테마/Shell Tools
  // registerDatasourceTools(server);
  // registerThemeTools(server);
  // registerShellTools(server);
}

export function registerResources(server: McpServer): void {
  // Phase 2: 스키마/가이드 Resources
  // registerSchemaResources(server);
  // registerGuideResources(server);

  // Phase 3: 동적 Resources
  // registerDynamicResources(server);
}

export function registerPrompts(server: McpServer): void {
  // Phase 4: Prompt 템플릿
  // registerFormWizardPrompt(server);
  // registerCrudHandlersPrompt(server);
}
```

### 설계 의도

- 각 register 함수는 MCP-SERVER.md Phase별로 주석 구획을 나눔
- 구현 시 `src/tools/forms.ts` 등에서 export한 함수를 import하여 호출
- 빈 함수 상태로 시작 → 이후 태스크에서 점진적으로 채워감

## 6. pnpm-workspace.yaml 확인

현재 설정:

```yaml
packages:
  - "packages/*"
```

**변경 불필요** — 와일드카드 `packages/*`가 `packages/mcp`를 자동으로 포함한다.

## 7. 루트 package.json — dev:mcp 스크립트 추가

```diff
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "dev:designer": "pnpm --filter @webform/designer dev",
    "dev:runtime": "pnpm --filter @webform/runtime dev",
    "dev:server": "pnpm --filter @webform/server dev",
+   "dev:mcp": "pnpm --filter @webform/mcp dev",
    ...
  }
```

**주의**: `pnpm dev` (전체 병렬 실행)에는 MCP 패키지가 자동 포함되지만, MCP 서버는 stdio 기반이므로 단독 개발 시 `dev:mcp`를 사용한다. 실제로 `pnpm dev`에서 MCP를 제외할지는 이후 판단한다.

## 8. 구현 순서

| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | `packages/mcp/` 디렉토리 + 하위 구조 생성 | 디렉토리 |
| 2 | `packages/mcp/package.json` 작성 | package.json |
| 3 | `packages/mcp/tsconfig.json` 작성 | tsconfig.json |
| 4 | `packages/mcp/src/index.ts` 작성 | src/index.ts |
| 5 | `packages/mcp/src/server.ts` 작성 | src/server.ts |
| 6 | 루트 `package.json`에 `dev:mcp` 추가 | package.json |
| 7 | `pnpm install` 실행하여 의존성 설치 | — |
| 8 | `pnpm --filter @webform/mcp typecheck` 검증 | — |

## 9. 검증 기준

- [ ] `pnpm install` 성공 (workspace 링크 포함)
- [ ] `pnpm --filter @webform/mcp typecheck` 에러 없음
- [ ] `pnpm --filter @webform/mcp build` 성공 → `dist/index.js` 생성
- [ ] `node packages/mcp/dist/index.js` 실행 시 MCP 서버가 stdin 대기 상태로 기동
