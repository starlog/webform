# CTX 보안 모델 — 스크립트 실행 환경

## 개요

WebForm은 사용자가 작성한 이벤트 핸들러 코드를 **서버 측에서 안전하게 실행**하기 위해 `isolated-vm` 기반 샌드박스를 사용한다. 사용자 코드는 호스트 Node.js 프로세스와 완전히 격리된 V8 컨텍스트에서 실행되며, 시스템이 주입하는 `ctx` 객체를 통해서만 외부와 상호작용할 수 있다.

---

## 실행 흐름

```
1. 클라이언트 UI 이벤트 발생
2. Runtime → POST /api/runtime/forms/:id/events (EventRequest 전송)
3. EventEngine: 발행된(published) 폼에서 server 핸들러 조회
4. SandboxRunner: isolated-vm Isolate 생성 → 격리된 V8 컨텍스트 확보
5. TypeScript → JavaScript 트랜스파일
6. ctx 객체 주입 + 사용자 코드를 래퍼 함수로 감싸서 실행
7. 실행 결과(속성 변경, 다이얼로그, 네비게이션 등) → UIPatch 배열로 반환
8. 클라이언트 UI 패치 적용
```

### 코드 처리 파이프라인

| 단계 | 설명 |
|------|------|
| TypeScript 트랜스파일 | 타입 어노테이션 제거, ES2020 타겟 |
| 코드 인스트루멘테이션 | 디버그 모드 시에만 적용 (라인별 추적 삽입) |
| 래퍼 코드 생성 | `(function(ctx) { /* 사용자 코드 */ })(__ctx__)` 형태로 감싸기 |
| 변경 추적 | 실행 전 스냅샷 → 실행 후 비교 → 변경된 속성만 추출 |

---

## 리소스 제한

| 항목 | 기본값 | 환경변수 |
|------|--------|----------|
| 실행 시간 제한 | 5,000ms | `SANDBOX_TIMEOUT_MS` |
| 메모리 제한 | 128MB | `SANDBOX_MEMORY_LIMIT_MB` |
| HTTP 요청 타임아웃 | 10,000ms | (고정) |
| MongoDB 쿼리 타임아웃 | 10,000ms | (컨트롤별 설정) |
| MongoDB 최대 결과 수 | 1,000건 | (컨트롤별 `maxResultCount`) |

- 실행 시간 초과 시 즉시 종료된다.
- 메모리 한도 초과 시 Isolate가 강제 종료된다.
- 각 실행마다 새로운 Isolate를 생성하며, 실행 간 상태가 공유되지 않는다.

---

## 차단된 전역 객체

사용자 코드에서 다음 전역 식별자는 **사용할 수 없다** (undefined로 덮어씌움):

| 식별자 | 차단 사유 |
|--------|-----------|
| `process` | Node.js 프로세스 제어 차단 |
| `require` | 모듈 로딩 차단 |
| `Function` | 동적 코드 생성 차단 |
| `eval` | 동적 코드 실행 차단 (디버그 모드에서는 허용) |
| `__dirname`, `__filename` | 파일 시스템 정보 노출 차단 |
| `module`, `exports` | 모듈 시스템 접근 차단 |
| `globalThis` | 호스트 전역 객체 접근 차단 |
| `setTimeout`, `setInterval` | 비동기 타이머 차단 |
| `setImmediate`, `queueMicrotask` | 비동기 실행 차단 |

---

## ctx 객체 — 허용된 작업

`ctx`는 사용자 코드가 시스템과 상호작용하는 **유일한 인터페이스**이다.

### 컨트롤 속성 읽기/쓰기

```javascript
// 읽기
const text = ctx.controls.btnSubmit.text;

// 쓰기 — 실행 완료 후 변경 사항이 UIPatch로 변환
ctx.controls.btnSubmit.text = "클릭됨";
ctx.controls.txtName.visible = false;
```

- 컨트롤은 이름(name)으로 접근한다.
- 속성 변경은 실행 전후 스냅샷 비교로 감지하여 `updateProperty` 오퍼레이션을 생성한다.

### UI 다이얼로그

```javascript
ctx.showMessage("저장 완료", "알림", "info");
// type: "info" | "warning" | "error"
```

### 폼 네비게이션

```javascript
ctx.navigate("targetFormId", { key: "value" });
```

### 라디오 그룹 값 조회

```javascript
const selected = ctx.getRadioGroupValue("groupName");
```

### 이벤트 정보

```javascript
ctx.sender;     // 이벤트를 발생시킨 컨트롤 이름
ctx.eventArgs;  // 이벤트 인자 (예: 선택된 값)
ctx.formId;     // 현재 폼 ID
```

### 콘솔 로깅

```javascript
console.log("디버그 메시지");
console.warn("경고");
console.error("에러");
console.info("정보");
```

- 모든 콘솔 출력은 캡처되어 실행 결과의 `logs` 배열에 포함된다.
- 호스트 프로세스의 콘솔에 직접 출력되지 않는다.

### HTTP 요청

```javascript
const res = await ctx.http.get(url);
const res = await ctx.http.post(url, body);
const res = await ctx.http.put(url, body);
const res = await ctx.http.patch(url, body);
const res = await ctx.http.delete(url);
// 반환: { status, ok, data }
```

| 제약 사항 | 설명 |
|-----------|------|
| 허용 메서드 | GET, POST, PUT, PATCH, DELETE만 가능 |
| 커스텀 헤더 | 불가 — Content-Type은 자동으로 `application/json` 설정 |
| 요청 타임아웃 | 10초 |
| 파일 업로드 | 불가 |
| 인증 헤더 | 직접 설정 불가 |

### MongoDB 작업 (MongoDBConnector 컨트롤 경유)

폼에 MongoDBConnector 컨트롤이 정의되어 있을 때만 사용 가능하다.

```javascript
await ctx.controls.myDB.find(collection, filter);
await ctx.controls.myDB.findOne(collection, filter);
await ctx.controls.myDB.insertOne(collection, doc);
await ctx.controls.myDB.updateOne(collection, filter, update);
await ctx.controls.myDB.deleteOne(collection, filter);
await ctx.controls.myDB.count(collection, filter);
```

| 제약 사항 | 설명 |
|-----------|------|
| 허용 작업 | find, findOne, insertOne, updateOne, deleteOne, count만 가능 |
| 집계(aggregation) | 불가 |
| 원시 명령(raw command) | 불가 |
| 연결 문자열 | 컨트롤 속성에 정의됨 (사용자 코드에서 직접 접근 불가) |
| 결과 수 제한 | 컨트롤별 `maxResultCount` (기본 1,000건) |
| 쿼리 타임아웃 | 컨트롤별 `queryTimeout` (기본 10,000ms) |
| 연결 수명 | 각 작업마다 새로 생성, 완료 후 즉시 종료 |

### Shell 모드 전용 (앱 프레임 실행 시)

Shell 모드에서는 추가 API가 제공된다:

```javascript
ctx.navigateBack();                          // 이전 폼으로 돌아가기
ctx.navigateReplace("formId", params);       // 현재 폼 교체
ctx.closeApp();                              // 앱 종료
ctx.currentFormId;                           // 현재 표시 중인 폼 ID
ctx.params;                                  // 네비게이션 파라미터
ctx.appState;                                // 앱 전역 상태 (읽기/쓰기)
```

---

## 허용되지 않는 작업

| 분류 | 상세 |
|------|------|
| 파일 시스템 | 읽기/쓰기/삭제 등 모든 파일 작업 불가 |
| 네트워크 소켓 | 직접 TCP/UDP 소켓 생성 불가 (HTTP만 ctx.http 경유) |
| 프로세스 제어 | 프로세스 생성/종료/시그널 전송 불가 |
| 모듈 로딩 | require, import 등 외부 라이브러리 사용 불가 |
| 동적 코드 실행 | eval, new Function 불가 (디버그 모드 eval 제외) |
| 비동기 타이머 | setTimeout, setInterval, setImmediate 불가 |
| 호스트 접근 | Node.js API, 호스트 전역 변수 접근 불가 |
| DB 직접 연결 | 연결 문자열 지정 불가 (컨트롤 설정만 사용) |
| DB 관리 명령 | createCollection, dropDatabase 등 관리 작업 불가 |
| 무한 실행 | 5초 타임아웃 초과 시 강제 종료 |
| 과도한 메모리 | 128MB 초과 시 Isolate 강제 종료 |

---

## 보안 경계 요약

```
┌─────────────────────────────────────────────┐
│              호스트 (Node.js)                │
│                                             │
│  EventEngine ─── SandboxRunner              │
│       │              │                      │
│       │         ┌────┴────┐                 │
│       │         │ isolated │                │
│       │         │   -vm    │                │
│       │         │ Isolate  │                │
│       │         │          │                │
│       │         │ ┌──────┐ │                │
│       │         │ │ 사용자│ │                │
│       │         │ │ 코드  │ │ ←─ 격리된 V8  │
│       │         │ └──┬───┘ │    컨텍스트    │
│       │         │    │     │                │
│       │         │   ctx    │ ←─ 유일한      │
│       │         │  (주입)  │    외부 접점   │
│       │         └────┬────┘                 │
│       │              │                      │
│       ▼              ▼                      │
│  UIPatch[]     HTTP / MongoDB               │
│  (클라이언트    (제한된 외부 통신)            │
│   UI 업데이트)                               │
└─────────────────────────────────────────────┘
```

### 핵심 원칙

1. **완전 격리**: 사용자 코드는 isolated-vm의 별도 V8 컨텍스트에서 실행되어 호스트 Node.js에 직접 접근할 수 없다.
2. **최소 권한**: ctx 객체를 통해 명시적으로 허용된 작업만 수행 가능하다.
3. **데이터 복사**: 모든 데이터는 `ExternalCopy`를 통해 격리 경계를 넘나들며, 참조 공유가 불가능하다.
4. **실행 격리**: 매 실행마다 새 Isolate를 생성하여 실행 간 상태 누출이 없다.
5. **리소스 제한**: 시간(5초)과 메모리(128MB) 제한으로 리소스 남용을 방지한다.

---

## 관련 소스 코드

| 파일 | 역할 |
|------|------|
| `packages/server/src/services/SandboxRunner.ts` | 샌드박스 격리 실행, ctx 객체 주입, 변경 추적 |
| `packages/server/src/services/EventEngine.ts` | 이벤트 라우팅, 실행 컨텍스트 구성 |
| `packages/server/src/services/CodeInstrumenter.ts` | 디버그 모드 코드 인스트루멘테이션 |
| `packages/server/src/config/index.ts` | 타임아웃, 메모리 제한 등 환경 설정 |
| `packages/server/src/routes/runtime.ts` | Runtime API 엔드포인트 |
| `packages/common/src/types/events.ts` | EventRequest, EventResponse 타입 |
| `packages/common/src/types/protocol.ts` | UIPatch 오퍼레이션 타입 |
