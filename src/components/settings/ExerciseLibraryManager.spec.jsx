// @vitest-environment jsdom
// 執行：npx vitest run src/components/settings/ExerciseLibraryManager.spec.jsx

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ExerciseLibraryManager from './ExerciseLibraryManager';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const setInput = (el, value) => act(() => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const buttonByText = (text) => [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text);

// 用真的 state 包起來，拿得到最新的 library / overrides
let state;
const Harness = ({ initialLibrary = DEFAULT_EXERCISE_LIBRARY, initialOverrides = {} }) => {
  const [exerciseLibrary, setExerciseLibrary] = useState(initialLibrary);
  const [exerciseOverrides, setExerciseOverrides] = useState(initialOverrides);
  state = { exerciseLibrary, exerciseOverrides };
  return (
    <ExerciseLibraryManager
      exerciseLibrary={exerciseLibrary} setExerciseLibrary={setExerciseLibrary}
      exerciseOverrides={exerciseOverrides} setExerciseOverrides={setExerciseOverrides}
    />
  );
};

const nameInputs = () => container.querySelectorAll('input[placeholder="動作名稱"]');

test('L1 新增表單開著時按某個動作的編輯，新增表單會關掉，只剩一個表單', () => {
  act(() => root.render(<Harness />));
  const before = state.exerciseLibrary.length;

  click(buttonByText('新增動作'));
  expect(nameInputs()).toHaveLength(1);

  click(container.querySelector('button[title="編輯"]'));
  expect(nameInputs()).toHaveLength(1);
  expect(nameInputs()[0].value).toBe(DEFAULT_EXERCISE_LIBRARY[0].name);
  expect(buttonByText('新增動作')).toBeTruthy();

  // 唯一的儲存是編輯那筆，不會多複製出一筆
  click(buttonByText('儲存'));
  expect(state.exerciseLibrary).toHaveLength(before);
  expect(state.exerciseLibrary[0].name).toBe(DEFAULT_EXERCISE_LIBRARY[0].name);
});

test('L1 編輯中按「新增動作」，編輯表單會關掉，新增表單是空白的', () => {
  act(() => root.render(<Harness />));
  click(container.querySelector('button[title="編輯"]'));
  click(buttonByText('新增動作'));
  expect(nameInputs()).toHaveLength(1);
  expect(nameInputs()[0].value).toBe('');
});

test('L2 刪除正在當替換的動作：先跳確認、說有幾個課表在用；取消就什麼都不動', () => {
  const overrides = { 'C-tri_dips': 'lib_weighted_dips' };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  act(() => root.render(<Harness initialOverrides={overrides} />));

  setInput(container.querySelector('input[placeholder="搜尋動作或肌群"]'), '負重雙槓');
  click(container.querySelector('button[title="刪除"]'));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0]).toContain('1 個課表在用');
  expect(confirm.mock.calls[0][0]).toContain('改回原動作');
  expect(state.exerciseLibrary.some(l => l.id === 'lib_weighted_dips')).toBe(true);
  expect(state.exerciseOverrides).toEqual(overrides);
});

test('L2 確認刪除後，連同用到它的替換設定一起清掉，其他替換保留', () => {
  const overrides = {
    'C-tri_dips': 'lib_weighted_dips',
    'A-bp_flat': 'lib_weighted_dips',
    'B-lat_pulldown': 'lib_pulldown_wide',
  };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  act(() => root.render(<Harness initialOverrides={overrides} />));

  setInput(container.querySelector('input[placeholder="搜尋動作或肌群"]'), '負重雙槓');
  click(container.querySelector('button[title="刪除"]'));

  expect(confirm.mock.calls[0][0]).toContain('2 個課表在用');
  expect(state.exerciseLibrary.some(l => l.id === 'lib_weighted_dips')).toBe(false);
  expect(state.exerciseOverrides).toEqual({ 'B-lat_pulldown': 'lib_pulldown_wide' });

  // 課表照原動作排，不會留一個指向不存在動作的孤兒設定
  const plan = buildSessionPlan(1, 'C', { exerciseOverrides: state.exerciseOverrides, exerciseLibrary: state.exerciseLibrary });
  expect(plan.find(e => e.exercise.id === 'tri_dips').exercise._libraryId).toBeUndefined();
});

test('L2 刪除沒有課表在用的動作，不跳確認直接刪', () => {
  const confirm = vi.spyOn(window, 'confirm');
  act(() => root.render(<Harness />));
  const before = state.exerciseLibrary.length;

  setInput(container.querySelector('input[placeholder="搜尋動作或肌群"]'), '負重雙槓');
  click(container.querySelector('button[title="刪除"]'));

  expect(confirm).not.toHaveBeenCalled();
  expect(state.exerciseLibrary).toHaveLength(before - 1);
});

test('「預設組數」沒有作用，表單和列表都不再顯示；編輯時保留原本資料裡的 defaultSets', () => {
  act(() => root.render(<Harness />));

  expect(container.textContent).not.toMatch(/\d+ 組/);

  click(buttonByText('新增動作'));
  expect(container.textContent).not.toContain('預設組數');
  expect(container.querySelector('input[type="number"]')).toBeNull();
  click(buttonByText('取消'));

  click(container.querySelector('button[title="編輯"]'));
  expect(container.textContent).not.toContain('預設組數');
  setInput(nameInputs()[0], '我的臥推');
  click(buttonByText('儲存'));
  expect(state.exerciseLibrary[0]).toEqual({ ...DEFAULT_EXERCISE_LIBRARY[0], name: '我的臥推' });
});
