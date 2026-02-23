import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '../stores/designerStore';
import type { ControlDefinition, ApplicationShellDefinition } from '@webform/common';

function makeControl(overrides: Partial<ControlDefinition> = {}): ControlDefinition {
  return {
    id: overrides.id ?? 'ctrl-1',
    type: 'Button',
    name: 'button1',
    properties: { text: 'Button' },
    position: { x: 0, y: 0 },
    size: { width: 75, height: 23 },
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

function makeShellDefinition(
  overrides: Partial<ApplicationShellDefinition> = {},
): ApplicationShellDefinition {
  return {
    id: 'shell-1',
    projectId: 'project-1',
    name: 'Test Shell',
    version: 1,
    properties: {
      title: 'My App',
      width: 1024,
      height: 768,
      backgroundColor: '#FFFFFF',
      font: {
        family: 'Segoe UI',
        size: 9,
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
      },
      showTitleBar: true,
      formBorderStyle: 'Sizable',
      maximizeBox: true,
      minimizeBox: true,
    },
    controls: [],
    eventHandlers: [],
    ...overrides,
  };
}

describe('designerStore - Shell', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      controls: [],
      formProperties: {
        title: 'Form1',
        width: 800,
        height: 600,
        backgroundColor: '#F0F0F0',
        font: {
          family: 'Segoe UI',
          size: 9,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
        },
        startPosition: 'CenterScreen',
        formBorderStyle: 'Sizable',
        maximizeBox: true,
        minimizeBox: true,
      },
      isDirty: false,
      currentFormId: null,
      editMode: 'form',
      shellControls: [],
      shellProperties: {
        title: 'Application',
        width: 1200,
        height: 800,
        backgroundColor: '#F0F0F0',
        font: {
          family: 'Segoe UI',
          size: 9,
          bold: false,
          italic: false,
          underline: false,
          strikethrough: false,
        },
        showTitleBar: true,
        formBorderStyle: 'Sizable',
        maximizeBox: true,
        minimizeBox: true,
      },
      currentShellId: null,
    });
  });

  describe('setEditMode', () => {
    it('editMode를 shell로 변경한다', () => {
      useDesignerStore.getState().setEditMode('shell');
      expect(useDesignerStore.getState().editMode).toBe('shell');
    });

    it('editMode를 form으로 변경한다', () => {
      useDesignerStore.getState().setEditMode('shell');
      useDesignerStore.getState().setEditMode('form');
      expect(useDesignerStore.getState().editMode).toBe('form');
    });
  });

  describe('loadShell', () => {
    it('shellControls, shellProperties, currentShellId를 설정한다', () => {
      const menuControl = makeControl({
        id: 'menu-1',
        type: 'MenuStrip',
        name: 'menuStrip1',
      });
      const shellDef = makeShellDefinition({
        id: 'shell-abc',
        controls: [menuControl],
      });

      useDesignerStore.getState().loadShell(shellDef);

      const state = useDesignerStore.getState();
      expect(state.currentShellId).toBe('shell-abc');
      expect(state.shellControls).toHaveLength(1);
      expect(state.shellControls[0].id).toBe('menu-1');
      expect(state.shellProperties.title).toBe('My App');
      expect(state.shellProperties.width).toBe(1024);
      expect(state.shellProperties.height).toBe(768);
    });

    it('editMode를 shell로 자동 전환한다', () => {
      expect(useDesignerStore.getState().editMode).toBe('form');

      useDesignerStore.getState().loadShell(makeShellDefinition());

      expect(useDesignerStore.getState().editMode).toBe('shell');
    });

    it('isDirty를 false로 리셋한다', () => {
      useDesignerStore.getState().addControl(makeControl());
      expect(useDesignerStore.getState().isDirty).toBe(true);

      useDesignerStore.getState().loadShell(makeShellDefinition());
      expect(useDesignerStore.getState().isDirty).toBe(false);
    });
  });

  describe('addShellControl', () => {
    it('shellControls 배열에 컨트롤을 추가한다', () => {
      const control = makeControl({ id: 'toolbar-1', type: 'ToolStrip', name: 'toolStrip1' });
      useDesignerStore.getState().addShellControl(control);

      const { shellControls } = useDesignerStore.getState();
      expect(shellControls).toHaveLength(1);
      expect(shellControls[0].id).toBe('toolbar-1');
      expect(shellControls[0].type).toBe('ToolStrip');
    });

    it('여러 컨트롤을 순서대로 추가한다', () => {
      useDesignerStore.getState().addShellControl(makeControl({ id: 'a', name: 'a' }));
      useDesignerStore.getState().addShellControl(makeControl({ id: 'b', name: 'b' }));

      const { shellControls } = useDesignerStore.getState();
      expect(shellControls).toHaveLength(2);
      expect(shellControls[0].id).toBe('a');
      expect(shellControls[1].id).toBe('b');
    });

    it('isDirty를 true로 설정한다', () => {
      expect(useDesignerStore.getState().isDirty).toBe(false);
      useDesignerStore.getState().addShellControl(makeControl());
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });
  });

  describe('updateShellControl', () => {
    it('특정 컨트롤의 속성을 업데이트한다', () => {
      useDesignerStore.getState().addShellControl(
        makeControl({ id: 'menu-1', type: 'MenuStrip', name: 'menuStrip1' }),
      );
      useDesignerStore.setState({ isDirty: false });

      useDesignerStore.getState().updateShellControl('menu-1', {
        position: { x: 0, y: 10 },
      });

      const ctrl = useDesignerStore.getState().shellControls[0];
      expect(ctrl.position).toEqual({ x: 0, y: 10 });
    });

    it('존재하지 않는 id에 대해서는 변경하지 않는다', () => {
      useDesignerStore.getState().addShellControl(makeControl({ id: 'menu-1' }));
      useDesignerStore.setState({ isDirty: false });

      useDesignerStore.getState().updateShellControl('not-exist', {
        position: { x: 999, y: 999 },
      });

      const ctrl = useDesignerStore.getState().shellControls[0];
      expect(ctrl.position).toEqual({ x: 0, y: 0 });
      expect(useDesignerStore.getState().isDirty).toBe(false);
    });

    it('isDirty를 true로 설정한다', () => {
      useDesignerStore.getState().addShellControl(makeControl({ id: 'menu-1' }));
      useDesignerStore.setState({ isDirty: false });

      useDesignerStore.getState().updateShellControl('menu-1', {
        size: { width: 100, height: 24 },
      });
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });
  });

  describe('setShellProperties', () => {
    it('shellProperties를 부분 업데이트한다', () => {
      useDesignerStore.getState().setShellProperties({
        title: 'Updated App',
        width: 1600,
      });

      const { shellProperties } = useDesignerStore.getState();
      expect(shellProperties.title).toBe('Updated App');
      expect(shellProperties.width).toBe(1600);
      // 변경하지 않은 속성은 유지
      expect(shellProperties.height).toBe(800);
      expect(shellProperties.backgroundColor).toBe('#F0F0F0');
    });

    it('isDirty를 true로 설정한다', () => {
      expect(useDesignerStore.getState().isDirty).toBe(false);
      useDesignerStore.getState().setShellProperties({ title: 'New Title' });
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });
  });

  describe('폼/셸 모드 전환 시 데이터 격리', () => {
    it('shell 모드로 전환해도 기존 controls/formProperties가 유지된다', () => {
      // 폼 컨트롤 추가
      const formControl = makeControl({ id: 'form-btn', name: 'formButton1' });
      useDesignerStore.getState().addControl(formControl);
      useDesignerStore.getState().setFormProperties({ title: 'MyForm' });

      // Shell 로드 (모드 전환)
      const shellDef = makeShellDefinition({
        controls: [makeControl({ id: 'shell-menu', type: 'MenuStrip', name: 'menuStrip1' })],
      });
      useDesignerStore.getState().loadShell(shellDef);

      const state = useDesignerStore.getState();
      // editMode는 shell
      expect(state.editMode).toBe('shell');
      // 폼 데이터는 그대로 유지
      expect(state.controls).toHaveLength(1);
      expect(state.controls[0].id).toBe('form-btn');
      expect(state.formProperties.title).toBe('MyForm');
      // Shell 데이터는 별도로 존재
      expect(state.shellControls).toHaveLength(1);
      expect(state.shellControls[0].id).toBe('shell-menu');
    });

    it('form 모드로 되돌아가도 shell 데이터가 유지된다', () => {
      // Shell 로드
      const shellDef = makeShellDefinition({
        controls: [makeControl({ id: 'shell-tool', type: 'ToolStrip', name: 'toolStrip1' })],
        properties: {
          title: 'Shell App',
          width: 1024,
          height: 768,
          backgroundColor: '#FFFFFF',
          font: {
            family: 'Segoe UI',
            size: 9,
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
          },
          showTitleBar: true,
          formBorderStyle: 'Sizable',
          maximizeBox: true,
          minimizeBox: true,
        },
      });
      useDesignerStore.getState().loadShell(shellDef);

      // form 모드로 전환
      useDesignerStore.getState().setEditMode('form');

      const state = useDesignerStore.getState();
      expect(state.editMode).toBe('form');
      // Shell 데이터는 유지
      expect(state.shellControls).toHaveLength(1);
      expect(state.shellControls[0].id).toBe('shell-tool');
      expect(state.shellProperties.title).toBe('Shell App');
      expect(state.currentShellId).toBe('shell-1');
    });
  });

  describe('removeShellControl', () => {
    it('shellControls 배열에서 컨트롤을 제거한다', () => {
      useDesignerStore.getState().addShellControl(makeControl({ id: 'a', name: 'a' }));
      useDesignerStore.getState().addShellControl(makeControl({ id: 'b', name: 'b' }));

      useDesignerStore.getState().removeShellControl('a');

      const { shellControls } = useDesignerStore.getState();
      expect(shellControls).toHaveLength(1);
      expect(shellControls[0].id).toBe('b');
    });

    it('isDirty를 true로 설정한다', () => {
      useDesignerStore.getState().addShellControl(makeControl({ id: 'x' }));
      useDesignerStore.setState({ isDirty: false });

      useDesignerStore.getState().removeShellControl('x');
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });
  });

  describe('getShellDefinition', () => {
    it('현재 Shell 상태를 ApplicationShellDefinition으로 반환한다', () => {
      useDesignerStore.setState({ currentProjectId: 'proj-1' });
      const shellDef = makeShellDefinition({
        id: 'shell-99',
        controls: [makeControl({ id: 'status-1', type: 'StatusStrip', name: 'statusStrip1' })],
      });
      useDesignerStore.getState().loadShell(shellDef);

      const result = useDesignerStore.getState().getShellDefinition();

      expect(result.id).toBe('shell-99');
      expect(result.projectId).toBe('proj-1');
      expect(result.name).toBe('Test Shell');
      expect(result.version).toBe(1);
      expect(result.controls).toHaveLength(1);
      expect(result.controls[0].id).toBe('status-1');
      expect(result.properties.title).toBe('My App');
      expect(result.eventHandlers).toEqual([]);
    });
  });
});
