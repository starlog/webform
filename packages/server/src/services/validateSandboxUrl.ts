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

  // 서버 자체 API 호출 허용 (datasource 등 내부 API)
  const selfPort = process.env.PORT || '4000';
  const selfHost = parsed.hostname.toLowerCase();
  if (
    (selfHost === 'localhost' || selfHost === '127.0.0.1') &&
    parsed.port === selfPort &&
    parsed.pathname.startsWith('/api/')
  ) {
    return;
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    throw new Error(`Blocked URL scheme: ${scheme}:// (only http/https allowed)`);
  }

  // 2단계: 호스트명 정규화 (Node.js URL parser는 IPv6에 대괄호를 포함)
  const rawHostname = parsed.hostname.toLowerCase();
  const hostname =
    rawHostname.startsWith('[') && rawHostname.endsWith(']')
      ? rawHostname.slice(1, -1)
      : rawHostname;

  // 3단계: 호스트명 차단
  if (hostname === 'localhost') {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  // 4단계: IP 주소 검증 (직접 IP 입력 또는 DNS 해석 후)
  let ipToCheck: string;

  if (isIP(hostname)) {
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
export function isBlockedIP(ip: string): boolean {
  // IPv4
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    const [a, b] = parts;
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 10) return true; // 10.0.0.0/8 (private)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (private)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (private)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / AWS metadata)
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // 224.0.0.0+ (multicast, reserved)
  }

  // IPv6
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized === '::') return true; // unspecified
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7 (ULA)
  if (normalized.startsWith('fe80')) return true; // fe80::/10 (link-local)
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6
    const v4Part = normalized.slice(7);
    // Dotted notation: ::ffff:127.0.0.1
    if (isIP(v4Part) === 4) return isBlockedIP(v4Part);
    // Hex notation: ::ffff:7f00:1 (URL parser가 정규화한 형식)
    const hexParts = v4Part.split(':');
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      if (!isNaN(hi) && !isNaN(lo)) {
        const a = (hi >> 8) & 0xff;
        const b = hi & 0xff;
        const c = (lo >> 8) & 0xff;
        const d = lo & 0xff;
        return isBlockedIP(`${a}.${b}.${c}.${d}`);
      }
    }
  }

  return false;
}
