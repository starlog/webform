# Optimistic Locking 설계 계획

## 문제

`FormService.updateForm()`에 낙관적 잠금이 없어서, 여러 디자이너가 같은 폼을 동시에 편집하면 **마지막 저장만 유지**되어 이전 변경 사항이 유실된다.

### 현재 동작 (Lost Update 문제)

```
시간 →
User A: loadForm(v3) ─── 편집 ─── saveForm() → v4 (OK)
User B: loadForm(v3) ─── 편집 ─────────── saveForm() → v5 (User A의 변경 덮어씀!)
```

### 현재 코드 분석

| 파일 | 현재 상태 |
|------|-----------|
| `Form` 모델 (`models/Form.ts:81`) | `version: Number` 필드 이미 존재 (default: 1) |
| `FormService.updateForm()` (L142-150) | `$inc: { version: 1 }` 이미 적용. **그러나 클라이언트 version과의 비교 없음** |
| `updateFormSchema` (validator) | `version` 필드 없음 — 클라이언트가 version을 전송하지 않음 |
| `apiService.saveForm()` (designer) | `UpdateFormPayload`에 `version` 필드 없음 |
| `designerStore.loadForm()` | 서버 응답의 `version`을 store에 저장하지 않음 |

## 설계

### 전략: Version-based Optimistic Locking

클라이언트가 폼 로드 시 받은 `version`을 저장 요청 시 함께 전송. 서버는 DB의 현재 version과 비교하여 일치할 때만 업데이트하고, 불일치 시 **409 Conflict**를 반환한다.

```
User A: loadForm(v3) ─── 편집 ─── saveForm(version:3) → v4 (OK, 3==3)
User B: loadForm(v3) ─── 편집 ─────────── saveForm(version:3) → 409 (3≠4, Conflict!)
```

### 변경 대상 파일

총 **6개 파일** 수정:

## 수정 계획

### 1. Server: `updateFormSchema`에 `version` 필드 추가

**파일**: `packages/server/src/validators/formValidator.ts`

```ts
// updateFormSchema에 version 필드 추가
export const updateFormSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  properties: formPropertiesSchema.partial().optional(),
  controls: z.array(controlDefinitionSchema).optional(),
  eventHandlers: z.array(eventHandlerSchema).optional(),
  dataBindings: z.array(dataBindingSchema).optional(),
  version: z.number().int().positive().optional(), // 낙관적 잠금용
});
```

- `version`은 `optional`로 설정 — 기존 API 호환성 유지 (version 없이 호출하면 잠금 검증 생략)

### 2. Server: `FormService.updateForm()`에 version 비교 로직 추가

**파일**: `packages/server/src/services/FormService.ts`

```ts
async updateForm(id: string, input: UpdateFormInput, userId: string): Promise<FormDocument> {
  const existing = await this.getForm(id);

  // ★ 낙관적 잠금: 클라이언트 version과 DB version 비교
  if (input.version !== undefined && input.version !== existing.version) {
    throw new AppError(409, 'Form has been modified by another user. Please reload and try again.');
  }

  const snapshot: FormVersionSnapshot = { /* ... 기존 코드 ... */ };

  const note = generateNote(existing, input);

  const { version: _clientVersion, ...updateData } = input;
  const updateFields: Record<string, unknown> = {
    ...updateData,
    updatedBy: userId,
  };

  // published → draft 전환 (기존 로직)
  if (existing.status === 'published') {
    updateFields.status = 'draft';
  }

  // ★ findOneAndUpdate 조건에 version 추가 (이중 안전장치)
  const filter: Record<string, unknown> = { _id: id, deletedAt: null };
  if (input.version !== undefined) {
    filter.version = input.version;
  }

  const form = await Form.findOneAndUpdate(
    filter,
    {
      $set: updateFields,
      $inc: { version: 1 },
      $push: { versions: snapshot },
    },
    { new: true },
  );

  if (!form) {
    // version 불일치로 업데이트 실패
    if (input.version !== undefined) {
      throw new AppError(409, 'Form has been modified by another user. Please reload and try again.');
    }
    throw new NotFoundError(`Form not found: ${id}`);
  }

  // FormVersion 저장 (기존 로직)
  FormVersion.create({ /* ... */ }).catch(/* ... */);

  return saved;
}
```

**핵심 포인트**:
- `input.version`이 있을 때만 잠금 검증 수행 (하위 호환)
- **이중 안전장치**: getForm으로 먼저 비교 + findOneAndUpdate 쿼리 조건에 version 포함 (race condition 방지)
- `input`에서 `version` 필드를 제거 후 `$set`에 전달 (DB version은 `$inc`로만 증가)

### 3. Server: `ConflictError` 클래스 추가 (선택)

**파일**: `packages/server/src/middleware/errorHandler.ts`

```ts
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
    this.name = 'ConflictError';
  }
}
```

- 기존 `AppError(409, ...)` 직접 사용도 가능하나, 의미 명확성을 위해 전용 클래스 추가
- **선택사항**: 없어도 `new AppError(409, message)`로 충분

### 4. Designer: `designerStore`에 `formVersion` 상태 추가

**파일**: `packages/designer/src/stores/designerStore.ts`

```ts
// State 인터페이스에 추가
formVersion: number | null;

// 초기값
formVersion: null,

// loadForm 액션에서 version 저장
loadForm: (formId, controls, properties, eventHandlers, version?) => set((state) => {
  state.currentFormId = formId;
  state.formVersion = version ?? null;   // ★ version 저장
  state.controls = flattenControls(controls);
  // ... 기존 코드 ...
}),

// markClean 또는 별도 액션으로 저장 후 version 업데이트
updateFormVersion: (version: number) => set((state) => {
  state.formVersion = version;
}),
```

### 5. Designer: `apiService`에서 version 전달

**파일**: `packages/designer/src/services/apiService.ts`

```ts
// UpdateFormPayload에 version 추가
interface UpdateFormPayload {
  name?: string;
  properties?: Partial<FormProperties>;
  controls?: ControlDefinition[];
  eventHandlers?: EventHandlerDefinition[];
  dataBindings?: DataBindingDefinition[];
  version?: number;  // ★ 낙관적 잠금용
}
```

**`useAutoSave.save()` 수정**:

```ts
const save = useCallback(async () => {
  if (!isDirty || !currentFormId) return;

  const state = useDesignerStore.getState();
  const nestedControls = nestControls(controls);
  const result = await apiService.saveForm(currentFormId, {
    controls: nestedControls,
    properties: formProperties,
    eventHandlers: extractEventHandlers(controls),
    version: state.formVersion ?? undefined,  // ★ version 전달
  });

  // ★ 저장 성공 시 새 version으로 업데이트
  state.updateFormVersion(result.data.version);
  markClean();
}, [/* ... */]);
```

**`loadForm` 호출 시 version 전달** (`App.tsx`):

```ts
const loadForm = async (formId: string) => {
  const { data } = await apiService.loadForm(formId);
  const store = useDesignerStore.getState();
  store.loadForm(formId, data.controls, data.properties, data.eventHandlers, data.version);
  // ...
};
```

### 6. Designer: 409 Conflict 에러 처리 (App.tsx)

**파일**: `packages/designer/src/App.tsx`

**`handleSave` 수정**:

```ts
const handleSave = useCallback(async () => {
  try {
    await save();
    showStatus('Saved');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';

    // ★ 409 Conflict 감지
    if (msg.includes('modified by another user')) {
      const reload = window.confirm(
        '다른 사용자가 이 폼을 수정했습니다.\n' +
        '최신 버전을 다시 불러오시겠습니까?\n\n' +
        '(취소하면 현재 변경사항을 유지하지만, 저장 시 다시 충돌이 발생할 수 있습니다.)'
      );
      if (reload && currentFormId) {
        await loadForm(currentFormId);
        showStatus('Reloaded latest version', 'success');
      } else {
        showStatus('Save conflict — please reload manually', 'error');
      }
    } else {
      showStatus(`Save failed: ${msg}`, 'error');
    }
  }
}, [save, currentFormId]);
```

**`apiService.request` 개선** — 409 에러 시 메시지 파싱:

현재 `request()` 함수가 이미 `error.error?.message`를 추출하므로 서버 에러 메시지가 그대로 전달됨. 추가 수정 불필요.

## 데이터 흐름 요약

```
[Designer Client]                          [Server]
     │                                        │
     │  GET /api/forms/:id                    │
     │ ────────────────────────────────────→   │
     │   ← { data: { ..., version: 5 } }      │
     │                                        │
     │  store.formVersion = 5                 │
     │  (편집 중...)                            │
     │                                        │
     │  PUT /api/forms/:id                    │
     │  { controls, properties, version: 5 }  │
     │ ────────────────────────────────────→   │
     │                                        │ DB.version == 5? → OK
     │   ← { data: { ..., version: 6 } }      │ $inc: { version: 1 }
     │                                        │
     │  store.formVersion = 6                 │
     │                                        │
     │  (다른 사용자가 v6→v7로 업데이트)         │
     │                                        │
     │  PUT /api/forms/:id                    │
     │  { controls, properties, version: 6 }  │
     │ ────────────────────────────────────→   │
     │                                        │ DB.version == 7 ≠ 6 → CONFLICT
     │   ← 409 { error: { message: "..." } }  │
     │                                        │
     │  confirm("다른 사용자가 수정...")         │
     │  → Reload or Keep editing              │
```

## 구현 순서

| 순서 | 파일 | 변경 내용 |
|------|------|-----------|
| 1 | `packages/server/src/middleware/errorHandler.ts` | `ConflictError` 클래스 추가 (선택) |
| 2 | `packages/server/src/validators/formValidator.ts` | `updateFormSchema`에 `version` 필드 추가 |
| 3 | `packages/server/src/services/FormService.ts` | `updateForm()`에 version 비교 + 쿼리 조건 추가 |
| 4 | `packages/designer/src/stores/designerStore.ts` | `formVersion` 상태 + `updateFormVersion` 액션 추가 |
| 5 | `packages/designer/src/services/apiService.ts` | `UpdateFormPayload`에 `version` 추가, save 시 version 전달 및 응답에서 업데이트 |
| 6 | `packages/designer/src/App.tsx` | `loadForm()`에서 version 전달, 409 충돌 시 UX 처리 |

## 테스트 계획

### 서버 단위 테스트

```ts
describe('FormService.updateForm - Optimistic Locking', () => {
  it('version 일치 시 정상 업데이트 (version +1)', async () => {
    // version: 3인 폼에 version: 3으로 요청 → 성공, 결과 version: 4
  });

  it('version 불일치 시 409 Conflict', async () => {
    // version: 3인 폼에 version: 2로 요청 → AppError(409)
  });

  it('version 미전달 시 잠금 검증 생략 (하위 호환)', async () => {
    // version 없이 요청 → 정상 업데이트
  });

  it('동시 업데이트 시 하나만 성공 (race condition)', async () => {
    // 같은 version으로 동시 2개 요청 → 1개 성공, 1개 409
  });
});
```

### 클라이언트 수동 테스트

1. 두 브라우저 탭에서 같은 폼을 열기
2. 탭 A에서 컨트롤 추가 → 저장 → 성공
3. 탭 B에서 컨트롤 추가 → 저장 → 충돌 다이얼로그 확인
4. "다시 불러오기" 선택 → 최신 버전으로 갱신 확인

## 하위 호환성

- `version` 파라미터는 **optional** — 기존 API 클라이언트는 수정 없이 동작
- 서버 로직: `input.version === undefined`이면 잠금 검증 생략
- DB 스키마 변경 없음 — `version` 필드는 이미 존재
