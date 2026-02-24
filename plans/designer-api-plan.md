# Designer API 클라이언트 publishAll 메서드 추가 계획

## 1. 기존 apiService 구조 분석

### 1.1 HTTP 클라이언트 패턴

**파일**: `packages/designer/src/services/apiService.ts`

- **`request<T>(path, options?)`** — 공통 HTTP 함수 (133행)
  - `ensureAuth()`로 Bearer 토큰 자동 획득
  - `API_BASE` (`import.meta.env.VITE_API_URL ?? '/api'`) 기반 경로 조합
  - 에러 시 `res.json()` 파싱 → `throw new Error(error.error?.message)`
  - 204 응답 → `undefined as T` 반환
  - Content-Type: `application/json` 자동 설정

### 1.2 기존 메서드 목록

| 메서드 | HTTP | 경로 | 반환 타입 |
|--------|------|------|-----------|
| `listForms(projectId?)` | GET | `/forms` | `{ data: FormSummary[]; meta: PaginationMeta }` |
| `loadForm(id)` | GET | `/forms/:id` | `{ data: FormDocument }` |
| `saveForm(id, form)` | PUT | `/forms/:id` | `{ data: FormDocument }` |
| `publishForm(id)` | POST | `/forms/:id/publish` | `{ data: FormDocument }` |
| `createForm(input)` | POST | `/forms` | `{ data: FormDocument }` |
| `deleteForm(id)` | DELETE | `/forms/:id` | `void` |
| `listProjects()` | GET | `/projects` | `{ data: ProjectDocument[]; meta: PaginationMeta }` |
| `getProject(id)` | GET | `/projects/:id` | `{ data: { project: ProjectDocument; forms: FormSummary[] } }` |
| `createProject(input)` | POST | `/projects` | `{ data: ProjectDocument }` |
| `deleteProject(id)` | DELETE | `/projects/:id` | `void` |
| `exportProject(id)` | GET | `/projects/:id/export` | `ExportProjectData` |
| `importProject(data)` | POST | `/projects/import` | `{ data: ProjectDocument }` |
| `updateProject(id, input)` | PUT | `/projects/:id` | `{ data: ProjectDocument }` |
| `applyProjectFont(id, font)` | PUT | `/projects/:id/font` | `{ success: boolean; modifiedCount: number }` |
| `getShell(projectId)` | GET | `/projects/:projectId/shell` | `{ data: ShellDocument } \| null` |
| `createShell(projectId, data)` | POST | `/projects/:projectId/shell` | `{ data: ShellDocument }` |
| `updateShell(projectId, data)` | PUT | `/projects/:projectId/shell` | `{ data: ShellDocument }` |
| `deleteShell(projectId)` | DELETE | `/projects/:projectId/shell` | `void` |
| `publishShell(projectId)` | POST | `/projects/:projectId/shell/publish` | `{ data: ShellDocument }` |

### 1.3 기존 publish 관련 패턴

- **`publishForm(id)`** (177행): `POST /forms/:id/publish`, body 없음
- **`publishShell(projectId)`** (290행): `POST /projects/:projectId/shell/publish`, body 없음
- 두 메서드 모두 인자 없는 POST 요청으로 동일 패턴

---

## 2. 새 메서드: `publishAll(projectId)`

### 2.1 메서드 시그니처 및 반환 타입

```typescript
interface PublishAllResult {
  forms: { publishedCount: number; skippedCount: number; totalCount: number };
  shell: { published: boolean; skipped: boolean };
}

// apiService 객체 내부
async publishAll(projectId: string): Promise<{ data: PublishAllResult }> {
  return request(`/projects/${projectId}/publish-all`, { method: 'POST' });
}
```

### 2.2 API 호출 상세

- **HTTP 메서드**: POST
- **경로**: `/projects/${projectId}/publish-all`
- **요청 Body**: 없음 (기존 publishForm, publishShell과 동일 패턴)
- **응답 구조**:
  ```json
  {
    "data": {
      "forms": {
        "publishedCount": 3,
        "skippedCount": 1,
        "totalCount": 4
      },
      "shell": {
        "published": true,
        "skipped": false
      }
    }
  }
  ```

---

## 3. 코드 추가 위치

### 3.1 타입 정의 추가

**파일**: `packages/designer/src/services/apiService.ts`
**위치**: 기존 인터페이스 정의 블록 하단 (116행, `ExportProjectData` 인터페이스 뒤)

```typescript
interface PublishAllResult {
  forms: { publishedCount: number; skippedCount: number; totalCount: number };
  shell: { published: boolean; skipped: boolean };
}
```

### 3.2 메서드 추가

**위치**: `apiService` 객체 내부, `publishShell()` 메서드 직후 (292행 뒤)

기존 publish 관련 메서드들과 그룹핑:
- `publishForm(id)` — 177행
- `publishShell(projectId)` — 290행
- **`publishAll(projectId)`** — 292행 뒤 (신규)

```typescript
  // 프로젝트 전체 퍼블리시 (폼 + Shell)
  async publishAll(projectId: string): Promise<{ data: PublishAllResult }> {
    return request(`/projects/${projectId}/publish-all`, { method: 'POST' });
  },
```

### 3.3 타입 재export 추가

**위치**: 파일 하단 `export type` 블록 (452–465행)

```typescript
export type {
  // ... 기존 타입들 ...
  PublishAllResult,
};
```

---

## 4. 수정 요약

| # | 파일 | 변경 내용 | 위치 |
|---|------|-----------|------|
| 1 | `apiService.ts` | `PublishAllResult` 인터페이스 추가 | ~116행 뒤 |
| 2 | `apiService.ts` | `publishAll()` 메서드 추가 | ~292행 뒤 (`publishShell` 다음) |
| 3 | `apiService.ts` | `PublishAllResult` 타입 재export | ~465행 `export type` 블록 |

변경 범위: **apiService.ts 단일 파일**, 약 10줄 추가.
