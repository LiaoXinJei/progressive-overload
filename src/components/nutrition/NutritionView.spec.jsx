// @vitest-environment jsdom
// 執行：npx vitest run src/components/nutrition/NutritionView.spec.jsx

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import NutritionView from './NutritionView';
import TabNavigation from '../shared/TabNavigation';

process.env.TZ = 'Asia/Taipei';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const profile = { targetCalories: 2000, targetProtein: 150, targetCarbs: 200, targetFat: 60 };
const breakfast = {
  id: 'm_1', time: '07:20', name: '台式早餐', source: 'manual',
  items: [{ id: 'i_1', name: '蛋餅', calories: 300, protein: 12, carbs: 30, fat: 14 }],
};

let container;
let root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const render = (nutritionLogs) => act(() => {
  root.render(
    <NutritionView
      nutritionProfile={profile}
      setNutritionProfile={() => {}}
      nutritionLogs={nutritionLogs}
      setNutritionLogs={() => {}}
    />,
  );
});

test('台灣早上 08:00 前，營養頁的「今天」是本地日期，不是 UTC 的前一天', () => {
  // 2026-10-23 (五) 07:30 台北 = 2026-10-22 23:30 UTC
  vi.setSystemTime(new Date('2026-10-22T23:30:00Z'));
  expect(new Date().getTimezoneOffset()).toBe(-480);

  render({ '2026-10-23': { meals: [breakfast] } });

  expect(container.textContent).toContain('今天');
  expect(container.textContent).toContain('10/23 (五)');
  expect(container.textContent).toContain('台式早餐');
});

test('從本地日期往前、往後切換一天', () => {
  vi.setSystemTime(new Date('2026-10-22T23:30:00Z'));
  render({ '2026-10-22': { meals: [{ ...breakfast, id: 'm_0', name: '昨天的早餐' }] } });

  const [prev, next] = container.querySelectorAll('button');
  act(() => prev.click());
  expect(container.textContent).toContain('10/22 (四)');
  expect(container.textContent).toContain('昨天的早餐');

  act(() => next.click());
  expect(container.textContent).toContain('今天');
  expect(container.textContent).toContain('10/23 (五)');
});

// ==================== 有 state 的版本：拿得到最新的 nutritionLogs ====================

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const setInput = (el, value) => act(() => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const buttonByText = (text) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));

let logsRef;
const Harness = ({ initialLogs = {} }) => {
  const [logs, setLogs] = useState(initialLogs);
  logsRef = logs;
  return (
    <>
      <NutritionView
        nutritionProfile={profile} setNutritionProfile={() => {}}
        nutritionLogs={logs} setNutritionLogs={setLogs}
      />
      {/* 跟 App 一樣，tab 列在 main 後面 */}
      <TabNavigation activeTab="nutrition" setActiveTab={() => {}} />
    </>
  );
};

const addMealViaForm = (foodName, calories) => {
  click(container.querySelector('button[title="手動新增餐點"]'));
  setInput(container.querySelector('input[placeholder="食物名稱"]'), foodName);
  setInput(container.querySelector('input[type="number"]'), String(calories));
  click(buttonByText('儲存餐點'));
};

const fireVisible = () => act(() => { document.dispatchEvent(new Event('visibilitychange')); });

test('N1 停在「今天」跨過午夜，回到前景後跟著換到新的今天，新餐點記在新的一天', () => {
  vi.setSystemTime(new Date('2026-10-30T15:50:00Z')); // 台北 10/30 (五) 23:50
  act(() => root.render(<Harness />));
  expect(container.textContent).toContain('10/30 (五)');

  vi.setSystemTime(new Date('2026-10-30T16:10:00Z')); // 台北 10/31 (六) 00:10
  fireVisible();
  expect(document.visibilityState).toBe('visible');

  const header = container.querySelector('main').textContent;
  expect(header).toContain('今天');
  expect(header).toContain('10/31 (六)');

  addMealViaForm('宵夜鹹酥雞', 650);
  expect(Object.keys(logsRef)).toEqual(['2026-10-31']);
  expect(logsRef['2026-10-31'].meals[0].items[0].name).toBe('宵夜鹹酥雞');
});

test('N1 App 在前景沒重繪，過了午夜也會自己換到新的今天', () => {
  // beforeEach 只假 Date；已經在假的狀態下再呼叫 useFakeTimers 不會生效，要先還原
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-30T15:50:00Z')); // 台北 10/30 23:50
  act(() => root.render(<Harness />));

  act(() => { vi.advanceTimersByTime(25 * 60 * 1000); }); // 台北 10/31 00:15
  expect(container.querySelector('main').textContent).toContain('10/31 (六)');
  expect(container.querySelector('main').textContent).toContain('今天');
});

test('N1 使用者手動切到別天，跨過午夜不會被拉走', () => {
  vi.setSystemTime(new Date('2026-10-30T15:50:00Z')); // 台北 10/30 23:50
  act(() => root.render(<Harness />));
  const [prev] = container.querySelectorAll('button');
  click(prev);
  expect(container.querySelector('main').textContent).toContain('10/29 (四)');

  vi.setSystemTime(new Date('2026-10-30T16:10:00Z')); // 台北 10/31 00:10
  fireVisible();
  expect(container.querySelector('main').textContent).toContain('10/29 (四)');
  expect(container.querySelector('main').textContent).not.toContain('今天');
});

test('刪除餐點要先確認：取消就不刪，確認才刪', () => {
  vi.setSystemTime(new Date('2026-10-22T23:30:00Z')); // 台北 10/23 07:30
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  act(() => root.render(<Harness initialLogs={{ '2026-10-23': { meals: [breakfast] } }} />));

  const del = container.querySelector('button[aria-label="刪除台式早餐"]');
  expect(del).not.toBeNull();
  click(del);
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm.mock.calls[0][0]).toContain('台式早餐');
  expect(logsRef['2026-10-23'].meals).toHaveLength(1);

  confirm.mockReturnValue(true);
  click(del);
  expect(logsRef['2026-10-23'].meals).toHaveLength(0);
  confirm.mockRestore();
});

test('刪除鈕的點擊範圍至少 44×44（14px 圖示 + 兩邊 15px padding），用負 margin 抵銷不改版面', () => {
  // jsdom 不算版面，只能檢查 class
  vi.setSystemTime(new Date('2026-10-22T23:30:00Z'));
  act(() => root.render(<Harness initialLogs={{ '2026-10-23': { meals: [breakfast] } }} />));
  const del = container.querySelector('button[aria-label="刪除台式早餐"]');
  expect(del.querySelector('svg').getAttribute('width')).toBe('14');
  expect(del.className.split(/\s+/)).toEqual(expect.arrayContaining(['p-[15px]', '-m-[15px]']));
});

test('右下角 FAB 和 main 底部空間都有算進 safe-area，最後一筆可以捲到 FAB 上方', () => {
  // jsdom 不算版面，只能檢查 class
  vi.setSystemTime(new Date('2026-10-22T23:30:00Z'));
  act(() => root.render(<Harness />));
  const main = container.querySelector('main');
  const fab = container.querySelector('button[title="手動新增餐點"]').parentElement;
  expect(main.className).toContain('pb-[calc(9rem+env(safe-area-inset-bottom))]');
  expect(fab.className).toContain('bottom-[calc(5rem+env(safe-area-inset-bottom))]');
});

// 從 className 讀 Tailwind 的 z-index（z-50、z-[60]）
const zIndexOf = (el) => {
  const m = el.className.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/);
  return m ? Number(m[1] ?? m[2]) : 0;
};

test.each([
  ['TDEE 計算器', () => click(buttonByText('編輯 TDEE 設定'))],
  ['手動新增餐點', () => click(container.querySelector('button[title="手動新增餐點"]'))],
  ['AI 食物分析', () => click(container.querySelector('button[title="AI 食物分析"]'))],
])('%s 的 modal 疊在底部 tab 列上面，底部留 safe-area', (_, open) => {
  // jsdom 不算疊層，檢查 z-index class 跟 DOM 順序：overlay 在 nav 前面，所以 z 一定要比 nav 大
  vi.setSystemTime(new Date('2026-10-22T23:30:00Z'));
  act(() => root.render(<Harness />));
  open();
  const overlay = container.querySelector('main .fixed.inset-0');
  const nav = container.querySelector('nav');
  expect(overlay).not.toBeNull();
  expect(overlay.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(zIndexOf(overlay)).toBeGreaterThan(zIndexOf(nav));
  expect(overlay.className).toContain('env(safe-area-inset-bottom)');
});
