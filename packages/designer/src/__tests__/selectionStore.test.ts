import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from '../stores/selectionStore';
import type { ControlDefinition } from '@webform/common';

function makeControl(overrides: Partial<ControlDefinition> = {}): ControlDefinition {
  return {
    id: overrides.id ?? 'ctrl-1',
    type: 'Button',
    name: overrides.name ?? 'button1',
    properties: { text: 'Button' },
    position: overrides.position ?? { x: 100, y: 200 },
    size: { width: 75, height: 23 },
    anchor: { top: true, bottom: false, left: true, right: false },
    dock: 'None',
    tabIndex: 0,
    visible: true,
    enabled: true,
    ...overrides,
  };
}

describe('selectionStore', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedIds: new Set<string>(),
      clipboard: [],
    });
  });

  describe('select', () => {
    it('단일 컨트롤을 선택한다', () => {
      useSelectionStore.getState().select('a');
      expect(useSelectionStore.getState().selectedIds).toEqual(new Set(['a']));
    });

    it('select 호출 시 기존 선택이 해제된다', () => {
      useSelectionStore.getState().select('a');
      useSelectionStore.getState().select('b');
      expect(useSelectionStore.getState().selectedIds).toEqual(new Set(['b']));
    });
  });

  describe('deselect', () => {
    it('특정 컨트롤의 선택을 해제한다', () => {
      useSelectionStore.setState({ selectedIds: new Set(['a', 'b']) });
      useSelectionStore.getState().deselect('a');
      expect(useSelectionStore.getState().selectedIds).toEqual(new Set(['b']));
    });
  });

  describe('toggleSelect', () => {
    it('선택되지 않은 컨트롤을 선택한다', () => {
      useSelectionStore.getState().toggleSelect('a');
      expect(useSelectionStore.getState().selectedIds.has('a')).toBe(true);
    });

    it('이미 선택된 컨트롤의 선택을 해제한다', () => {
      useSelectionStore.setState({ selectedIds: new Set(['a']) });
      useSelectionStore.getState().toggleSelect('a');
      expect(useSelectionStore.getState().selectedIds.has('a')).toBe(false);
    });
  });

  describe('clearSelection', () => {
    it('모든 선택을 해제한다', () => {
      useSelectionStore.setState({ selectedIds: new Set(['a', 'b', 'c']) });
      useSelectionStore.getState().clearSelection();
      expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    });
  });

  describe('copySelected + pasteControls', () => {
    it('붙여넣기 시 새로운 ID를 가진다', () => {
      const original = makeControl({ id: 'orig-id', name: 'button1' });
      useSelectionStore.getState().copySelected([original]);

      const pasted = useSelectionStore.getState().pasteControls();
      expect(pasted).toHaveLength(1);
      expect(pasted[0].id).not.toBe('orig-id');
    });

    it('붙여넣기 시 position에 +16px 오프셋이 적용된다', () => {
      const original = makeControl({ position: { x: 100, y: 200 } });
      useSelectionStore.getState().copySelected([original]);

      const pasted = useSelectionStore.getState().pasteControls();
      expect(pasted[0].position).toEqual({ x: 116, y: 216 });
    });

    it('붙여넣기 시 새로운 이름이 생성된다', () => {
      const original = makeControl({ name: 'button1' });
      useSelectionStore.getState().copySelected([original]);

      const pasted = useSelectionStore.getState().pasteControls();
      expect(pasted[0].name).toBe('button2');
    });

    it('여러 컨트롤을 복사/붙여넣기할 수 있다', () => {
      const controls = [
        makeControl({ id: 'a', name: 'button1', position: { x: 10, y: 20 } }),
        makeControl({ id: 'b', name: 'label3', position: { x: 50, y: 60 } }),
      ];
      useSelectionStore.getState().copySelected(controls);

      const pasted = useSelectionStore.getState().pasteControls();
      expect(pasted).toHaveLength(2);
      expect(pasted[0].id).not.toBe('a');
      expect(pasted[1].id).not.toBe('b');
      expect(pasted[0].position).toEqual({ x: 26, y: 36 });
      expect(pasted[1].position).toEqual({ x: 66, y: 76 });
    });
  });
});
