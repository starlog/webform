import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '../stores/historyStore';

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
  });

  describe('pushSnapshot', () => {
    it('스냅샷을 저장한다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      expect(useHistoryStore.getState().past).toEqual(['snap-1']);
    });

    it('여러 스냅샷을 순서대로 저장한다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().pushSnapshot('snap-2');
      expect(useHistoryStore.getState().past).toEqual(['snap-1', 'snap-2']);
    });
  });

  describe('undo', () => {
    it('마지막 스냅샷을 반환하고 현재 상태를 future에 저장한다', () => {
      useHistoryStore.getState().pushSnapshot('before-change');

      const result = useHistoryStore.getState().undo('current');
      expect(result).toBe('before-change');
      expect(useHistoryStore.getState().past).toEqual([]);
      expect(useHistoryStore.getState().future).toEqual(['current']);
    });

    it('여러 undo를 순차적으로 수행할 수 있다', () => {
      useHistoryStore.getState().pushSnapshot('state-0');
      useHistoryStore.getState().pushSnapshot('state-1');

      const r1 = useHistoryStore.getState().undo('state-2');
      expect(r1).toBe('state-1');

      const r2 = useHistoryStore.getState().undo('state-1');
      expect(r2).toBe('state-0');
    });

    it('past가 비어있으면 null을 반환한다', () => {
      const result = useHistoryStore.getState().undo('current');
      expect(result).toBeNull();
    });

    it('undo 후 canRedo가 true가 된다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().undo('current');
      expect(useHistoryStore.getState().canRedo).toBe(true);
    });

    it('모든 past를 undo하면 canUndo가 false가 된다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().undo('current');
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });
  });

  describe('redo', () => {
    it('undo 후 redo하면 현재 상태를 복원한다', () => {
      useHistoryStore.getState().pushSnapshot('before');
      useHistoryStore.getState().undo('after');

      const result = useHistoryStore.getState().redo('before');
      expect(result).toBe('after');
    });

    it('future가 비어있으면 null을 반환한다', () => {
      const result = useHistoryStore.getState().redo('current');
      expect(result).toBeNull();
    });

    it('redo 후 canUndo가 true가 된다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().undo('current');
      useHistoryStore.getState().redo('snap-1');
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });
  });

  describe('undo/redo 통합 시나리오', () => {
    it('push-push-undo-undo-redo-redo로 상태가 올바르게 변한다', () => {
      // state-0 → change1 → state-1 → change2 → state-2
      useHistoryStore.getState().pushSnapshot('state-0');
      useHistoryStore.getState().pushSnapshot('state-1');

      // undo change2: state-2 → state-1
      const u1 = useHistoryStore.getState().undo('state-2');
      expect(u1).toBe('state-1');

      // undo change1: state-1 → state-0
      const u2 = useHistoryStore.getState().undo('state-1');
      expect(u2).toBe('state-0');

      // redo change1: state-0 → state-1
      const r1 = useHistoryStore.getState().redo('state-0');
      expect(r1).toBe('state-1');

      // redo change2: state-1 → state-2
      const r2 = useHistoryStore.getState().redo('state-1');
      expect(r2).toBe('state-2');
    });

    it('undo 후 새 변경을 하면 future가 초기화된다', () => {
      useHistoryStore.getState().pushSnapshot('state-0');
      useHistoryStore.getState().pushSnapshot('state-1');
      useHistoryStore.getState().undo('state-2');
      expect(useHistoryStore.getState().canRedo).toBe(true);

      useHistoryStore.getState().pushSnapshot('state-1-new');
      expect(useHistoryStore.getState().canRedo).toBe(false);
      expect(useHistoryStore.getState().future).toEqual([]);
    });
  });

  describe('50개 초과 시 오래된 것 제거', () => {
    it('MAX_HISTORY(50)를 초과하면 가장 오래된 스냅샷이 제거된다', () => {
      for (let i = 0; i < 55; i++) {
        useHistoryStore.getState().pushSnapshot(`snap-${i}`);
      }

      const { past } = useHistoryStore.getState();
      expect(past).toHaveLength(50);
      expect(past[0]).toBe('snap-5');
      expect(past[49]).toBe('snap-54');
    });
  });

  describe('canUndo / canRedo', () => {
    it('초기 상태에서 canUndo는 false이다', () => {
      expect(useHistoryStore.getState().canUndo).toBe(false);
    });

    it('초기 상태에서 canRedo는 false이다', () => {
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });

    it('pushSnapshot 후 canUndo는 true이다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      expect(useHistoryStore.getState().canUndo).toBe(true);
    });

    it('새 스냅샷 추가 시 future가 초기화되어 canRedo가 false가 된다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().pushSnapshot('snap-2');
      useHistoryStore.getState().undo('current');
      expect(useHistoryStore.getState().canRedo).toBe(true);

      useHistoryStore.getState().pushSnapshot('snap-3');
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });
  });
});
