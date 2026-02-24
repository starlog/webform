# ProjectService publishAll 메서드 구현 계획

## 1. 기존 ProjectService 구조 분석

### 1.1 클래스 구조 (`packages/server/src/services/ProjectService.ts`)

**현재 패턴:** ProjectService는 상태를 갖지 않는 클래스로, 생성자가 없고 의존성 주입도 없다. 각 메서드가 Mongoose 모델(`Project`, `Form`)을 직접 import하여 사용한다.

```typescript
import { Project } from '../models/Project.js';
import { Form } from '../models/Form.js';

export class ProjectService {
  // 생성자 없음, 의존성 주입 없음
  // 모든 메서드가 모델을 직접 사용
}
```

**서비스 인스턴스화:** 라우트 파일에서 `new ProjectService()`로 직접 생성한다. DI 컨테이너 없음.

```typescript
// routes/projects.ts
const projectService = new ProjectService();

// routes/forms.ts
const formService = new FormService();
const projectService = new ProjectService();
```

### 1.2 FormService 의존성 (`FormService.ts`)

FormService도 동일한 패턴 — 생성자 없음, 모델 직접 사용. `publishAllByProject` 메서드가 이미 구현되어 있다:

```typescript
async publishAllByProject(
  projectId: string,
  userId: string,
): Promise<{ publishedCount: number; skippedCount: number; totalCount: number }>
```

- draft 폼만 publish, 이미 published인 폼은 skip (에러 아님)
- `bulkWrite`로 단일 DB 라운드트립 처리
- 폼이 0개인 경우도 정상 반환 `{ publishedCount: 0, skippedCount: 0, totalCount: 0 }`

### 1.3 ShellService 의존성 (`ShellService.ts`)

ShellService도 동일 패턴. `publishShell` 메서드:

```typescript
async publishShell(projectId: string, userId: string): Promise<ShellDocument>
```

### 1.4 의존성 주입 방식 결정

현재 프로젝트의 패턴에 맞춰, ProjectService 내부에서 FormService와 ShellService를 **직접 인스턴스화**한다. 생성자 주입은 기존 코드와 일관성이 없으므로 사용하지 않는다.

```typescript
import { FormService } from './FormService.js';
import { ShellService } from './ShellService.js';

export class ProjectService {
  private formService = new FormService();
  private shellService = new ShellService();
  // ... 기존 메서드들
}
```

## 2. ShellService.publishShell 에러 처리 방식

### 2.1 에러 발생 케이스

| 상황 | 동작 | 에러 타입 |
|------|------|----------|
| Shell이 존재하지 않음 | `getShellByProjectId()`에서 throw | `NotFoundError` (404) |
| Shell이 이미 published | `publishShell()`에서 throw | `AppError` (409) |
| Shell이 존재하고 unpublished | 정상 publish | 에러 없음 |

### 2.2 publishShell 내부 로직

```typescript
async publishShell(projectId: string, userId: string): Promise<ShellDocument> {
  // 1단계: Shell 조회 — 없으면 NotFoundError throw
  const existing = await this.getShellByProjectId(projectId);

  // 2단계: 이미 published면 AppError(409) throw
  if (existing.published) {
    throw new AppError(409, 'Shell is already published');
  }

  // 3단계: published = true로 업데이트
  const shell = await Shell.findOneAndUpdate(
    { projectId, deletedAt: null },
    { $set: { published: true, updatedBy: userId } },
    { new: true },
  );
  return shell.toObject() as ShellDocument;
}
```

### 2.3 publishAll에서의 Shell 에러 처리 전략

publishAll은 **프로젝트 전체 퍼블리시**이므로, Shell이 없거나 이미 published인 경우를 에러로 처리하면 안 된다. 이 두 케이스를 `skipped`로 처리해야 한다.

**처리 방법:** `try-catch`로 `publishShell` 호출을 감싸고, `NotFoundError`(Shell 없음)와 `AppError` 409(이미 published)를 catch하여 `skipped: true`로 반환한다.

```typescript
// Shell 퍼블리시 처리
let shellResult: { published: boolean; skipped: boolean };
try {
  await this.shellService.publishShell(projectId, userId);
  shellResult = { published: true, skipped: false };
} catch (err) {
  if (
    err instanceof NotFoundError ||
    (err instanceof AppError && err.statusCode === 409)
  ) {
    shellResult = { published: false, skipped: true };
  } else {
    throw err; // 예상 외 에러는 상위로 전파
  }
}
```

## 3. publishAll 메서드 상세 구현 로직

### 3.1 메서드 시그니처

```typescript
async publishAll(
  projectId: string,
  userId: string,
): Promise<PublishAllResult>
```

### 3.2 단계별 로직

**Step 1: 프로젝트 존재 확인**
```typescript
await this.getProject(projectId);
```
- 프로젝트가 없으면 `NotFoundError`가 throw됨 (기존 `getProject` 재사용)
- 프로젝트 존재 확인 후 진행

**Step 2: FormService.publishAllByProject 호출**
```typescript
const formsResult = await this.formService.publishAllByProject(projectId, userId);
```
- 반환: `{ publishedCount, skippedCount, totalCount }`
- 폼이 0개여도 에러 없이 정상 반환

**Step 3: ShellService.publishShell 호출 (에러 흡수)**
```typescript
let shellResult: { published: boolean; skipped: boolean };
try {
  await this.shellService.publishShell(projectId, userId);
  shellResult = { published: true, skipped: false };
} catch (err) {
  if (
    err instanceof NotFoundError ||
    (err instanceof AppError && err.statusCode === 409)
  ) {
    shellResult = { published: false, skipped: true };
  } else {
    throw err;
  }
}
```

**Step 4: 통합 결과 반환**
```typescript
return {
  forms: formsResult,
  shell: shellResult,
};
```

## 4. 반환 타입 정의

```typescript
export interface PublishAllResult {
  forms: {
    publishedCount: number;
    skippedCount: number;
    totalCount: number;
  };
  shell: {
    published: boolean;
    skipped: boolean;
  };
}
```

이 인터페이스는 `ProjectService.ts` 파일 상단에 정의한다 (기존 `ExportProjectData` 인터페이스와 동일한 위치).

## 5. 최종 코드 초안

```typescript
import { FormService } from './FormService.js';
import { ShellService } from './ShellService.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';

export interface PublishAllResult {
  forms: {
    publishedCount: number;
    skippedCount: number;
    totalCount: number;
  };
  shell: {
    published: boolean;
    skipped: boolean;
  };
}

export class ProjectService {
  private formService = new FormService();
  private shellService = new ShellService();

  // ... 기존 메서드들 유지 ...

  async publishAll(projectId: string, userId: string): Promise<PublishAllResult> {
    // 1. 프로젝트 존재 확인
    await this.getProject(projectId);

    // 2. 모든 폼 퍼블리시
    const formsResult = await this.formService.publishAllByProject(projectId, userId);

    // 3. Shell 퍼블리시 (없거나 이미 published면 skipped)
    let shellResult: { published: boolean; skipped: boolean };
    try {
      await this.shellService.publishShell(projectId, userId);
      shellResult = { published: true, skipped: false };
    } catch (err) {
      if (
        err instanceof NotFoundError ||
        (err instanceof AppError && err.statusCode === 409)
      ) {
        shellResult = { published: false, skipped: true };
      } else {
        throw err;
      }
    }

    // 4. 통합 결과 반환
    return {
      forms: formsResult,
      shell: shellResult,
    };
  }
}
```

## 6. 시나리오별 예상 결과

| 시나리오 | forms 결과 | shell 결과 |
|---------|-----------|-----------|
| 폼 3개(draft 2, published 1) + Shell(unpublished) | `{ publishedCount: 2, skippedCount: 1, totalCount: 3 }` | `{ published: true, skipped: false }` |
| 폼 0개 + Shell 없음 | `{ publishedCount: 0, skippedCount: 0, totalCount: 0 }` | `{ published: false, skipped: true }` |
| 모든 폼 published + Shell already published | `{ publishedCount: 0, skippedCount: N, totalCount: N }` | `{ published: false, skipped: true }` |
| 폼 2개(모두 draft) + Shell(unpublished) | `{ publishedCount: 2, skippedCount: 0, totalCount: 2 }` | `{ published: true, skipped: false }` |

## 7. 수정할 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `packages/server/src/services/ProjectService.ts` | `FormService`/`ShellService` import 추가, 클래스 프로퍼티로 인스턴스 선언, `PublishAllResult` 인터페이스 추가, `publishAll()` 메서드 추가 |

> 라우트 연결(`POST /api/projects/:id/publish-all`)은 이 계획 범위 밖이며, 별도 태스크에서 진행.
