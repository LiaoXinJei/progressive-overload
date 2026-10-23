// @vitest-environment jsdom
// 執行：npx vitest run src/components/nutrition/NutritionView.spec.jsx

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import NutritionView from './NutritionView';

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
