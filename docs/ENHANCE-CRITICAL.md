# ENHANCE-CRITICAL: 즉시 수정 필요 (보안 + 버그)

## #1. MongoDB 연결 문자열 SSRF 취약점

**파일:** `packages/server/src/services/SandboxRunner.ts:200-258`

**문제:**
`MongoConnectorInfo.connectionString`이 폼 정의에서 직접 가져와 검증 없이 `new MongoClient()`에 전달됨.
HTTP 요청에는 `validateSandboxUrl()`이 적용되지만 MongoDB 연결 문자열에는 내부 주소 검증이 없음.

**공격 시나리오:**
사용자가 `mongodb://127.0.0.1:27017/webform`을 연결 문자열로 설정하면 서버 내부 DB에 직접 접근 가능.

**수정 방안:**
```typescript
// SandboxRunner.ts — MongoClient 생성 전에 검증 추가
function validateMongoConnectionString(connectionString: string): void {
  const url = new URL(connectionString);
  const hostname = url.hostname;
  // 내부 주소 차단: loopback, private IP, link-local
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname.startsWith('192.168.')
  ) {
    throw new Error(`Internal address not allowed: ${hostname}`);
  }
}
```

**영향 범위:** 보안 — SSRF를 통한 내부 데이터베이스 무단 접근

---

## #2. URL Fragment 토큰 누출

**파일:** `packages/server/src/routes/googleAuth.ts:184`

**문제:**
OAuth 콜백에서 `res.redirect(`${redirectUrl}#auth_token=${runtimeToken}`)` 방식으로 토큰 전달.
- 브라우저 히스토리에 토큰 노출
- Referrer 헤더를 통해 제3자 서비스에 누출 가능
- 브라우저 탭 공유 시 토큰 유출

**수정 방안:**
```typescript
// 옵션 A: httpOnly 쿠키 사용 (권장)
res.cookie('runtime_auth_token', runtimeToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 1일
});
res.redirect(redirectUrl.toString());

// 옵션 B: 서버사이드 임시 코드 교환 (Authorization Code 패턴)
// 1) 임시 코드 생성 후 redirect에 query param으로 전달
// 2) 클라이언트가 코드를 서버에 POST하여 실제 토큰 수신
```

**영향 범위:** 보안 — 인증 토큰 제3자 누출

---

## #3. graphViewProps 속성 중복 정의 (UI 버그)

**파일:** `packages/designer/src/components/PropertyPanel/controlProperties.ts:222-233`

**문제:**
`properties.graphType`이 동일한 `name`으로 2번 등록됨 (label만 다름: `GraphType` / `Data Format`).
PropertyPanel에서 동일 속성이 두 행으로 렌더링되며, 하나를 변경하면 다른 것도 같이 변경되는 혼란 유발.

```typescript
// 현재 코드 (버그)
const graphViewProps: PropertyMeta[] = withCommon(
  { name: 'properties.graphType', label: 'GraphType', ... },   // 222줄
  // ... 중간 생략 ...
  { name: 'properties.graphType', label: 'Data Format', ... }, // 233줄 — 동일 name 중복!
);
```

**수정 방안:**
두 번째 항목이 의도한 속성 이름을 확인 후 교체. 예:
```typescript
{ name: 'properties.dataFormat', label: 'Data Format', ... } // 별도 속성으로 분리
```
또는 중복 항목 자체를 제거.

**영향 범위:** 버그 — GraphView 컨트롤 속성 편집 시 혼란

---

## #4. popFormHistory 비원자적 상태 접근 (Race Condition)

**파일:** `packages/runtime/src/stores/runtimeStore.ts:379-387`

**문제:**
`get()`으로 상태를 읽은 후 별도의 `set()` 호출에서 mutate. 두 호출 사이에 다른 상태 변경이 끼어들 수 있음.

```typescript
// 현재 코드 (비원자적)
popFormHistory: () => {
  const history = get().formHistory;        // 1) 읽기
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  set((state) => {                          // 2) 쓰기 — 1)과 2) 사이에 gap 존재
    state.formHistory.pop();
  });
  return last;
},
```

**수정 방안:**
```typescript
popFormHistory: () => {
  let last: FormHistoryEntry | null = null;
  set((state) => {
    if (state.formHistory.length === 0) return;
    last = state.formHistory[state.formHistory.length - 1];
    state.formHistory.pop();
  });
  return last;
},
```

**영향 범위:** 버그 — 빠른 네비게이션 시 히스토리 손실 또는 잘못된 폼으로 이동
