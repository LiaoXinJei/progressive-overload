// @vitest-environment jsdom
// 執行：npx vitest run src/App.shell.spec.jsx
// 驗證 App 殼層（header 週次、設定面板、App 層 modal）的互動。

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 這裡只測殼層，訓練頁 UI 換成空元件
vi.mock('./components/training/TrainingView', () => ({ default: () => null }));

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
});

const render = (element) => act(() => root.render(element));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const weekButton = (w) => [...container.querySelectorAll('header button')].find(b => b.textContent === `W${w}`);

// ==================== 點目前這週會跳回 D1 ====================

test('點目前這週不會跳回 D1，換週才回到 D1', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 7, viewState: { currentWeek: 2, currentDay: 3 } }));
  render(<App />);

  click(weekButton(2));
  expect(stored().viewState).toMatchObject({ currentWeek: 2, currentDay: 3 });

  click(weekButton(3));
  expect(stored().viewState).toMatchObject({ currentWeek: 3, currentDay: 0 });
});

// ==================== R5：重量步長欄打不出 0.5 ====================

const openSettings = () => click(container.querySelector('button[title="設定"]'));
const weightInput = () => container.querySelector('input[step="0.25"]');
const typeInto = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

test('重量步長欄清空或打 0 不會馬上變 0.25，打得出 0.5；離開欄位時不合法就回到上一個合法值', () => {
  render(<App />);
  openSettings();
  const input = weightInput();
  act(() => input.focus());

  typeInto(input, '');
  expect(input.value).toBe('');
  typeInto(input, '0');
  expect(input.value).toBe('0');
  typeInto(input, '0.5');
  expect(input.value).toBe('0.5');
  expect(stored().weightIncrement).toBe(0.5);

  // 打到一半是不合法的值：設定不動，離開欄位後顯示回 0.5
  typeInto(input, '0');
  expect(stored().weightIncrement).toBe(0.5);
  act(() => input.blur());
  expect(input.value).toBe('0.5');
  expect(stored().weightIncrement).toBe(0.5);
});

test('重量步長欄輸入到一半點常用值，欄位改顯示常用值', () => {
  render(<App />);
  openSettings();
  const input = weightInput();
  act(() => input.focus());

  typeInto(input, '0');
  click([...container.querySelectorAll('button')].find(b => b.textContent === '2.5kg'));
  expect(input.value).toBe('2.5');
  expect(stored().weightIncrement).toBe(2.5);
});

// ==================== App 層 modal 被底部頁籤蓋住 ====================

const zIndexOf = (el) => {
  const match = el.className.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/);
  return Number(match[1] ?? match[2]);
};
const overlay = () => [...container.querySelectorAll('div.fixed')].find(el => el.className.includes('inset-0'));

test('重設確認和設定 modal 疊在底部頁籤上面（頁籤在 DOM 前面，z-index 要比它大）', () => {
  render(<App />);
  const navZ = zIndexOf(container.querySelector('nav'));

  click(container.querySelector('button[title="重設所有資料"]'));
  expect(zIndexOf(overlay())).toBeGreaterThan(navZ);
  click([...container.querySelectorAll('button')].find(b => b.textContent === '取消'));

  openSettings();
  expect(zIndexOf(overlay())).toBeGreaterThan(navZ);
});
