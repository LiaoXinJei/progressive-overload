// 整個 App 共用的使用者輸入紀錄（訓練頁卸載時也照記，例如在營養頁捲完馬上切回訓練頁）。
//
// - lastActivityAt：使用者最近一次「自己在捲」的時間。只算真的捲動：滾輪、離按下點超過 10px 的拖動、
//   會捲動的按鍵（方向鍵、PageUp / PageDown、空白鍵、Home / End；在輸入框裡按的不算）。
//   點按時手指抖一兩 px 不算，不然換天時的自動捲動會被誤擋。
// - modality：最後一次輸入是鍵盤還是指標，決定程式移焦時要不要讓焦點框出現。
// - 程式觸發的平滑捲動（smoothScrollTo）進行中，使用者一滾輪、按下、觸控或按捲動鍵就立刻停下來交給使用者，
//   不然平滑捲動會把使用者的捲動拉回去。

export const DRAG_THRESHOLD_PX = 10;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ', 'Home', 'End']);
// 平滑捲動最長多久；瀏覽器有 scrollend 時以它為準
const SMOOTH_SCROLL_MAX_MS = 1200;

export const userInput = {
  lastActivityAt: 0,
  modality: 'pointer',
  tracking: false,
  // 按下 / 觸控開始的位置（算拖動距離）
  start: null,
  // 程式觸發的平滑捲動是否進行中
  programmaticScroll: false,
};

let programmaticTimer = null;

const isTypingTarget = (el) => Boolean(el?.closest?.('input, textarea, select, [contenteditable="true"]'));
// 空白鍵按在按鈕上是「按下按鈕」，不是捲動（例如用鍵盤切 D1–D5）
const isActivatableTarget = (el) => Boolean(el?.closest?.('button, [role="button"], [role="switch"], [role="tab"], summary'));
// 固定在畫面上的層（頂部 bar、tab 列、休息膠囊、sheet）上按下不是在捲頁面
const isOverlayTarget = (el) => Boolean(el?.closest?.('header, nav, [data-rest-pill], [role="dialog"], [role="alertdialog"]'));

const endProgrammaticScroll = () => {
  clearTimeout(programmaticTimer);
  programmaticTimer = null;
  userInput.programmaticScroll = false;
};

// 使用者接手：停掉進行中的程式捲動（停在現在的位置，使用者自己的捲動接著算）
const userTakesOver = () => {
  if (userInput.programmaticScroll) {
    endProgrammaticScroll();
    window.scrollTo({ top: window.scrollY, behavior: 'instant' });
  }
};

const markActivity = () => {
  userInput.lastActivityAt = Date.now();
  userTakesOver();
};

export const isUserScrollingWithin = (ms) => Date.now() - userInput.lastActivityAt < ms;

// 程式觸發的捲動：reduce（減少動態效果）時直接跳過去，不然平滑捲，捲動中使用者一動就停
export const smoothScrollTo = (top, { reduce = false } = {}) => {
  if (reduce) {
    window.scrollTo({ top });
    return;
  }
  endProgrammaticScroll();
  userInput.programmaticScroll = true;
  window.scrollTo({ top, behavior: 'smooth' });
  programmaticTimer = setTimeout(endProgrammaticScroll, SMOOTH_SCROLL_MAX_MS);
};

export const trackUserInput = () => {
  if (userInput.tracking || typeof document === 'undefined') return;
  userInput.tracking = true;

  const pointFrom = (e) => {
    const t = e.touches?.[0] ?? e;
    return typeof t?.clientX === 'number' ? { x: t.clientX, y: t.clientY } : null;
  };
  const begin = (e) => {
    userInput.start = pointFrom(e);
    // 在頁面上按下（不是按在頂部 bar、tab 列、膠囊、sheet 上）：使用者要自己捲或點，先停掉程式捲動
    if (!isOverlayTarget(e.target)) userTakesOver();
  };
  const move = (e) => {
    if (e.type === 'pointermove' && !e.buttons) return;
    const start = userInput.start;
    const p = pointFrom(e);
    if (!start || !p) return;
    if (Math.hypot(p.x - start.x, p.y - start.y) > DRAG_THRESHOLD_PX) markActivity();
  };

  // 程式平滑捲動中滾第一格：userTakesOver 的原地停下會把瀏覽器這一格的捲動蓋掉，
  // 下一個 frame 如果位置還沒動，就自己補上這一格的位移
  const onWheel = (e) => {
    const wasProgrammatic = userInput.programmaticScroll;
    markActivity();
    if (!wasProgrammatic || !e.deltaY) return;
    const before = window.scrollY;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - before) < 1) {
        window.scrollTo({ top: before + e.deltaY * unit, behavior: 'instant' });
      }
    });
  };

  document.addEventListener('wheel', onWheel, { capture: true, passive: true });
  document.addEventListener('touchstart', begin, { capture: true, passive: true });
  document.addEventListener('touchmove', move, { capture: true, passive: true });
  document.addEventListener('pointerdown', (e) => {
    userInput.modality = 'pointer';
    begin(e);
  }, true);
  document.addEventListener('pointermove', move, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) userInput.modality = 'keyboard';
    if (!SCROLL_KEYS.has(e.key) || isTypingTarget(e.target)) return;
    if (e.key === ' ' && isActivatableTarget(e.target)) return;
    markActivity();
  }, true);
  window.addEventListener('scrollend', () => {
    if (userInput.programmaticScroll) endProgrammaticScroll();
  });
};
