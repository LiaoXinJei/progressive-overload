// @vitest-environment jsdom
// 執行：npm test
//
// 健身房模式（設定裡的實驗開關）：像素場景一個動作一站，點中間開始這組、再點一下完成。
// 一次只畫選中那站的動作卡。canvas 在 jsdom 沒有 2D context，這裡只測互動與資料。

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, beforeEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 0; // PUSH A：平板槓鈴臥推 3 組 → 上斜啞鈴臥推 → superset …
const key = (exId, idx) => `w${WEEK}-d${DAY}-${exId}-s${idx}`;
const T0 = new Date(2026, 10, 1, 19, 0, 0).getTime();

let root = null;
let container = null;
let now = T0;

beforeEach(() => {
  now = T0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  // jsdom 沒有 canvas，getContext 會印 Not implemented；場景拿不到 context 就不畫
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({ logs = {}, history = {}, currentTime = T0 } = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [h, setH] = useState(history);
    const [ce, setCe] = useState({});
    const [cs, setCs] = useState({});
    const [time, setTime] = useState(currentTime);
    state.logs = l;
    state.history = h;
    state.customExercises = ce;
    state.setTime = setTime;
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={h} setHistory={setH}
        currentWeek={WEEK} currentDay={DAY} setCurrentDay={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={ce} setCustomExercises={setCe}
        customSets={cs} setCustomSets={setCs}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY}
        exerciseOverrides={{}} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={time}
        restTarget={90}
        gymMode
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
const typeInto = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const action = () => container.querySelector('[data-gym-action]');
const hint = () => container.querySelector('#gym-hint').textContent;
const shownExercises = () => [...container.querySelectorAll('[data-exercise-id]')].map(el => el.dataset.exerciseId);
const rows = () => [...container.querySelectorAll('[data-set-row]')];
const restPill = () => container.querySelector('[data-rest-pill]');
const done = (weight, reps, completedAt) => ({ weight, reps, done: true, completedAt });
const BENCH = { bp_flat: { weight: 80, reps: '8' } };

test('開啟後只畫選中那站的動作卡；前一個動作做完，動作間休息線照常顯示', () => {
  renderView({
    logs: {
      [key('bp_flat', 0)]: done(80, '8', T0 - 9 * 60000),
      [key('bp_flat', 1)]: done(80, '8', T0 - 6 * 60000),
      [key('bp_flat', 2)]: done(80, '8', T0 - 60000),
    },
    history: BENCH,
  });
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  assert.ok(container.querySelector('[data-gym-scene]'));
  const labels = [...container.querySelectorAll('[data-rest-label]')].map(el => el.textContent);
  assert.ok(labels.some(t => t.startsWith('動作間休息')), labels.join(' / '));
});

test('點中間開始這組：浮卡移到這組、按鈕改念完成；1 秒內再點不算，之後再點才完成並開始休息', () => {
  const state = renderView({ history: BENCH });
  assert.equal(action().getAttribute('aria-label'), '開始 平板槓鈴臥推 第 1 組');
  click(action());
  assert.equal(action().getAttribute('aria-label'), '完成 平板槓鈴臥推 第 1 組');
  assert.ok(rows()[0].hasAttribute('data-current'));
  assert.match(hint(), /做完再點一下/);

  now += 500;
  click(action());
  assert.notEqual(state.logs[key('bp_flat', 0)]?.done, true, '連點不算完成');

  now += 1500;
  click(action());
  const log = state.logs[key('bp_flat', 0)];
  assert.equal(log.done, true);
  assert.equal(log.completedAt, now);
  assert.deepEqual([log.weight, log.reps], [80, '8']);
  assert.equal(action().getAttribute('aria-label'), '開始 平板槓鈴臥推 第 2 組');
  assert.ok(rows()[1].hasAttribute('data-current'), '浮卡換到下一組');
  assert.match(hint(), /^休息中 /, '開始休息');
});

test('沒填次數也沒有上次紀錄：再點一下不完成，焦點跳到次數欄並提示先填次數', () => {
  const state = renderView();
  click(action());
  now += 2000;
  click(action());
  assert.notEqual(state.logs[key('bp_flat', 0)]?.done, true);
  assert.equal(document.activeElement, rows()[0].querySelector('[data-reps-input]'));
  assert.equal(hint(), '先填次數再點完成');
  typeInto(rows()[0].querySelector('[data-reps-input]'), '10');
  click(action());
  assert.equal(state.logs[key('bp_flat', 0)].done, true);
  assert.equal(state.logs[key('bp_flat', 0)].weight, 0);
});

test('健身房模式不顯示休息膠囊：休息狀態在面板提示上，開始做下一組時換成做完再點一下', () => {
  renderView({ logs: { [key('bp_flat', 0)]: done(80, '8', T0 - 30000) }, history: BENCH });
  assert.equal(restPill(), null);
  assert.equal(hint(), '休息中 0:30 / 1:30');
  click(action());
  assert.equal(hint(), '做完再點一下');
  now += 2000;
  click(action());
  assert.equal(restPill(), null);
  assert.match(hint(), /^休息中 /);
});

const panel = () => container.querySelector('[data-gym-panel]');

test('面板：顯示選中那站的目前這組，在面板輸入次數、按 ✓ 就完成，換到下一組', () => {
  const state = renderView();
  assert.match(panel().querySelector('h2').textContent, /^第 1 組/);
  const check = panel().querySelector('[data-gym-complete]');
  assert.equal(check.disabled, true, '沒次數也沒上次紀錄不能按');
  typeInto(panel().querySelector('[data-gym-reps]'), '10');
  typeInto(panel().querySelector('[data-gym-weight]'), '70');
  assert.deepEqual([state.logs[key('bp_flat', 0)].weight, state.logs[key('bp_flat', 0)].reps], ['70', '10']);
  click(panel().querySelector('[data-gym-complete]'));
  assert.equal(state.logs[key('bp_flat', 0)].done, true);
  assert.match(panel().querySelector('h2').textContent, /^第 2 組/);
});

test('面板：重量 − / + 用上次紀錄當起點', () => {
  const state = renderView({ history: BENCH });
  click(panel().querySelector('button[aria-label="第 1 組重量加 2 公斤"]'));
  assert.equal(state.logs[key('bp_flat', 0)].weight, 82);
});

test('面板：這站做完了顯示下一台，點了換過去', () => {
  renderView({
    logs: {
      [key('bp_flat', 0)]: done(80, '8', T0 - 9 * 60000),
      [key('bp_flat', 1)]: done(80, '8', T0 - 6 * 60000),
      [key('bp_flat', 2)]: done(80, '8', T0 - 3 * 60000),
    },
    history: BENCH,
  });
  click(container.querySelector('button[aria-label^="上一台"]'));
  assert.deepEqual(shownExercises(), ['bp_flat']);
  assert.match(panel().textContent, /平板槓鈴臥推 做完了/);
  click([...panel().querySelectorAll('button')].find(b => b.textContent.startsWith('下一台')));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
});

test('做完一個動作的最後一組，自動換到下一個動作', () => {
  renderView({
    logs: {
      [key('bp_flat', 0)]: done(80, '8', T0 - 6 * 60000),
      [key('bp_flat', 1)]: done(80, '8', T0 - 3 * 60000),
    },
    history: BENCH,
  });
  assert.deepEqual(shownExercises(), ['bp_flat']);
  click(action());
  now += 2000;
  click(action());
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  assert.equal(action().getAttribute('aria-label'), '開始 上斜啞鈴臥推 第 1 組');
});

test('手動換到別站後，時間往前走不會被拉回目前這組', () => {
  const state = renderView({ history: BENCH });
  click(container.querySelector('button[aria-label^="下一台"]'));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  act(() => state.setTime(T0 + 5000));
  act(() => state.setTime(T0 + 10000));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  // 在這站點開始：目前這組換成這站的第一組
  click(action());
  assert.ok(rows()[0].hasAttribute('data-current'));
  assert.equal(action().getAttribute('aria-label'), '完成 上斜啞鈴臥推 第 1 組');
});

test('完成後再取消完成，人物不會又開始做那一組', () => {
  const state = renderView({ history: BENCH });
  click(action());
  now += 2000;
  click(action());
  assert.equal(state.logs[key('bp_flat', 0)].done, true);
  click(rows()[0].querySelector('[data-complete-btn]'));
  assert.equal(state.logs[key('bp_flat', 0)].done, false);
  assert.equal(action().getAttribute('aria-label'), '開始 平板槓鈴臥推 第 1 組');
});

test('新增自訂動作後選到它那一站', () => {
  const state = renderView();
  click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === '新增動作'));
  typeInto(container.querySelector('input[placeholder="例如：槓鈴深蹲"]'), '地雷管推舉');
  click([...container.querySelectorAll('.fixed button')].find(b => b.textContent === '新增'));
  const id = state.customExercises.A?.[0]?.id;
  assert.ok(id);
  assert.deepEqual(shownExercises(), [id]);
});

test('最後一組的次數欄按 Enter：換到下一站，焦點到它第一組的重量欄', () => {
  renderView({ history: BENCH });
  const repsInput = rows()[2].querySelector('[data-reps-input]');
  act(() => repsInput.focus());
  act(() => repsInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  assert.equal(document.activeElement.dataset.logKey, key('bp_incline_db', 0));
});
