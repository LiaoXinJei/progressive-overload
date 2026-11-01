// @vitest-environment jsdom
// 執行：npm test
// 設定 → 重設確認框的焦點：開啟時焦點進確認框，關掉後回到打開設定的那顆鈕（不是留在被遮住的地方）

import { test, vi, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// 訓練頁只留打開設定的按鈕（真的在 TrainingView 的頂部 bar）
vi.mock('./components/training/TrainingView', () => ({
  default: ({ onOpenSettings }) => <button type="button" title="設定" aria-label="設定" onClick={onOpenSettings} />,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('localStorage', globalThis.jsdom.window.localStorage);

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
  document.documentElement.style.overflow = '';
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const press = (key, init = {}) => act(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
});

test('B6：重設確認框開啟時焦點在框裡、Tab 不會跑出去；取消後焦點回到設定鈕', async () => {
  await act(async () => root.render(<App />));
  const settings = container.querySelector('button[title="設定"]');
  act(() => settings.focus());
  click(settings);
  click(container.querySelector('button[title="重設所有資料"]'));

  const alert = container.querySelector('[role="alertdialog"]');
  assert.ok(alert);
  assert.ok(alert.contains(document.activeElement), '焦點要在確認框裡');
  assert.equal(document.activeElement.textContent, '取消');
  assert.equal(document.documentElement.style.overflow, 'hidden');

  // 在頭尾按 Tab / Shift+Tab 會繞回框裡（中間的 Tab 是瀏覽器預設行為，jsdom 不模擬）
  press('Tab', { shiftKey: true });
  assert.equal(document.activeElement.textContent, '確定重設');
  press('Tab');
  assert.equal(document.activeElement.textContent, '取消');

  click(document.activeElement);
  assert.equal(container.querySelector('[role="alertdialog"]'), null);
  assert.equal(document.activeElement, settings);
  assert.equal(document.documentElement.style.overflow, '');
});

test('B6：重設確認框按 Esc 取消', async () => {
  await act(async () => root.render(<App />));
  click(container.querySelector('button[title="設定"]'));
  click(container.querySelector('button[title="重設所有資料"]'));
  press('Escape');
  assert.equal(container.querySelector('[role="alertdialog"]'), null);
});

test('B6：設定 sheet 按「完成」關掉，焦點回到設定鈕', async () => {
  await act(async () => root.render(<App />));
  const settings = container.querySelector('button[title="設定"]');
  act(() => settings.focus());
  click(settings);
  assert.ok(container.querySelector('[role="dialog"]').contains(document.activeElement));
  click([...container.querySelectorAll('button')].find(b => b.textContent === '完成'));
  assert.equal(document.activeElement, settings);
});
