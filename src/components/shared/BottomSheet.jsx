import React, { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Presence, { prefersReducedMotion } from './Presence';

// 退場動畫長度，SheetPresence 等這麼久才卸載
const EXIT_MS = 350;
// 往下拖超過這個距離、或放開時還在快速下滑，就關閉
const DISMISS_DISTANCE = 100;
const DISMISS_VELOCITY = 0.5; // px / ms

// sheet 關閉時先播完退場再卸載：<SheetPresence>{open && <BottomSheet … />}</SheetPresence>
export const SheetPresence = ({ children }) => <Presence exitMs={EXIT_MS}>{children}</Presence>;

// iOS 式底部 sheet。z-[60] 疊在底部 tab 列（z-50）上面，底部留 home indicator 的安全區。
// 從下往上滑入；頂端（把手與標題列）往下拖跟手，超過 100px 或快速下滑就關閉。
// 遮罩點了關閉、Esc 關閉；開啟時焦點移進來（有 data-autofocus 的元素優先），卸載時還給開啟前的元素。
// doneLabel：右上角用文字按鈕（例如「完成」）取代關閉圖示
const BottomSheet = ({ title, onClose, children, footer, doneLabel, exiting = false, ...rest }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    const target = panel?.querySelector('[data-autofocus]') ?? panel;
    target?.focus({ preventScroll: true });
    return () => {
      // 退場時另一個 sheet 已經開了（例如動作選項 → 替換動作），焦點在新 sheet 裡就不搶回來
      const active = document.activeElement;
      const focusLeft = !active || active === document.body || panel?.contains(active);
      if (focusLeft && previous?.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (exiting) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [exiting]);

  const onPointerDown = (e) => {
    if (exiting || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    dragRef.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // 往上拖有阻力，最多 24px
    setDragY(dy >= 0 ? dy : Math.max(-24, dy / 4));
  };

  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null;
    setDragging(false);
    const dy = e.clientY - d.startY;
    if (e.type === 'pointerup' && (dy > DISMISS_DISTANCE || (dy > 12 && d.velocity > DISMISS_VELOCITY))) {
      // 留著 dragY：退場從放手的位置接著滑出去
      onCloseRef.current();
      return;
    }
    setDragY(0);
  };

  const reduceMotion = prefersReducedMotion();
  // 減少動態效果：退場不滑，原地淡出
  const offset = exiting && !reduceMotion ? '100%' : `${dragY}px`;
  const panelHeight = panelRef.current?.offsetHeight || 600;
  const backdropOpacity = exiting ? 0 : Math.max(0, 1 - Math.max(0, dragY) / panelHeight);
  const transition = dragging
    ? 'none'
    : reduceMotion
      ? 'opacity 200ms ease-out'
      : 'transform 400ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out';

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/50 ${exiting ? 'pointer-events-none' : 'sheet-backdrop-in'}`}
        style={{ opacity: backdropOpacity, transition: dragging ? 'none' : 'opacity 300ms ease-out' }}
        onClick={exiting ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[90vh] w-full max-w-[480px] flex-col rounded-t-[28px] bg-card pb-[env(safe-area-inset-bottom)] text-label shadow-[0_-10px_40px_rgba(0,0,0,0.5)] focus:outline-none ${exiting ? 'pointer-events-none' : 'sheet-in'}`}
        style={{
          transform: `translateY(${offset})`,
          opacity: exiting && reduceMotion ? 0 : 1,
          transition,
        }}
        {...rest}
      >
        {/* 把手與標題列：拖曳區 */}
        <div
          className="relative shrink-0 cursor-grab touch-none select-none px-2 pb-1 pt-4 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="absolute left-1/2 top-1.5 h-[5px] w-9 -translate-x-1/2 rounded-full bg-grabber" aria-hidden="true" />
          <div className="flex min-h-11 items-center gap-1">
            <span className="w-14 shrink-0" aria-hidden="true" />
            <h3 id={titleId} className="min-w-0 flex-1 truncate text-center text-body font-semibold text-label">{title}</h3>
            {doneLabel ? (
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-14 shrink-0 items-center justify-center rounded-full text-body font-semibold text-accent-text"
              >
                {doneLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉"
                className="flex h-11 w-14 shrink-0 items-center justify-center rounded-full"
              >
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-fill text-label-2">
                  <X size={16} strokeWidth={2.5} aria-hidden="true" />
                </span>
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer}
      </div>
    </>
  );
};

export default BottomSheet;
