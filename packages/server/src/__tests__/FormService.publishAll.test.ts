import { describe, it, expect } from 'vitest';
import { FormService } from '../services/FormService.js';
import type { CreateFormInput } from '../validators/formValidator.js';

const formService = new FormService();

const userId = 'user-1';

function makeInput(overrides: Partial<CreateFormInput> = {}): CreateFormInput {
  return {
    name: 'Test Form',
    projectId: 'project-1',
    properties: {},
    controls: [],
    eventHandlers: [],
    dataBindings: [],
    ...overrides,
  } as unknown as CreateFormInput;
}

describe('FormService.publishAllByProject', () => {
  it('draft 폼 3개 + published 폼 1개 → publishedCount: 3, skippedCount: 1, totalCount: 4', async () => {
    // draft 폼 3개 생성
    await formService.createForm(makeInput({ name: 'Draft 1' }), userId);
    await formService.createForm(makeInput({ name: 'Draft 2' }), userId);
    await formService.createForm(makeInput({ name: 'Draft 3' }), userId);

    // 1개는 published로 전환
    const toPublish = await formService.createForm(makeInput({ name: 'Published 1' }), userId);
    await formService.publishForm(toPublish._id.toString(), userId);

    const result = await formService.publishAllByProject('project-1', userId);

    expect(result.publishedCount).toBe(3);
    expect(result.skippedCount).toBe(1);
    expect(result.totalCount).toBe(4);
  });

  it('빈 프로젝트 → publishedCount: 0, skippedCount: 0, totalCount: 0', async () => {
    const result = await formService.publishAllByProject('empty-project', userId);

    expect(result.publishedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('모든 폼이 이미 published인 경우 → publishedCount: 0, skippedCount: N', async () => {
    const form1 = await formService.createForm(makeInput({ name: 'Form A' }), userId);
    const form2 = await formService.createForm(makeInput({ name: 'Form B' }), userId);
    await formService.publishForm(form1._id.toString(), userId);
    await formService.publishForm(form2._id.toString(), userId);

    const result = await formService.publishAllByProject('project-1', userId);

    expect(result.publishedCount).toBe(0);
    expect(result.skippedCount).toBe(2);
    expect(result.totalCount).toBe(2);
  });

  it('draft 폼만 있는 경우 → 모두 퍼블리시, skippedCount: 0', async () => {
    await formService.createForm(makeInput({ name: 'Draft A' }), userId);
    await formService.createForm(makeInput({ name: 'Draft B' }), userId);
    await formService.createForm(makeInput({ name: 'Draft C' }), userId);

    const result = await formService.publishAllByProject('project-1', userId);

    expect(result.publishedCount).toBe(3);
    expect(result.skippedCount).toBe(0);
    expect(result.totalCount).toBe(3);
  });
});
