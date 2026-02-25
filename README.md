# WebForm

웹 브라우저에서 Microsoft Visual Studio의 WinForm 디자이너 경험을 재현하는 **Server-Driven UI(SDUI)** 기반 로우코드 폼 빌더입니다.

## 주요 기능

- **비주얼 폼 디자이너** — 드래그 앤 드롭으로 Button, TextBox, ComboBox, DataGridView 등 25종의 컨트롤을 배치하고 속성을 편집
- **이벤트 핸들러** — Monaco Editor에서 JavaScript 이벤트 코드를 작성하면 서버의 isolated-vm 샌드박스에서 안전하게 실행
- **데이터 바인딩** — MongoDB, REST API 등 외부 데이터소스와 컨트롤을 바인딩
- **실시간 미리보기** — WebSocket을 통해 디자이너 변경사항이 런타임에 즉시 반영
- **프로젝트 관리** — 솔루션/프로젝트 단위로 여러 폼을 구조화하여 관리

## 아키텍처

```
┌──────────────┐     ┌──────────────┐
│   Designer   │     │   Runtime    │
│  (React)     │     │  (React)     │
│  :3000       │     │  :3001       │
└──────┬───────┘     └──────┬───────┘
       │  /api proxy        │  /api proxy
       └────────┬───────────┘
                ▼
        ┌───────────────┐
        │    Server     │
        │  (Express)    │
        │  :4000        │
        ├───────────────┤
        │  EventEngine  │──▶ isolated-vm 샌드박스
        │  WebSocket    │──▶ 실시간 동기화
        └───────┬───────┘
                │
        ┌───────┴───────┐
        │               │
   ┌────▼────┐    ┌─────▼────┐
   │ MongoDB │    │  Redis   │
   └─────────┘    └──────────┘
```

Designer에서 만든 폼 정의(JSON)를 서버에 저장하고, Runtime이 이를 로드하여 React 컴포넌트로 렌더링합니다. 사용자 이벤트는 서버의 샌드박스에서 실행되어 UI 패치로 반환됩니다.

## 사전 요구사항

| 항목 | 버전 | 비고 |
|------|------|------|
| **Node.js** | 18 이상 | |
| **pnpm** | 9.x | `npm install -g pnpm@9` |
| **Docker** | — | Redis 컨테이너 실행용 |
| **MongoDB** | 7.x 이상 | 로컬 또는 Atlas 등 원격 인스턴스 |

## 설치 및 실행

### 빠른 시작

```bash
git clone <repository-url>
cd webform
./run.sh
```

`run.sh`가 다음을 자동으로 수행합니다:
1. pnpm 설치 확인
2. 의존성 설치 (`pnpm install`)
3. Redis Docker 컨테이너 시작
4. 서버 `.env` 파일 생성 (JWT_SECRET, ENCRYPTION_KEY 랜덤 생성)
5. 모든 서비스 시작 (Designer :3000, Runtime :3001, Server :4000)

### 초기 데이터 설정

서버가 실행된 상태에서 **별도 터미널**에서 다음 스크립트를 실행합니다.

```bash
# 프리셋 테마 시딩 (24개 테마 → MongoDB)
./generate-themes.sh

# 데모 프로젝트 + 샘플 데이터 생성 (선택)
./generate-sample.sh
```

| 스크립트 | 용도 | 사전 조건 |
|----------|------|-----------|
| `generate-themes.sh` | 24개 프리셋 테마를 API로 MongoDB에 시딩 | 서버 실행 중, `.env`에 JWT_SECRET |
| `generate-sample.sh` | 데모 프로젝트 + 샘플 폼 + MongoDB 주문 데이터 생성 | 서버 실행 중, Docker(MongoDB 컨테이너), `.env`에 JWT_SECRET |

> **참고**: `generate-themes.sh`는 upsert 방식이므로 반복 실행해도 안전합니다. 최초 실행 시 `24 upserted`, 재실행 시 `24 unchanged`가 출력됩니다.

### 수동 설치

```bash
# 1. 의존성 설치
pnpm install

# 2. Redis 실행
docker run -d --name webform-redis -p 6379:6379 redis:7-alpine

# 3. 서버 환경 변수 설정
cp packages/server/.env.example packages/server/.env
# .env 파일에서 JWT_SECRET(32자 이상)과 ENCRYPTION_KEY(64자 hex)를 변경

# 4. 실행
pnpm dev

# 5. 별도 터미널에서 초기 데이터 설정
./generate-themes.sh       # 프리셋 테마 시딩
./generate-sample.sh       # 데모 데이터 (선택)
```

### 개별 서비스 실행

```bash
pnpm dev:server      # Server   — http://localhost:4000
pnpm dev:designer    # Designer — http://localhost:3000
pnpm dev:runtime     # Runtime  — http://localhost:3001
```

### 테스트

```bash
pnpm test            # 전체 테스트
pnpm test:watch      # Watch 모드
```

## 환경 변수

서버 환경 변수는 `packages/server/.env`에서 설정합니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `4000` | 서버 포트 |
| `MONGODB_URI` | `mongodb://localhost:27017/webform` | MongoDB 연결 URI |
| `REDIS_URL` | `redis://localhost:6379` | Redis 연결 URL |
| `JWT_SECRET` | — | JWT 서명 키 (32자 이상, 필수) |
| `ENCRYPTION_KEY` | — | AES-256 암호화 키 (64자 hex, 필수) |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | 허용 CORS 출처 |
| `SANDBOX_TIMEOUT_MS` | `5000` | 이벤트 핸들러 실행 타임아웃 |
| `SANDBOX_MEMORY_LIMIT_MB` | `128` | 샌드박스 메모리 제한 |

## 기술 스택

| 영역 | 기술 |
|------|------|
| 언어 | TypeScript |
| 프론트엔드 | React, Vite, Zustand, react-dnd, Monaco Editor |
| 백엔드 | Node.js, Express, WebSocket(ws) |
| 데이터베이스 | MongoDB(Mongoose), Redis(ioredis) |
| 샌드박스 | isolated-vm |
| 테스트 | Vitest |
| 패키지 관리 | pnpm workspace |
