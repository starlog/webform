# ENHANCE-HIGH: 단기 수정 (미완성 리팩토링 + 성능)

---

## Part A: 미완성 리팩토링 완료

### #5. EventEditor.tsx — 추출 파일 임포트로 교체 (~800줄 제거)

**파일:** `packages/designer/src/components/EventEditor/EventEditor.tsx` (2,367줄)

**현황:**
추출 파일 5개가 이미 생성되었으나, `EventEditor.tsx`가 이를 임포트하지 않고 구버전 코드를 그대로 유지 중.

| 추출 파일 | EventEditor.tsx 내 중복 위치 | 중복 내용 |
|-----------|----------------------------|-----------|
| `sampleCode.ts` | L41~234 | `getSampleCode` 함수 전체 (~194줄) |
| `debugUtils.ts` | L9~29, L237~243, L1386~1397, L1535~1584 | 타입 정의, `LOG_COLORS`, `formatTimestamp`, `navigatePath`, `resolveExpression`, `escapeCssContent`, `tryParseJson` |
| `DebugConsole.tsx` | L1399~1533 | `DebugTabButton`, `DebugConsole` 컴포넌트 (~135줄) |
| `WatchPanel.tsx` | 내부 인라인 코드 | Watch 패널 관련 로직 |
| `VariablesPanel.tsx` | 내부 인라인 코드 | Variables 패널 관련 로직 |

**작업 순서:**

1. `EventEditor.tsx` 상단에 임포트 추가:
```typescript
import { getSampleCode } from './sampleCode';
import {
  DebugLogEntry, TraceEntry, ExecutionSummary,
  LOG_COLORS, formatTimestamp, escapeCssContent,
  navigatePath, resolveExpression, tryParseJson,
} from './debugUtils';
import { DebugConsole, DebugTabButton } from './DebugConsole';
import { WatchPanel } from './WatchPanel';
import { VariablesPanel } from './VariablesPanel';
```

2. `EventEditor.tsx`에서 중복 코드 삭제:
   - L9~29: 타입 정의 (`DebugLogEntry`, `TraceEntry`, `ExecutionSummary`) 삭제
   - L41~234: `getSampleCode` 함수 삭제
   - L237~243: `escapeCssContent` 삭제
   - L1386~1397: `LOG_COLORS`, `formatTimestamp` 삭제
   - L1399~1533: `DebugTabButton`, `DebugConsole` 삭제
   - L1535~1584: `navigatePath`, `resolveExpression` 삭제
   - 파일 하단: `tryParseJson` 삭제

3. 추출 파일의 export 확인 — 필요한 모든 심볼이 export되는지 검증

**예상 결과:** EventEditor.tsx가 2,367줄 → ~1,500줄로 감소

---

### #6. DataSourcePanel.tsx — 추출 파일 임포트로 교체 (~470줄 제거)

**파일:** `packages/designer/src/components/DataSourcePanel/DataSourcePanel.tsx` (1,321줄)

**현황:**
`dataSourceApi.ts`와 `dataSourceStyles.ts`가 이미 생성되었으나, `DataSourcePanel.tsx`가 이를 임포트하지 않고 동일 코드를 인라인으로 유지 중.

| 추출 파일 | DataSourcePanel.tsx 내 중복 위치 | 중복 내용 |
|-----------|--------------------------------|-----------|
| `dataSourceApi.ts` | L1~144 | `authHeaders`, `mapDs`, `fetchDataSources`, `createDataSource`, `testConnection`, `fetchDataSource`, `updateDataSource`, `deleteDataSource`, `fetchTables`, `previewData`, `executeRawQuery` |
| `dataSourceStyles.ts` | L146~330 | `styles` 객체 전체 |

**작업 순서:**

1. `DataSourcePanel.tsx` 상단에 임포트 추가:
```typescript
import {
  fetchDataSources, createDataSource, testConnection,
  fetchDataSource, updateDataSource, deleteDataSource,
  fetchTables, previewData, executeRawQuery,
} from './dataSourceApi';
import { styles } from './dataSourceStyles';
```

2. `DataSourcePanel.tsx`에서 중복 코드 삭제:
   - L1~144: 인라인 API 함수 전체 삭제
   - L146~330: 인라인 styles 객체 전체 삭제

3. `dataSourceApi.ts`와 `DataSourcePanel.tsx`의 함수 시그니처 일치 확인

**예상 결과:** DataSourcePanel.tsx가 1,321줄 → ~850줄로 감소

---

## Part B: 성능 이슈 수정

### #7. SandboxRunner MongoDB 연결 풀 미사용

**파일:** `packages/server/src/services/SandboxRunner.ts:210-255`

**문제:**
모든 MongoDB 연산에서 `new MongoClient()` → `connect()` → 쿼리 → `close()`를 반복.
이미 `MongoClientPool` 유틸이 존재하지만 SandboxRunner에서 사용하지 않음.

```typescript
// 현재 코드 (매번 새 연결)
const client = new MongoClient(info.connectionString);
try {
  await client.connect();
  const db = client.db(info.database);
  // ... 쿼리 실행
} finally {
  await client.close();
}
```

**수정 방안:**
```typescript
// MongoClientPool 활용
import { MongoClientPool } from '../utils/MongoClientPool';

const client = await MongoClientPool.getMongoClient(info.connectionString);
const db = client.db(info.database);
// ... 쿼리 실행
// close() 호출하지 않음 — 풀이 관리
```

**영향:** 이벤트 핸들러에서 MongoDB 쿼리 시 연결 지연 제거, 서버 부하 감소

---

### #8. DataSourceService 인스턴스별 캐시 분리

**파일:** `packages/server/src/services/DataSourceService.ts:25`

**문제:**
`dsCache`가 인스턴스 멤버로 선언되어 있고, `DataSourceService`가 라우트마다 별도 인스턴스로 생성됨:
- `routes/datasources.ts:12` → `new DataSourceService()`
- `routes/runtime.ts:36` → `new DataSourceService()`

두 인스턴스가 각각 별도 캐시를 유지하여 캐시 적중률이 절반으로 감소.

```typescript
// 현재 코드
class DataSourceService {
  private dsCache = new Map<string, { data: any; expiry: number }>();
  // ...
}
```

**수정 방안 (택 1):**

```typescript
// 옵션 A: static 캐시 (최소 변경)
class DataSourceService {
  private static dsCache = new Map<string, { data: any; expiry: number }>();
  // ...
}

// 옵션 B: 모듈 수준 싱글톤 (권장)
// DataSourceService.ts
const dataSourceService = new DataSourceService();
export default dataSourceService;

// 각 라우트에서:
import dataSourceService from '../services/DataSourceService';
```

**영향:** 캐시 적중률 향상, 불필요한 DB 쿼리 감소

---

### #9. EventEngine 매 이벤트마다 컨트롤 트리 3회 순회

**파일:** `packages/server/src/services/EventEngine.ts:94-109`

**문제:**
동일한 폼에 대해 이벤트가 발생할 때마다 컨트롤 트리를 3번 전체 순회:
```typescript
const { idToName, nameToId } = buildControlMaps(formDef.controls);     // 1회
const mongoConnectors = this.extractMongoConnectors(formDef.controls); // 2회
const swaggerConnectors = this.extractSwaggerConnectors(formDef.controls); // 3회
```

**수정 방안:**
```typescript
// 단일 순회로 통합
function analyzeControls(controls: ControlDefinition[]) {
  const idToName: Record<string, string> = {};
  const nameToId: Record<string, string> = {};
  const mongoConnectors: MongoConnectorInfo[] = [];
  const swaggerConnectors: SwaggerConnectorInfo[] = [];

  function walk(ctrls: ControlDefinition[]) {
    for (const ctrl of ctrls) {
      // buildControlMaps 로직
      idToName[ctrl.id] = ctrl.name;
      nameToId[ctrl.name] = ctrl.id;
      // extractMongoConnectors 로직
      if (ctrl.type === 'MongoDBConnector') { /* ... */ }
      // extractSwaggerConnectors 로직
      if (ctrl.type === 'SwaggerConnector') { /* ... */ }
      if (ctrl.children) walk(ctrl.children);
    }
  }
  walk(controls);
  return { idToName, nameToId, mongoConnectors, swaggerConnectors };
}
```

추가로, 폼 정의가 변경되지 않는 한 결과를 캐시할 수 있음:
```typescript
private controlAnalysisCache = new Map<string, { version: number; result: AnalysisResult }>();
```

**영향:** 이벤트 처리 시 CPU 사용량 ~66% 감소 (3회 → 1회 순회)

---

### #10. applyFontToAllForms N+1 DB 쓰기

**파일:** `packages/server/src/services/ProjectService.ts:167-197`

**문제:**
프로젝트의 모든 폼에 대해 개별 `save()` 호출:
```typescript
const forms = await Form.find({ projectId, deletedAt: null });
for (const form of forms) {
  // ... 속성 수정
  await form.save(); // 폼 N개 → N번의 DB 쓰기
}
```

**수정 방안:**
```typescript
// bulkWrite로 교체
const bulkOps = forms.map((form) => ({
  updateOne: {
    filter: { _id: form._id },
    update: {
      $set: {
        'properties.font': fontConfig,
        // 기타 변경 사항
      },
    },
  },
}));
await Form.bulkWrite(bulkOps);
```

**영향:** 프로젝트에 폼 20개 → DB 쓰기 20회 → 1회로 감소
