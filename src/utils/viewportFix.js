// iOS 26 的 WebKit bug（WebKit 297779 / FB19889436）：鍵盤收起之後 visualViewport.height 沒有變回來，
// 貼在畫面底部的 position: fixed 元素（tab 列、休息膠囊、sheet）停在鍵盤上緣的位置，卡在畫面中間。
// 沒在打字的時候，量 window.innerHeight 和 visualViewport 底部差多少寫進 --kb-gap，
// 貼底的固定層加 .kb-fix（負的 margin-bottom）推回畫面底部。正常情況差距是 0，其他瀏覽器不受影響。

const isTypingTarget = (el) => Boolean(el?.closest?.('input, textarea, select, [contenteditable="true"]'));

// 回傳要往下推多少 px
export const viewportGap = ({ innerHeight, vv, typing }) => {
  // 打字中鍵盤開著，visualViewport 本來就比較矮，不動
  if (!vv || typing) return 0;
  // 使用者雙指放大中，visualViewport 本來就比較小
  if (Math.abs((vv.scale ?? 1) - 1) > 0.01) return 0;
  const gap = Math.round(innerHeight - (vv.height + vv.offsetTop));
  // 差不到 1px 當作沒有；超過畫面六成當作量錯，不動
  return gap >= 1 && gap < innerHeight * 0.6 ? gap : 0;
};

export const installViewportFix = (win = window) => {
  const vv = win.visualViewport;
  if (!vv) return () => {};
  const doc = win.document;
  let last = null;
  const update = () => {
    const gap = viewportGap({ innerHeight: win.innerHeight, vv, typing: isTypingTarget(doc.activeElement) });
    if (gap === last) return;
    last = gap;
    doc.documentElement.style.setProperty('--kb-gap', `${gap}px`);
  };
  // 鍵盤收起的動畫跑完 visualViewport 才定下來：失焦後隔一下再多量幾次
  const timers = new Set();
  const settle = () => {
    update();
    for (const ms of [100, 300, 700]) {
      const id = win.setTimeout(() => { timers.delete(id); update(); }, ms);
      timers.add(id);
    }
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  win.addEventListener('resize', update);
  win.addEventListener('scroll', update, { passive: true });
  doc.addEventListener('focusin', update);
  doc.addEventListener('focusout', settle);
  update();
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    win.removeEventListener('resize', update);
    win.removeEventListener('scroll', update);
    doc.removeEventListener('focusin', update);
    doc.removeEventListener('focusout', settle);
    timers.forEach(id => win.clearTimeout(id));
  };
};
