import { describe, it, expect } from 'vitest';
import { VERSION } from '../index';

describe('common', () => {
  it('VERSION should be 1.0.0', () => {
    expect(VERSION).toBe('1.0.0');
  });
});
