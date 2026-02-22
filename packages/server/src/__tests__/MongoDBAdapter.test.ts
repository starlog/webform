import { describe, it, expect } from 'vitest';
import { sanitizeQueryInput } from '@webform/common';

describe('MongoDBAdapter - sanitizeFilter', () => {
  it('$where 필드를 제거해야 한다', () => {
    const input = { $where: 'this.isAdmin === true', name: 'test' };
    const result = sanitizeQueryInput(input);

    expect(result).not.toHaveProperty('$where');
    expect(result).toEqual({ name: 'test' });
  });

  it('안전한 필터는 변경 없이 통과해야 한다', () => {
    const input = { name: '홍길동' };
    const result = sanitizeQueryInput(input);

    expect(result).toEqual({ name: '홍길동' });
  });

  it('중첩된 $where 필드도 제거해야 한다', () => {
    const input = {
      name: 'test',
      nested: {
        $where: 'malicious code',
        safe: 'value',
      },
    };
    const result = sanitizeQueryInput(input);

    expect(result).toEqual({
      name: 'test',
      nested: { safe: 'value' },
    });
    expect((result.nested as Record<string, unknown>).$where).toBeUndefined();
  });
});
