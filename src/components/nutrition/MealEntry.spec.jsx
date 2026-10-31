// @vitest-environment jsdom
// 執行：npx vitest run src/components/nutrition/MealEntry.spec.jsx

import { test, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import MealEntry from './MealEntry';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let saved;
let closed;

beforeEach(() => {
  saved = null;
  closed = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<MealEntry onSave={(m) => { saved = m; }} onClose={() => { closed = true; }} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const setInput = (el, value) => act(() => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const buttonByText = (text) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));
const nameInputs = () => container.querySelectorAll('input[placeholder="食物名稱"]');
// 每個食物項目 4 格：熱量、蛋白質、碳水、脂肪
const numberInputs = () => container.querySelectorAll('input[type="number"]');

test('M1 沒填名稱但有填數字的項目用「未命名」保留，不會整筆被丟掉', () => {
  click(buttonByText('午餐'));
  setInput(nameInputs()[0], '雞胸肉');
  setInput(numberInputs()[0], '200');

  click(buttonByText('新增食物項目'));
  setInput(numberInputs()[4], '600'); // 第二項只填熱量
  setInput(numberInputs()[5], '25');  // 和蛋白質

  click(buttonByText('儲存餐點'));
  expect(closed).toBe(true);
  expect(saved.items.map(i => [i.name, i.calories, i.protein])).toEqual([
    ['雞胸肉', 200, 0],
    ['未命名', 600, 25],
  ]);
  expect(saved.items.reduce((s, i) => s + i.calories, 0)).toBe(800);
});

test('M1 完全空白的項目才丟掉，其他照存', () => {
  setInput(nameInputs()[0], '白飯');
  click(buttonByText('新增食物項目')); // 第二項整個空白
  click(buttonByText('儲存餐點'));
  expect(saved.items.map(i => i.name)).toEqual(['白飯']);
});

test('M1 每一項都空白時儲存鈕 disable，並說明原因', () => {
  const save = buttonByText('儲存餐點');
  expect(save.disabled).toBe(true);
  const reasonId = save.getAttribute('aria-describedby');
  expect(reasonId).toBeTruthy();
  expect(container.querySelector(`#${reasonId}`).textContent).toContain('至少填一項');

  click(save);
  expect(saved).toBeNull();
  expect(closed).toBe(false);

  // 填了任何數字就可以存
  setInput(numberInputs()[2], '30');
  expect(buttonByText('儲存餐點').disabled).toBe(false);
  expect(container.textContent).not.toContain('至少填一項');
});

test('營養素欄位用小數鍵盤、字級 16px（text-base），iOS 聚焦時不會放大畫面', () => {
  const inputs = [...numberInputs()];
  expect(inputs).toHaveLength(4);
  inputs.forEach((input) => {
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.className.split(/\s+/)).toContain('text-base');
    expect(input.className).not.toMatch(/(^|\s)text-(xs|sm)(\s|$)/);
  });
});
