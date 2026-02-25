# SSRF 필터링 계획

## 1. 취약점 분석

### 1.1 취약 코드 위치

**`packages/server/src/services/SandboxRunner.ts:145-156`** — `httpHandler`

```typescript
const httpHandler = new ivm.Reference(async (method: string, url: string, body?: string) => {
  const res = await fetch(url, {           // ← URL 검증 없이 직접 fetch
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body,
    signal: AbortSignal.timeout(10_000),
  });
  // ...
});
```

사용자 코드(isolated-vm 샌드박스)에서 `ctx.http.get(url)` 등 호출 시 URL이 Node.js 호스트의 `fetch()`로 그대로 전달된다. isolated-vm의 코드 격리는 유지되지만, HTTP 요청 자체는 **서버 프로세스의 네트워크 컨텍스트**에서 실행되므로 SSRF 공격이 가능하다.

### 1.2 영향 받는 메서드 (SandboxRunner.ts:401-417)

| 메서드 | 샌드박스 내 호출 | 비고 |
|--------|-----------------|------|
| `ctx.http.get(url)` | `__httpHandler.applySyncPromise(undefined, ['GET', String(url)])` | |
| `ctx.http.post(url, body)` | `__httpHandler.applySyncPromise(undefined, ['POST', String(url), JSON.stringify(body)])` | |
| `ctx.http.put(url, body)` | `__httpHandler.applySyncPromise(undefined, ['PUT', ...])` | |
| `ctx.http.patch(url, body)` | `__httpHandler.applySyncPromise(undefined, ['PATCH', ...])` | |
| `ctx.http.delete(url)` | `__httpHandler.applySyncPromise(undefined, ['DELETE', ...])` | |

5개 메서드 모두 동일한 `__httpHandler`를 경유하므로, **httpHandler 진입부 한 곳**에서 URL을 검증하면 전체를 방어할 수 있다.

### 1.3 공격 시나리오

| 시나리오 | 예시 URL | 위험 |
|----------|---------|------|
| 로컬 서버 접근 | `http://localhost:4000/api/forms` | 인증 없이 내부 API 호출 |
| AWS 메타데이터 | `http://169.254.169.254/latest/meta-data/iam/security-credentials/` | IAM 자격 증명 탈취 |
| 내부 네트워크 스캔 | `http://10.0.0.1:8080/admin` | 사내 서비스 접근 |
| 파일 프로토콜 | `file:///etc/passwd` | 로컬 파일 읽기 |
| DNS rebinding | 외부 도메인 → 해석 시 내부 IP 반환 | 위 차단 우회 |

### 1.4 기존 보안 조치

- isolated-vm으로 코드 격리 — `process`, `require`, `Function` 등 차단 (120-136줄)
- HTTP 요청 타임아웃 10초 (`AbortSignal.timeout(10_000)`)
- 메모리 제한 (`env.SANDBOX_MEMORY_LIMIT_MB`)
- **URL 검증: 없음**

---

## 2. 방어 전략

### 2.1 검증 함수 설계

새 파일 `packages/server/src/services/validateSandboxUrl.ts` 생성:

```typescript
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * 샌드박스 HTTP 요청의 URL을 검증한다.
 * 내부 네트워크, 메타데이터 서비스 등 SSRF 대상을 차단한다.
 * @throws {Error} 차단된 URL일 경우
 */
export async function validateSandboxUrl(url: string): Promise<void> {
  // 1단계: URL 파싱 및 스킴 검증
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    throw new Error(`Blocked URL scheme: ${scheme}:// (only http/https allowed)`);
  }

  // 2단계: 호스트명 차단
  const hostname = parsed.hostname.toLowerCase();
  const blockedHostnames = ['localhost', '0.0.0.0', '[::1]', '[::0]'];
  if (blockedHostnames.includes(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  // 3단계: IP 주소 검증 (직접 IP 입력 또는 DNS 해석 후)
  let ipToCheck: string;

  if (isIP(hostname)) {
    // 직접 IP가 입력된 경우
    ipToCheck = hostname;
  } else {
    // DNS 해석하여 실제 IP 확인 (DNS rebinding 방어)
    try {
      const { address } = await lookup(hostname);
      ipToCheck = address;
    } catch {
      throw new Error(`DNS resolution failed for: ${hostname}`);
    }
  }

  if (isBlockedIP(ipToCheck)) {
    throw new Error(`Blocked IP address: ${ipToCheck}`);
  }
}

/**
 * 내부/예약 IP 대역인지 확인
 */
function isBlockedIP(ip: string): boolean {
  // IPv4
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 127) return true;                        // 127.0.0.0/8 (loopback)
    if (a === 10) return true;                         // 10.0.0.0/8 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 (private)
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16 (private)
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 0) return true;                           // 0.0.0.0/8
    if (a >= 224) return true;                          // 224.0.0.0+ (multicast, reserved)
  }

  // IPv6
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;                           // loopback
  if (normalized === '::') return true;                            // unspecified
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;  // fc00::/7 (ULA)
  if (normalized.startsWith('fe80')) return true;                  // fe80::/10 (link-local)
  if (normalized.startsWith('::ffff:')) {                          // IPv4-mapped IPv6
    const v4Part = normalized.slice(7);
    if (isIP(v4Part) === 4) return isBlockedIP(v4Part);
  }

  return false;
}
```

### 2.2 차단 대상 정리

| 범주 | 대상 | 사유 |
|------|------|------|
| **스킴** | `file://`, `ftp://`, `gopher://`, `data://`, `dict://` 등 | http/https만 허용 |
| **호스트명** | `localhost`, `0.0.0.0`, `[::1]`, `[::0]` | 직접 루프백 접근 |
| **IPv4 loopback** | `127.0.0.0/8` | 로컬 서비스 접근 |
| **IPv4 private** | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | 내부 네트워크 |
| **IPv4 link-local** | `169.254.0.0/16` | AWS/GCP 메타데이터 |
| **IPv4 unspecified** | `0.0.0.0/8` | 모든 인터페이스 |
| **IPv4 reserved** | `224.0.0.0+` | 멀티캐스트, 예약 |
| **IPv6 loopback** | `::1` | 로컬 |
| **IPv6 ULA** | `fc00::/7` (`fc`, `fd` prefix) | 내부 네트워크 |
| **IPv6 link-local** | `fe80::/10` | 링크 로컬 |
| **IPv4-mapped IPv6** | `::ffff:127.0.0.1` 등 | IPv4 차단 우회 방지 |

### 2.3 DNS Rebinding 방어

DNS rebinding 공격: 외부 도메인이 첫 번째 DNS 조회에서 공인 IP를 반환하고, 두 번째 조회에서 내부 IP(`127.0.0.1`)를 반환하여 검증을 우회.

**방어 방법**: `validateSandboxUrl()`에서 DNS를 직접 해석(`dns.lookup`)하고, 해석된 IP로 검증한 뒤 해당 IP로 직접 요청을 보내는 방식이 가장 안전하다. 그러나 `fetch()`의 기본 동작은 hostname으로 요청하므로 재해석 가능성이 남는다.

**실용적 접근**:
- 검증 시점에 DNS를 해석하여 IP를 확인하고 차단 여부를 판단
- fetch 호출 시에도 해석된 IP를 직접 사용 (Host 헤더 수동 설정)하면 완전하지만, 복잡도가 높음
- **1차 구현**: DNS 해석 + IP 검증으로 대부분의 SSRF 및 단순 DNS rebinding 차단
- **2차 강화 (선택)**: 해석된 IP를 사용하여 직접 연결 (undici의 `Agent` `connect` 옵션 활용)

---

## 3. 적용 방안

### 3.1 SandboxRunner.ts 수정

`httpHandler` 내부에서 `fetch()` 호출 전에 `validateSandboxUrl()` 호출:

```typescript
// SandboxRunner.ts:145-156 수정

import { validateSandboxUrl } from './validateSandboxUrl.js';

// ...

const httpHandler = new ivm.Reference(async (method: string, url: string, body?: string) => {
  await validateSandboxUrl(url);  // ← 추가: URL 검증

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  return new ivm.ExternalCopy({ status: res.status, ok: res.ok, data }).copyInto();
});
```

**변경점**: 1줄 추가 (`await validateSandboxUrl(url)`)
- 검증 실패 시 throw → `ctx.http.get()` 호출이 에러 반환
- `ctx.http`의 5개 메서드(get, post, put, patch, delete) 모두 동일 핸들러 경유하므로 한 번에 적용

### 3.2 에러 메시지 처리

검증 실패 시 사용자 코드에서 잡을 수 있는 에러 반환:
- `"Blocked URL scheme: file:// (only http/https allowed)"`
- `"Blocked hostname: localhost"`
- `"Blocked IP address: 127.0.0.1"`
- `"DNS resolution failed for: nonexistent.example"`
- `"Invalid URL: not-a-url"`

### 3.3 파일 변경 요약

| 파일 | 변경 | 설명 |
|------|------|------|
| `packages/server/src/services/validateSandboxUrl.ts` | **신규** | URL 검증 함수 |
| `packages/server/src/services/SandboxRunner.ts` | 수정 | httpHandler에 검증 호출 1줄 추가 + import |

---

## 4. 테스트 계획

`packages/server/src/__tests__/validateSandboxUrl.test.ts` 생성:

### 4.1 차단 테스트 (expect throw)

```typescript
// 스킴 차단
'file:///etc/passwd'
'ftp://evil.com/file'
'gopher://127.0.0.1:25'
'data:text/html,<script>alert(1)</script>'

// 호스트명 차단
'http://localhost:4000/api/forms'
'http://0.0.0.0:4000'
'http://[::1]:4000'

// IPv4 내부 대역
'http://127.0.0.1:4000'
'http://127.255.255.255'
'http://10.0.0.1'
'http://172.16.0.1'
'http://172.31.255.255'
'http://192.168.1.1'
'http://169.254.169.254/latest/meta-data/'

// IPv6
'http://[::1]/'
'http://[fc00::1]/'
'http://[fd12:3456::1]/'
'http://[fe80::1]/'

// IPv4-mapped IPv6
'http://[::ffff:127.0.0.1]/'
'http://[::ffff:169.254.169.254]/'

// 유효하지 않은 URL
'not-a-url'
''
```

### 4.2 허용 테스트 (expect no throw)

```typescript
'http://example.com'
'https://api.github.com/repos'
'https://jsonplaceholder.typicode.com/posts'
'http://8.8.8.8'           // 공인 IP
'https://example.com:8443'  // 커스텀 포트
```

### 4.3 통합 테스트 (SandboxRunner)

기존 `SandboxRunner.test.ts`에 추가:

```typescript
it('SSRF: 내부 URL 요청을 차단해야 한다', async () => {
  const result = await runner.runCode(
    'var res = ctx.http.get("http://localhost:4000/api/forms");',
    {},
  );
  expect(result.success).toBe(false);
  expect(result.error).toContain('Blocked');
});

it('SSRF: 메타데이터 서비스 접근을 차단해야 한다', async () => {
  const result = await runner.runCode(
    'var res = ctx.http.get("http://169.254.169.254/latest/meta-data/");',
    {},
  );
  expect(result.success).toBe(false);
  expect(result.error).toContain('Blocked');
});
```

---

## 5. 구현 순서

1. `validateSandboxUrl.ts` 생성 (검증 함수 + `isBlockedIP` 헬퍼)
2. `validateSandboxUrl.test.ts` 생성 및 단위 테스트 통과 확인
3. `SandboxRunner.ts` 수정 (import + 1줄 추가)
4. `SandboxRunner.test.ts`에 통합 테스트 추가
5. 전체 테스트 실행 (`pnpm --filter @webform/server test`)
