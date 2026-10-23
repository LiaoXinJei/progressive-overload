// @vitest-environment jsdom
// 執行：npm test
//
// 組數紀錄（輸入次數、歷史、替換動作）的回歸測試，對應 BUG-03 / 11 / 16。

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 1; // PULL A：引體向上 → 單臂啞鈴划船，兩個都是 single
const key = (exId, idx) => `w${WEEK}-d${DAY}-${exId}-s${idx}`;

let root = null;
let container = null;

afterEach(() => {
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
  };
};

const done = (weight, reps, completedAt) => ({ weight, reps, done: true, completedAt });

// ==================== BUG-03：次數只記到第一位數 ====================

test('BUG-03：輸入兩位數次數，歷史與下一組 placeholder 要是完整的 12', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '1');
  typeInto(row(0).reps, '12');
  assert.equal(state.logs[key('pullup', 0)].reps, '12');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '12' });
  assert.equal(row(1).reps.placeholder, '12');
});

test('BUG-03（不變）：完成時間記在第一次自動完成，之後改次數不會重設', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '1');
  const first = state.logs[key('pullup', 0)].completedAt;
  assert.equal(typeof first, 'number');
  typeInto(row(0).reps, '12');
  assert.equal(state.logs[key('pullup', 0)].completedAt, first);
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

test('BUG-16：替換後的動作輸入次數，不會套原動作重量、也不會覆蓋原動作歷史', () => {
  const state = renderView({ ...REPLACED, history: { pullup: { weight: 100, reps: '8' } } });
  typeInto(row(0).reps, '10');
  assert.notEqual(state.logs[key('pullup', 0)]?.done, true);
  typeInto(row(0).weight, '45');
  typeInto(row(0).reps, '12');
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
