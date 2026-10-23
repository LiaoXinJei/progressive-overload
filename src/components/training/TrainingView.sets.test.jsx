// @vitest-environment jsdom
// 執行：npm test
// BUG-14：組數覆寫要分週存，替換動作不寫組數

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 4;
const DAY = 0; // PUSH A，第一個動作是平板槓鈴臥推

let root = null;
let container = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({ customSets = {}, exerciseOverrides = {} } = {}) => {
  const state = {};
  const Harness = () => {
    const [cs, setCs] = useState(customSets);
    const [ov, setOv] = useState(exerciseOverrides);
    state.customSets = cs;
    state.exerciseOverrides = ov;
    const noop = () => {};
    return (
      <TrainingView
        logs={{}} setLogs={noop}
        history={{}} setHistory={noop}
        mode="maintenance" currentWeek={WEEK} currentDay={DAY} setCurrentDay={noop}
        showStats={false} setShowStats={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={{}} setCustomExercises={noop}
        customSets={cs} setCustomSets={setCs}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY} exerciseOverrides={ov} setExerciseOverrides={setOv}
        weightIncrement={2}
        currentTime={Date.now()}
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

const byTitle = (title) => container.querySelector(`button[title="${title}"]`);

test('BUG-14：按 +1 組只存在這一週的 key', () => {
  const state = renderView();
  click(byTitle('增加一組'));
  assert.deepEqual(state.customSets, { [`w${WEEK}-A-bp_flat`]: 5 });
});

test('BUG-14：替換動作不寫組數，組數照週期算', () => {
  const state = renderView();
  click(byTitle('替換動作'));
  const item = [...container.querySelectorAll('button')]
    .find(b => b.textContent.includes('平板啞鈴臥推'));
  click(item);
  assert.deepEqual(state.exerciseOverrides, { 'A-bp_flat': 'lib_flat_db_press' });
  assert.deepEqual(state.customSets, {});
});

test('BUG-14：替換選單不顯示動作庫的預設組數', () => {
  renderView();
  click(byTitle('替換動作'));
  const item = [...container.querySelectorAll('button')]
    .find(b => b.textContent.includes('平板啞鈴臥推'));
  assert.doesNotMatch(item.textContent, /\d+ 組/);
});

test('BUG-14：恢復為原動作時清掉該動作各週的組數調整', () => {
  const state = renderView({
    customSets: { 'w4-A-bp_flat': 5, 'w2-A-bp_flat': 2, 'w4-A-bp_incline_db': 3 },
    exerciseOverrides: { 'A-bp_flat': 'lib_flat_db_press' },
  });
  click(byTitle('替換動作'));
  click([...container.querySelectorAll('button')].find(b => b.textContent === '恢復為原動作'));
  assert.deepEqual(state.exerciseOverrides, {});
  assert.deepEqual(state.customSets, { 'w4-A-bp_incline_db': 3 });
});
