# 서버 Runtime Shell API (앱 로딩) - 계획

## 1. 현재 runtime.ts 엔드포인트 목록 및 패턴

### 현재 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/runtime/forms/:id` | published 폼 정의 조회 |
| POST | `/api/runtime/forms/:id/events` | 폼 이벤트 실행 → UIPatch 반환 |
| POST | `/api/runtime/forms/:id/data` | 데이터소스 쿼리 실행 |
| POST | `/api/runtime/mongodb/test-connection` | MongoDB 연결 테스트 |
| POST | `/api/runtime/mongodb/query` | MongoDB 문서 조회 |
| POST | `/api/runtime/mongodb/insert` | MongoDB 문서 삽입 |
| POST | `/api/runtime/mongodb/update` | MongoDB 문서 수정 |
| POST | `/api/runtime/mongodb/delete` | MongoDB 문서 삭제 |

### 코드 패턴
- `runtimeRouter = Router()` (단일 라우터)
- 모든 핸들러가 `async (req, res, next)` + `try/catch` + `next(err)` 패턴
- 에러: `NotFoundError`, `AppError(statusCode, message)` 사용
- Form 조회 시 `Form.findById()` 직접 호출 (FormService 미사용)
- published 체크: `form.status !== 'published'` 검사 후 `NotFoundError` throw

## 2. 신규 엔드포인트 구현 코드 초안

### 2.1 GET /api/runtime/shells/:projectId

퍼블리시된 Shell 조회. `ApplicationShellDefinition` 형태로 반환.

```typescript
import { ShellService } from '../services/ShellService.js';

const shellService = new ShellService();

/**
 * GET /api/runtime/shells/:projectId
 * 퍼블리시된 Shell 정의를 반환한다.
 */
runtimeRouter.get('/shells/:projectId', async (req, res, next) => {
  try {
    const shell = await shellService.getPublishedShell(req.params.projectId);

    if (!shell) {
      throw new NotFoundError('Published shell not found');
    }

    res.json({
      id: shell._id.toString(),
      projectId: shell.projectId,
      name: shell.name,
      version: shell.version,
      properties: shell.properties,
      controls: shell.controls,
      eventHandlers: shell.eventHandlers
        .filter((h: any) => h.handlerType === 'server')
        .map((h: any) => ({
          controlId: h.controlId,
          eventName: h.eventName,
          handlerType: h.handlerType,
        })),
      startFormId: shell.startFormId,
    });
  } catch (err) {
    next(err);
  }
});
```

**참고**: 기존 `GET /api/runtime/forms/:id`와 동일한 패턴으로 `eventHandlers`를 서버 타입만 필터링하여 반환 (클라이언트 코드 노출 방지).

### 2.2 POST /api/runtime/shells/:projectId/events

Shell 이벤트 처리 스텁. 실제 EventEngine 연동은 `server-shell-events` 태스크에서 구현.

```typescript
import type { ShellEventRequest } from '@webform/common';

/**
 * POST /api/runtime/shells/:projectId/events
 * Shell 이벤트를 실행하고 UIPatch 배열을 반환한다.
 * (스텁: server-shell-events 태스크에서 완성)
 */
runtimeRouter.post('/shells/:projectId/events', async (req, res, next) => {
  try {
    const shell = await shellService.getPublishedShell(req.params.projectId);

    if (!shell) {
      throw new NotFoundError('Published shell not found');
    }

    const payload = req.body as ShellEventRequest;

    if (!payload.controlId || !payload.eventName || !payload.shellState) {
      throw new AppError(400, 'Missing required fields: controlId, eventName, shellState');
    }

    // TODO: server-shell-events 태스크에서 EventEngine.executeShellEvent()로 교체
    res.json({
      success: true,
      patches: [],
      logs: [],
    });
  } catch (err) {
    next(err);
  }
});
```

### 2.3 GET /api/runtime/app/:projectId (핵심 엔드포인트)

Shell + 시작 폼을 일괄 로딩하는 앱 로딩 엔드포인트.

```typescript
/**
 * GET /api/runtime/app/:projectId
 * AppLoadResponse: Shell(있으면) + 시작 폼을 일괄 반환한다.
 *
 * Query params:
 *   - formId?: string — 시작 폼 ID 직접 지정 (shell.startFormId 오버라이드)
 */
runtimeRouter.get('/app/:projectId', async (req, res, next) => {
  try {
    // 1. Shell 조회 (없으면 null)
    const shell = await shellService.getPublishedShell(req.params.projectId);

    // 2. 시작 폼 ID 결정: 쿼리 파라미터 > shell.startFormId
    const formId = (req.query.formId as string) || shell?.startFormId;

    if (!formId) {
      throw new AppError(400, 'No start form specified: set shell.startFormId or pass ?formId=');
    }

    // 3. published 폼 조회
    const form = await Form.findById(formId);

    if (!form) {
      throw new NotFoundError('Start form not found');
    }

    if (form.status !== 'published') {
      throw new NotFoundError('Start form not published');
    }

    // 4. 응답 조합
    const shellDef = shell
      ? {
          id: shell._id.toString(),
          projectId: shell.projectId,
          name: shell.name,
          version: shell.version,
          properties: shell.properties,
          controls: shell.controls,
          eventHandlers: shell.eventHandlers
            .filter((h: any) => h.handlerType === 'server')
            .map((h: any) => ({
              controlId: h.controlId,
              eventName: h.eventName,
              handlerType: h.handlerType,
            })),
          startFormId: shell.startFormId,
        }
      : null;

    const startForm = {
      id: form._id.toString(),
      name: form.name,
      version: form.version,
      properties: form.properties,
      controls: form.controls,
      eventHandlers: form.eventHandlers
        .filter((h) => h.handlerType === 'server')
        .map((h) => ({
          controlId: h.controlId,
          eventName: h.eventName,
          handlerType: h.handlerType,
        })),
      dataBindings: form.dataBindings,
    };

    res.json({ shell: shellDef, startForm });
  } catch (err) {
    next(err);
  }
});
```

## 3. AppLoadResponse 타입 결정

### 결정: common 패키지에 추가

`AppLoadResponse`는 Runtime 클라이언트(packages/runtime)에서도 타입을 참조해야 하므로 common 패키지에 정의한다.

**파일**: `packages/common/src/types/shell.ts` (기존 파일에 추가)

```typescript
import type { FormDefinition } from './form';

/**
 * GET /api/runtime/app/:projectId 응답 타입.
 * Shell이 없는 프로젝트의 경우 shell이 null이 된다.
 */
export interface AppLoadResponse {
  shell: ApplicationShellDefinition | null;
  startForm: FormDefinition;
}
```

**수정**: `packages/common/src/index.ts`에 `AppLoadResponse` export 추가.

## 4. Shell 직렬화 헬퍼 함수

Shell → `ApplicationShellDefinition` 변환이 2곳(shells/:projectId, app/:projectId)에서 반복되므로 헬퍼 함수를 추출한다.

```typescript
function toShellDefinition(shell: ShellDocument): ApplicationShellDefinition {
  return {
    id: shell._id.toString(),
    projectId: shell.projectId,
    name: shell.name,
    version: shell.version,
    properties: shell.properties,
    controls: shell.controls,
    eventHandlers: shell.eventHandlers
      .filter((h: any) => h.handlerType === 'server')
      .map((h: any) => ({
        controlId: h.controlId,
        eventName: h.eventName,
        handlerType: h.handlerType,
      })),
    startFormId: shell.startFormId,
  };
}
```

마찬가지로 Form → FormDefinition (런타임용) 변환도 기존 `GET /forms/:id`에 이미 존재하므로 별도 함수로 추출한다.

```typescript
function toRuntimeFormDef(form: FormDocument) {
  return {
    id: form._id.toString(),
    name: form.name,
    version: form.version,
    properties: form.properties,
    controls: form.controls,
    eventHandlers: form.eventHandlers
      .filter((h) => h.handlerType === 'server')
      .map((h) => ({
        controlId: h.controlId,
        eventName: h.eventName,
        handlerType: h.handlerType,
      })),
    dataBindings: form.dataBindings,
  };
}
```

## 5. 에러 시나리오 처리

| 시나리오 | HTTP 코드 | 에러 메시지 |
|----------|-----------|-------------|
| Shell 미퍼블리시/없음 (GET shells/:projectId) | 404 | `Published shell not found` |
| Shell 이벤트에 필수 필드 누락 | 400 | `Missing required fields: controlId, eventName, shellState` |
| Shell 없음 + formId 미지정 (GET app/:projectId) | 400 | `No start form specified: set shell.startFormId or pass ?formId=` |
| 시작 폼 없음 (GET app/:projectId) | 404 | `Start form not found` |
| 시작 폼 미퍼블리시 (GET app/:projectId) | 404 | `Start form not published` |
| Shell 있지만 startFormId 미설정 + formId 미지정 | 400 | `No start form specified: set shell.startFormId or pass ?formId=` |

## 6. 수정 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `packages/server/src/routes/runtime.ts` | **수정** | 3개 엔드포인트 추가, ShellService import, 헬퍼 함수 추가 |
| `packages/common/src/types/shell.ts` | **수정** | `AppLoadResponse` 인터페이스 추가 |
| `packages/common/src/index.ts` | **수정** | `AppLoadResponse` export 추가 |

## 7. 구현 순서

1. `packages/common/src/types/shell.ts`에 `AppLoadResponse` 타입 추가
2. `packages/common/src/index.ts`에 export 추가
3. `packages/server/src/routes/runtime.ts`에:
   a. `ShellService` import 추가
   b. `ShellDocument` 타입, `ShellEventRequest` 타입 import
   c. `toShellDefinition()` 헬퍼 함수 추가
   d. `toRuntimeFormDef()` 헬퍼 함수 추가 + 기존 `GET /forms/:id` 리팩터링
   e. `GET /shells/:projectId` 엔드포인트 추가
   f. `POST /shells/:projectId/events` 스텁 엔드포인트 추가
   g. `GET /app/:projectId` 엔드포인트 추가
