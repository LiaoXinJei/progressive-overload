// @vitest-environment jsdom
// 執行：npm test

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import TabNavigation from '../shared/TabNavigation.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 1; // PULL A，第一個動作是引體向上
const PULLUP_S0 = `w${WEEK}-d${DAY}-pullup-s0`;
const MIN = 60 * 1000;

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
    complete: row.querySelector('[data-complete-btn]'),
  };
};

const overtimeText = () => {
  const el = [...container.querySelectorAll('span')].find(s => s.textContent.startsWith('已超時'));
  return el ? el.textContent : null;
};

// ==================== 第 5 點：自體重（重量 0） ====================

test('第 5 點：沒有歷史時按「−」把重量設為 0，輸入框要顯示 0 而不是空白', () => {
  renderView();
  const row = firstPullupRow();
  assert.equal(row.weight.value, '');
  click(row.minus);
  assert.equal(firstPullupRow().weight.value, '0');
});

test('第 5 點：重量 0 再輸入次數、按 ✓，要完成並把 0 kg 寫進歷史', () => {
  const state = renderView();
  click(firstPullupRow().minus);
  typeInto(firstPullupRow().reps, '8');
  click(firstPullupRow().complete);
  assert.equal(state.logs[PULLUP_S0]?.done, true);
  assert.equal(state.logs[PULLUP_S0]?.weight, 0);
  assert.deepEqual(state.history.pullup, { weight: 0, reps: '8' });
});

test('第 5 點：歷史重量是 0 時，placeholder 顯示 0，只輸入次數再按 ✓ 就完成', () => {
  const state = renderView({ history: { pullup: { weight: 0, reps: '8' } } });
  const row = firstPullupRow();
  assert.equal(row.weight.placeholder, '0');
  typeInto(row.reps, '8');
  click(firstPullupRow().complete);
  assert.equal(state.logs[PULLUP_S0]?.done, true);
  assert.equal(state.logs[PULLUP_S0]?.weight, 0);
});

test('第 5 點（不變）：重量空白又沒有歷史時，只輸入次數不會完成', () => {
  const state = renderView();
  typeInto(firstPullupRow().reps, '8');
  assert.notEqual(state.logs[PULLUP_S0]?.done, true);
});

// ==================== 第 6 點：超時警示 ====================

// 整個 session 每組都完成，第一組在 start、最後一組在 start + spanMin
const finishedSessionLogs = (start, spanMin) => {
  const plan = buildSessionPlan(WEEK, 'B', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY });
  const keys = plan.flatMap(({ exercise, sets }) =>
    [...Array(sets)].map((_, i) => `w${WEEK}-d${DAY}-${exercise.id}-s${i}`));
  const step = (spanMin * MIN) / (keys.length - 1);
  return Object.fromEntries(keys.map((key, i) =>
    [key, { weight: 20, reps: '8', done: true, completedAt: start + Math.round(i * step) }]));
};

test('第 6 點：三天前做完的 50 分鐘課表，不應顯示超時', () => {
  const now = Date.now();
  renderView({ logs: finishedSessionLogs(now - 3 * 24 * 60 * MIN, 50), currentTime: now });
  assert.equal(overtimeText(), null);
});

test('第 6 點：今天稍早做完的 75 分鐘課表，超時停在 15 分鐘', () => {
  // 三天前的課表不再顯示超時（BUG-06 殘留），這裡固定在同一天
  const now = new Date(2026, 9, 23, 20, 0).getTime();
  renderView({ logs: finishedSessionLogs(now - 3 * 60 * MIN, 75), currentTime: now });
  assert.equal(overtimeText(), '已超時 15 分鐘 · 考慮跳過 1 組 isolation');
});

// ==================== 替換 / 新增動作視窗不被底部 tab 列蓋住 ====================

// tailwind 的 z-50 / z-[60]
const zIndexOf = (el) => {
  const m = el.className.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/);
  return m ? Number(m[1] ?? m[2]) : null;
};

test('視窗：替換動作、新增動作疊在底部 tab 列上面，底部留 home indicator 的安全區', () => {
  const noop = () => {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(
    <>
      <TrainingView
        logs={{}} setLogs={noop}
        history={{}} setHistory={noop}
        mode="maintenance" currentWeek={WEEK} currentDay={DAY} setCurrentDay={noop}
        showStats={false} setShowStats={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={{}} setCustomExercises={noop}
        customSets={{}} setCustomSets={noop}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY} exerciseOverrides={{ 'B-pullup': 'lib_pulldown_wide' }} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={Date.now()}
      />
      <TabNavigation activeTab="training" setActiveTab={noop} />
    </>
  ));
  const navZ = zIndexOf(container.querySelector('nav'));
  const overlayOf = (title) => [...container.querySelectorAll('h3')].find(h => h.textContent === title).closest('.fixed');

  click(container.querySelector('button[title="替換動作"]'));
  const picker = overlayOf('替換動作');
  assert.ok(zIndexOf(picker) > navZ, `替換動作 z=${zIndexOf(picker)}，nav z=${navZ}`);
  assert.match(picker.className, /safe-area-inset-bottom/);
  click(picker.querySelector('button'));

  click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === '新增動作'));
  const addModal = overlayOf('新增動作');
  assert.ok(zIndexOf(addModal) > navZ, `新增動作 z=${zIndexOf(addModal)}，nav z=${navZ}`);
  assert.match(addModal.className, /safe-area-inset-bottom/);
});

test('第 6 點（不變）：還沒做完的課表，超時照現在時間即時計算', () => {
  const now = Date.now();
  renderView({
    logs: { [PULLUP_S0]: { weight: 0, reps: '8', done: true, completedAt: now - 70 * MIN } },
    currentTime: now,
  });
  assert.equal(overtimeText(), '已超時 10 分鐘 · 考慮跳過 1 組 isolation');
});
