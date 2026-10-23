// @vitest-environment jsdom
// 執行：npm test

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let container = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const noop = () => {};

const baseProps = () => ({
  logs: {}, setLogs: noop,
  history: {}, setHistory: noop,
  mode: 'maintenance',
  currentWeek: 1, currentDay: 0, setCurrentDay: noop,
  showStats: true, setShowStats: noop,
  customExerciseNames: {}, setCustomExerciseNames: noop,
  customExercises: {}, setCustomExercises: noop,
  customSets: {}, setCustomSets: noop,
  exerciseOrder: {}, setExerciseOrder: noop,
  exerciseLibrary: DEFAULT_EXERCISE_LIBRARY,
  exerciseOverrides: {}, setExerciseOverrides: noop,
  weightIncrement: 2,
  currentTime: Date.now(),
});

const render = (props) => {
  if (!root) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => root.render(<TrainingView {...props} />));
};

// 統計面板裡某肌群的實際組數（動作卡片也有同名肌群標籤，統計面板在最後）
const statSets = (label) => {
  const spans = [...container.querySelectorAll('span')].filter(s => s.textContent === label);
  return parseInt(spans.at(-1).nextElementSibling.textContent, 10);
};

// 統計面板預設開啟、App 首次 render 就會走到這裡；缺 import 時整個 App 白畫面
test('統計面板開啟時、W1–W10 × D1–D5 都能渲染', () => {
  for (let week = 1; week <= 10; week++) {
    for (let day = 0; day <= 4; day++) {
      render({ ...baseProps(), currentWeek: week, currentDay: day });
      assert.ok(container.textContent.includes('本週訓練量'), `W${week} D${day + 1} 缺少統計面板`);
    }
  }
});

test('只改 exerciseOverrides 時、本週訓練量即時更新', () => {
  const props = baseProps();
  render(props);
  const before = statSets('胸部');

  // PUSH A 的腿伸直（股四頭）換成平板啞鈴臥推（胸）
  const legExtSets = buildSessionPlan(1, 'A', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY })
    .find(e => e.exercise.id === 'leg_ext').sets;
  render({ ...props, exerciseOverrides: { 'A-leg_ext': 'lib_flat_db_press' } });

  assert.equal(statSets('胸部'), before + legExtSets);
});
