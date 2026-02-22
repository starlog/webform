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
    it('이전 스냅샷을 반환한다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().pushSnapshot('snap-2');

      const result = useHistoryStore.getState().undo();
      expect(result).toBe('snap-1');
    });

    it('past가 비어있으면 null을 반환한다', () => {
      const result = useHistoryStore.getState().undo();
      expect(result).toBeNull();
    });

    it('undo 후 canRedo가 true가 된다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().pushSnapshot('snap-2');
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canRedo).toBe(true);
    });
  });

  describe('redo', () => {
    it('undo 후 redo하면 해당 스냅샷을 반환한다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().pushSnapshot('snap-2');
      useHistoryStore.getState().undo();

      const result = useHistoryStore.getState().redo();
      expect(result).toBe('snap-2');
    });

    it('future가 비어있으면 null을 반환한다', () => {
      const result = useHistoryStore.getState().redo();
      expect(result).toBeNull();
    });

    it('redo 후 canUndo가 true가 된다', () => {
      useHistoryStore.getState().pushSnapshot('snap-1');
      useHistoryStore.getState().pushSnapshot('snap-2');
      useHistoryStore.getState().undo();
      useHistoryStore.getState().redo();
      expect(useHistoryStore.getState().canUndo).toBe(true);
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
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canRedo).toBe(true);

      useHistoryStore.getState().pushSnapshot('snap-3');
      expect(useHistoryStore.getState().canRedo).toBe(false);
    });
  });
});
