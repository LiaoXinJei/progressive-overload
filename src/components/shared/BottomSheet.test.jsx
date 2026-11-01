// @vitest-environment jsdom
// 執行：npm test
//
// BottomSheet / Presence：退場還沒播完又打開要重新掛載（拖曳位移、焦點重來），背景捲動鎖

import React, { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, beforeEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import BottomSheet, { SheetPresence } from './BottomSheet.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root = null;
let container = null;

beforeEach(() => {
  // 有 matchMedia 才會走「等退場播完再卸載」那條路（jsdom 預設沒有，會直接卸載）
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.style.overflow = '';
});

let mounts = 0;
const Content = () => {
  useEffect(() => { mounts += 1; }, []);
  return <button type="button" data-autofocus>內容</button>;
};

const renderHarness = () => {
  const api = {};
  const Harness = () => {
    const [open, setOpen] = useState(true);
    api.setOpen = setOpen;
    return (
      <>
        <button type="button" data-opener onClick={() => setOpen(true)}>打開</button>
        <SheetPresence>
          {open && (
            <BottomSheet title="週次" onClose={() => setOpen(false)}>
              <Content />
            </BottomSheet>
          )}
        </SheetPresence>
      </>
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return api;
};

const dialogs = () => container.querySelectorAll('[role="dialog"]');

test('B2：關閉後退場還沒播完就再打開，重新掛載一個新的 sheet，焦點進到新 sheet', () => {
  mounts = 0;
  const api = renderHarness();
  assert.equal(mounts, 1);
  act(() => api.setOpen(false));
  // 退場中：還在 DOM 裡
  assert.equal(dialogs().length, 1);
  act(() => { vi.advanceTimersByTime(120); });
  act(() => api.setOpen(true));
  assert.equal(dialogs().length, 1);
  assert.equal(mounts, 2, '應該重新掛載，不沿用退場中的那一個');
  const dialog = dialogs()[0];
  assert.equal(dialog.style.transform, 'translateY(0px)');
  assert.ok(dialog.contains(document.activeElement), '焦點要進到重新打開的 sheet');
  act(() => { vi.advanceTimersByTime(500); });
  assert.equal(dialogs().length, 1, '舊的那個退場計時器不能把新的 sheet 卸掉');
});

test('B4：退場播完卸載後才解除背景捲動鎖', () => {
  const api = renderHarness();
  assert.equal(document.documentElement.style.overflow, 'hidden');
  act(() => api.setOpen(false));
  assert.equal(document.documentElement.style.overflow, 'hidden');
  act(() => { vi.advanceTimersByTime(400); });
  assert.equal(dialogs().length, 0);
  assert.equal(document.documentElement.style.overflow, '');
});

test('B9：sheet 最高 90dvh（保留 vh 備援）', () => {
  renderHarness();
  assert.match(dialogs()[0].className, /\bsheet-max-h\b/);
  assert.doesNotMatch(dialogs()[0].className, /max-h-\[90vh\]/);
});
