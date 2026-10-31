// @vitest-environment jsdom
// 執行：npm test
// 休息通知的 restContext 綁「最近一筆完成組」那天，不綁畫面上正在看的週 / 天

import { test, vi, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// 記下每次 render 傳給 useRestNotification 的 restContext
const captured = vi.hoisted(() => ({ contexts: [] }));
vi.mock('./hooks/useRestNotification', () => ({
  useRestNotification: ({ restContext }) => { captured.contexts.push(restContext); },
  requestNotificationPermission: async () => 'granted',
}));
// 訓練頁換成只放切換天數按鈕的空殼
vi.mock('./components/training/TrainingView', () => ({
  default: ({ setCurrentDay }) => (
    <button type="button" data-goto-day3 onClick={() => setCurrentDay(2)}>D3</button>
  ),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Node 25 內建的 localStorage 會蓋掉 jsdom 的版本（沒給 --localstorage-file 時不能用），改用 jsdom 的
vi.stubGlobal('localStorage', globalThis.jsdom.window.localStorage);

let container;
let root;

beforeEach(() => {
  localStorage.clear();
  captured.contexts = [];
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
const latestContext = () => captured.contexts[captured.contexts.length - 1];

test('D2 休息中切去看 D3、再切到 W3，restContext 還是 D2 的組間休息', async () => {
  const ts = Date.now() - 30 * 1000;
  localStorage.setItem('rp_focus_pro_data', JSON.stringify({
    schemaVersion: 6,
    logs: { 'w1-d1-pullup-s0': { weight: 60, reps: '8', done: true, completedAt: ts } },
    history: {},
    viewState: { currentWeek: 1, currentDay: 1 },
    restNotificationDelay: 90,
  }));
  await act(async () => root.render(<App />));
  assert.deepEqual(
    { type: latestContext().type, anchorTs: latestContext().anchorTs },
    { type: 'in-set', anchorTs: ts },
  );

  click(container.querySelector('[data-goto-day3]'));
  assert.deepEqual(
    { type: latestContext().type, anchorTs: latestContext().anchorTs },
    { type: 'in-set', anchorTs: ts },
  );

  click([...container.querySelectorAll('button')].find(b => b.textContent === 'W3'));
  assert.deepEqual(
    { type: latestContext().type, anchorTs: latestContext().anchorTs },
    { type: 'in-set', anchorTs: ts },
  );
});
