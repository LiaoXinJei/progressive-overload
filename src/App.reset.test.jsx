// @vitest-environment jsdom
// 執行：npm test

import { test, vi, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// 這裡只測重設流程，訓練頁本身不渲染
vi.mock('./components/training/TrainingView', () => ({ default: () => null }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Node 25 內建的 localStorage 會蓋掉 jsdom 的版本（沒給 --localstorage-file 時不能用），改用 jsdom 的
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

test('重設所有資料會清掉營養設定與紀錄，但保留 Gemini API Key', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 4,
    nutritionProfile: { targetCalories: 2200, targetProtein: 160, targetCarbs: 250, targetFat: 70, geminiApiKey: 'AIza-test-key' },
    nutritionLogs: { '2026-10-23': { meals: [{ id: 'm1', items: [] }] } },
  }));

  await act(async () => root.render(<App />));
  // 確認重設前資料有正確載入
  assert.equal(JSON.parse(localStorage.getItem(STORAGE_KEY)).nutritionProfile.geminiApiKey, 'AIza-test-key');

  await click(container.querySelector('button[title="重設所有資料"]'));
  const confirm = [...container.querySelectorAll('button')].find(b => b.textContent.includes('確定重設'));
  await click(confirm);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.nutritionProfile?.geminiApiKey, 'AIza-test-key');
  assert.equal(saved.nutritionProfile?.targetCalories, undefined);
  assert.deepEqual(saved.nutritionLogs, {});
});

test('沒有設定 API Key 時，重設後營養設定維持 null', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 4,
    nutritionProfile: { targetCalories: 2200, targetProtein: 160, targetCarbs: 250, targetFat: 70, geminiApiKey: '' },
  }));

  await act(async () => root.render(<App />));

  await click(container.querySelector('button[title="重設所有資料"]'));
  const confirm = [...container.querySelectorAll('button')].find(b => b.textContent.includes('確定重設'));
  await click(confirm);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.equal(saved.nutritionProfile, null);
});

test('重設所有資料會清掉使用者改的動作名稱', async () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 7,
    customExerciseNames: { bp_flat: '我的臥推' },
    customExercises: { A: [{ id: 'custom_1', name: 'x', muscle: 'CHEST', type: 'isolation' }] },
  }));

  await act(async () => root.render(<App />));
  assert.deepEqual(JSON.parse(localStorage.getItem(STORAGE_KEY)).customExerciseNames, { bp_flat: '我的臥推' });

  await click(container.querySelector('button[title="重設所有資料"]'));
  const confirm = [...container.querySelectorAll('button')].find(b => b.textContent.includes('確定重設'));
  await click(confirm);

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  assert.deepEqual(saved.customExerciseNames, {});
  assert.deepEqual(saved.customExercises, {});
});
