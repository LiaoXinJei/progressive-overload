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

// ==================== R3：讀檔失敗後完全不寫、也沒提示 ====================

const corruptBackups = () => Object.keys(localStorage)
  .filter(key => key.startsWith(`${STORAGE_KEY}_corrupt_`))
  .map(key => localStorage.getItem(key));
const alerts = () => [...container.querySelectorAll('[role="alert"]')];
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const weekButton = (w) => [...container.querySelectorAll('header button')].find(b => b.textContent === `W${w}`);

test('讀檔失敗（JSON 壞掉）時原始字串另存一份，照空資料啟動、之後照常寫入，畫面有提示', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<React.StrictMode><App /></React.StrictMode>);
  console.error.mockRestore();

  // StrictMode 讀檔跑兩次也只備份一份
  expect(corruptBackups()).toEqual(['{not json']);
  expect(stored()).toMatchObject({ schemaVersion: 7, logs: {} });
  expect(alerts()).toHaveLength(1);
  expect(alerts()[0].textContent).toContain('讀取存檔失敗');

  click(weekButton(3));
  expect(stored().viewState.currentWeek).toBe(3);
  expect(corruptBackups()).toEqual(['{not json']);
});

test('讀檔失敗又沒辦法另存備份時不寫回，保留原始資料並提示', () => {
  localStorage.setItem(STORAGE_KEY, '{not json');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const setItem = vi.spyOn(Object.getPrototypeOf(localStorage), 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });
  render(<App />);
  setItem.mockRestore();
  console.error.mockRestore();

  click(weekButton(3));
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{not json');
  expect(alerts()[0].textContent).toContain('沒辦法另存備份');
});

// ==================== setItem 沒包 try/catch，空間滿了白畫面 ====================

test('寫入失敗（儲存空間滿了）不會白畫面，只提示一次', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 7, viewState: { currentWeek: 2 } }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const setItem = vi.spyOn(Object.getPrototypeOf(localStorage), 'setItem').mockImplementation(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  });

  render(<App />);
  expect(alerts()).toHaveLength(1);
  expect(alerts()[0].textContent).toContain('儲存失敗');

  click([...alerts()[0].querySelectorAll('button')].find(b => b.textContent === '知道了'));
  expect(alerts()).toHaveLength(0);
  // 還是存不進去，但不再跳提示
  click(weekButton(3));
  expect(alerts()).toHaveLength(0);
  expect(weekButton(3).className).toContain('bg-white');

  setItem.mockRestore();
  console.error.mockRestore();
  click(weekButton(4));
  expect(stored().viewState.currentWeek).toBe(4);
});

// ==================== R6：開兩個視窗，舊視窗會蓋掉新資料 ====================

// 模擬別的視窗寫入：同一個 jsdom 視窗自己 setItem 不會收到 storage 事件，手動發
const writeFromOtherWindow = (data) => {
  const json = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, json);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: json, storageArea: localStorage }));
  });
};

test('別的視窗寫入後重新載入，這個視窗之後的操作不會用舊狀態蓋掉新資料', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 7, viewState: { currentWeek: 2 } }));
  render(<App />);

  const newLog = { 'w2-d0-bp_flat-s0': { weight: 60, reps: '8', done: true, completedAt: 1 } };
  writeFromOtherWindow({
    ...stored(),
    logs: newLog,
    nutritionProfile: { geminiApiKey: 'AIza-new' },
  });
  // 這個視窗隨手換一週
  click(weekButton(3));

  const data = stored();
  expect(data.viewState.currentWeek).toBe(3);
  expect(data.logs).toEqual(newLog);
  expect(data.nutritionProfile).toEqual({ geminiApiKey: 'AIza-new' });
});

test('別的視窗寫入的內容載入後跟存檔一樣，不會再寫回（兩個視窗不會互相觸發寫入）', () => {
  render(<App />);
  const setItem = vi.spyOn(Object.getPrototypeOf(localStorage), 'setItem');

  writeFromOtherWindow({ ...stored(), logs: { 'w1-d0-bp_flat-s0': { weight: 60, reps: '8', done: true, completedAt: 1 } } });

  // 只有模擬別的視窗那一次
  expect(setItem).toHaveBeenCalledTimes(1);
  setItem.mockRestore();
});

test('別的視窗寫入的是舊版存檔時照樣跑遷移再載入', () => {
  render(<App />);

  writeFromOtherWindow({
    schemaVersion: 6,
    exerciseLibrary: [{ id: 'lib_skullcrusher', name: '骷髏粉碎機', muscle: 'TRICEPS', type: 'isolation', defaultSets: 3 }],
  });

  expect(stored().schemaVersion).toBe(7);
  expect(stored().exerciseLibrary[0].name).toBe('仰臥三頭伸展');
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
