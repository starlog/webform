# FormService publishAllByProject 메서드 구현 계획

## 1. 기존 코드 분석

### 1.1 Form 모델 (`packages/server/src/models/Form.ts`)

**FormDocument 인터페이스 주요 필드:**

| 필드 | 타입 | 설명 |
|------|------|------|
| `_id` | `ObjectId` | 폼 ID |
| `name` | `string` | 폼 이름 |
| `version` | `number` | 현재 버전 (수정 시 $inc로 증가, 기본값 1) |
| `projectId` | `string` | 프로젝트 ID (인덱스 설정됨) |
| `status` | `'draft' \| 'published'` | 퍼블리시 상태 (기본값 `'draft'`) |
| `publishedVersion` | `number?` | 퍼블리시된 시점의 version 값 |
| `deletedAt` | `Date \| null` | soft delete 플래그 (null이면 활성) |
| `createdBy` | `string` | 생성자 |
| `updatedBy` | `string` | 수정자 |

**관련 인덱스:**
- `{ projectId: 1, deletedAt: 1 }` — projectId + soft delete 복합 인덱스 (조회에 활용 가능)
- `{ status: 1 }` — status 단독 인덱스

### 1.2 기존 publishForm() 메서드 (`FormService.ts:117-141`)

```typescript
async publishForm(id: string, userId: string): Promise<FormDocument> {
  // 1. 폼 조회 (deletedAt: null 확인)
  const existing = await this.getForm(id);

  // 2. 이미 published면 409 에러
  if (existing.status === 'published') {
    throw new AppError(409, 'Form is already published');
  }

  // 3. status → 'published', publishedVersion → 현재 version
  const form = await Form.findByIdAndUpdate(id, {
    $set: {
      status: 'published',
      publishedVersion: existing.version,
      updatedBy: userId,
    },
  }, { new: true });

  return form.toObject() as FormDocument;
}
```

**핵심 로직:** `publishedVersion`에 해당 폼의 현재 `version` 값을 복사하는 방식. 이 때문에 모든 폼에 동일한 값을 설정할 수 없어 `updateMany` 대신 개별 업데이트가 필요함.

### 1.3 ShellService publishShell() 패턴 (`ShellService.ts:102-125`)

- 단일 문서 퍼블리시 패턴으로 Form과 유사
- `published: boolean` 필드 사용 (Form의 `status: 'draft' | 'published'`와 다름)
- 이미 published면 409 에러 반환

## 2. publishAllByProject 상세 구현 로직

### 2.1 메서드 시그니처

```typescript
async publishAllByProject(
  projectId: string,
  userId: string,
): Promise<{ publishedCount: number; skippedCount: number; totalCount: number }>
```

### 2.2 단계별 로직

**Step 1: 대상 폼 전체 조회**
```typescript
const forms = await Form.find(
  { projectId, deletedAt: null },
  { _id: 1, status: 1, version: 1 },  // 필요 필드만 projection
).lean();
```
- `projectId`에 속한 삭제되지 않은 모든 폼 조회
- `{ projectId: 1, deletedAt: 1 }` 복합 인덱스 활용
- `_id`, `status`, `version`만 projection하여 메모리 최소화

**Step 2: draft 폼 필터링**
```typescript
const draftForms = forms.filter((f) => f.status === 'draft');
const skippedCount = forms.length - draftForms.length;
```
- `status === 'draft'`인 폼만 퍼블리시 대상
- 이미 `published`인 폼은 스킵 (에러 아님, 카운트만 기록)

**Step 3: bulkWrite 실행 (draft 폼이 있는 경우만)**
```typescript
if (draftForms.length > 0) {
  await Form.bulkWrite(
    draftForms.map((f) => ({
      updateOne: {
        filter: { _id: f._id },
        update: {
          $set: {
            status: 'published',
            publishedVersion: f.version,
            updatedBy: userId,
          },
        },
      },
    })),
  );
}
```

**Step 4: 결과 반환**
```typescript
return {
  publishedCount: draftForms.length,
  skippedCount,
  totalCount: forms.length,
};
```

## 3. bulkWrite 사용 이유

### 왜 updateMany가 아닌 bulkWrite인가?

`updateMany`는 모든 매칭 문서에 **동일한 값**을 설정한다:
```typescript
// ❌ 불가능: 각 폼의 version이 다르므로 publishedVersion을 일괄 설정할 수 없음
await Form.updateMany(
  { projectId, deletedAt: null, status: 'draft' },
  { $set: { status: 'published', publishedVersion: ??? } }
);
```

각 폼의 `publishedVersion`은 해당 폼의 현재 `version` 값이어야 하므로, 폼별 개별 업데이트가 필요하다. `bulkWrite`는 여러 개의 개별 오퍼레이션을 **단일 DB 라운드트립**으로 처리한다.

### bulkWrite 오퍼레이션 구조 예시

폼 3개가 있는 경우 (formA: version 3, formB: version 7, formC: version 1):

```typescript
Form.bulkWrite([
  {
    updateOne: {
      filter: { _id: ObjectId('formA_id') },
      update: {
        $set: { status: 'published', publishedVersion: 3, updatedBy: 'user1' },
      },
    },
  },
  {
    updateOne: {
      filter: { _id: ObjectId('formB_id') },
      update: {
        $set: { status: 'published', publishedVersion: 7, updatedBy: 'user1' },
      },
    },
  },
  {
    updateOne: {
      filter: { _id: ObjectId('formC_id') },
      update: {
        $set: { status: 'published', publishedVersion: 1, updatedBy: 'user1' },
      },
    },
  },
]);
```

### 성능 비교

| 방식 | DB 라운드트립 | 비고 |
|------|-------------|------|
| 개별 `findByIdAndUpdate` N번 | N회 | 느림 |
| `bulkWrite` | 1회 | 단일 라운드트립, 최적 |
| `updateMany` | 1회 | 폼별 다른 값 설정 불가 |

## 4. 에러 처리 전략

| 시나리오 | 처리 |
|---------|------|
| projectId에 해당하는 폼이 0개 | 정상 반환: `{ publishedCount: 0, skippedCount: 0, totalCount: 0 }` |
| 모든 폼이 이미 published | 정상 반환: `{ publishedCount: 0, skippedCount: N, totalCount: N }` |
| bulkWrite 실패 | Mongoose 에러 그대로 상위 전파 (Express 에러 핸들러가 500 처리) |

- 빈 프로젝트나 전부 published인 경우는 에러가 아닌 정상 응답으로 처리
- `draftForms.length === 0`이면 bulkWrite를 호출하지 않음 (불필요한 DB 요청 방지)

## 5. 수정할 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `packages/server/src/services/FormService.ts` | `publishAllByProject()` 메서드 추가 |

> 라우트/컨트롤러 연결은 이 계획의 범위 밖이며, 별도 태스크에서 API 엔드포인트를 추가할 때 진행.

## 6. 최종 코드 초안

```typescript
async publishAllByProject(
  projectId: string,
  userId: string,
): Promise<{ publishedCount: number; skippedCount: number; totalCount: number }> {
  const forms = await Form.find(
    { projectId, deletedAt: null },
    { _id: 1, status: 1, version: 1 },
  ).lean();

  const draftForms = forms.filter((f) => f.status === 'draft');
  const skippedCount = forms.length - draftForms.length;

  if (draftForms.length > 0) {
    await Form.bulkWrite(
      draftForms.map((f) => ({
        updateOne: {
          filter: { _id: f._id },
          update: {
            $set: {
              status: 'published' as const,
              publishedVersion: f.version,
              updatedBy: userId,
            },
          },
        },
      })),
    );
  }

  return {
    publishedCount: draftForms.length,
    skippedCount,
    totalCount: forms.length,
  };
}
```
