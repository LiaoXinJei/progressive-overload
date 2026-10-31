import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// 手機底部抽屜。z-[60] 疊在底部 tab 列（z-50）上面，底部留 home indicator 的安全區。
// 遮罩點了關閉、Esc 關閉；開啟時焦點移進來（有 data-autofocus 的元素優先），關閉時還給開啟前的元素
const BottomSheet = ({ title, onClose, children, footer, ...rest }) => {
  const panelRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    const target = panel?.querySelector('[data-autofocus]') ?? panel;
    target?.focus({ preventScroll: true });
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous?.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-hall/80" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-in fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[85vh] w-full max-w-[480px] flex-col rounded-t-2xl border-t border-line bg-hall-2 pb-[env(safe-area-inset-bottom)] text-fg shadow-[0_-8px_32px_rgba(0,0,0,0.45)] focus:outline-none"
        {...rest}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-1">
          <h3 id={titleId} className="min-w-0 truncate text-xl font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface hover:text-fg"
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer}
      </div>
    </>
  );
};

export default BottomSheet;
