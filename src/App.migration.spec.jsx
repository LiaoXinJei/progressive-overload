// @vitest-environment jsdom
// 執行：npx vitest run src/App.migration.spec.jsx
// 驗證 App 載入 localStorage（rp_focus_pro_data）時的 schema 遷移。

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DEFAULT_EXERCISE_LIBRARY } from './constants/workouts';

// 這裡只測持久化，訓練頁 UI 換成空元件
vi.mock('./components/training/TrainingView', () => ({ default: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Node 22+ 內建的 localStorage 會蓋掉 jsdom 的（Node 25 沒給 --localstorage-file 就不能用），改用 jsdom 的
vi.stubGlobal('localStorage', globalThis.jsdom.window.localStorage);

const STORAGE_KEY = 'rp_focus_pro_data';
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
const libIds = (lib) => lib.map(item => item.id);

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
});

const render = (element) => act(() => root.render(element));

// ==================== item 8：升級後動作庫沒更新 ====================

// v3 的動作庫片段：bp_flat 被使用者改過名、lib_skullcrusher 被使用者刪掉、
// bp_machine / lib_db_fly / lib_squat_bb 是 v3 FINAL 移除的預設動作、lib_custom_1 是使用者自訂
const V3_LIBRARY = [
  { id: 'bp_flat', name: '我的平板臥推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'bp_machine', name: '機械胸推', muscle: 'CHEST', type: 'compound', defaultSets: 3 },
  { id: 'lib_db_fly', name: '啞鈴飛鳥', muscle: 'CHEST', type: 'isolation', defaultSets: 3 },
  { id: 'lib_squat_bb', name: '槓鈴深蹲', muscle: 'QUADS', type: 'compound', defaultSets: 3 },
  { id: 'lib_close_grip_bp', name: '窄握臥推', muscle: 'TRICEPS', type: 'compound', defaultSets: 3 },
  { id: 'lib_custom_1', name: '我的自訂動作', muscle: 'BICEPS', type: 'isolation', defaultSets: 2 },
];

const expectLibrarySynced = (lib) => {
  const ids = libIds(lib);
  // v3 FINAL 新增的動作補進來
  expect(ids).toContain('lib_machine_press_flat');
  expect(ids).toContain('tri_overhead_seated');
  expect(ids).toContain('lib_calf_donkey');
  expect(ids).toContain('leg_press');
  // 移除的預設動作拿掉
  expect(ids).not.toContain('bp_machine');
  expect(ids).not.toContain('lib_db_fly');
  expect(ids).not.toContain('lib_squat_bb');
  // 使用者的修改、自訂動作、刪除都保留
  expect(lib.find(item => item.id === 'bp_flat').name).toBe('我的平板臥推');
  expect(lib.find(item => item.id === 'lib_custom_1')).toEqual(V3_LIBRARY[5]);
  expect(ids).not.toContain('lib_skullcrusher');
  // 沒有重複 id
  expect(new Set(ids).size).toBe(ids.length);
};

test('v3 使用者升級後，動作庫補上 v3 FINAL 新動作、移除已拿掉的動作', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 3,
    exerciseLibrary: V3_LIBRARY,
    viewState: { currentWeek: 3, currentDay: 2 },
  }));

  render(<App />);

  const data = stored();
  expectLibrarySynced(data.exerciseLibrary);
  expect(data.viewState).toMatchObject({ currentWeek: 1, currentDay: 0 });
});

test('已被舊版 v4 migration 升級過（動作庫還是舊的）的使用者，也會補齊動作庫且不重置進度', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 4,
    exerciseLibrary: V3_LIBRARY,
    viewState: { currentWeek: 3, currentDay: 2 },
  }));

  render(<App />);

  const data = stored();
  expectLibrarySynced(data.exerciseLibrary);
  expect(data.viewState).toMatchObject({ currentWeek: 3, currentDay: 2 });
});

test('新安裝的使用者拿到完整預設動作庫', () => {
  render(<App />);
  expect(libIds(stored().exerciseLibrary)).toEqual(libIds(DEFAULT_EXERCISE_LIBRARY));
});

test('動作庫同步只跑一次：已同步的使用者刪掉新動作後不會被補回', () => {
  const lib = DEFAULT_EXERCISE_LIBRARY.filter(item => item.id !== 'lib_calf_donkey');
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 5, exerciseLibrary: lib }));

  render(<App />);

  expect(libIds(stored().exerciseLibrary)).not.toContain('lib_calf_donkey');
});

test('替換設定指向已移除或已改名的動作時清掉，其他替換設定保留', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 4,
    exerciseOverrides: {
      'A-bp_incline_db': 'pec_deck',
      'A-bp_flat': 'bp_machine',
      'B-db_row': 'lib_t_bar_row',
      'B-pullup': 'lib_pulldown_wide',
      'C-lateral_raise': 'lib_custom_1',
    },
  }));

  render(<App />);

  expect(stored().exerciseOverrides).toEqual({
    'B-pullup': 'lib_pulldown_wide',
    'C-lateral_raise': 'lib_custom_1',
  });
});

// ==================== BUG-14：組數覆寫改成分週 ====================

test('v5 → v6：舊的不分週組數覆寫清掉，schemaVersion 升到 6', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 5,
    customSets: { 'A-leg_ext': 5, 'C-tri_overhead_seated': 3 },
    exerciseOverrides: { 'B-pullup': 'lib_pulldown_wide' },
  }));

  render(<App />);

  expect(stored().schemaVersion).toBe(6);
  expect(stored().customSets).toEqual({});
  expect(stored().exerciseOverrides).toEqual({ 'B-pullup': 'lib_pulldown_wide' });
});

test('v6 的分週組數覆寫原樣保留', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 6,
    customSets: { 'w4-A-leg_ext': 5, 'w2-C-lib_skullcrusher': 3 },
  }));

  render(<App />);

  expect(stored().customSets).toEqual({ 'w4-A-leg_ext': 5, 'w2-C-lib_skullcrusher': 3 });
});
