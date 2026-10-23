// @vitest-environment jsdom
// 執行：npx vitest run src/App.persistence.spec.jsx
// 驗證 App 載入 / 寫回 localStorage（rp_focus_pro_data）的時機。

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 這裡只測持久化，訓練頁 UI 換成空元件（個別測試可以換掉實作）
const trainingView = vi.hoisted(() => ({ render: () => null }));
vi.mock('./components/training/TrainingView', () => ({ default: (props) => trainingView.render(props) }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Node 22+ 內建的 localStorage 會蓋掉 jsdom 的（Node 25 沒給 --localstorage-file 就不能用），改用 jsdom 的
vi.stubGlobal('localStorage', globalThis.jsdom.window.localStorage);

const STORAGE_KEY = 'rp_focus_pro_data';
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));

let container;
let root;

beforeEach(() => {
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  trainingView.render = () => null;
});

const render = (element) => act(() => root.render(element));

// ==================== item 9：StrictMode 重新整理清空資料 ====================

test('StrictMode 下重新整理，已存的資料不會被空狀態蓋掉', () => {
  const logs = { 'w2-d1-pullup-s0': { weight: 10, reps: 8, done: true, completedAt: 1 } };
  const nutritionLogs = { '2026-10-23': { meals: [{ id: 'm_1', time: '07:20', name: '早餐', items: [] }] } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 5,
    logs,
    history: { pullup: { weight: 10, reps: 8 } },
    viewState: { currentWeek: 2, currentDay: 1, showStats: true },
    activeTab: 'nutrition',
    nutritionLogs,
  }));

  render(<React.StrictMode><App /></React.StrictMode>);

  const data = stored();
  expect(data.logs).toEqual(logs);
  expect(data.history).toEqual({ pullup: { weight: 10, reps: 8 } });
  expect(data.viewState.currentWeek).toBe(2);
  expect(data.nutritionLogs).toEqual(nutritionLogs);
});

test('localStorage 是空的時候，照常寫入初始狀態', () => {
  render(<React.StrictMode><App /></React.StrictMode>);
  expect(stored()).toMatchObject({ logs: {}, viewState: { currentWeek: 1, currentDay: 0 } });
});

test('讀檔失敗（JSON 壞掉）時不寫回，保留原始資料', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<React.StrictMode><App /></React.StrictMode>);
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{not json');
  console.error.mockRestore();
});

test('讀檔後的第一次 render 拋錯時，已存的資料不會被初始空狀態蓋掉', () => {
  const logs = { 'w2-d1-pullup-s0': { weight: 10, reps: 8, done: true, completedAt: 1 } };
  const seed = JSON.stringify({ schemaVersion: 5, logs, viewState: { currentWeek: 2, currentDay: 1 } });
  localStorage.setItem(STORAGE_KEY, seed);
  // 初始空狀態可以 render，帶入讀到的資料後才壞掉（例如 BUG-01 這類 render 錯誤）
  trainingView.render = ({ logs: current }) => {
    if (Object.keys(current).length > 0) throw new Error('render 壞掉');
    return null;
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});

  expect(() => render(<App />)).toThrow('render 壞掉');
  expect(localStorage.getItem(STORAGE_KEY)).toBe(seed);
  console.error.mockRestore();
});
