# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WebForm은 Microsoft WinForm 디자이너를 웹으로 구현한 Server-Driven UI(SDUI) 기반 로우코드 플랫폼이다. pnpm 모노레포로 4개 패키지를 관리한다.

## Commands

```bash
# 전체 실행 (Designer:3000, Runtime:3001, Server:4000)
./run.sh                    # 환경 설정 + 실행
pnpm dev                    # 모든 패키지 병렬 실행

# 개별 실행
pnpm dev:designer           # Designer (port 3000)
pnpm dev:runtime            # Runtime (port 3001)
pnpm dev:server             # Server (port 4000)

# 테스트 (Vitest)
pnpm test                   # 모든 패키지
pnpm --filter @webform/server test          # 서버만
pnpm --filter @webform/designer test        # 디자이너만
npx vitest run src/__tests__/SomeFile.test.ts  # 단일 파일 (해당 패키지 디렉토리에서)

# 코드 품질
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint 자동 수정
pnpm format                 # Prettier 포맷
pnpm typecheck              # TypeScript 타입 체크
```

## Architecture

### 패키지 구조

- **`packages/common`** — 공유 타입 (FormDefinition, ControlType, UIPatch, EventRequest 등). 의존성 없음.
- **`packages/server`** — Express + WebSocket 백엔드. MongoDB(Mongoose), Redis(ioredis), isolated-vm 샌드박스.
- **`packages/designer`** — React 폼 디자이너. react-dnd 드래그앤드롭, Monaco Editor 이벤트 코드 편집, Zustand 상태관리.
- **`packages/runtime`** — React 폼 실행기. SDUI 렌더링, 이벤트 처리, 데이터 바인딩, WebSocket 패치 수신.

### SDUI 런타임 흐름

1. Designer에서 폼 정의 JSON 생성 → MongoDB 저장
2. Runtime이 `GET /api/runtime/forms/:id`로 FormDefinition 로드
3. `SDUIRenderer`가 JSON → React 컴포넌트 변환
4. 사용자 이벤트 발생 → `POST /api/runtime/forms/:id/events`로 EventRequest 전송
5. `EventEngine` → `SandboxRunner`(isolated-vm)에서 핸들러 코드 실행
6. 상태 diff → UIPatch 배열 반환 → 클라이언트 UI 업데이트

### 핵심 서비스 (Server)

- **`EventEngine`** (`services/EventEngine.ts`) — 이벤트 요청 수신 → 컨텍스트 구성 → SandboxRunner 실행 → UIPatch 생성
- **`SandboxRunner`** (`services/SandboxRunner.ts`) — isolated-vm으로 사용자 코드 격리 실행. `ctx` 객체(controls, showMessage, http 등)를 주입
- **`DataSourceService`** (`services/DataSourceService.ts`) — MongoDB, REST API, Static 데이터소스 쿼리

### Designer 주요 컴포넌트

- **`DesignerCanvas`** (`components/Canvas/DesignerCanvas.tsx`) — 폼 캔버스. 컨트롤 드롭/선택/드래그 선택 박스, 폼 리사이즈 핸들(e/s/se 방향 드래그로 크기 조절, 그리드 스냅, 최소 200x150)
- **`PropertyPanel`** (`components/PropertyPanel/PropertyPanel.tsx`) — 속성 편집기. 컨트롤 선택 시 컨트롤 속성, 미선택 시 폼 속성(Layout/Appearance/Behavior) 표시. `PropertyCategory` + `PropertyMeta` 패턴 사용
- **`controlProperties.ts`** (`components/PropertyPanel/controlProperties.ts`) — 컨트롤 타입별 `PropertyMeta[]` 정의. `withCommon()`으로 공통 속성 합성
- **`ResizeHandle`** (`components/Canvas/ResizeHandle.tsx`) — 컨트롤 리사이즈 핸들 (8방향). mousedown → document mousemove/mouseup 패턴

### 상태관리 (Zustand)

- **Designer**: `designerStore`(controls, formProperties, isDirty, setFormProperties), `selectionStore`, `historyStore`(undo/redo)
- **Runtime**: `runtimeStore`(currentFormDef, controlStates, dialogQueue)

### 포트 및 프록시

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Designer | 3000 | `/api` → localhost:4000 프록시 |
| Runtime | 3001 | `/api` → localhost:4000 프록시 |
| Server | 4000 | REST API + WebSocket (`/ws/designer/:formId`, `/ws/runtime/:formId`) |

## Code Style

- Prettier: singleQuote, trailingComma: all, printWidth: 100, tabWidth: 2
- ESLint: typescript-eslint + react-hooks + react-refresh
- 응답은 한국어로 작성
