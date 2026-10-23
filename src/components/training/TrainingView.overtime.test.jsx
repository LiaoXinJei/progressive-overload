// @vitest-environment jsdom
// 執行：npm test
// BUG-06 殘留：課表第一組不是今天時，不顯示「已超時」

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 0; // PUSH A
const MIN = 60 * 1000;
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime(); // 當地時間
const done = (ts) => ({ weight: 60, reps: '8', done: true, completedAt: ts });

let root = null;
let container = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({ logs, currentTime }) => {
  const noop = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(
    <TrainingView
      logs={logs} setLogs={noop}
      history={{}} setHistory={noop}
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
  ));
};

const overtimeText = () => {
  const el = [...container.querySelectorAll('span')].find(s => s.textContent.startsWith('已超時'));
  return el ? el.textContent : null;
};

test('三天前只做了一組、沒做完的課表，今天打開不顯示超時', () => {
  renderView({
    logs: { 'w1-d0-bp_flat-s0': done(at(20, 18)) },
    currentTime: at(23, 9),
  });
  assert.equal(overtimeText(), null);
});

test('昨天開始的課表，過了午夜也不顯示超時', () => {
  renderView({
    logs: { 'w1-d0-bp_flat-s0': done(at(22, 23, 0)) },
    currentTime: at(23, 0, 30),
  });
  assert.equal(overtimeText(), null);
});

test('（不變）今天開始、還沒做完的課表，超時照現在時間計算', () => {
  renderView({
    logs: { 'w1-d0-bp_flat-s0': done(at(23, 18)) },
    currentTime: at(23, 18) + 70 * MIN,
  });
  assert.equal(overtimeText(), '已超時 10 分鐘 · 考慮跳過 1 組 isolation');
});
