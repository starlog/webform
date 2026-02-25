import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';

const DRAG_THRESHOLD = 3;

interface UseFormDragOptions {
  enabled: boolean;
  isMaximized: boolean;
  formRef: RefObject<HTMLDivElement | null>;
}

export function useFormDrag({ enabled, isMaximized, formRef }: UseFormDragOptions) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const posRef = useRef(position);
  posRef.current = position;

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  const onTitleBarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!enabled || isMaximized) return;
      if (e.button !== 0) return;

      const formEl = formRef.current;
      if (!formEl) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startPosX = posRef.current.x;
      const startPosY = posRef.current.y;
      let isDragging = false;

      // 드래그 시작 시 부모 컨테이너와 폼 크기를 캡처
      const parent = formEl.offsetParent as HTMLElement | null;
      const parentW = parent ? parent.clientWidth : Infinity;
      const parentH = parent ? parent.clientHeight : Infinity;
      const formW = formEl.offsetWidth;
      const formH = formEl.offsetHeight;

      const onMouseMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;

        if (!isDragging) {
          if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
            return;
          }
          isDragging = true;
        }

        // 부모 영역 내로 클램핑
        const maxX = parentW - formW;
        const maxY = parentH - formH;
        const newX = Math.max(0, Math.min(maxX, startPosX + dx));
        const newY = Math.max(0, Math.min(maxY, startPosY + dy));

        setPosition({ x: newX, y: newY });
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [enabled, isMaximized, formRef],
  );

  // enabled가 꺼지면 위치 리셋
  useEffect(() => {
    if (!enabled) {
      setPosition({ x: 0, y: 0 });
    }
  }, [enabled]);

  return { position, onTitleBarMouseDown, resetPosition };
}
