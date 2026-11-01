// @vitest-environment jsdom
// 執行：npm test
// 使用者輸入紀錄：點按的小抖動不算捲動；程式平滑捲動中使用者一動就停下來交給使用者

import { test, beforeEach, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { userInput, trackUserInput, isUserScrollingWithin, smoothScrollTo, DRAG_THRESHOLD_PX } from './userInput.js';

trackUserInput();

let scrollTo;
beforeEach(() => {
  userInput.lastActivityAt = 0;
  userInput.start = null;
  scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  window.scrollTo = scrollTo;
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const touch = (type, x, y, target = document.body) => {
  const e = new Event(type, { bubbles: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }] });
  target.dispatchEvent(e);
};
const pointer = (type, x, y, buttons = 1, target = document.body) => {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons }));
};

test('Q1：觸控點按抖 2px 不算使用者捲動', () => {
  touch('touchstart', 100, 100);
  touch('touchmove', 102, 102);
  assert.equal(isUserScrollingWithin(1000), false);
});

test('Q1：觸控拖超過 10px 才算使用者捲動', () => {
  touch('touchstart', 100, 100);
  touch('touchmove', 100, 100 + DRAG_THRESHOLD_PX + 1);
  assert.equal(isUserScrollingWithin(1000), true);
});

test('Q1：滑鼠按著小幅移動不算，拖超過 10px 才算；沒按著的移動不算', () => {
  pointer('pointerdown', 50, 50);
  pointer('pointermove', 54, 53);
  assert.equal(isUserScrollingWithin(1000), false);
  pointer('pointermove', 300, 300, 0);
  assert.equal(isUserScrollingWithin(1000), false);
  pointer('pointermove', 50, 70);
  assert.equal(isUserScrollingWithin(1000), true);
});

test('Q1：滾輪、捲動鍵算；在輸入框裡按方向鍵不算', () => {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  assert.equal(isUserScrollingWithin(1000), false);
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
  assert.equal(isUserScrollingWithin(1000), true);
  userInput.lastActivityAt = 0;
  document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));
  assert.equal(isUserScrollingWithin(1000), true);
});

test('Q2：程式平滑捲動中滾輪 → 立刻停在目前位置，算使用者接手', () => {
  smoothScrollTo(800);
  assert.deepEqual(scrollTo.mock.calls.at(-1)[0], { top: 800, behavior: 'smooth' });
  assert.equal(userInput.programmaticScroll, true);
  document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -300 }));
  assert.deepEqual(scrollTo.mock.calls.at(-1)[0], { top: window.scrollY, behavior: 'instant' });
  assert.equal(userInput.programmaticScroll, false);
  assert.equal(isUserScrollingWithin(1000), true);
});

test('Q2：程式平滑捲動中在頁面上觸控 / 按下 → 停下來；按在膠囊、tab 列上不停', () => {
  const pill = document.createElement('button');
  pill.setAttribute('data-rest-pill', '');
  document.body.appendChild(pill);
  smoothScrollTo(800);
  pointer('pointerdown', 10, 10, 1, pill);
  assert.equal(userInput.programmaticScroll, true, '按在休息膠囊上不是在捲頁面');
  touch('touchstart', 100, 300);
  assert.equal(userInput.programmaticScroll, false);
  assert.deepEqual(scrollTo.mock.calls.at(-1)[0], { top: window.scrollY, behavior: 'instant' });
});

test('Q2：沒有程式捲動時使用者捲動，不會呼叫停止', () => {
  document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));
  assert.equal(scrollTo.mock.calls.length, 0);
});

test('Q2：減少動態效果時直接跳過去，不算進行中的平滑捲動', () => {
  smoothScrollTo(500, { reduce: true });
  assert.deepEqual(scrollTo.mock.calls.at(-1)[0], { top: 500 });
  assert.equal(userInput.programmaticScroll, false);
});
