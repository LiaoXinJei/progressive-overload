// @vitest-environment jsdom
// 執行：npm test
// 設定裡的「健身房模式（實驗）」開關：存進存檔、重新開啟還在、別的視窗切換會同步、重設資料時保留

import { test, vi, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// 訓練頁只留打開設定的按鈕，並把收到的 gymMode 印出來
vi.mock('./components/training/TrainingView', () => ({
  default: ({ onOpenSettings, gymMode }) => (
    <>
      <button type="button" title="設定" onClick={onOpenSettings} />
      <output data-gym-prop>{String(gymMode)}</output>
    </>
  ),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('localStorage', globalThis.jsdom.window.localStorage);

const STORAGE_KEY = 'rp_focus_pro_data';
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

const click = (el) => act(() => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const gymProp = () => container.querySelector('[data-gym-prop]').textContent;
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
const openSettings = () => click(container.querySelector('button[title="設定"]'));
const gymSwitch = () => container.querySelector('button[role="switch"][aria-labelledby="gym-mode-label"]');

test('舊存檔沒有這個欄位：預設關，不需要遷移', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 7, logs: {} }));
  await act(async () => root.render(<App />));
  assert.equal(gymProp(), 'false');
  assert.equal(saved().gymMode, false);
  assert.equal(saved().schemaVersion, 7);
});

test('設定裡打開：傳給訓練頁、寫進存檔；重新開啟還是開著', async () => {
  await act(async () => root.render(<App />));
  await openSettings();
  assert.equal(gymSwitch().getAttribute('aria-checked'), 'false');
  await click(gymSwitch());
  assert.equal(gymSwitch().getAttribute('aria-checked'), 'true');
  assert.equal(gymProp(), 'true');
  assert.equal(saved().gymMode, true);

  act(() => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<App />));
  assert.equal(gymProp(), 'true');
});

test('別的視窗切換開關，這個視窗跟著同步', async () => {
  await act(async () => root.render(<App />));
  const other = { ...saved(), gymMode: true };
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(other) }));
  });
  assert.equal(gymProp(), 'true');
});

test('重設所有資料時保留健身房模式（顯示偏好，不是訓練資料）', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 7, gymMode: true }));
  await act(async () => root.render(<App />));
  await openSettings();
  await click(container.querySelector('button[title="重設所有資料"]'));
  await click([...container.querySelectorAll('button')].find(b => b.textContent.includes('確定重設')));
  assert.equal(saved().gymMode, true);
  assert.equal(gymProp(), 'true');
});
