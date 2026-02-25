# WebForm 개선 계획

## 프로젝트 현황

| 항목 | 수치 |
|------|------|
| TypeScript/TSX 파일 | 302개 |
| 테스트 파일 | 73개 |
| 컨트롤 타입 | 45개 |
| API 엔드포인트 | 8개 라우트 그룹 |
| Mongoose 모델 | 6개 |

---

## 🔴 높은 우선순위 (즉시 수정 권장)

### 1. 테스트 실패 수정

`forms.integration.test.ts`에서 2~3개 테스트 실패:

- 버전 배열 길이 불일치 (예상 1, 실제 2)
- 중복 publish 시 409 대신 200 반환

**영향**: 폼 버전 관리 및 publish 상태 로직 버그

**위치**: `packages/server/src/__tests__/forms.integration.test.ts`

### 2. SSRF 취약점 — SandboxRunner HTTP 요청

사용자 코드에서 `ctx.http.get(url)` 호출 시 URL 검증 없음. 내부 `http://localhost:4000`이나 `http://169.254.169.254`(AWS 메타데이터) 등에 접근 가능.

**권장**: URL 화이트리스트 또는 내부 IP 차단 필터 추가

**위치**: `packages/server/src/services/SandboxRunner.ts`

### 3. WebSocket 인증 부재

`/ws/designer/:formId`, `/ws/runtime/:formId`에 JWT 인증 없음. formId만으로 누구나 폼 데이터 수신 가능.

**권장**: WebSocket 연결 시 토큰 검증 추가

**위치**: `packages/server/src/websocket/`

### 4. MongoDB 연결 풀링 미사용

`MongoDBAdapter`에서 매 쿼리마다 `new MongoClient()` → `client.close()`. 성능 저하 및 연결 풀 미활용.

**권장**: 연결 풀 재사용 또는 캐시된 클라이언트 패턴 적용

**위치**: `packages/server/src/services/adapters/MongoDBAdapter.ts`

---

## 🟡 중간 우선순위 (단기 개선)

### 5. 동시 편집 충돌 해결 없음

`FormService.updateForm()`에 낙관적 잠금(Optimistic Locking) 없음. 여러 디자이너가 같은 폼 편집 시 마지막 저장만 유지.

**권장**: `version` 필드 기반 충돌 감지 구현

**위치**: `packages/server/src/services/FormService.ts`

### 6. 에러 처리 및 사용자 피드백 부족

- **Designer**: 저장 실패 시 3초 토스트만 표시, 상세 에러 없음
- **Runtime**: 데이터소스 로드 실패 시 조용히 실패 (UI 피드백 없음)
- **Server**: DataSourceService 에러 로깅 부재

**권장**: 에러 토스트 개선, 재시도 메커니즘, 상세 에러 메시지

**위치**:
- `packages/designer/src/App.tsx`
- `packages/runtime/src/stores/runtimeStore.ts`
- `packages/server/src/services/DataSourceService.ts`

### 7. 대용량 데이터 성능

- **DataGridView**: 가상화 없음 — 수천 행에서 모든 DOM 생성
- **Designer Canvas**: O(n²) 스냅라인 계산 — 컨트롤 500+ 시 느림
- **historyStore**: JSON.stringify 기반 스냅샷 — 큰 폼에서 오버헤드

**권장**: `react-window` 적용, 스냅라인 공간 인덱싱, 구조적 스냅샷

**위치**:
- `packages/runtime/src/controls/DataGridView.tsx`
- `packages/designer/src/components/Canvas/DesignerCanvas.tsx`
- `packages/designer/src/stores/historyStore.ts`

### 8. 메모리 누수 위험

- **Designer**: `document.addEventListener` 반복 등록 가능성 (CanvasControl mousedown)
- **Runtime**: 폼 전환 시 `dataSourceData` 미정리, WebSocket 리스너 누적 가능

**권장**: useEffect cleanup 보강, 폼 언마운트 시 상태 초기화

**위치**:
- `packages/designer/src/components/Canvas/CanvasControl.tsx`
- `packages/runtime/src/stores/runtimeStore.ts`
- `packages/runtime/src/communication/wsClient.ts`

### 9. 선택 상태 불일치 (Designer)

컨트롤 삭제 시 `selectedIds`(selectionStore)가 자동 정리 안 됨. 삭제된 ID 참조로 오류 발생 가능.

**권장**: `removeControl` 시 selectedIds 동기 정리

**위치**:
- `packages/designer/src/stores/designerStore.ts`
- `packages/designer/src/stores/selectionStore.ts`

### 10. FormService 트랜잭션 부재

폼 + 버전 저장이 atomic이 아님. 부분 저장 가능.

**권장**: MongoDB 트랜잭션 또는 최소한 에러 롤백 로직

**위치**: `packages/server/src/services/FormService.ts`

---

## 🟢 낮은 우선순위 (장기 개선)

### 11. 접근성(A11Y) 전무

Designer 전체에 ARIA 속성 0개, 키보드 네비게이션 미지원, 스크린 리더 지원 없음.

**권장**: 주요 UI에 role, aria-label, 포커스 관리 추가

**위치**: `packages/designer/src/components/`

### 12. 타입 안전성 개선 (common 패키지)

- `UIPatch.payload`: `Record<string, unknown>` → discriminated union으로 개선
- `ControlProxy`: `[key: string]: unknown` → 공통 속성 타입 추가
- `EventArgs`: 컨트롤별 이벤트 인자 타입 미구분

**위치**: `packages/common/src/types/`

### 13. 대형 파일 분리

- `EventEditor.tsx`: 2,350줄 → 에디터/디버그패널/타입생성 분리
- `PropertyPanel.tsx`: 800줄 → Shell 모드 분리
- `controlProperties.ts`: 7,000줄 → 컨트롤 타입별 파일 분리

**위치**:
- `packages/designer/src/components/EventEditor/EventEditor.tsx`
- `packages/designer/src/components/PropertyPanel/PropertyPanel.tsx`
- `packages/designer/src/components/PropertyPanel/controlProperties.ts`

### 14. CI/CD 및 배포 인프라 부재

Docker 파일 없음, GitHub Actions 없음, `.env` 관리 없음 (vitest.config에 하드코딩).

**권장**: Dockerfile, CI 파이프라인, `.env.example` 추가

### 15. 테스트 커버리지 확대

| 패키지 | 현재 | 미테스트 영역 |
|--------|------|--------------|
| common | 66개 | 양호 |
| server | 222개 (3 실패) | WebSocket, 동시성, RestAPI 어댑터 |
| designer | 31개 파일 | Canvas 드래그, EventEditor, 통합 테스트 |
| runtime | 142개 | 40+ 개별 컨트롤, E2E |

### 16. 감사 로그 (Audit Log)

이벤트 실행, 폼 수정, 데이터소스 접근 기록 없음.

**권장**: 최소한 폼 변경 이력과 이벤트 실행 로그 저장

---

## 잘 구현된 부분

- **샌드박스 격리** — isolated-vm 기반 사용자 코드 실행, 메모리/타임아웃 제한
- **입력 검증** — Zod 스키마 + MongoDB 쿼리 주입 방지 (sanitizeQueryInput)
- **암호화** — AES-256-CBC로 데이터소스 connectionString 보호
- **상태 관리** — Zustand + Immer 패턴, 깔끔한 스토어 구조
- **SDUI 아키텍처** — JSON → React 변환, 패치 기반 실시간 업데이트
- **버전 히스토리** — 폼 변경 자동 기록, 스냅샷 복원 가능
- **테마 시스템** — 21개 토큰 카테고리, 계층적 테마 적용
- **소프트 삭제** — 모든 엔티티 안전 삭제
- **common 패키지** — 의존성 없는 타입 정의, 66개 테스트 통과

---

## 권장 실행 순서

| 순서 | 항목 | 예상 난이도 | 영향도 |
|------|------|-----------|--------|
| 1 | 테스트 실패 수정 (#1) | 낮음 | 높음 |
| 2 | SSRF URL 필터링 (#2) | 낮음 | 높음 |
| 3 | WebSocket 인증 (#3) | 중간 | 높음 |
| 4 | MongoDB 연결 풀링 (#4) | 중간 | 높음 |
| 5 | 에러 처리 개선 (#6) | 중간 | 중간 |
| 6 | 낙관적 잠금 (#5) | 중간 | 중간 |
| 7 | 메모리 누수 수정 (#8) | 낮음 | 중간 |
| 8 | 대용량 성능 (#7) | 높음 | 중간 |
| 9 | CI/CD 구축 (#14) | 중간 | 중간 |
| 10 | 접근성 (#11) | 높음 | 낮음 |
