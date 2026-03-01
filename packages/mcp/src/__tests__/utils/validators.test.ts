import { describe, it, expect } from 'vitest';
import { validateObjectId, validateRequired } from '../../utils/validators.js';

describe('validateObjectId', () => {
  it('유효한 24자 hex 문자열은 통과한다', () => {
    expect(() => validateObjectId('aabbccddee112233ff445566')).not.toThrow();
  });

  it('대문자 hex도 통과한다', () => {
    expect(() => validateObjectId('AABBCCDDEE112233FF445566')).not.toThrow();
  });

  it('대소문자 혼합도 통과한다', () => {
    expect(() => validateObjectId('aAbBcCdDeE112233fF445566')).not.toThrow();
  });

  it('23자 문자열은 실패한다', () => {
    expect(() => validateObjectId('aabbccddee112233ff44556')).toThrow('유효하지 않은');
  });

  it('25자 문자열은 실패한다', () => {
    expect(() => validateObjectId('aabbccddee112233ff4455667')).toThrow('유효하지 않은');
  });

  it('비hex 문자가 포함되면 실패한다', () => {
    expect(() => validateObjectId('aabbccddee112233ff44556g')).toThrow('유효하지 않은');
  });

  it('빈 문자열은 실패한다', () => {
    expect(() => validateObjectId('')).toThrow('유효하지 않은');
  });

  it('fieldName을 에러 메시지에 포함한다', () => {
    expect(() => validateObjectId('invalid', 'formId')).toThrow('formId');
  });

  it('기본 fieldName은 id이다', () => {
    expect(() => validateObjectId('invalid')).toThrow('id');
  });

  it('에러 메시지에 입력값을 포함한다', () => {
    expect(() => validateObjectId('wrong-id', 'projectId')).toThrow('"wrong-id"');
  });
});

describe('validateRequired', () => {
  it('유효한 문자열은 통과한다', () => {
    expect(() => validateRequired('hello', 'name')).not.toThrow();
  });

  it('숫자 0은 통과한다', () => {
    expect(() => validateRequired(0, 'count')).not.toThrow();
  });

  it('false는 통과한다', () => {
    expect(() => validateRequired(false, 'flag')).not.toThrow();
  });

  it('빈 배열은 통과한다', () => {
    expect(() => validateRequired([], 'items')).not.toThrow();
  });

  it('null은 실패한다', () => {
    expect(() => validateRequired(null, 'name')).toThrow('필수 입력');
  });

  it('undefined는 실패한다', () => {
    expect(() => validateRequired(undefined, 'name')).toThrow('필수 입력');
  });

  it('빈 문자열은 실패한다', () => {
    expect(() => validateRequired('', 'name')).toThrow('필수 입력');
  });

  it('공백만 있는 문자열은 실패한다', () => {
    expect(() => validateRequired('   ', 'name')).toThrow('필수 입력');
  });

  it('에러 메시지에 fieldName을 포함한다', () => {
    expect(() => validateRequired(null, 'projectId')).toThrow('projectId');
  });
});
