import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달/다이얼로그에 포커스 트랩을 적용하는 훅.
 * - Tab/Shift+Tab을 내부 포커스 가능 요소로 제한
 * - 활성화 시 첫 번째 포커스 가능 요소로 자동 이동
 * - 비활성화 시 이전 포커스 요소로 복원
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, isActive: boolean): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !ref.current) return;

    // 이전 포커스 요소 기억
    previousFocusRef.current = document.activeElement as HTMLElement;

    const container = ref.current;

    // 첫 번째 포커스 가능 요소로 이동
    const focusFirst = () => {
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.focus();
      }
    };

    // 약간의 딜레이 후 포커스 이동 (렌더링 완료 후)
    const timer = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(timer);
      container.removeEventListener('keydown', handleKeyDown);

      // 이전 포커스 요소로 복원
      if (previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, ref]);
}
