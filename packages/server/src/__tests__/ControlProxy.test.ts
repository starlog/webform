import { describe, it, expect } from 'vitest';
import { snapshotState, diffToPatches, buildControlsContext } from '../services/ControlProxy.js';

describe('ControlProxy', () => {
  describe('snapshotState', () => {
    it('원본과 독립적인 깊은 복사를 반환해야 한다', () => {
      const state = { lbl: { text: 'hello' } };
      const snapshot = snapshotState(state);

      state.lbl.text = 'changed';

      expect(snapshot.lbl.text).toBe('hello');
    });
  });

  describe('diffToPatches', () => {
    it('속성 변경 시 UIPatch를 생성해야 한다', () => {
      const before = { lblStatus: { text: '초기값' } };
      const after = { lblStatus: { text: '클릭됨' } };

      const patches = diffToPatches(before, after);

      expect(patches).toHaveLength(1);
      expect(patches[0]).toEqual({
        type: 'updateProperty',
        target: 'lblStatus',
        payload: { text: '클릭됨' },
      });
    });

    it('여러 속성 변경 시 복수 UIPatch를 생성해야 한다', () => {
      const before = {
        lblStatus: { text: '초기값' },
        txtInput: { value: '', enabled: true },
      };
      const after = {
        lblStatus: { text: '완료' },
        txtInput: { value: '입력됨', enabled: false },
      };

      const patches = diffToPatches(before, after);

      expect(patches).toHaveLength(2);

      const lblPatch = patches.find((p) => p.target === 'lblStatus');
      expect(lblPatch).toEqual({
        type: 'updateProperty',
        target: 'lblStatus',
        payload: { text: '완료' },
      });

      const txtPatch = patches.find((p) => p.target === 'txtInput');
      expect(txtPatch).toEqual({
        type: 'updateProperty',
        target: 'txtInput',
        payload: { value: '입력됨', enabled: false },
      });
    });

    it('변경이 없으면 빈 배열을 반환해야 한다', () => {
      const state = { lbl: { text: 'hello' } };
      const patches = diffToPatches(state, { ...state });

      expect(patches).toHaveLength(0);
    });
  });

  describe('buildControlsContext', () => {
    it('현재 값을 반환해야 한다', () => {
      const state = {
        lblStatus: { text: '초기값', visible: true },
        txtName: { value: 'test' },
      };

      const ctx = buildControlsContext(state);

      expect(ctx.lblStatus.text).toBe('초기값');
      expect(ctx.lblStatus.visible).toBe(true);
      expect(ctx.txtName.value).toBe('test');
    });
  });
});
