// @vitest-environment jsdom
// 執行：npx vitest run src/App.nutritionLibrary.spec.jsx
// App 層的接線：營養頁的回頂部按鈕、動作庫刪除時一起清替換設定

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// 訓練頁本身不渲染，只留打開設定的按鈕（真的在 TrainingView 的頂部 bar）
vi.mock('./components/training/TrainingView', () => ({
  default: ({ onOpenSettings }) => <button type="button" title="設定" onClick={onOpenSettings} />,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Node 25 內建的 localStorage 會蓋掉 jsdom 的版本（沒給 --localstorage-file 時不能用），改用 jsdom 的
vi.stubGlobal('localStorage', globalThis.jsdom.window.localStorage);

const STORAGE_KEY = 'rp_focus_pro_data';
const profile = { targetCalories: 2000, targetProtein: 150, targetCarbs: 200, targetFat: 60 };
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
  window.scrollY = 0;
  vi.restoreAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const setInput = (el, value) => act(() => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const scrollTo = (y) => act(() => {
  window.scrollY = y;
  window.dispatchEvent(new Event('scroll'));
});

const renderWith = async (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, ...data }));
  await act(async () => root.render(<App />));
};

test('營養頁往下捲也不顯示回頂部按鈕，避免壓住「+」新增餐點和最後一餐的刪除鈕', async () => {
  await renderWith({ activeTab: 'nutrition', nutritionProfile: profile });
  scrollTo(800);
  expect(container.querySelector('button[aria-label="回到頂部"]')).toBeNull();
  expect(container.querySelector('button[title="手動新增餐點"]')).not.toBeNull();
});

// 訓練頁改版拿掉回頂部按鈕（頂部 bar 只有一條、平台看板點了會捲到下一組）
test('訓練頁往下捲也不顯示回頂部按鈕', async () => {
  await renderWith({ activeTab: 'training' });
  scrollTo(800);
  expect(container.querySelector('button[aria-label="回到頂部"]')).toBeNull();
});

test('設定 > 動作庫刪除正在當替換的動作，確認後 App 的替換設定一起清掉並存檔', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderWith({
    activeTab: 'training',
    exerciseOverrides: { 'C-tri_dips': 'lib_weighted_dips', 'B-lat_pulldown': 'lib_pulldown_wide' },
  });

  click(container.querySelector('button[title="設定"]'));
  click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === '動作庫'));
  setInput(container.querySelector('input[placeholder="搜尋動作或肌群"]'), '負重雙槓');
  click(container.querySelector('button[title="刪除"]'));

  expect(window.confirm).toHaveBeenCalledTimes(1);
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  expect(saved.exerciseOverrides).toEqual({ 'B-lat_pulldown': 'lib_pulldown_wide' });
  expect(saved.exerciseLibrary.some(l => l.id === 'lib_weighted_dips')).toBe(false);
});
