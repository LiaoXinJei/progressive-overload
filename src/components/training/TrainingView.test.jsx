// @vitest-environment jsdom
// 執行：npm test

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 1; // PULL A，第一個動作是引體向上
const PULLUP_S0 = `w${WEEK}-d${DAY}-pullup-s0`;

let root = null;
let container = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

// 用 state 包住 TrainingView，讓 setLogs / setHistory 的 updater 真的生效
const renderView = ({ logs = {}, history = {}, currentTime = Date.now() } = {}) => {
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
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY} exerciseOverrides={{}} setExerciseOverrides={noop}
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

// 引體向上第一組的輸入列
const firstPullupRow = () => {
  const row = container.querySelector('[data-set-row]');
  return {
    weight: row.querySelector('[data-weight-input]'),
    reps: row.querySelector('[data-reps-input]'),
    minus: row.querySelector('button[title="-2kg"]'),
  };
};

// ==================== 第 5 點：自體重（重量 0） ====================

test('第 5 點：沒有歷史時按「−」把重量設為 0，輸入框要顯示 0 而不是空白', () => {
  renderView();
  const row = firstPullupRow();
  assert.equal(row.weight.value, '');
  click(row.minus);
  assert.equal(firstPullupRow().weight.value, '0');
});

test('第 5 點：重量 0 再輸入次數，要自動完成並把 0 kg 寫進歷史', () => {
  const state = renderView();
  click(firstPullupRow().minus);
  typeInto(firstPullupRow().reps, '8');
  assert.equal(state.logs[PULLUP_S0]?.done, true);
  assert.equal(state.logs[PULLUP_S0]?.weight, 0);
  assert.deepEqual(state.history.pullup, { weight: 0, reps: '8' });
});

test('第 5 點：歷史重量是 0 時，placeholder 顯示 0，只輸入次數就能自動完成', () => {
  const state = renderView({ history: { pullup: { weight: 0, reps: '8' } } });
  const row = firstPullupRow();
  assert.equal(row.weight.placeholder, '0');
  typeInto(row.reps, '8');
  assert.equal(state.logs[PULLUP_S0]?.done, true);
  assert.equal(state.logs[PULLUP_S0]?.weight, 0);
});

test('第 5 點（不變）：重量空白又沒有歷史時，輸入次數不會自動完成', () => {
  const state = renderView();
  typeInto(firstPullupRow().reps, '8');
  assert.notEqual(state.logs[PULLUP_S0]?.done, true);
});
