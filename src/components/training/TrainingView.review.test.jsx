// @vitest-environment jsdom
// 執行：npm test
//
// 訓練頁改版驗收（設計驗收 + bug review）的回歸測試：浮卡不卡在已完成的組、✓ 彈一下不重播、
// 休息膠囊（時間格式、超過目標、跨午夜）、動作進度條顏色、拖曳把手、sheet 焦點與背景捲動鎖

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MIN = 60 * 1000;
const T0 = new Date(2026, 10, 1, 19, 30).getTime();
const done = (weight, reps, completedAt) => ({ weight, reps: String(reps), done: true, completedAt });
const key = (exId, idx, week = 3, day = 1) => `w${week}-d${day}-${exId}-s${idx}`;

let root = null;
let container = null;

afterEach(() => {
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.documentElement.style.overflow = '';
});

// W3 PULL A，引體向上這週 4 組（草圖的情境）
const renderView = ({
  logs = {}, history = { pullup: { weight: 0, reps: '9' } }, week = 3, day = 1,
  customSets = { 'w3-B-pullup': 4 }, currentTime = T0,
} = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [h, setH] = useState(history);
    const [d, setD] = useState(day);
    state.logs = l;
    state.setDay = setD;
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={h} setHistory={setH}
        currentWeek={week} currentDay={d} setCurrentDay={setD}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={{}} setCustomExercises={noop}
        customSets={customSets} setCustomSets={noop}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY} exerciseOverrides={{}} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={currentTime}
        restTarget={120}
      />
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return state;
};

const click = (el) => act(() => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const rowOf = (logKey) => container.querySelector(`[data-weight-input][data-log-key="${logKey}"]`).closest('[data-set-row]');
const currentKey = () => container.querySelector('[data-set-row][data-current] [data-weight-input]')?.dataset.logKey ?? null;
const pill = () => container.querySelector('[data-rest-pill]');

const twoDone = () => ({
  [key('pullup', 0)]: done(0, 10, T0 - 4 * MIN),
  [key('pullup', 1)]: done(0, 9, T0 - 84 * 1000),
});

// ==================== B1：浮卡卡在已完成的組 ====================

test('B1：聚焦已完成的第 2 組改數字，再直接按第 3 組 ✓，浮卡移到第 4 組，不留在第 2 組', () => {
  const state = renderView({ logs: twoDone() });
  act(() => rowOf(key('pullup', 1)).querySelector('[data-weight-input]').focus());
  assert.equal(currentKey(), key('pullup', 1));
  click(rowOf(key('pullup', 2)).querySelector('[data-complete-btn]'));
  assert.equal(state.logs[key('pullup', 2)].done, true);
  assert.equal(currentKey(), key('pullup', 3));
  // 浮卡下排的「跳過這組」是第 4 組的，按了不會動到已完成的第 2 組
  click(container.querySelector('[data-set-row][data-current] button[title="跳過此組"]'));
  assert.equal(state.logs[key('pullup', 1)].done, true);
  assert.equal(state.logs[key('pullup', 3)].skipped, true);
});

test('B1：已完成的組焦點離開那一列，就不再是目前這組', () => {
  renderView({ logs: twoDone() });
  const input = rowOf(key('pullup', 1)).querySelector('[data-weight-input]');
  act(() => input.focus());
  assert.equal(currentKey(), key('pullup', 1));
  act(() => input.blur());
  assert.equal(currentKey(), key('pullup', 2));
});

test('B1：已完成的組當浮卡時，下排寫「改成跳過」，不是「跳過這組」', () => {
  renderView({ logs: twoDone() });
  act(() => rowOf(key('pullup', 0)).querySelector('[data-weight-input]').focus());
  const skip = container.querySelector('[data-set-row][data-current] button[title="跳過此組"]');
  assert.equal(skip.textContent, '改成跳過');
  act(() => rowOf(key('pullup', 0)).querySelector('[data-weight-input]').blur());
  assert.equal(container.querySelector('[data-set-row][data-current] button[title="跳過此組"]').textContent, '跳過這組');
});

// ==================== B5：✓ 彈一下換天回來重播 ====================

test('B5：按 ✓ 後換天再換回來，勾勾不會再彈一次', () => {
  const state = renderView({ logs: twoDone() });
  const btn = () => rowOf(key('pullup', 2)).querySelector('[data-complete-btn]');
  click(btn());
  assert.match(btn().className, /check-pop/);
  act(() => state.setDay(0));
  act(() => state.setDay(1));
  assert.doesNotMatch(btn().className, /check-pop/);
});

test('B5：彈一下播完（animationend）就拿掉動畫 class', () => {
  renderView({ logs: twoDone() });
  const btn = () => rowOf(key('pullup', 2)).querySelector('[data-complete-btn]');
  click(btn());
  assert.match(btn().className, /check-pop/);
  act(() => btn().dispatchEvent(new Event('animationend', { bubbles: true })));
  assert.doesNotMatch(btn().className, /check-pop/);
});

// ==================== D1：動作進度條顏色 ====================

test('D1：動作進度條一律用完成綠，不依推拉腿上色', () => {
  for (const day of [0, 1, 4]) {
    renderView({ logs: {}, day, customSets: {} });
    for (const bar of container.querySelectorAll('[data-exercise-progress]')) {
      assert.match(bar.className, /\bbg-done\b/);
      assert.doesNotMatch(bar.className, /bg-(push|pull|legs)\b/);
    }
    act(() => root.unmount());
    container.remove();
    root = null;
  }
});

// ==================== D2 / D3 / B10：休息膠囊 ====================

test('D2：休息超過一小時，膠囊跟休息線用同一個時間格式（1:06:00，不是 66:00）', () => {
  renderView({ logs: { [key('pullup', 0)]: done(0, 10, T0 - 70 * MIN), [key('pullup', 1)]: done(0, 9, T0 - 66 * MIN) } });
  const label = pill().getAttribute('aria-label');
  assert.match(label, /已休息 1:06:00/);
  assert.doesNotMatch(pill().textContent, /66:00/);
  const line = [...container.querySelectorAll('[data-rest-label]')].map(el => el.textContent);
  assert.ok(line.includes('休息中 1:06:00'), JSON.stringify(line));
});

test('D3：超過休息目標，膠囊改「該做下一組了」、顯示超出多少；組間休息線也標超過', () => {
  renderView({ logs: { ...twoDone(), [key('pullup', 1)]: done(0, 9, T0 - 3 * MIN) } });
  assert.ok(pill().hasAttribute('data-over'));
  assert.match(pill().textContent, /該做下一組了/);
  assert.match(pill().textContent, /\+1:00/);
  assert.match(pill().textContent, /已休 3:00/);
  const live = container.querySelector('[data-rest="set-live"]');
  assert.ok(live.hasAttribute('data-over'));
  assert.match(live.textContent, /超過 1:00/);
  // 測試找的 label 文字格式不變
  assert.equal(live.querySelector('[data-rest-label]').textContent, '休息中 3:00');
});

test('D3（不變）：還沒到目標，膠囊照常寫「休息中」和目標', () => {
  renderView({ logs: twoDone() });
  assert.ok(!pill().hasAttribute('data-over'));
  assert.match(pill().textContent, /休息中/);
  assert.match(pill().textContent, /\/ 2:00/);
  assert.ok(!container.querySelector('[data-rest="set-live"]').hasAttribute('data-over'));
});

test('B10：跨午夜休息，膠囊不會消失', () => {
  const midnight = new Date(2026, 10, 2, 0, 0).getTime();
  renderView({
    logs: { [key('pullup', 0)]: done(0, 10, midnight - 6 * MIN), [key('pullup', 1)]: done(0, 9, midnight - 2 * MIN) },
    currentTime: midnight + 3 * MIN,
  });
  assert.ok(pill(), '00:03 還在休息（23:58 做完），應該看得到膠囊');
});

test('B10（不變）：幾個小時前的休息不再顯示膠囊', () => {
  renderView({ logs: { [key('pullup', 0)]: done(0, 10, T0 - 5 * 60 * MIN) }, currentTime: T0 });
  assert.equal(pill(), null);
});

// ==================== B8：拖曳把手 ====================

test('B8：拖曳只從左側把手開始，標題本身不是把手', () => {
  renderView({ logs: {}, day: 1, week: 1, customSets: {} });
  const handles = [...container.querySelectorAll('[data-rfd-drag-handle-draggable-id]')];
  assert.ok(handles.length > 0);
  for (const h of handles) {
    assert.match(h.getAttribute('aria-label') ?? '', /^拖曳排序/);
    assert.equal(h.querySelector('h3'), null, '把手裡不應該包著動作標題');
  }
  for (const h3 of container.querySelectorAll('h3')) {
    assert.equal(h3.closest('[data-rfd-drag-handle-draggable-id]'), null);
  }
});

test('B8：動作選項 sheet 的拖曳說明，單動作講左側把手，superset 成員講拖整組', () => {
  renderView({ logs: {}, day: 1, week: 1, customSets: {} });
  const optionsOf = (exId) => container.querySelector(`[data-exercise-id="${exId}"] button[aria-label="動作選項"]`);
  click(optionsOf('pullup'));
  assert.match(container.querySelector('[role="dialog"]').textContent, /按住左側把手可以拖曳排序/);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  click(optionsOf('rear_fly'));
  const text = container.querySelector('[role="dialog"]').textContent;
  assert.doesNotMatch(text, /按住左側把手可以拖曳排序/);
  assert.match(text, /配對/);
});

// ==================== B6 / B4：sheet 焦點、背景捲動 ====================

test('B6：從「⋯」開替換動作再關掉，焦點回到那個動作的「⋯」', () => {
  renderView({ logs: {}, day: 1, week: 1, customSets: {} });
  const trigger = container.querySelector('[data-exercise-id="db_row"] button[aria-label="動作選項"]');
  act(() => trigger.focus());
  click(trigger);
  click(container.querySelector('button[title="替換動作"]'));
  assert.equal(document.activeElement.getAttribute('placeholder'), '搜尋動作或肌群');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, trigger);
});

test('B6：sheet 開著時 Tab 在 sheet 裡循環', () => {
  renderView({ logs: {}, day: 1, week: 1, customSets: {} });
  click(container.querySelector('[data-current-week]'));
  const dialog = container.querySelector('[role="dialog"]');
  const buttons = [...dialog.querySelectorAll('button')];
  act(() => buttons.at(-1).focus());
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
  assert.equal(document.activeElement, buttons[0]);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
  assert.equal(document.activeElement, buttons.at(-1));
});

test('B4：sheet 開著時鎖背景捲動，疊兩層也要全部關掉才解鎖', () => {
  renderView({ logs: {}, day: 1, week: 1, customSets: {} });
  assert.equal(document.documentElement.style.overflow, '');
  click(container.querySelector('[data-open-volume]'));
  assert.equal(document.documentElement.style.overflow, 'hidden');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(document.documentElement.style.overflow, '');
  // 動作選項 → 替換動作：兩個 sheet 交接，關掉替換動作後解鎖
  click(container.querySelector('button[aria-label="動作選項"]'));
  click(container.querySelector('button[title="替換動作"]'));
  assert.equal(document.documentElement.style.overflow, 'hidden');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(document.documentElement.style.overflow, '');
});
