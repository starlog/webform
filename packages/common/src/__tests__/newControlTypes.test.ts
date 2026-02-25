import { describe, it, expect } from 'vitest';
import { CONTROL_TYPES } from '../types/form';
import { CONTROL_EVENTS } from '../types/events';
import type { ControlType } from '../types/form';

describe('신규 컨트롤 타입 등록 검증', () => {
  const NEW_TYPES = [
    'Slider', 'Switch', 'Upload', 'Alert', 'Tag', 'Divider',
    'Card', 'Badge', 'Avatar', 'Tooltip', 'Collapse', 'Statistic',
  ] as const;

  describe('CONTROL_TYPES에 12개 신규 타입 포함', () => {
    it.each(NEW_TYPES)('%s이(가) CONTROL_TYPES에 포함되어야 한다', (type) => {
      expect(CONTROL_TYPES).toContain(type);
    });

    it('신규 타입이 총 12개여야 한다', () => {
      const found = NEW_TYPES.filter((t) => CONTROL_TYPES.includes(t));
      expect(found).toHaveLength(12);
    });
  });

  describe('CONTROL_EVENTS에 7개 이벤트 그룹 포함', () => {
    const EVENT_GROUPS = {
      Slider: ['ValueChanged'],
      Switch: ['CheckedChanged'],
      Upload: ['FileSelected', 'UploadCompleted', 'UploadFailed'],
      Alert: ['Closed'],
      Tag: ['TagAdded', 'TagRemoved', 'TagClicked'],
      Tooltip: ['VisibleChanged'],
      Collapse: ['ActiveKeyChanged'],
    } as const;

    it.each(Object.keys(EVENT_GROUPS))('%s 이벤트 그룹이 등록되어야 한다', (group) => {
      expect(CONTROL_EVENTS).toHaveProperty(group);
      expect(CONTROL_EVENTS[group].length).toBeGreaterThan(0);
    });

    it.each(Object.entries(EVENT_GROUPS))(
      '%s의 이벤트 목록이 정확해야 한다',
      (group, expectedEvents) => {
        expect([...CONTROL_EVENTS[group]]).toEqual([...expectedEvents]);
      },
    );
  });

  describe('이벤트 미등록 타입 확인 (의도적)', () => {
    const NO_EVENT_TYPES = ['Divider', 'Card', 'Badge', 'Avatar', 'Statistic'];

    it.each(NO_EVENT_TYPES)('%s은(는) 고유 이벤트가 없어야 한다 (공통 이벤트만 사용)', (type) => {
      expect(CONTROL_EVENTS[type]).toBeUndefined();
    });
  });

  describe('TypeScript 타입 추론 검증', () => {
    it('신규 타입이 ControlType 유니온에 포함되어야 한다', () => {
      // 컴파일 타임 검증: 아래 할당이 타입 오류 없이 가능해야 함
      const slider: ControlType = 'Slider';
      const switchType: ControlType = 'Switch';
      const upload: ControlType = 'Upload';
      const alert: ControlType = 'Alert';
      const tag: ControlType = 'Tag';
      const divider: ControlType = 'Divider';
      const card: ControlType = 'Card';
      const badge: ControlType = 'Badge';
      const avatar: ControlType = 'Avatar';
      const tooltip: ControlType = 'Tooltip';
      const collapse: ControlType = 'Collapse';
      const statistic: ControlType = 'Statistic';

      // 런타임 검증
      expect(slider).toBe('Slider');
      expect(switchType).toBe('Switch');
      expect(upload).toBe('Upload');
      expect(alert).toBe('Alert');
      expect(tag).toBe('Tag');
      expect(divider).toBe('Divider');
      expect(card).toBe('Card');
      expect(badge).toBe('Badge');
      expect(avatar).toBe('Avatar');
      expect(tooltip).toBe('Tooltip');
      expect(collapse).toBe('Collapse');
      expect(statistic).toBe('Statistic');
    });
  });
});
