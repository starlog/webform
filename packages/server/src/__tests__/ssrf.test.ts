import { describe, it, expect } from 'vitest';
import { validateSandboxUrl } from '../services/validateSandboxUrl.js';
import { SandboxRunner } from '../services/SandboxRunner.js';

describe('SSRF URL 필터링', () => {
  describe('validateSandboxUrl — 차단 케이스', () => {
    it('http://localhost/api → 차단', async () => {
      await expect(validateSandboxUrl('http://localhost/api')).rejects.toThrow('Blocked hostname');
    });

    it('http://127.0.0.1:4000 → 차단', async () => {
      await expect(validateSandboxUrl('http://127.0.0.1:4000')).rejects.toThrow(
        'Blocked IP address',
      );
    });

    it('http://169.254.169.254/latest/meta-data → 차단 (AWS 메타데이터)', async () => {
      await expect(
        validateSandboxUrl('http://169.254.169.254/latest/meta-data'),
      ).rejects.toThrow('Blocked IP address');
    });

    it('http://10.0.0.1 → 차단 (내부망)', async () => {
      await expect(validateSandboxUrl('http://10.0.0.1')).rejects.toThrow('Blocked IP address');
    });

    it('http://192.168.1.1 → 차단', async () => {
      await expect(validateSandboxUrl('http://192.168.1.1')).rejects.toThrow('Blocked IP address');
    });

    it('file:///etc/passwd → 차단', async () => {
      await expect(validateSandboxUrl('file:///etc/passwd')).rejects.toThrow('Blocked URL scheme');
    });
  });

  describe('validateSandboxUrl — 허용 케이스', () => {
    it('https://api.example.com/data → 통과 (외부 공개 URL)', async () => {
      // example.com은 DNS 해석 가능하지만 api.example.com은 불가하므로 example.com 사용
      await expect(validateSandboxUrl('https://example.com/data')).resolves.toBeUndefined();
    });

    it('https://jsonplaceholder.typicode.com/todos/1 → 통과', async () => {
      await expect(
        validateSandboxUrl('https://jsonplaceholder.typicode.com/todos/1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('SandboxRunner 통합 — SSRF 차단', () => {
    const runner = new SandboxRunner();

    it('샌드박스에서 localhost HTTP 요청 차단', async () => {
      const result = await runner.runCode(
        'var res = ctx.http.get("http://localhost/api");',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });

    it('샌드박스에서 127.0.0.1 HTTP 요청 차단', async () => {
      const result = await runner.runCode(
        'var res = ctx.http.get("http://127.0.0.1:4000");',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });

    it('샌드박스에서 AWS 메타데이터 접근 차단', async () => {
      const result = await runner.runCode(
        'var res = ctx.http.get("http://169.254.169.254/latest/meta-data");',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });

    it('샌드박스에서 내부망(10.x) 접근 차단', async () => {
      const result = await runner.runCode(
        'var res = ctx.http.get("http://10.0.0.1");',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });

    it('샌드박스에서 내부망(192.168.x) 접근 차단', async () => {
      const result = await runner.runCode(
        'var res = ctx.http.get("http://192.168.1.1");',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });

    it('샌드박스에서 file:// 스킴 차단', async () => {
      const result = await runner.runCode(
        'var res = ctx.http.get("file:///etc/passwd");',
        {},
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked');
    });
  });
});
