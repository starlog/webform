# Publish All 구현 계획

## 개요

프로젝트 내 모든 폼(및 Shell)을 한 번에 퍼블리시하는 "Publish All" 기능을 구현한다.

## 현재 상태 분석

### 기존 Publish 흐름
1. **폼 퍼블리시**: `POST /api/forms/:id/publish` → `status: 'published'`, `publishedVersion` 설정
2. **Shell 퍼블리시**: `POST /api/projects/:projectId/shell/publish` → `published: true`
3. **자동 draft 전환**: 퍼블리시된 폼/Shell 편집 시 자동으로 `draft`로 복귀
4. **중복 퍼블리시 방지**: 이미 published 상태인 폼 퍼블리시 시 409 에러

### 관련 파일
| 파일 | 역할 |
|------|------|
| `packages/server/src/models/Form.ts` | Form 모델 (status, publishedVersion) |
| `packages/server/src/models/Shell.ts` | Shell 모델 (published boolean) |
| `packages/server/src/services/FormService.ts` | publishForm() 메서드 |
| `packages/server/src/services/ShellService.ts` | publishShell() 메서드 |
| `packages/server/src/routes/projects.ts` | 프로젝트 라우트 |
| `packages/designer/src/App.tsx` | 메뉴바 Publish 버튼 |
| `packages/designer/src/services/apiService.ts` | API 클라이언트 |
| `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx` | 프로젝트 탐색기 컨텍스트 메뉴 |

---

## 구현 계획

### 1단계: Server — FormService에 publishAllByProject 메서드 추가

**파일**: `packages/server/src/services/FormService.ts`

```typescript
async publishAllByProject(projectId: string, userId: string): Promise<{
  publishedCount: number;
  skippedCount: number;
  totalCount: number;
}> {
  // 1. projectId에 속한 삭제되지 않은 모든 폼 조회
  // 2. status === 'draft'인 폼만 필터
  // 3. MongoDB updateMany로 일괄 업데이트:
  //    - status → 'published'
  //    - publishedVersion → 각 폼의 현재 version
  //    - updatedBy → userId
  // 4. 결과 반환 (퍼블리시된 수, 스킵된 수, 전체 수)
}
```

**주의사항**:
- `updateMany`로 한번에 처리하면 각 폼별 `publishedVersion`을 개별 `version`값으로 설정할 수 없음
- 따라서 `bulkWrite`를 사용하여 각 폼별 개별 업데이트 오퍼레이션 생성
- 이미 published인 폼은 스킵 (409 에러 대신 카운트만)

### 2단계: Server — ProjectService에 publishAll 메서드 추가

**파일**: `packages/server/src/services/ProjectService.ts`

```typescript
async publishAll(projectId: string, userId: string): Promise<{
  forms: { publishedCount: number; skippedCount: number; totalCount: number };
  shell: { published: boolean; skipped: boolean };
}> {
  // 1. 프로젝트 존재 확인
  // 2. formService.publishAllByProject(projectId, userId) 호출
  // 3. shellService.publishShell(projectId, userId) 호출 (Shell 존재 시, 이미 published면 스킵)
  // 4. 통합 결과 반환
}
```

### 3단계: Server — API 엔드포인트 추가

**파일**: `packages/server/src/routes/projects.ts`

```
POST /api/projects/:id/publish-all
```

**응답 예시**:
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

### 4단계: Designer — API 클라이언트 메서드 추가

**파일**: `packages/designer/src/services/apiService.ts`

```typescript
async publishAll(projectId: string): Promise<{
  data: {
    forms: { publishedCount: number; skippedCount: number; totalCount: number };
    shell: { published: boolean; skipped: boolean };
  };
}> {
  return request(`/projects/${projectId}/publish-all`, { method: 'POST' });
}
```

### 5단계: Designer — ProjectExplorer 컨텍스트 메뉴에 "Publish All" 추가

**파일**: `packages/designer/src/components/ProjectExplorer/ProjectExplorer.tsx`

프로젝트 노드 우클릭 컨텍스트 메뉴에 "Publish All" 항목 추가:

```
프로젝트 우클릭 메뉴 (기존)
├── 새 폼
├── 기본 폰트 설정
├── 폰트 일괄 적용
├── 내보내기
├── 삭제

프로젝트 우클릭 메뉴 (변경 후)
├── 새 폼
├── Publish All        ← 새로 추가
├── 기본 폰트 설정
├── 폰트 일괄 적용
├── 내보내기
├── 삭제
```

**동작**:
1. 클릭 시 `apiService.publishAll(projectId)` 호출
2. 현재 열려있는 폼이 해당 프로젝트에 속하면 `formStatus` 상태 업데이트
3. `explorerRefreshKey` 증가로 트리 새로고침 (상태 인디케이터 갱신)
4. 결과 메시지 표시: "N개 폼 퍼블리시 완료 (M개 스킵)"

### 6단계: 테스트

**파일**: `packages/server/src/__tests__/FormService.test.ts`

- draft 폼 3개 + published 폼 1개 → publishAll → 3개 퍼블리시, 1개 스킵 확인
- 빈 프로젝트 → publishAll → 0개 퍼블리시 확인
- 모든 폼이 이미 published → publishAll → 0개 퍼블리시, 전체 스킵 확인

**파일**: `packages/server/src/__tests__/projects.integration.test.ts`

- `POST /api/projects/:id/publish-all` 엔드포인트 통합 테스트

---

## 변경 파일 요약

| 패키지 | 파일 | 변경 내용 |
|--------|------|-----------|
| server | `services/FormService.ts` | `publishAllByProject()` 메서드 추가 |
| server | `services/ProjectService.ts` | `publishAll()` 메서드 추가 |
| server | `routes/projects.ts` | `POST /:id/publish-all` 엔드포인트 추가 |
| server | `__tests__/FormService.test.ts` | publishAllByProject 단위 테스트 |
| server | `__tests__/projects.integration.test.ts` | publish-all 통합 테스트 |
| designer | `services/apiService.ts` | `publishAll()` 메서드 추가 |
| designer | `components/ProjectExplorer/ProjectExplorer.tsx` | 컨텍스트 메뉴 항목 + 핸들러 추가 |
