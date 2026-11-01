// @vitest-environment jsdom
// 執行：npm test
// iOS 26 鍵盤收起後貼底固定層卡在畫面中間的修正（utils/viewportFix.js）

import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { viewportGap, installViewportFix } from './viewportFix.js';

const vvOf = (height, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale });

test('鍵盤收起後 visualViewport 還是矮的：差多少推多少', () => {
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(508), typing: false }), 336);
});

test('正常情況、打字中（鍵盤開著）、雙指放大中都不推', () => {
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(844), typing: false }), 0);
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(508), typing: true }), 0);
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(400, 0, 2), typing: false }), 0);
});

test('量到怪數字不推：不到 1px、超過畫面六成、visualViewport 比 innerHeight 還高', () => {
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(843.6), typing: false }), 0);
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(200), typing: false }), 0);
  assert.equal(viewportGap({ innerHeight: 844, vv: vvOf(900), typing: false }), 0);
  assert.equal(viewportGap({ innerHeight: 844, vv: null, typing: false }), 0);
});

// 假的 window：visualViewport 是可以發事件的物件
const fakeWindow = () => {
  const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  const win = Object.assign(new EventTarget(), {
    innerHeight: 844, visualViewport: vv, document,
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (id) => clearTimeout(id),
  });
  return { win, vv };
};
const gapVar = () => document.documentElement.style.getPropertyValue('--kb-gap');

let uninstall = () => {};
afterEach(() => {
  uninstall();
  vi.useRealTimers();
  document.body.innerHTML = '';
  document.documentElement.style.removeProperty('--kb-gap');
});

test('打字中不推；輸入框失焦、鍵盤收起後 visualViewport 卡住才推，恢復後歸零', () => {
  vi.useFakeTimers();
  const { win, vv } = fakeWindow();
  uninstall = installViewportFix(win);
  assert.equal(gapVar(), '0px');

  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  vv.height = 508; // 鍵盤開著
  vv.dispatchEvent(new Event('resize'));
  assert.equal(gapVar(), '0px');

  input.blur(); // 鍵盤收起，但 visualViewport 沒變回來（bug）
  vi.advanceTimersByTime(700);
  assert.equal(gapVar(), '336px');

  vv.height = 844; // 之後 WebKit 自己恢復
  vv.dispatchEvent(new Event('resize'));
  assert.equal(gapVar(), '0px');
});
