import { describe, it, expect } from 'vitest';
import { EncryptionService } from '../services/EncryptionService.js';

describe('EncryptionService', () => {
  const service = new EncryptionService();

  it('암호화 → 복호화 라운드트립 시 동일값을 반환해야 한다', () => {
    const plaintext = 'hello-world-secret-value';
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it('다른 키로 복호화 시 에러가 발생해야 한다', () => {
    const encrypted = service.encrypt('some-secret');

    // iv:ciphertext 형식에서 ciphertext를 변조하여 다른 키 효과 재현
    const [iv, cipher] = encrypted.split(':');
    // 첫 바이트 변조
    const tampered = cipher.slice(0, -2) + 'ff';
    const tamperedText = `${iv}:${tampered}`;

    expect(() => service.decrypt(tamperedText)).toThrow();
  });

  it('한국어 문자열을 올바르게 암호화/복호화해야 한다', () => {
    const korean = '안녕하세요 데이터소스 연결 문자열입니다';
    const encrypted = service.encrypt(korean);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toBe(korean);
    expect(encrypted).not.toBe(korean);
  });
});
