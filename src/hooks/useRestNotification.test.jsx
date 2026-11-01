// @vitest-environment jsdom
// 執行：npm test
// 切到背景時排程休息通知；沒有 Notification 的瀏覽器（iOS Safari 非 PWA）不能噴錯

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import { useRestNotification } from './useRestNotification.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let container = null;
let rejections = [];
const onRejection = (reason) => { rejections.push(reason); };

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  process.off('unhandledRejection', onRejection);
  rejections = [];
  vi.unstubAllGlobals();
  delete document.hidden;
  delete navigator.serviceWorker;
});

const Probe = ({ restContext }) => {
  useRestNotification({ restContext });
  return null;
};

// 假的 service worker，記下送出的訊息
const stubServiceWorker = () => {
  const messages = [];
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ active: { postMessage: (m) => messages.push(m) } }) },
  });
  return messages;
};

const goBackground = async () => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  // 等 schedule() 的 promise 跑完、Node 判定有沒有沒接住的 rejection
  await new Promise(r => setTimeout(r, 10));
};

const restContext = () => ({ type: 'in-set', delay: 90, anchorTs: Date.now(), notifyKey: 'B:1:in-set:1' });

const renderProbe = () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Probe restContext={restContext()} />));
};

test('沒有 Notification 物件（iOS Safari 非 PWA）切到背景，不排程也不噴 unhandled rejection', async () => {
  process.on('unhandledRejection', onRejection);
  vi.stubGlobal('Notification', undefined);
  const messages = stubServiceWorker();
  renderProbe();
  await goBackground();
  assert.deepEqual(rejections.map(String), []);
  assert.deepEqual(messages, []);
});

test('（不變）有通知權限時切到背景，排程休息結束通知', async () => {
  vi.stubGlobal('Notification', { permission: 'granted' });
  const messages = stubServiceWorker();
  renderProbe();
  await goBackground();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'SCHEDULE_NOTIFICATION');
});
