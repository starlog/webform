# WebForm 개선 계획 (Phase 2)

IMPROVEMENTS.md의 후속 분석으로, 전체 4개 패키지(common, server, designer, runtime) + 루트 구성을 심층 분석하여 도출한 개선사항입니다.

## 프로젝트 현황 (업데이트)

| 항목 | 수치 |
|------|------|
| TypeScript/TSX 파일 | 310개 |
| 테스트 파일 | 82개 (26.5%) |
| 컨트롤 타입 | 45개 |
| 총 코드 라인 | ~32,000줄 |
| API 라우트 그룹 | 8개 |
| Mongoose 모델 | 6개 |

---

## 🔴 Critical — 즉시 수정 (1~2주)

### 1. 클라이언트 코드 실행 보안 (`new Function`)

Runtime에서 사용자 이벤트 핸들러 코드를 `new Function()`으로 실행. XSS 및 코드 주입 공격에 노출, CSP 위반.

```typescript
// 현재 — 위험
const fn = new Function('sender', 'e', 'ctx', evt.handlerCode);
fn(sender, eventArgs, ctx);
```

**권장**: Web Worker 또는 iframe 샌드박스 도입, 서버 핸들러 우선 사용 유도

**위치**:
- `packages/runtime/src/hooks/useEventHandlers.ts:78`
- `packages/runtime/src/renderer/SDUIRenderer.tsx:66`

### 2. 리소스 소유권/접근 제어 부재

모든 API에서 `req.user.sub`(사용자 ID)를 저장만 하고, 리소스 접근 시 소유자 검증 없음. 어떤 사용자든 다른 사용자의 폼/프로젝트 수정 가능.

```typescript
// 현재 — createdBy를 저장만 함
const form = await Form.findById(id);
// ❌ form.createdBy === req.user.sub 검증 없음
```

**권장**: 모든 CRUD API에 리소스 소유자 검증 미들웨어 추가

**위치**:
- `packages/server/src/services/FormService.ts:77-82`
- `packages/server/src/services/ProjectService.ts:65-70`
- `packages/server/src/routes/forms.ts`
- `packages/server/src/routes/projects.ts`
- `packages/server/src/routes/datasources.ts`

### 3. SandboxRunner MongoDB 커넥터 코드 주입

템플릿 리터럴로 `controlName`이 생성 코드에 직접 주입됨. 악의적인 컨트롤 이름으로 임의 코드 실행 가능.

```typescript
// 현재 — 위험
ctx.controls['${mc.controlName}'] = ctx.controls['${mc.controlName}'] || {};
```

**권장**: 템플릿 리터럴 제거, JSON.stringify 이스케이프 또는 안전한 매핑 테이블 사용

**위치**: `packages/server/src/services/SandboxRunner.ts:422-441`

### 4. debugMode에서 eval 차단 해제

`debugMode=true` 시 `eval()` 차단이 해제되어 샌드박스 우회 경로 생성.

**권장**: production 환경에서 debugMode 완전 차단, 관리자 권한만 허용

**위치**: `packages/server/src/services/SandboxRunner.ts:128-131`

### 5. WebSocket 토큰 URL 파라미터 노출

JWT 토큰이 URL 쿼리 파라미터로 전달되어 서버 로그, 프록시 기록, 브라우저 히스토리에 남음.

```typescript
// 현재 — 토큰이 URL에 노출
const token = url.searchParams.get('token');
```

**권장**: 첫 메시지 기반 인증 또는 Sec-WebSocket-Protocol 헤더 활용

**위치**: `packages/server/src/websocket/auth.ts:15`

### 6. insertOne 파라미터 버그

SandboxRunner의 MongoDB insertOne에서 `filter`를 document로 사용하는 버그.

```typescript
// 현재 — 버그
col.insertOne(filter);  // filter가 아니라 arg1(document)이어야 함
```

**위치**: `packages/server/src/services/SandboxRunner.ts:198`

---

## 🟡 High — 단기 개선 (2~4주)

### 7. PropertyPanel 거대 컴포넌트 분할

781줄 단일 컴포넌트에 getValue/handleValueChange 패턴 5회 중복, 카테고리 그룹화 로직 3회 반복.

**권장**:
- `FormPropertyEditor`, `ControlPropertyEditor`, `ShellPropertyEditor`, `EventsEditor`로 분할
- `resolveNestedValue()`, `applyNestedValue()`, `groupPropertiesByCategory()` 헬퍼 추출

**위치**: `packages/designer/src/components/PropertyPanel/PropertyPanel.tsx`

### 8. React 렌더링 최적화

| 문제 | 위치 | 권장 |
|------|------|------|
| CanvasControl에 React.memo 미적용 | `designer/Canvas/CanvasControl.tsx` | `React.memo` + custom comparator |
| App.tsx 9개 상태로 전체 리렌더링 | `designer/App.tsx` (553줄) | 상태 분리 또는 컴포넌트 분할 |
| useDataBinding 매 렌더링 재계산 | `runtime/hooks/useDataBinding.ts` | 메모이제이션 강화 |
| onSnaplineChange/onContextMenu 미메모이제이션 | `designer/Canvas/DesignerCanvas.tsx:391-401` | useCallback 적용 |
| ControlPreview 비메모이제이션 | `designer/Canvas/CanvasControl.tsx:36-74` | React.memo 적용 |

### 9. ErrorBoundary 추가

Designer와 Runtime 모두 에러 경계 없음. 컴포넌트 렌더링 중 예외 발생 시 전체 앱 크래시.

**권장**:
- 루트 레벨 전역 ErrorBoundary
- Canvas, PropertyPanel, EventEditor 등 패널별 ErrorBoundary
- Runtime FormContainer, ShellRenderer별 ErrorBoundary

**위치**:
- `packages/designer/src/App.tsx`
- `packages/runtime/src/App.tsx`

### 10. WebSocket Exponential Backoff

Runtime WebSocket이 고정 5초 간격으로 재연결. 서버 장애 시 과도한 요청 발생.

```typescript
// 현재 — 고정 5초
this.reconnectTimer = setTimeout(() => {
  if (this.currentPath === pathAtConnect) reconnect();
}, 5000);
```

**권장**: 지수 백오프 (5s → 10s → 20s → 60s cap) + 최대 재연결 시도 제한

**위치**: `packages/runtime/src/communication/wsClient.ts:71-75`

### 11. REST API 어댑터 보안 강화

| 문제 | 위치 | 권장 |
|------|------|------|
| HTTP 메서드 미검증 | `RestApiAdapter.ts:39-50` | 허용 메서드 화이트리스트 (GET, POST, PUT, PATCH, DELETE) |
| URL 경로 조작 가능 | `RestApiAdapter.ts:46` | path 검증, `../` 패턴 거부 |
| WebSocket Origin 미검증 | `websocket/index.ts` | CORS Origin 화이트리스트 |

**위치**: `packages/server/src/services/adapters/RestApiAdapter.ts`

### 12. SandboxRunner MongoDB 연결 풀 미사용

SandboxRunner의 mongoHandler가 MongoClientPool을 사용하지 않고 매번 새 연결 생성.

**권장**: `getMongoClient()` 풀 활용

**위치**: `packages/server/src/services/SandboxRunner.ts:178`

### 13. 프로덕션 에러 로깅 시스템

Runtime 전반에 15개의 `console.warn/console.error` 호출만 사용. 프로덕션 환경에서 에러 추적/모니터링 불가능.

**권장**:
- 중앙 집중식 에러 로깅 서비스 도입 (Sentry, LogRocket 등)
- 에러 발생 시 사용자 UI 피드백 표시

**위치**: `packages/runtime/` 전반

---

## 🟠 Medium — 중기 개선 (1~2개월)

### 14. Discriminated Union 타입 도입

`Record<string, unknown>` 남용으로 타입 안전성 부족.

```typescript
// 현재 — 느슨한 타입
interface ControlDefinition {
  type: ControlType;
  properties: Record<string, unknown>;
}

// 권장 — 타입별 속성 정의
type ControlDefinition =
  | { type: 'Button'; properties: ButtonProperties }
  | { type: 'TextBox'; properties: TextBoxProperties }
  | { type: 'DataGridView'; properties: DataGridViewProperties };
```

**적용 대상**:
- `ControlDefinition.properties` → 컨트롤별 인터페이스
- `UIPatch.payload` → patch type별 payload 분리
- `EventArgs` → 이벤트별 인자 타입 정의

**위치**: `packages/common/src/types/`

### 15. FormProperties / ShellProperties 중복 제거

두 타입이 대부분 동일한 필드를 가지며 독립적으로 정의됨.

```typescript
// 권장 — 공통 기본 타입 추출
interface BaseWindowProperties {
  title: string;
  width: number;
  height: number;
  backgroundColor: string;
  font: FontDefinition;
  formBorderStyle: FormBorderStyle;
  maximizeBox: boolean;
  minimizeBox: boolean;
  windowState?: 'Normal' | 'Maximized';
  theme?: ThemeId;
}

interface FormProperties extends BaseWindowProperties {
  startPosition: 'CenterScreen' | 'Manual' | 'CenterParent';
  themeColorMode?: 'theme' | 'control';
}

interface ShellProperties extends BaseWindowProperties {
  showTitleBar: boolean;
}
```

**위치**:
- `packages/common/src/types/form.ts`
- `packages/common/src/types/shell.ts`

### 16. Zod 스키마 강화

| 문제 | 위치 | 권장 |
|------|------|------|
| 재귀적 control 구조 깊이 무제한 | `formValidator.ts:37-52` | 최대 깊이(10) 제한 추가 |
| executeQuerySchema `.passthrough()` | `datasourceValidator.ts:80` | 명시적 필드 스키마로 변경 |
| DataSourceService 정규식 ReDoS | `DataSourceService.ts:108` | 검색 입력 크기/복잡도 제한 |

### 17. 패키지 간 코드 중복 제거

| 중복 대상 | designer | runtime | 권장 |
|---------|----------|---------|------|
| 컨트롤 registry | `controls/registry.ts` | `controls/registry.ts` | common으로 이동 |
| 레이아웃 계산 | 별도 구현 | `layoutUtils.ts` | common으로 통합 |
| 리사이즈 로직 | `ResizeHandle.tsx` | `useFormResize.tsx` | 공통 훅 추출 |

### 18. designerStore 리팩터링

594줄의 단일 스토어에 44개 메서드. `isDirty = true` 반복 패턴.

**권장**:
- 도메인별 슬라이스 분리 (controls, events, shell)
- `isDirty` 설정을 Immer 미들웨어 레벨에서 자동화
- `moveControl` vs `moveControls` 등 중복 메서드 통합

**위치**: `packages/designer/src/stores/designerStore.ts`

### 19. historyStore 메모리 최적화

스냅샷이 `[...controls]` 얕은 복사로 구조적 공유 부족. 대규모 폼에서 메모리 낭비.

**권장**: 구조적 공유(structural sharing) 또는 diff 기반 스냅샷

**위치**: `packages/designer/src/stores/historyStore.ts`

---

## 🟢 Low — 장기 개선 (지속)

### 20. 접근성 강화

| 문제 | 위치 | 권장 |
|------|------|------|
| 모달 포커스 트래핑 없음 | `designer/App.tsx:496-550` | focus-trap 라이브러리 도입 |
| Runtime aria 속성 거의 없음 | `runtime/controls/` 전반 | aria-label, aria-describedby 추가 |
| 키보드 리사이징 미지원 | `runtime/useFormResize.tsx` | 화살표 키 리사이즈 지원 |
| 비활성 항목 색상 대비 부족 | `#bbb` 텍스트 | WCAG AA 기준(4.5:1) 충족 |

### 21. 테스트 커버리지 확대

| 미테스트 영역 | 패키지 | 우선순위 |
|-------------|--------|---------|
| REST API 어댑터 | server | 높음 |
| 권한/접근 제어 | server | 높음 |
| flattenControls / nestControls | common | 중간 |
| WebSocket 재연결 | runtime | 중간 |
| 대규모 폼 성능 벤치마크 | 전체 | 낮음 |
| 접근성 테스트 | runtime | 낮음 |

### 22. CI/CD 개선

| 항목 | 현재 | 권장 |
|------|------|------|
| 테스트 커버리지 리포트 | 미구성 | Vitest coverage 리포팅 추가 |
| Docker 이미지 푸시 | 미구성 | 레지스트리 배포 파이프라인 |
| 성능 모니터링 | 미구성 | Lighthouse CI 또는 커스텀 벤치마크 |

### 23. TypeScript 트랜스파일 에러 폴백

SandboxRunner에서 TypeScript 트랜스파일 실패 시 원본 코드를 그대로 사용.

**권장**: 트랜스파일 실패 시 명확한 에러 반환, 원본 실행 방지

**위치**: `packages/server/src/services/SandboxRunner.ts:52-62`

---

## IMPROVEMENTS.md 대비 해결된 항목

| IMPROVEMENTS.md 항목 | 상태 | 비고 |
|---------------------|------|------|
| #2 SSRF 취약점 | ✅ 해결됨 | `validateSandboxUrl.ts` 추가, 내부 IP 차단, DNS rebinding 방어 |
| #3 WebSocket 인증 | ✅ 해결됨 | JWT 토큰 검증 추가 (URL 파라미터 방식 → 본 문서 #5에서 개선 권장) |
| #4 MongoDB 연결 풀링 | ✅ 부분 해결 | `MongoClientPool.ts` 추가, SandboxRunner는 미적용 (본 문서 #12) |
| #8 메모리 누수 | ✅ 부분 해결 | runtimeStore 초기화 개선, 테스트 추가 |
| #11 접근성 | ✅ 부분 해결 | Designer에 ARIA 속성 추가, 키보드 네비게이션 개선 |
| #14 CI/CD | ✅ 해결됨 | GitHub Actions, Dockerfile, docker-compose.yml 추가 |

---

## 잘 구현된 부분 (신규 발견)

- **SSRF 방어** — `validateSandboxUrl.ts`로 로컬호스트, 내부 IP, AWS 메타데이터 차단, DNS rebinding 방어
- **환경 변수 검증** — Zod 기반 `config/index.ts`, JWT_SECRET 최소 32자, ENCRYPTION_KEY 64자 강제
- **에러 핸들러** — 스택 트레이스 미노출, requestId 추적, Zod 에러 400 변환
- **Graceful shutdown** — 서버 종료 시 MongoDB/Redis 연결 정리
- **테마 시스템** — 45개 이상 토큰, 계층적 적용, 프리셋 지원
- **Snapline 최적화** — 인덱스 기반 이진 탐색 (CanvasControl)
- **데이터 바인딩** — oneWay, oneTime, twoWay, selectedRow 4가지 모드 지원
- **MongoClientPool** — 연결 문자열 기반 캐싱으로 재사용 최적화
- **CI 파이프라인** — lint → format → typecheck → test → docker build 완전 자동화

---

## 권장 실행 순서

| 순서 | 항목 | 난이도 | 영향도 | 카테고리 |
|------|------|--------|--------|---------|
| 1 | `new Function` 제거 (#1) | 높음 | 🔴 Critical | 보안 |
| 2 | 리소스 소유권 검증 (#2) | 중간 | 🔴 Critical | 보안 |
| 3 | 코드 주입 수정 (#3) | 낮음 | 🔴 Critical | 보안 |
| 4 | insertOne 버그 수정 (#6) | 낮음 | 🔴 Critical | 버그 |
| 5 | debugMode eval 차단 (#4) | 낮음 | 🔴 Critical | 보안 |
| 6 | WS 토큰 노출 개선 (#5) | 중간 | 🔴 Critical | 보안 |
| 7 | ErrorBoundary 추가 (#9) | 낮음 | 🟡 High | 안정성 |
| 8 | PropertyPanel 분할 (#7) | 중간 | 🟡 High | 코드 품질 |
| 9 | React 렌더링 최적화 (#8) | 중간 | 🟡 High | 성능 |
| 10 | WS Exponential Backoff (#10) | 낮음 | 🟡 High | 안정성 |
| 11 | REST 어댑터 보안 (#11) | 낮음 | 🟡 High | 보안 |
| 12 | 에러 로깅 시스템 (#13) | 중간 | 🟡 High | 운영 |
| 13 | Discriminated Union (#14) | 높음 | 🟠 Medium | 타입 |
| 14 | 코드 중복 제거 (#17) | 중간 | 🟠 Medium | 코드 품질 |
| 15 | 접근성 강화 (#20) | 높음 | 🟢 Low | UX |
| 16 | 테스트 확대 (#21) | 중간 | 🟢 Low | 품질 |
