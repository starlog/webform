import { describe, it, expect, beforeEach } from 'vitest';
import { useDesignerStore } from '../stores/designerStore';
import type { ControlDefinition } from '@webform/common';

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

describe('designerStore', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      controls: [],
      isDirty: false,
      currentFormId: null,
    });
  });

  describe('addControl', () => {
    it('controls 배열에 컨트롤을 추가한다', () => {
      const control = makeControl();
      useDesignerStore.getState().addControl(control);

      const { controls } = useDesignerStore.getState();
      expect(controls).toHaveLength(1);
      expect(controls[0].id).toBe('ctrl-1');
    });

    it('여러 컨트롤을 순서대로 추가한다', () => {
      useDesignerStore.getState().addControl(makeControl({ id: 'a' }));
      useDesignerStore.getState().addControl(makeControl({ id: 'b' }));

      const { controls } = useDesignerStore.getState();
      expect(controls).toHaveLength(2);
      expect(controls[0].id).toBe('a');
      expect(controls[1].id).toBe('b');
    });
  });

  describe('updateControl', () => {
    it('position을 변경한다', () => {
      useDesignerStore.getState().addControl(makeControl({ id: 'ctrl-1' }));
      useDesignerStore.getState().updateControl('ctrl-1', {
        position: { x: 100, y: 200 },
      });

      const ctrl = useDesignerStore.getState().controls[0];
      expect(ctrl.position).toEqual({ x: 100, y: 200 });
    });

    it('존재하지 않는 id에 대해서는 변경하지 않는다', () => {
      useDesignerStore.getState().addControl(makeControl({ id: 'ctrl-1' }));
      useDesignerStore.getState().updateControl('not-exist', {
        position: { x: 999, y: 999 },
      });

      const ctrl = useDesignerStore.getState().controls[0];
      expect(ctrl.position).toEqual({ x: 0, y: 0 });
    });
  });

  describe('removeControl', () => {
    it('배열에서 컨트롤을 제거한다', () => {
      useDesignerStore.getState().addControl(makeControl({ id: 'a' }));
      useDesignerStore.getState().addControl(makeControl({ id: 'b' }));

      useDesignerStore.getState().removeControl('a');

      const { controls } = useDesignerStore.getState();
      expect(controls).toHaveLength(1);
      expect(controls[0].id).toBe('b');
    });
  });

  describe('bringToFront / sendToBack', () => {
    beforeEach(() => {
      useDesignerStore.getState().addControl(makeControl({ id: 'a', name: 'a' }));
      useDesignerStore.getState().addControl(makeControl({ id: 'b', name: 'b' }));
      useDesignerStore.getState().addControl(makeControl({ id: 'c', name: 'c' }));
    });

    it('bringToFront: 지정한 컨트롤을 배열 맨 뒤로 이동한다', () => {
      useDesignerStore.getState().bringToFront('a');

      const ids = useDesignerStore.getState().controls.map((c) => c.id);
      expect(ids).toEqual(['b', 'c', 'a']);
    });

    it('sendToBack: 지정한 컨트롤을 배열 맨 앞으로 이동한다', () => {
      useDesignerStore.getState().sendToBack('c');

      const ids = useDesignerStore.getState().controls.map((c) => c.id);
      expect(ids).toEqual(['c', 'a', 'b']);
    });
  });

  describe('isDirty', () => {
    it('초기 상태는 false이다', () => {
      expect(useDesignerStore.getState().isDirty).toBe(false);
    });

    it('addControl 후 true가 된다', () => {
      useDesignerStore.getState().addControl(makeControl());
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });

    it('updateControl 후 true가 된다', () => {
      useDesignerStore.getState().addControl(makeControl({ id: 'x' }));
      useDesignerStore.setState({ isDirty: false });

      useDesignerStore.getState().updateControl('x', { position: { x: 10, y: 10 } });
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });

    it('removeControl 후 true가 된다', () => {
      useDesignerStore.getState().addControl(makeControl({ id: 'x' }));
      useDesignerStore.setState({ isDirty: false });

      useDesignerStore.getState().removeControl('x');
      expect(useDesignerStore.getState().isDirty).toBe(true);
    });

    it('markClean으로 false로 설정할 수 있다', () => {
      useDesignerStore.getState().addControl(makeControl());
      useDesignerStore.getState().markClean();
      expect(useDesignerStore.getState().isDirty).toBe(false);
    });
  });
});
