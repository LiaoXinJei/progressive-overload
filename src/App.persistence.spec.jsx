// @vitest-environment jsdom
// 執行：npx vitest run src/App.persistence.spec.jsx
// 驗證 App 載入 / 寫回 localStorage（rp_focus_pro_data）的時機。

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 這裡只測持久化，訓練頁 UI 換成只放殼層按鈕的空殼（個別測試可以換掉實作）：週次按鈕（真的在 TrainingView 的週次 sheet，
// 選週呼叫 onSelectWeek、目前這週標 aria-current）、設定鈕（真的在 TrainingView 的頂部 bar）
const trainingView = vi.hoisted(() => {
  const shell = ({ currentWeek, onSelectWeek, onOpenSettings }) => (
      <header>
        {[...Array(10)].map((_, i) => (
          <button key={i} type="button" aria-current={currentWeek === i + 1 ? 'true' : undefined} onClick={() => onSelectWeek(i + 1)}>W{i + 1}</button>
        ))}
        <button type="button" title="設定" onClick={onOpenSettings} />
      </header>
    );
  return { shell, render: shell };
});
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
  trainingView.render = trainingView.shell;
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
  expect(weekButton(3).getAttribute('aria-current')).toBe('true');

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

const isCurrentWeek = (el, w) => [...el.querySelectorAll('header button')]
  .find(b => b.textContent === `W${w}`).getAttribute('aria-current') === 'true';

test('別的視窗寫入時只同步資料：本視窗的週次、天數、頁籤、統計面板開關不變，設定頁也不會被關掉', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 7,
    viewState: { currentWeek: 2, currentDay: 3, showStats: true },
    activeTab: 'training',
  }));
  render(<App />);
  click(container.querySelector('button[title="設定"]'));

  const newLog = { 'w5-d1-pullup-s0': { weight: 10, reps: '8', done: true, completedAt: 1 } };
  writeFromOtherWindow({
    ...stored(),
    viewState: { currentWeek: 5, currentDay: 1, showStats: false },
    activeTab: 'nutrition',
    logs: newLog,
    weightIncrement: 5,
  });

  // 畫面留在本視窗：W2、訓練頁（週次列只有訓練頁才有）、設定頁開著且顯示同步過來的步長
  expect(isCurrentWeek(container, 2)).toBe(true);
  expect(container.querySelector('input[step="0.25"]').value).toBe('5');

  // 本視窗改一筆資料，寫回的是同步過來的資料 + 本視窗的畫面狀態
  click([...container.querySelectorAll('button')].find(b => b.textContent === '完成'));
  // 維持 / 增重移進設定裡
  click(container.querySelector('button[title="設定"]'));
  click([...container.querySelectorAll('button')].find(b => b.textContent.includes('增重模式')));
  const data = stored();
  expect(data.viewState).toEqual({ currentWeek: 2, currentDay: 3, showStats: true });
  expect(data.activeTab).toBe('training');
  expect(data).toMatchObject({ logs: newLog, weightIncrement: 5, mode: 'bulking' });
});

test('兩個視窗畫面狀態不同時，同步後不會互相觸發寫入', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 7, viewState: { currentWeek: 2, currentDay: 0 } }));
  // 把同一個 jsdom 裡的兩個 App 當成兩個視窗：任何一邊寫入都發 storage 事件（寫入的那邊也會收到，等於多測一次自己收到）。
  // 互相觸發的話寫入會一直增加，超過 20 次就不再發事件，免得測試卡死
  const proto = Object.getPrototypeOf(localStorage);
  const realSetItem = proto.setItem;
  let writes = 0;
  const setItem = vi.spyOn(proto, 'setItem').mockImplementation(function (key, value) {
    realSetItem.call(this, key, value);
    if (key !== STORAGE_KEY || ++writes > 20) return;
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value, storageArea: localStorage }));
  });

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  const otherRoot = createRoot(otherContainer);
  render(<App />);
  act(() => otherRoot.render(<App />));
  const afterMount = writes;

  // 另一個視窗換到 W3：寫一次
  act(() => [...otherContainer.querySelectorAll('header button')].find(b => b.textContent === 'W3')
    .dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(writes).toBe(afterMount + 1);

  // 本視窗改資料：寫一次，另一個視窗同步資料後不再寫回（維持 / 增重在設定裡，打開設定不寫入）
  click(container.querySelector('button[title="設定"]'));
  click([...container.querySelectorAll('button')].find(b => b.textContent.includes('增重模式')));
  expect(writes).toBe(afterMount + 2);

  // 兩邊各自留著自己的週次，資料一致
  expect(isCurrentWeek(container, 2)).toBe(true);
  expect(isCurrentWeek(otherContainer, 3)).toBe(true);
  expect(stored()).toMatchObject({ mode: 'bulking', viewState: { currentWeek: 2 } });
  act(() => otherContainer.querySelector('button[title="設定"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const otherModeButton = [...otherContainer.querySelectorAll('button')].find(b => b.textContent.includes('增重模式'));
  expect(otherModeButton.getAttribute('aria-pressed')).toBe('true');

  setItem.mockRestore();
  act(() => otherRoot.unmount());
  otherContainer.remove();
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
