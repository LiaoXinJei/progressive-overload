// @vitest-environment jsdom
// 執行：npm test
//
// 休息計時顯示（組間「休息中 / 休息時間」、動作間休息、superset 進入提示）的回歸測試

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

// 這裡不測拖拉，@hello-pangea/dnd 換成直接畫 children 的空殼（同 TrainingView.stats.test.jsx）
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => children,
  Droppable: ({ children }) => children({ innerRef() {}, droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef() {}, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MIN = 60 * 1000;
const T0 = 1_800_000_000_000;

let root = null;
let container = null;

afterEach(() => {
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({ week = 1, day = 1, logs = {}, currentTime = T0 } = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [h, setH] = useState({});
    state.logs = l;
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={h} setHistory={setH}
        mode="maintenance" currentWeek={week} currentDay={day} setCurrentDay={noop}
        showStats={false} setShowStats={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={{}} setCustomExercises={noop}
        customSets={{}} setCustomSets={noop}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY}
        exerciseOverrides={{}} setExerciseOverrides={noop}
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
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

const done = (weight, reps, completedAt) => ({ weight, reps, done: true, completedAt });
const setsOf = (week, workoutKey, exId) => buildSessionPlan(week, workoutKey, { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY })
  .find(e => e.exercise.id === exId).sets;

// 動作卡片（用標題找）；回傳文字，不回傳 DOM 節點（斷言失敗時序列化節點會讓 worker 掛掉）
const card = (name) => [...container.querySelectorAll('h3')].find(h => h.textContent === name).closest('.p-6');
const leafTexts = (prefix, scope = container) => [...scope.querySelectorAll('div')]
  .filter(d => d.children.length === 0 && d.textContent.startsWith(prefix))
  .map(d => d.textContent);
const completeBtn = (n) => container.querySelectorAll('[data-set-row]')[n].querySelector('[data-complete-btn]');

// ==================== 取消再重新完成：休息時間不變成負數 ====================

test('重新完成：s1 已完成，s0 取消再按 ✓，s0 下方休息時間還是 3:00', () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 10 * MIN);
  renderView({
    logs: {
      'w1-d1-pullup-s0': done(60, '8', T0),
      'w1-d1-pullup-s1': done(60, '8', T0 + 3 * MIN),
    },
    currentTime: T0 + 10 * MIN,
  });
  click(completeBtn(0));
  click(completeBtn(0));
  assert.deepEqual(leafTexts('休息時間'), ['休息時間: 3:00']);
});

// ==================== 休息時間不顯示負數 ====================

test('負數：按 ✓ 的時間比畫面時間晚（App 每秒才更新 currentTime），休息中顯示 0:00 不是 -1:-1', () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 400);
  renderView({ currentTime: T0 });
  typeInto(container.querySelector('[data-reps-input]'), '8');
  click(completeBtn(0));
  assert.deepEqual(leafTexts('休息中'), ['休息中: 0:00']);
});

test('負數：前一個動作末組剛按 ✓，下一個動作的動作間休息顯示 0:00', () => {
  const n = setsOf(1, 'B', 'pullup');
  const logs = {};
  for (let i = 0; i < n - 1; i++) logs[`w1-d1-pullup-s${i}`] = done(60, '8', T0 - 5 * MIN);
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 400);
  renderView({ logs, currentTime: T0 });
  const last = card('引體向上').querySelectorAll('[data-set-row]')[n - 1];
  typeInto(last.querySelector('[data-reps-input]'), '8');
  click(last.querySelector('[data-complete-btn]'));
  assert.deepEqual(leafTexts('動作間休息'), ['動作間休息: 0:00']);
});
