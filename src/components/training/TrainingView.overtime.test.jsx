// @vitest-environment jsdom
// 執行：npm test
// BUG-06 殘留：課表第一組不是今天時，不顯示「已超時」

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 0; // PUSH A
const MIN = 60 * 1000;
const at = (day, hour, minute = 0) => new Date(2026, 9, day, hour, minute).getTime(); // 當地時間
const done = (ts) => ({ weight: 60, reps: '8', done: true, completedAt: ts });

let root = null;
let container = null;

afterEach(() => {
  vi.restoreAllMocks();
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

// 頂部 bar 的「超時 N 分」
const overtimeText = () => container.querySelector('[data-overtime]')?.textContent ?? null;

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

test('今天做完的課表，回頭誤觸 ✓ 取消再按回，不會因為完成時間變成現在而顯示超時', () => {
  // PULL A 18:00 起每組 2 分鐘做完（不到一小時），21:00 回頭點錯
  const plan = buildSessionPlan(1, 'B', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY });
  const logs = {};
  let t = at(31, 18);
  plan.forEach(({ exercise, sets }) => {
    for (let i = 0; i < sets; i++) {
      logs[`w1-d1-${exercise.id}-s${i}`] = done(t);
      t += 2 * MIN;
    }
  });
  vi.spyOn(Date, 'now').mockReturnValue(at(31, 21));
  const Harness = () => {
    const [l, setL] = useState(logs);
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={{}} setHistory={noop}
        mode="maintenance" currentWeek={1} currentDay={1} setCurrentDay={noop}
        showStats={false} setShowStats={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={{}} setCustomExercises={noop}
        customSets={{}} setCustomSets={noop}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY} exerciseOverrides={{}} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={at(31, 21)}
      />
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  assert.equal(overtimeText(), null);
  const firstComplete = () => container.querySelector('[data-set-row] [data-complete-btn]');
  act(() => { firstComplete().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  act(() => { firstComplete().dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  assert.equal(overtimeText(), null);
});

test('（不變）今天開始、還沒做完的課表，超時照現在時間計算', () => {
  renderView({
    logs: { 'w1-d0-bp_flat-s0': done(at(23, 18)) },
    currentTime: at(23, 18) + 70 * MIN,
  });
  assert.equal(overtimeText(), '超時 10 分');
});
