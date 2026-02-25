import { describe, it, expect } from 'vitest';
import { validateSandboxUrl } from '../services/validateSandboxUrl.js';

describe('validateSandboxUrl', () => {
  describe('차단: 유효하지 않은 URL', () => {
    it.each(['not-a-url', '', 'just-text'])('"%s"을 차단해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).rejects.toThrow('Invalid URL');
    });
  });

  describe('차단: 허용되지 않은 스킴', () => {
    it.each([
      'file:///etc/passwd',
      'ftp://evil.com/file',
      'gopher://127.0.0.1:25',
      'data:text/html,<script>alert(1)</script>',
    ])('"%s"을 차단해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).rejects.toThrow('Blocked URL scheme');
    });
  });

  describe('차단: 호스트명', () => {
    it.each([
      'http://localhost:4000/api/forms',
      'http://localhost',
    ])('"%s"을 차단해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).rejects.toThrow('Blocked hostname');
    });
  });

  describe('차단: IPv4 내부 대역', () => {
    it.each([
      ['http://127.0.0.1:4000', '127.0.0.1'], // loopback
      ['http://127.255.255.255', '127.255.255.255'], // loopback range
      ['http://10.0.0.1', '10.0.0.1'], // 10.0.0.0/8
      ['http://172.16.0.1', '172.16.0.1'], // 172.16.0.0/12
      ['http://172.31.255.255', '172.31.255.255'], // 172.16.0.0/12 upper
      ['http://192.168.1.1', '192.168.1.1'], // 192.168.0.0/16
      ['http://169.254.169.254/latest/meta-data/', '169.254.169.254'], // AWS metadata
      ['http://0.0.0.0', '0.0.0.0'], // unspecified
    ])('"%s" (IP: %s)을 차단해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).rejects.toThrow('Blocked IP address');
    });
  });

  describe('차단: IPv6', () => {
    it.each([
      'http://[::1]/',
      'http://[fc00::1]/',
      'http://[fd12:3456::1]/',
      'http://[fe80::1]/',
    ])('"%s"을 차단해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).rejects.toThrow('Blocked IP address');
    });
  });

  describe('차단: IPv4-mapped IPv6', () => {
    it.each([
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:169.254.169.254]/',
      'http://[::ffff:10.0.0.1]/',
      'http://[::ffff:192.168.1.1]/',
    ])('"%s"을 차단해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).rejects.toThrow('Blocked IP address');
    });
  });

  describe('허용: 정상 URL', () => {
    it.each([
      'https://example.com',
      'https://api.github.com/repos',
      'https://jsonplaceholder.typicode.com/posts',
      'http://8.8.8.8',
      'https://example.com:8443',
    ])('"%s"을 허용해야 한다', async (url) => {
      await expect(validateSandboxUrl(url)).resolves.toBeUndefined();
    });
  });

  describe('차단: 172.x 범위 경계값', () => {
    it('172.15.0.1은 허용해야 한다 (private 범위 밖)', async () => {
      await expect(validateSandboxUrl('http://172.15.0.1')).resolves.toBeUndefined();
    });

    it('172.32.0.1은 허용해야 한다 (private 범위 밖)', async () => {
      await expect(validateSandboxUrl('http://172.32.0.1')).resolves.toBeUndefined();
    });

    it('172.16.0.1은 차단해야 한다', async () => {
      await expect(validateSandboxUrl('http://172.16.0.1')).rejects.toThrow('Blocked IP address');
    });

    it('172.31.255.255는 차단해야 한다', async () => {
      await expect(validateSandboxUrl('http://172.31.255.255')).rejects.toThrow(
        'Blocked IP address',
      );
    });
  });
});
