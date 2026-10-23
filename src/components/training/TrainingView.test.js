// 執行：npm test
//
// TrainingView 渲染回歸測試：以 react-dom/server 渲染，不需要瀏覽器或 DOM。

import { test } from 'vitest';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

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

// 統計面板預設開啟、App 首次 render 就會走到這裡；缺 import 時整個 App 白畫面
test('統計面板開啟時、W1–W10 × D1–D5 都能渲染', () => {
  for (let week = 1; week <= 10; week++) {
    for (let day = 0; day <= 4; day++) {
      const html = renderToString(
        React.createElement(TrainingView, { ...baseProps(), currentWeek: week, currentDay: day }),
      );
      assert.ok(html.includes('本週訓練量'), `W${week} D${day + 1} 缺少統計面板`);
    }
  }
});

test('統計面板顯示肌群目標組數', () => {
  // W1 胸部目標 = VOLUME_CONFIG.CHEST[0] = 10
  const html = renderToString(React.createElement(TrainingView, baseProps()));
  assert.match(html, /胸部<\/span><span class="font-mono">\d+<span class="text-neutral-500"> \/ <!-- -->10<\/span>/);
});
