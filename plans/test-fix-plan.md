# 테스트 실패 수정 계획

## 대상 테스트 파일

`packages/server/src/__tests__/forms.integration.test.ts`

---

## 실패 테스트 1: 버전 히스토리 반환 오류

### 테스트 케이스

```
GET /api/forms/:id/versions > 버전 배열을 반환해야 한다 (line 167)
```

### 테스트 흐름

1. `POST /api/forms` → 폼 생성 (version=1)
2. `PUT /api/forms/:id` → 이름 변경으로 업데이트 (version=2)
3. `GET /api/forms/:id/versions` → 버전 히스토리 조회

### 기대값

```typescript
expect(res.body.data).toHaveLength(1);    // 이전 버전 스냅샷 1개
expect(res.body.data[0].version).toBe(1); // 업데이트 전 버전 번호
```

### 실패 원인

**파일**: `packages/server/src/services/FormService.ts` — `updateForm` 메서드 (line 158-174)

`updateForm`에서 `FormVersion.create` 호출 시 **새로운 버전(saved.version)**의 정보를 저장하고 있다. 그러나 버전 히스토리의 목적은 **업데이트 전 상태(이전 버전)의 스냅샷**을 보존하는 것이다.

**현재 코드** (line 158-174):

```typescript
// FormVersion 컬렉션에 새 상태 저장 (업데이트 완료 후)
FormVersion.create({
  formId: id,
  version: saved.version,           // ← BUG: 새 버전 번호 (2)
  note,
  snapshot: {
    name: saved.name,               // ← BUG: 새 상태의 데이터
    properties: saved.properties,
    controls: saved.controls,
    eventHandlers: saved.eventHandlers,
    dataBindings: saved.dataBindings,
  },
  savedAt: new Date(),
  savedBy: userId,
})
```

**문제점**:

- `version: saved.version` → 업데이트 **후** 버전 번호(2)를 저장. 테스트는 이전 버전(1)을 기대
- `snapshot: { ...saved... }` → 업데이트 **후** 상태를 저장. 이전 상태의 스냅샷을 저장해야 함
- 동일 메서드 내에서 이미 `existing` 변수에 이전 상태가 있고, `snapshot` 변수(line 117-127)에 이전 버전의 스냅샷이 올바르게 구성되어 있으나, `FormVersion.create`에서 사용하지 않고 있음

### 수정 방안

**수정 파일**: `packages/server/src/services/FormService.ts`
**수정 메서드**: `updateForm` (line 158-174)

기존에 만들어둔 `snapshot` 변수(이전 버전 정보)를 `FormVersion.create`에서 재사용:

```typescript
// FormVersion 컬렉션에 이전 상태 저장
FormVersion.create({
  formId: id,
  version: snapshot.version,          // 이전 버전 번호 (existing.version)
  note,
  snapshot: snapshot.snapshot,         // 이전 상태의 스냅샷
  savedAt: new Date(),
  savedBy: userId,
}).catch((err) => {
  console.error('Failed to save FormVersion:', err);
});
```

**변경 범위**: 2줄 변경 (`saved.version` → `snapshot.version`, `snapshot: { ...saved... }` → `snapshot: snapshot.snapshot`)

---

## 실패 테스트 2: 중복 publish 시 409 미반환

### 테스트 케이스

```
POST /api/forms/:id/publish > 이미 published 상태면 409를 반환해야 한다 (line 210)
```

### 테스트 흐름

1. `POST /api/forms` → 폼 생성 (status=draft)
2. `POST /api/forms/:id/publish` → 첫 번째 publish (status=published)
3. `POST /api/forms/:id/publish` → 두 번째 publish (이미 published)

### 기대값

```typescript
expect(res.status).toBe(409); // 중복 publish 시 Conflict
```

### 실패 원인

**파일**: `packages/server/src/services/FormService.ts` — `publishForm` 메서드 (line 207-227)

`publishForm`에서 `existing.status`가 이미 `'published'`인지 확인하지 않고 무조건 publish를 수행한다. 동일 프로젝트의 `ShellService.publishShell` (line 105-106)에서는 이미 published 상태 체크를 하고 있으나, `FormService.publishForm`에는 이 로직이 누락되어 있다.

**현재 코드** (line 207-227):

```typescript
async publishForm(id: string, userId: string): Promise<FormDocument> {
  const existing = await this.getForm(id);
  // ← BUG: published 상태 체크 누락

  const form = await Form.findByIdAndUpdate(
    id,
    { $set: { status: 'published', publishedVersion: existing.version, updatedBy: userId } },
    { new: true },
  );
  // ...
}
```

### 수정 방안

**수정 파일**: `packages/server/src/services/FormService.ts`
**수정 메서드**: `publishForm` (line 207-227)

`ShellService.publishShell`과 동일한 패턴으로 상태 체크 추가:

```typescript
async publishForm(id: string, userId: string): Promise<FormDocument> {
  const existing = await this.getForm(id);

  if (existing.status === 'published') {
    throw new AppError(409, 'Form is already published');
  }

  const form = await Form.findByIdAndUpdate(
    // ... 기존 코드 동일
  );
  // ...
}
```

**변경 범위**: 3줄 추가 (import에 `AppError` 추가 + 상태 체크 조건문)

**참고**: `AppError`는 이미 `errorHandler.ts`에서 export되고 있으며, `errorHandler` 미들웨어가 `statusCode`를 기반으로 응답을 생성하므로 `AppError(409, ...)`을 throw하면 자동으로 409 응답이 된다.

---

## 수정 요약

| # | 파일 | 메서드 | 변경 내용 | 변경량 |
|---|------|--------|-----------|--------|
| 1 | `FormService.ts` | `updateForm` | `FormVersion.create`에서 `saved` 대신 `snapshot` 변수 사용 | 2줄 수정 |
| 2 | `FormService.ts` | `publishForm` | `existing.status === 'published'` 체크 및 `AppError(409)` throw 추가 | 1줄 import 변경 + 3줄 추가 |

**수정 파일 총 1개**: `packages/server/src/services/FormService.ts`
