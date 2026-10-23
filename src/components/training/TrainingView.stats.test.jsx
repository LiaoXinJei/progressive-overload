// @vitest-environment jsdom
// 執行：npm test

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// 這裡只看統計面板，不測拖拉排序。@hello-pangea/dnd 每次 render 都很重（jsdom 裡約佔一半時間），
// 換成直接把 children 畫出來的空殼；拖拉的整合由其他 TrainingView 測試用真的套件測
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => children,
  Droppable: ({ children }) => children({ innerRef() {}, droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef() {}, draggableProps: {}, dragHandleProps: {} }, { isDragging: false }),
}));

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

// 統計面板裡某肌群的「實際 / 目標」文字（動作卡片也有同名肌群標籤，統計面板在最後）
const statText = (label) => {
  const spans = [...container.querySelectorAll('span')].filter(s => s.textContent === label);
  return spans.at(-1).nextElementSibling.textContent;
};

const statSets = (label) => parseInt(statText(label), 10);

// 統計面板預設開啟、App 首次 render 就會走到這裡；缺 import 時整個 App 白畫面
// 每天一個 test、裡面跑 W1–W10：換週時動作卡片不變、只更新文字，比每次都換天（整批卡片重建）快很多，
// 單一 test 也短，機器忙時不會撞到 vitest 預設的 5 秒逾時
test.each([1, 2, 3, 4, 5])('統計面板開啟時、D%i 的 W1–W10 都能渲染', (d) => {
  for (let week = 1; week <= 10; week++) {
    render({ ...baseProps(), currentWeek: week, currentDay: d - 1 });
    assert.ok(container.textContent.includes('本週訓練量'), `W${week} D${d} 缺少統計面板`);
  }
});

test('統計面板顯示肌群目標組數', () => {
  // W1 胸部目標 = VOLUME_CONFIG.CHEST[0] = 10
  render(baseProps());
  assert.match(statText('胸部'), /^\d+ \/ 10(?!\d)/);
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
