# Publish All API 엔드포인트 구현 계획

## 1. 기존 라우트 패턴 분석

### 파일 구조
- **파일**: `packages/server/src/routes/projects.ts`
- **라우터**: `projectsRouter = Router()` (Express Router)
- **서비스 인스턴스**: 파일 상단에서 `new ProjectService()` 생성

### 인증 방식
- `routes/index.ts`에서 `apiRouter.use(authenticate)` 미들웨어를 `/projects` 라우터 등록 전에 적용
- 따라서 `projectsRouter` 내 모든 라우트는 자동으로 JWT 인증 적용
- 사용자 ID 추출: `req.user!.sub` 패턴 사용

### 에러 처리 방식
- 모든 핸들러가 `try/catch` + `next(err)` 패턴 사용
- 글로벌 `errorHandler` 미들웨어가 에러 타입별 응답 생성:
  - `AppError` → 해당 statusCode + `{ error: { message, requestId } }`
  - `NotFoundError(404)` → 404 응답
  - `ZodError` → 400 + validation details
  - 기타 → 500 + "Internal server error"

### 기존 엔드포인트 목록 (선언 순서)
| 순서 | 메서드 | 경로 | 설명 |
|------|--------|------|------|
| 1 | GET | `/` | 프로젝트 목록 |
| 2 | POST | `/` | 프로젝트 생성 |
| 3 | POST | `/import` | 프로젝트 가져오기 (/:id보다 먼저) |
| 4 | GET | `/:id` | 프로젝트 상세 |
| 5 | DELETE | `/:id` | 프로젝트 삭제 |
| 6 | PUT | `/:id/font` | 폼 폰트 일괄 적용 |
| 7 | PUT | `/:id` | 프로젝트 업데이트 |
| 8 | GET | `/:id/export` | 프로젝트 내보내기 |

### 응답 형식 패턴
- 성공: `res.json({ data: ... })` 또는 `res.status(201).json({ data: ... })`
- 삭제: `res.status(204).end()`
- Request body 검증: Zod 스키마 사용 (`*.parse(req.body)`)

## 2. 새 엔드포인트 추가 위치

### 코드 위치
`packages/server/src/routes/projects.ts`의 **112행 이후** (기존 `GET /:id/export` 엔드포인트 다음)에 추가.

이유:
- `POST /:id/publish-all`은 `/:id` 하위 경로이므로 다른 `/:id/*` 라우트들과 함께 배치
- Express 라우트 매칭에서 충돌 없음 (POST 메서드이고 `/publish-all` 서브경로 명시)

### 추가할 코드 구조
```typescript
// POST /api/projects/:id/publish-all — 프로젝트 전체 퍼블리시
projectsRouter.post('/:id/publish-all', async (req, res, next) => {
  try {
    const result = await projectService.publishAll(req.params.id, req.user!.sub);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
```

## 3. 요청/응답 형식

### 요청
```
POST /api/projects/:id/publish-all
Authorization: Bearer <JWT token>
Content-Type: application/json (body 불필요)
```

- **Path Parameter**: `id` — 프로젝트 ID (MongoDB ObjectId)
- **Request Body**: 없음
- **인증**: JWT Bearer 토큰 필수 (글로벌 authenticate 미들웨어)

### 성공 응답 (200)
```json
{
  "data": {
    "forms": {
      "publishedCount": 5,
      "skippedCount": 2,
      "totalCount": 7
    },
    "shell": {
      "published": true,
      "skipped": false
    }
  }
}
```

### 에러 응답

**404 — 프로젝트 없음**
```json
{
  "error": {
    "message": "Project not found: <projectId>",
    "requestId": "<requestId>"
  }
}
```
- `ProjectService.publishAll` 내부에서 `this.getProject()`가 `NotFoundError` throw
- 글로벌 `errorHandler`가 자동 처리

**401 — 인증 없음**
- 글로벌 `authenticate` 미들웨어가 처리 (토큰 없거나 유효하지 않은 경우)

**500 — 서버 에러**
```json
{
  "error": {
    "message": "Internal server error",
    "requestId": "<requestId>"
  }
}
```
- 예상치 못한 예외 발생 시 글로벌 `errorHandler`가 처리

## 4. 에러 처리 전략

| 에러 상황 | 처리 주체 | 응답 코드 | 비고 |
|-----------|-----------|-----------|------|
| JWT 토큰 없음/만료 | `authenticate` 미들웨어 | 401 | 라우트 핸들러 도달 전 차단 |
| 프로젝트 없음 | `ProjectService.getProject()` → `NotFoundError` | 404 | `errorHandler`가 자동 처리 |
| 폼 publish 실패 (개별) | `FormService.publishAllByProject` 내부 | 500 | bulkWrite 실패 시 |
| Shell 없음/이미 published | `ProjectService.publishAll` 내부 try/catch | 200 | `shell.skipped: true`로 정상 응답 |
| DB 연결 오류 등 | 글로벌 `errorHandler` | 500 | 미처리 예외 |

핵심: 라우트 핸들러에서는 별도 에러 처리 없이 `try/catch + next(err)` 패턴만 사용. 모든 비즈니스 로직 에러는 `ProjectService.publishAll`에서 처리됨.

## 5. 통합 테스트 케이스 계획

### 테스트 파일
`packages/server/src/__tests__/projects.publishAll.integration.test.ts`

### 테스트 환경 설정 (기존 패턴 따름)
```typescript
import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { env } from '../config/index.js';

vi.mock('../db/redis.js', () => ({
  getRedis: () => ({ ping: async () => 'PONG' }),
  connectRedis: vi.fn(),
  disconnectRedis: vi.fn(),
}));

const { createApp } = await import('../app.js');
const app = createApp();
const token = jwt.sign({ sub: 'user-1', role: 'admin' }, env.JWT_SECRET);
const auth = `Bearer ${token}`;
```

### 테스트 케이스

#### TC1: 정상 퍼블리시 — draft 폼이 있는 프로젝트
1. 프로젝트 생성
2. 폼 2개 생성 (draft 상태)
3. `POST /api/projects/:id/publish-all` 호출
4. 검증: status 200, `data.forms.publishedCount === 2`, `data.forms.skippedCount === 0`, `data.forms.totalCount === 2`

#### TC2: 빈 프로젝트 — 폼 없음
1. 프로젝트 생성 (폼 미생성)
2. `POST /api/projects/:id/publish-all` 호출
3. 검증: status 200, `data.forms.publishedCount === 0`, `data.forms.totalCount === 0`

#### TC3: 존재하지 않는 프로젝트 — 404
1. 존재하지 않는 ID로 `POST /api/projects/000000000000000000000000/publish-all` 호출
2. 검증: status 404, `error.message` 포함

#### TC4: 인증 없는 요청 — 401
1. Authorization 헤더 없이 `POST /api/projects/:id/publish-all` 호출
2. 검증: status 401

#### TC5: 응답 형식 검증
1. 프로젝트 + 폼 생성
2. publish-all 호출
3. 검증: `data.forms` 객체에 `publishedCount`, `skippedCount`, `totalCount` 필드 존재 및 number 타입
4. 검증: `data.shell` 객체에 `published`, `skipped` 필드 존재 및 boolean 타입

## 6. 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `packages/server/src/routes/projects.ts` | `POST /:id/publish-all` 엔드포인트 추가 (약 10줄) |
