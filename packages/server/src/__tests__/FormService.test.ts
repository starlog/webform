import { describe, it, expect, beforeEach } from 'vitest';
import { FormService } from '../services/FormService.js';
import { NotFoundError, AppError } from '../middleware/errorHandler.js';

const formService = new FormService();

const baseInput = {
  name: 'Test Form',
  projectId: 'project-1',
  properties: {},
  controls: [],
  eventHandlers: [],
  dataBindings: [],
};

const userId = 'user-1';

describe('FormService', () => {
  describe('createForm', () => {
    it('version=1, status="draft"로 생성되어야 한다', async () => {
      const form = await formService.createForm(baseInput, userId);

      expect(form.name).toBe('Test Form');
      expect(form.projectId).toBe('project-1');
      expect(form.version).toBe(1);
      expect(form.status).toBe('draft');
      expect(form.versions).toEqual([]);
      expect(form.createdBy).toBe(userId);
      expect(form.updatedBy).toBe(userId);
      expect(form.deletedAt).toBeNull();
      expect(form._id).toBeDefined();
    });
  });

  describe('updateForm', () => {
    it('version이 증가하고 versions 배열에 이전 스냅샷이 저장되어야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      const updated = await formService.updateForm(
        id,
        { name: 'Updated Form' },
        'user-2',
      );

      expect(updated.version).toBe(2);
      expect(updated.name).toBe('Updated Form');
      expect(updated.updatedBy).toBe('user-2');
      expect(updated.versions).toHaveLength(1);
      expect(updated.versions[0].version).toBe(1);
      expect(updated.versions[0].snapshot.name).toBe('Test Form');
      expect(updated.versions[0].savedAt).toBeDefined();
    });

    it('여러 번 수정 시 versions 배열이 누적되어야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      await formService.updateForm(id, { name: 'V2' }, userId);
      const v3 = await formService.updateForm(id, { name: 'V3' }, userId);

      expect(v3.version).toBe(3);
      expect(v3.versions).toHaveLength(2);
      expect(v3.versions[0].version).toBe(1);
      expect(v3.versions[0].snapshot.name).toBe('Test Form');
      expect(v3.versions[1].version).toBe(2);
      expect(v3.versions[1].snapshot.name).toBe('V2');
    });

    it('published 상태에서 수정 시 draft로 전환되어야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      await formService.publishForm(id, userId);
      const updated = await formService.updateForm(id, { name: 'Re-draft' }, userId);

      expect(updated.status).toBe('draft');
    });
  });

  describe('deleteForm', () => {
    it('soft delete 후 getForm 호출 시 NotFoundError가 발생해야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      await formService.deleteForm(id);

      await expect(formService.getForm(id)).rejects.toThrow(NotFoundError);
    });

    it('존재하지 않는 폼 삭제 시 NotFoundError가 발생해야 한다', async () => {
      const fakeId = '000000000000000000000000';
      await expect(formService.deleteForm(fakeId)).rejects.toThrow(NotFoundError);
    });
  });

  describe('publishForm', () => {
    it('status="published"로 전환되어야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      const published = await formService.publishForm(id, userId);

      expect(published.status).toBe('published');
      expect(published.publishedVersion).toBe(1);
    });

    it('이미 published 상태면 409 에러가 발생해야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      await formService.publishForm(id, userId);

      await expect(formService.publishForm(id, userId)).rejects.toThrow(AppError);
      await expect(formService.publishForm(id, userId)).rejects.toThrow(
        'Form is already published',
      );
    });
  });

  describe('listForms', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await formService.createForm(
          { ...baseInput, name: `Form ${i}` },
          userId,
        );
      }
    });

    it('페이지네이션이 동작해야 한다', async () => {
      const page1 = await formService.listForms({ page: 1, limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);

      const page2 = await formService.listForms({ page: 2, limit: 2 });
      expect(page2.data).toHaveLength(2);

      const page3 = await formService.listForms({ page: 3, limit: 2 });
      expect(page3.data).toHaveLength(1);
    });

    it('삭제된 폼은 목록에 포함되지 않아야 한다', async () => {
      const all = await formService.listForms({ page: 1, limit: 10 });
      const firstId = all.data[0]._id.toString();

      await formService.deleteForm(firstId);

      const afterDelete = await formService.listForms({ page: 1, limit: 10 });
      expect(afterDelete.total).toBe(4);
    });

    it('status 필터가 동작해야 한다', async () => {
      const all = await formService.listForms({ page: 1, limit: 10 });
      const firstId = all.data[0]._id.toString();
      await formService.publishForm(firstId, userId);

      const drafts = await formService.listForms({
        page: 1,
        limit: 10,
        status: 'draft',
      });
      expect(drafts.total).toBe(4);

      const published = await formService.listForms({
        page: 1,
        limit: 10,
        status: 'published',
      });
      expect(published.total).toBe(1);
    });

    it('search 필터가 동작해야 한다', async () => {
      const result = await formService.listForms({
        page: 1,
        limit: 10,
        search: 'Form 3',
      });
      expect(result.total).toBe(1);
      expect(result.data[0].name).toBe('Form 3');
    });
  });

  describe('getVersions', () => {
    it('버전 히스토리를 반환해야 한다', async () => {
      const created = await formService.createForm(baseInput, userId);
      const id = created._id.toString();

      await formService.updateForm(id, { name: 'V2' }, userId);
      await formService.updateForm(id, { name: 'V3' }, userId);

      const versions = await formService.getVersions(id);

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2);
      expect(versions[1].version).toBe(1);
      // snapshot은 제외되어야 한다
      expect((versions[0] as any).snapshot).toBeUndefined();
    });
  });
});
