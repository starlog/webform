# 에러 처리 개선 계획

## 현황 분석

### 1. Designer — 폼 저장/발행 에러 처리

**파일**: `packages/designer/src/App.tsx`, `packages/designer/src/services/apiService.ts`

**현재 동작**:
- `showStatus()` (App.tsx:43-46): 상태 메시지를 3초간 메뉴바에 표시 후 자동 소멸
- `handleSave()` (App.tsx:48-69): catch 블록에서 `showStatus('Save failed')` — 에러 원인 정보 없음
- `handlePublish()` (App.tsx:71-102): 동일 패턴, `showStatus('Publish failed')`

**핵심 버그**:
- `useAutoSave`의 `save()` 함수 (apiService.ts:460-493)가 에러를 **throw하지 않고 console.error만 호출**
- 따라서 `handleSave()`의 catch 블록이 실행되지 않아 `'Save failed'` 토스트가 표시되지 않음
- 사용자는 자동 저장 실패를 전혀 인지할 수 없음

**기타 문제**:
- `handleNewForm` (ProjectExplorer.tsx): 폼 생성 실패 시 console.error만, UI 피드백 없음
- `loadForm` (App.tsx:150-178): 폼 로드 실패 시 console.error만, UI 피드백 없음

### 2. Runtime — 데이터소스 로드 에러

**파일**: `packages/runtime/src/bindings/BindingEngine.ts`, `packages/runtime/src/bindings/bindingStore.ts`, `packages/runtime/src/hooks/useDataBinding.ts`

**현재 동작**:
- `bindingStore`에 `errors: Record<string, string | null>` 상태가 **이미 구현됨**
- `BindingEngine.loadDataSourceData()` (BindingEngine.ts:48-66)에서 `setError(dsId, message)` 호출
- `initializeBindings()`에서 `Promise.allSettled()` 사용 — 부분 실패 허용

**핵심 문제**:
- `useDataBinding` hook (useDataBinding.ts:17-18)이 `errors` 상태를 **구독하지 않음** — dataSourceData와 selectedRows만 구독
- `DataGridView`, `ComboBox` 등 바인딩 컨트롤이 에러 상태를 **표시하지 않음**
- DataGridView에서 로드 실패 시 "데이터가 없습니다." 메시지만 표시 — 에러와 빈 데이터를 구분 불가
- WebSocket `error` 메시지 (patchApplier.ts:25)가 console.error로만 로깅됨

### 3. Server — DataSourceService 에러 로깅

**파일**: `packages/server/src/services/DataSourceService.ts`, `packages/server/src/routes/runtime.ts`

**현재 동작**:
- `NotFoundError`, `AppError` 클래스가 구현되어 있고, 에러가 errorHandler 미들웨어에 전달됨
- errorHandler (errorHandler.ts:28-67)에서 500 에러만 `console.error()` 로깅
- 라우트 핸들러에서 try-catch → next(err) 패턴 사용

**핵심 문제**:
- `DataSourceService.executeQuery()` (DataSourceService.ts:218-226): adapter 에러 발생 시 **에러 로깅 없음** — 데이터소스 ID/타입 컨텍스트 없이 상위로 전파만 됨
- `DataSourceService.testConnection()` (DataSourceService.ts:205-213): 동일하게 로깅 없음
- runtime.ts:191-199에서 일괄 데이터소스 조회 시 개별 실패를 **빈 배열로 대체** — 에러 정보 완전 유실
- Adapter(MongoDBAdapter, RestApiAdapter)에서 발생하는 네이티브 에러가 컨텍스트 없이 전파됨

---

## 개선 계획

### Phase 1: Server — 에러 로깅 추가 (영향 범위: 최소)

#### 1-1. DataSourceService에 에러 로깅 추가

**파일**: `packages/server/src/services/DataSourceService.ts`

`executeQuery()`와 `testConnection()` 메서드에 try-catch 래핑 + 컨텍스트 로깅:

```typescript
// executeQuery 수정
async executeQuery(id: string, query: Record<string, unknown>): Promise<unknown[]> {
  const ds = await this.getDataSource(id);
  const adapter = this.createAdapter(ds);
  try {
    return await adapter.executeQuery(query);
  } catch (err) {
    console.error(
      `[DataSourceService] executeQuery failed — id=${id}, type=${ds.type}, query=${JSON.stringify(query)}`,
      err,
    );
    throw err;
  } finally {
    await adapter.disconnect();
  }
}

// testConnection 수정
async testConnection(id: string): Promise<{ success: boolean; message: string }> {
  const ds = await this.getDataSource(id);
  const adapter = this.createAdapter(ds);
  try {
    return await adapter.testConnection();
  } catch (err) {
    console.error(
      `[DataSourceService] testConnection failed — id=${id}, type=${ds.type}`,
      err,
    );
    throw err;
  } finally {
    await adapter.disconnect();
  }
}
```

#### 1-2. Runtime 일괄 조회 시 에러 정보 보존

**파일**: `packages/server/src/routes/runtime.ts` (라인 191-199)

현재 개별 데이터소스 실패 시 빈 배열로 대체하면서 에러를 무시하는 코드를 개선:

```typescript
// 기존
results[dsId] = [];

// 개선: 에러 로깅 추가
catch (err) {
  console.error(
    `[runtime] Data source query failed — formId=${req.params.id}, dsId=${dsId}`,
    err instanceof Error ? err.message : err,
  );
  results[dsId] = [];
}
```

### Phase 2: Designer — 상세 에러 토스트 개선

#### 2-1. useAutoSave의 save()가 에러를 throw하도록 수정

**파일**: `packages/designer/src/services/apiService.ts`

`save()` 함수 (라인 460-493)의 catch 블록에서 에러를 re-throw:

```typescript
// 기존
} catch (error) {
  console.error('Auto-save failed:', error);
}

// 개선: 에러 재전파
} catch (error) {
  console.error('Auto-save failed:', error);
  throw error;  // 호출자가 에러를 처리할 수 있도록 전파
}
```

`forceSave()` 함수 (라인 496-528)도 동일하게 수정.

#### 2-2. App.tsx의 showStatus에 에러 상세 정보 포함

**파일**: `packages/designer/src/App.tsx`

`handleSave()`와 `handlePublish()`의 catch 블록에서 HTTP 에러 메시지 포함:

```typescript
// 기존
} catch {
  showStatus('Save failed');
}

// 개선: 서버 에러 메시지 포함
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  showStatus(`Save failed: ${msg}`);
}
```

#### 2-3. 토스트 스타일 개선 — 에러 시 빨간색 표시

**파일**: `packages/designer/src/App.tsx`

`saveStatus` 상태를 에러 여부 구분 가능하도록 확장:

```typescript
// 기존: string | null
const [saveStatus, setSaveStatus] = useState<string | null>(null);

// 개선: type 추가
const [saveStatus, setSaveStatus] = useState<{
  message: string;
  type: 'success' | 'error';
} | null>(null);

const showStatus = (msg: string, type: 'success' | 'error' = 'success') => {
  setSaveStatus({ message: msg, type });
  setTimeout(() => setSaveStatus(null), type === 'error' ? 5000 : 3000);
};
```

토스트 렌더링 부분 (라인 373-378)에서 에러 시 빨간색 스타일 적용:

```typescript
<span style={{
  fontSize: 11,
  color: saveStatus.type === 'error' ? '#d32f2f' : '#2e7d32',
  fontWeight: 500,
}}>
  {saveStatus.message}
</span>
```

### Phase 3: Runtime — 데이터소스 에러 UI 표시

#### 3-1. useDataBinding hook에서 errors 구독 추가

**파일**: `packages/runtime/src/hooks/useDataBinding.ts`

```typescript
// 기존: dataSourceData, selectedRows만 구독
const dataSourceData = useBindingStore((s) => s.dataSourceData);
const selectedRows = useBindingStore((s) => s.selectedRows);

// 개선: errors, loadingStates 구독 추가
const dataSourceData = useBindingStore((s) => s.dataSourceData);
const selectedRows = useBindingStore((s) => s.selectedRows);
const errors = useBindingStore((s) => s.errors);
const loadingStates = useBindingStore((s) => s.loadingStates);
```

반환 결과에 에러/로딩 정보 포함:

```typescript
// 바인딩된 dataSourceId에 대한 에러 정보 추가
for (const binding of myBindings) {
  const ref = parseDataSourceRef(binding.dataSourceId);
  if (ref.type === 'dataSource') {
    if (errors[ref.dataSourceId]) {
      result['__error__'] = errors[ref.dataSourceId];
    }
    if (loadingStates[ref.dataSourceId]) {
      result['__loading__'] = true;
    }
  }
}
```

#### 3-2. DataGridView에 에러/로딩 상태 표시

**파일**: `packages/runtime/src/controls/DataGridView.tsx`

```typescript
// 에러 시 에러 메시지 표시
if (props['__error__']) {
  return (
    <div style={{ padding: 12, color: '#d32f2f', fontSize: 13 }}>
      데이터 로드 실패: {String(props['__error__'])}
    </div>
  );
}

// 로딩 시 로딩 표시
if (props['__loading__']) {
  return (
    <div style={{ padding: 12, color: '#666', fontSize: 13 }}>
      데이터 로딩 중...
    </div>
  );
}
```

#### 3-3. WebSocket 에러 메시지 UI 표시

**파일**: `packages/runtime/src/communication/patchApplier.ts`

```typescript
// 기존
case 'error':
  console.error('Server error:', message.payload);
  break;

// 개선: runtimeStore의 dialogQueue에 에러 다이얼로그 추가
case 'error':
  console.error('Server error:', message.payload);
  runtimeStore.applyPatches([{
    type: 'showDialog',
    target: '',
    payload: {
      title: '서버 오류',
      text: typeof message.payload === 'string'
        ? message.payload
        : JSON.stringify(message.payload),
      dialogType: 'error',
    },
  }]);
  break;
```

---

## 수정 파일 목록

| Phase | 파일 | 변경 내용 |
|-------|------|-----------|
| 1 | `packages/server/src/services/DataSourceService.ts` | executeQuery, testConnection에 에러 로깅 추가 |
| 1 | `packages/server/src/routes/runtime.ts` | 일괄 조회 시 에러 로깅 추가 |
| 2 | `packages/designer/src/services/apiService.ts` | save(), forceSave()에서 에러 re-throw |
| 2 | `packages/designer/src/App.tsx` | 상세 에러 메시지 토스트, 에러 스타일 구분 |
| 3 | `packages/runtime/src/hooks/useDataBinding.ts` | errors, loadingStates 구독 추가 |
| 3 | `packages/runtime/src/controls/DataGridView.tsx` | 에러/로딩 상태 UI 표시 |
| 3 | `packages/runtime/src/communication/patchApplier.ts` | WebSocket 에러 UI 표시 |

## 우선순위

1. **Phase 1 (Server 로깅)** — 즉시 적용 가능, 기존 동작 변경 없음, 디버깅에 즉각적 효과
2. **Phase 2 (Designer 토스트)** — save() 에러 전파가 핵심, 사용자 경험 직접 개선
3. **Phase 3 (Runtime 에러 UI)** — bindingStore 인프라가 이미 존재하므로 구현 비용 낮음
