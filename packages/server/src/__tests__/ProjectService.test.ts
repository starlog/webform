import { describe, it, expect } from 'vitest';
import { ProjectService } from '../services/ProjectService.js';
import { Form } from '../models/Form.js';

describe('ProjectService', () => {
  const service = new ProjectService();
  const userId = 'user-001';

  describe('createProject', () => {
    it('name과 기본값이 올바르게 설정되어야 한다', async () => {
      const project = await service.createProject(
        { name: 'Test Project', description: '' },
        userId,
      );

      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('');
      expect(project.createdBy).toBe(userId);
      expect(project.updatedBy).toBe(userId);
      expect(project._id).toBeDefined();
    });

    it('description을 지정하면 해당 값이 저장되어야 한다', async () => {
      const project = await service.createProject(
        { name: 'With Desc', description: '설명 텍스트' },
        userId,
      );

      expect(project.description).toBe('설명 텍스트');
    });
  });

  describe('exportProject', () => {
    it('폼 스냅샷을 포함한 JSON을 반환해야 한다', async () => {
      const project = await service.createProject(
        { name: 'Export Test', description: '내보내기 테스트' },
        userId,
      );
      const projectId = project._id.toString();

      // 프로젝트에 폼 2개 생성
      await Form.create([
        {
          name: 'Form A',
          projectId,
          version: 1,
          status: 'draft',
          properties: { title: 'A', width: 800, height: 600 },
          controls: [{ id: 'ctrl-1', type: 'Button', name: 'btn1', properties: {}, position: { x: 0, y: 0 }, size: { width: 75, height: 23 } }],
          eventHandlers: [],
          dataBindings: [],
          versions: [],
          createdBy: userId,
          updatedBy: userId,
        },
        {
          name: 'Form B',
          projectId,
          version: 1,
          status: 'draft',
          properties: { title: 'B', width: 640, height: 480 },
          controls: [],
          eventHandlers: [{ event: 'click', handler: 'onBtnClick' }],
          dataBindings: [],
          versions: [],
          createdBy: userId,
          updatedBy: userId,
        },
      ]);

      const result = await service.exportProject(projectId);

      expect(result.exportVersion).toBe('1.0');
      expect(result.exportedAt).toBeDefined();
      expect(result.project.name).toBe('Export Test');
      expect(result.project.description).toBe('내보내기 테스트');
      expect(result.forms).toHaveLength(2);

      const formA = result.forms.find((f) => f.name === 'Form A');
      expect(formA).toBeDefined();
      expect(formA!.controls).toHaveLength(1);

      const formB = result.forms.find((f) => f.name === 'Form B');
      expect(formB).toBeDefined();
      expect(formB!.eventHandlers).toHaveLength(1);
    });
  });

  describe('importProject', () => {
    it('새 프로젝트와 폼이 복원되어야 한다', async () => {
      const importData = {
        project: { name: 'Imported Project', description: '가져온 프로젝트' },
        forms: [
          {
            name: 'Imported Form 1',
            properties: { title: 'IF1' },
            controls: [{ id: 'c1', type: 'Label', name: 'label1', properties: { text: 'Hello' }, position: { x: 10, y: 20 }, size: { width: 100, height: 23 } }],
            eventHandlers: [],
            dataBindings: [],
          },
          {
            name: 'Imported Form 2',
            properties: {},
            controls: [],
            eventHandlers: [],
            dataBindings: [],
          },
        ],
      };

      const project = await service.importProject(importData, userId);

      expect(project.name).toBe('Imported Project');
      expect(project.description).toBe('가져온 프로젝트');
      expect(project.createdBy).toBe(userId);

      // DB에서 폼 확인
      const forms = await Form.find({ projectId: project._id.toString(), deletedAt: null });
      expect(forms).toHaveLength(2);

      const form1 = forms.find((f) => f.name === 'Imported Form 1');
      expect(form1).toBeDefined();
      expect(form1!.controls).toHaveLength(1);
      expect(form1!.version).toBe(1);
      expect(form1!.status).toBe('draft');
    });

    it('폼이 없는 프로젝트도 가져올 수 있어야 한다', async () => {
      const project = await service.importProject(
        { project: { name: 'Empty Import', description: '' }, forms: [] },
        userId,
      );

      expect(project.name).toBe('Empty Import');

      const forms = await Form.find({ projectId: project._id.toString() });
      expect(forms).toHaveLength(0);
    });
  });
});
