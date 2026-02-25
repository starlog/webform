import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CanvasControl } from '../components/Canvas/CanvasControl';
import { ResizeHandle } from '../components/Canvas/ResizeHandle';
import { useDesignerStore } from '../stores/designerStore';
import type { ControlDefinition } from '@webform/common';

// react-dnd provider 없이 테스트하기 위한 mock
vi.mock('react-dnd', () => ({
  useDrag: () => [{ isDragging: false }, vi.fn(), vi.fn()],
  useDrop: () => [{}, vi.fn()],
}));

const mockControl: ControlDefinition = {
  id: 'ctrl1',
  type: 'Button',
  name: 'button1',
  properties: { text: 'Test' },
  position: { x: 10, y: 20 },
  size: { width: 100, height: 30 },
  anchor: { top: true, left: true, bottom: false, right: false },
  dock: 'None',
  tabIndex: 0,
  visible: true,
  enabled: true,
};

describe('CanvasControl cleanup 테스트', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // designerStore에 컨트롤 추가
    useDesignerStore.setState({
      controls: [mockControl],
      gridSize: 1,
    });

    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    cleanup();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('컴포넌트 언마운트 시 드래그 중인 document 이벤트 리스너가 제거된다', () => {
    const onSnaplineChange = vi.fn();
    const { container, unmount } = render(
      <CanvasControl
        control={mockControl}
        isSelected={false}
        onSnaplineChange={onSnaplineChange}
      />,
    );

    const controlEl = container.querySelector('.canvas-control')!;

    // mousedown으로 드래그 시작 → document에 mousemove/mouseup 등록
    fireEvent.mouseDown(controlEl, { clientX: 50, clientY: 50 });

    const moveListenersBefore = addSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    ).length;
    const upListenersBefore = addSpy.mock.calls.filter(
      (call) => call[0] === 'mouseup',
    ).length;

    expect(moveListenersBefore).toBeGreaterThan(0);
    expect(upListenersBefore).toBeGreaterThan(0);

    // 드래그 중 언마운트 (정상적이지 않은 상황)
    unmount();

    // cleanup에 의해 removeEventListener가 호출됨
    const moveRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    ).length;
    const upRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mouseup',
    ).length;

    expect(moveRemoved).toBeGreaterThan(0);
    expect(upRemoved).toBeGreaterThan(0);
  });

  it('정상 드래그 완료 후 언마운트 시 중복 removeEventListener가 호출되지 않는다', () => {
    const onSnaplineChange = vi.fn();
    const { container, unmount } = render(
      <CanvasControl
        control={mockControl}
        isSelected={false}
        onSnaplineChange={onSnaplineChange}
      />,
    );

    const controlEl = container.querySelector('.canvas-control')!;

    // 드래그 시작
    fireEvent.mouseDown(controlEl, { clientX: 50, clientY: 50 });

    // 드래그 완료 (mouseup)
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    removeSpy.mockClear();

    // 언마운트 — activeDragListeners가 null이므로 추가 remove 없어야 함
    unmount();

    const moveRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    ).length;
    const upRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mouseup',
    ).length;

    expect(moveRemoved).toBe(0);
    expect(upRemoved).toBe(0);
  });
});

describe('ResizeHandle cleanup 테스트', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useDesignerStore.setState({
      controls: [mockControl],
      gridSize: 1,
    });

    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    cleanup();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('리사이즈 중 언마운트 시 document 이벤트 리스너가 제거된다', () => {
    const { container, unmount } = render(
      <ResizeHandle direction="se" controlId="ctrl1" />,
    );

    const handleEl = container.querySelector('.resize-handle')!;

    // mousedown으로 리사이즈 시작
    fireEvent.mouseDown(handleEl, { clientX: 100, clientY: 100 });

    const moveAdded = addSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    ).length;
    expect(moveAdded).toBeGreaterThan(0);

    // 리사이즈 중 언마운트
    unmount();

    // cleanup에 의해 removeEventListener가 호출됨
    const moveRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    ).length;
    const upRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mouseup',
    ).length;

    expect(moveRemoved).toBeGreaterThan(0);
    expect(upRemoved).toBeGreaterThan(0);
  });

  it('정상 리사이즈 완료 후 언마운트 시 중복 removeEventListener가 없다', () => {
    const { container, unmount } = render(
      <ResizeHandle direction="se" controlId="ctrl1" />,
    );

    const handleEl = container.querySelector('.resize-handle')!;

    // 리사이즈 시작 → 완료
    fireEvent.mouseDown(handleEl, { clientX: 100, clientY: 100 });
    fireEvent(document, new MouseEvent('mouseup', { bubbles: true }));

    removeSpy.mockClear();

    // 언마운트
    unmount();

    const moveRemoved = removeSpy.mock.calls.filter(
      (call) => call[0] === 'mousemove',
    ).length;
    expect(moveRemoved).toBe(0);
  });
});
