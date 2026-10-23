// @vitest-environment jsdom
// 執行：npm test
//
// 組數紀錄（✓ 完成、輸入次數、歷史、替換動作、動作間休息）的回歸測試，對應 BUG-03 / 04 / 11 / 16 / 19 / 20。

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 1; // PULL A：引體向上 → 單臂啞鈴划船，兩個都是 single
const key = (exId, idx) => `w${WEEK}-d${DAY}-${exId}-s${idx}`;
const MIN = 60 * 1000;

let root = null;
let container = null;

afterEach(() => {
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({ logs = {}, history = {}, exerciseOverrides = {}, currentTime = Date.now() } = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [h, setH] = useState(history);
    state.logs = l;
    state.history = h;
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={h} setHistory={setH}
        mode="maintenance" currentWeek={WEEK} currentDay={DAY} setCurrentDay={noop}
        showStats={false} setShowStats={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={{}} setCustomExercises={noop}
        customSets={{}} setCustomSets={noop}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY}
        exerciseOverrides={exerciseOverrides} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={currentTime}
      />
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return state;
};

const typeInto = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const click = (el) => act(() => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

// 第 n 個組數列（整頁順序，引體向上的組數排最前面）
const row = (n) => {
  const el = container.querySelectorAll('[data-set-row]')[n];
  return {
    weight: el.querySelector('[data-weight-input]'),
    reps: el.querySelector('[data-reps-input]'),
    plus: el.querySelector('button[title="+2kg"]'),
    complete: el.querySelector('[data-complete-btn]'),
    setNo: el.querySelector('button'),
  };
};

const done = (weight, reps, completedAt) => ({ weight, reps, done: true, completedAt });

// ==================== ✓ 完成按鈕（BUG-03 / 04 / 19） ====================

// 回傳文字，不回傳 DOM 節點
const leafText = (prefix) => [...container.querySelectorAll('div')]
  .find(d => d.children.length === 0 && d.textContent.startsWith(prefix))?.textContent ?? null;

test('✓：輸入重量和次數不會自動完成，不寫歷史、不開始休息', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  assert.notEqual(state.logs[key('pullup', 0)].done, true);
  assert.equal(state.logs[key('pullup', 0)].completedAt, undefined);
  assert.deepEqual(state.history, {});
  assert.equal(leafText('休息中'), null);
});

test('✓：按下才完成，寫歷史並開始休息計時', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(typeof log.completedAt, 'number');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '10' });
  assert.equal(row(0).complete.getAttribute('aria-pressed'), 'true');
  assert.match(leafText('休息中') ?? '', /^休息中: /);
});

test('✓：再按一次取消完成，休息計時消失、數字保留', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, false);
  assert.equal(log.completedAt, undefined);
  assert.equal(log.weight, '60');
  assert.equal(log.reps, '10');
  assert.equal(row(0).complete.title, '完成此組');
  assert.equal(leafText('休息中'), null);
});

test('✓：帶入上次紀錄（點組號）後按 ✓ 一下就完成', () => {
  const state = renderView({ history: { pullup: { weight: 20, reps: '8' } } });
  click(row(0).setNo);
  assert.notEqual(state.logs[key('pullup', 0)].done, true);
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(log.weight, 20);
  assert.equal(log.reps, '8');
});

test('✓：什麼都沒填、有上次紀錄時直接按 ✓，用上次的重量與次數（placeholder）完成', () => {
  const state = renderView({ history: { pullup: { weight: 20, reps: '8' } } });
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(log.weight, 20);
  assert.equal(log.reps, '8');
});

test('✓（BUG-04）：重量空白、沒有歷史時按 ✓，當 0 kg 自體重完成並寫進歷史', () => {
  const state = renderView();
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(log.weight, 0);
  assert.equal(row(0).weight.value, '0');
  assert.deepEqual(state.history.pullup, { weight: 0, reps: '8' });
});

test('✓：沒填次數、也沒有上次次數時不能按', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  assert.equal(row(0).complete.disabled, true);
  click(row(0).complete);
  assert.notEqual(state.logs[key('pullup', 0)].done, true);
  assert.deepEqual(state.history, {});
});

test('✓：跳過的組不顯示 ✓，取消跳過後恢復', () => {
  renderView({ logs: { [key('pullup', 0)]: { skipped: true } } });
  assert.equal(row(0).complete, null);
  click(container.querySelector('[data-set-row] button[title="取消跳過"]'));
  assert.notEqual(row(0).complete, null);
});

// ==================== BUG-03：次數只記到第一位數 ====================

test('BUG-03：輸入兩位數次數再按 ✓，歷史與下一組 placeholder 要是完整的 12', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '1');
  typeInto(row(0).reps, '12');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].reps, '12');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '12' });
  assert.equal(row(1).reps.placeholder, '12');
});

test('BUG-03：完成時間記在按 ✓ 的時候，不是打字的時候；之後改次數不會重設', () => {
  const t0 = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(t0);
  const state = renderView({ currentTime: t0 });
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '12');
  assert.equal(state.logs[key('pullup', 0)].completedAt, undefined);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 40 * 1000);
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0 + 40 * 1000);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 90 * 1000);
  typeInto(row(0).reps, '11');
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0 + 40 * 1000);
});

// ==================== BUG-11：完成後再改，歷史沒跟著改 ====================

test('BUG-11：完成後改重量（輸入框），歷史重量跟著更新', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  typeInto(row(0).weight, '62.5');
  assert.equal(state.logs[key('pullup', 0)].weight, '62.5');
  assert.deepEqual(state.history.pullup, { weight: 62.5, reps: '10' });
});

test('BUG-11：完成後按「+」，歷史重量跟著更新', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  click(row(0).plus);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '10' });
});

test('BUG-11：完成後改次數，歷史次數跟著更新', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  typeInto(row(0).reps, '8');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '8' });
});

test('BUG-11：完成後清空次數或重量，歷史保留原值、不會被寫成空白', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  typeInto(row(0).reps, '');
  typeInto(row(0).weight, '');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '10' });
});

test('BUG-11：改前面已完成的組時，後面還有完成的組，歷史保留後面那組', () => {
  const state = renderView({
    logs: {
      [key('pullup', 0)]: done(60, '10', Date.now() - 3 * MIN),
      [key('pullup', 1)]: done(62, '8', Date.now()),
    },
    history: { pullup: { weight: 62, reps: '8' } },
  });
  typeInto(row(0).reps, '12');
  typeInto(row(0).weight, '64');
  assert.equal(state.logs[key('pullup', 0)].reps, '12');
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '8' });
});

test('BUG-11：後面的組已完成、回頭補記前面的組，歷史保留後面那組', () => {
  const state = renderView({
    logs: { [key('pullup', 1)]: done(62, '8', Date.now()) },
    history: { pullup: { weight: 62, reps: '8' } },
  });
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].done, true);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '8' });
});

test('BUG-11（不變）：還沒完成的組改重量，不寫歷史', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '10' } } });
  typeInto(row(0).weight, '70');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '10' });
});

// ==================== BUG-16：替換動作沿用原動作歷史 ====================

const REPLACED = { exerciseOverrides: { 'B-pullup': 'lib_pulldown_wide' } };

test('BUG-16：替換成別的動作後，不顯示原動作的歷史', () => {
  renderView({ ...REPLACED, history: { pullup: { weight: 100, reps: '8' } } });
  assert.equal(row(0).weight.placeholder, '—');
  assert.equal(row(0).reps.placeholder, '—');
});

test('BUG-16：替換後的動作按 ✓，不會套原動作重量、也不會覆蓋原動作歷史', () => {
  const state = renderView({ ...REPLACED, history: { pullup: { weight: 100, reps: '8' } } });
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].weight, 0);
  click(row(0).complete); // 取消，重新記
  typeInto(row(0).weight, '45');
  typeInto(row(0).reps, '12');
  click(row(0).complete);
  assert.deepEqual(state.history.pullup, { weight: 100, reps: '8' });
  assert.deepEqual(state.history.lib_pulldown_wide, { weight: 45, reps: '12' });
});

test('BUG-16：替換後的動作用自己的歷史當 placeholder', () => {
  renderView({
    ...REPLACED,
    history: { pullup: { weight: 100, reps: '8' }, lib_pulldown_wide: { weight: 50, reps: '12' } },
  });
  assert.equal(row(0).weight.placeholder, '50');
  assert.equal(row(0).reps.placeholder, '12');
});

// ==================== BUG-20：第一組跳過，動作間休息一直跳 ====================

const pullupSets = buildSessionPlan(WEEK, 'B', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY })
  .find(e => e.exercise.id === 'pullup').sets;

// 引體向上全部完成，最後一組在 t0
const pullupDone = (t0) => Object.fromEntries([...Array(pullupSets)].map((_, i) =>
  [key('pullup', i), done(0, '8', t0 - (pullupSets - 1 - i) * 3 * MIN)]));

// 回傳文字與是否跳動，不回傳 DOM 節點（斷言失敗時 vitest 序列化節點會讓 worker 掛掉）
const interRest = () => {
  const el = [...container.querySelectorAll('div')]
    .find(d => d.children.length === 0 && d.textContent.startsWith('動作間休息'));
  return el ? { text: el.textContent, pulsing: el.className.includes('animate-pulse') } : null;
};

test('BUG-20：划船第一組跳過、第二組已完成 → 動作間休息停在第二組完成時間、不再跳動', () => {
  const now = Date.now();
  const t0 = now - 60 * MIN;
  renderView({
    logs: {
      ...pullupDone(t0),
      [key('db_row', 0)]: { skipped: true },
      [key('db_row', 1)]: done(30, '10', t0 + 2 * MIN),
    },
    currentTime: now,
  });
  assert.deepEqual(interRest(), { text: '動作間休息: 2:00', pulsing: false });
});

test('BUG-20：划船第一組跳過、後面都還沒做 → 還在休息，照現在時間跳動', () => {
  const now = Date.now();
  const t0 = now - 5 * MIN;
  renderView({
    logs: { ...pullupDone(t0), [key('db_row', 0)]: { skipped: true } },
    currentTime: now,
  });
  assert.deepEqual(interRest(), { text: '動作間休息: 5:00', pulsing: true });
});

test('BUG-20：划船每組都跳過 → 不顯示動作間休息', () => {
  const now = Date.now();
  const rowSets = buildSessionPlan(WEEK, 'B', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY })
    .find(e => e.exercise.id === 'db_row').sets;
  const skipped = Object.fromEntries([...Array(rowSets)].map((_, i) => [key('db_row', i), { skipped: true }]));
  renderView({ logs: { ...pullupDone(now - 60 * MIN), ...skipped }, currentTime: now });
  assert.equal(interRest(), null);
});
