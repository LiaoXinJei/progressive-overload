import { cloneElement, useEffect, useReducer, useRef } from 'react';

// jsdom（測試）沒有 matchMedia 也沒有版面：不播退場，直接卸載
export const canAnimate = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';
export const prefersReducedMotion = () => canAnimate() && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 元件拿掉時先播完退場再卸載：<Presence exitMs={350}>{show && <Thing … />}</Presence>。
// 拿掉後留著最後一次的元素（內容可能已經沒有對應的 state），加上 exiting 讓它自己播退場。
// 退場還沒播完又顯示：換一個 key 重新掛載，不沿用退場中的那一個（拖到一半的位移、焦點都重來）
const Presence = ({ children, exitMs }) => {
  const lastRef = useRef(null);
  const genRef = useRef(0);
  const wasExitingRef = useRef(false);
  const [, rerender] = useReducer(n => n + 1, 0);
  const present = Boolean(children);
  if (present) {
    if (wasExitingRef.current) genRef.current += 1;
    lastRef.current = children;
  }
  const exiting = !present && lastRef.current != null;
  wasExitingRef.current = exiting;

  useEffect(() => {
    if (!exiting) return undefined;
    const finish = () => {
      lastRef.current = null;
      wasExitingRef.current = false;
      rerender();
    };
    if (!canAnimate()) {
      finish();
      return undefined;
    }
    const timer = setTimeout(finish, exitMs);
    return () => clearTimeout(timer);
  }, [exiting, exitMs]);

  if (!lastRef.current) return null;
  const key = `presence-${genRef.current}`;
  return present ? cloneElement(children, { key }) : cloneElement(lastRef.current, { key, exiting: true });
};

export default Presence;
