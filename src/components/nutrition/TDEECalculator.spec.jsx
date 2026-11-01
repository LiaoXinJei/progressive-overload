// @vitest-environment jsdom
// 執行：npx vitest run src/components/nutrition/TDEECalculator.spec.jsx

import { test, expect, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TDEECalculator from './TDEECalculator';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let saved;

beforeEach(() => {
  saved = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const renderCalc = (profile = null) => act(() => {
  root.render(<TDEECalculator profile={profile} onSave={(p) => { saved = p; }} onClose={() => {}} />);
});
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const setInput = (el, value) => act(() => {
  const proto = Object.getPrototypeOf(el);
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const buttonByText = (text) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));
const fields = () => {
  const [age, height, weight] = container.querySelectorAll('input[type="number"]');
  return { age, height, weight };
};

test('T1 體重、身高清空時不能儲存，並標出是哪個欄位', () => {
  renderCalc();
  setInput(fields().weight, '');
  setInput(fields().height, '');

  const save = buttonByText('儲存設定');
  expect(save.disabled).toBe(true);
  expect(fields().weight.getAttribute('aria-invalid')).toBe('true');
  expect(fields().height.getAttribute('aria-invalid')).toBe('true');
  expect(fields().age.getAttribute('aria-invalid')).toBe('false');
  expect(container.textContent).toContain('身高請填 100–250 cm');
  expect(container.textContent).toContain('體重請填 30–300 kg');
  // 按鈕旁也說明為什麼不能存
  expect(container.querySelector(`#${save.getAttribute('aria-describedby')}`).textContent).toContain('標紅的欄位');

  click(save);
  expect(saved).toBeNull();
});

test.each([
  ['age', '9', '年齡請填 10–100 歲'],
  ['age', '101', '年齡請填 10–100 歲'],
  ['height', '99', '身高請填 100–250 cm'],
  ['height', '251', '身高請填 100–250 cm'],
  ['weight', '29', '體重請填 30–300 kg'],
  ['weight', '301', '體重請填 30–300 kg'],
])('T1 %s = %s 超出範圍時不能儲存', (field, value, message) => {
  renderCalc();
  setInput(fields()[field], value);
  expect(buttonByText('儲存設定').disabled).toBe(true);
  expect(fields()[field].getAttribute('aria-invalid')).toBe('true');
  expect(container.textContent).toContain(message);
});

test('T1 範圍內但算出來的目標熱量 ≤ 0（極端值 + 減脂）也不能儲存', () => {
  renderCalc({ gender: 'female', age: 100, height: 100, weight: 30, activityLevel: 1.2, goal: 'cut', targetCalories: 1 });
  expect(buttonByText('儲存設定').disabled).toBe(true);
  expect(container.textContent).toContain('目標熱量必須大於 0');
});

test('T1 欄位可以清空重打，合法時儲存數字型別、目標熱量大於 0', () => {
  renderCalc();
  setInput(fields().weight, '');
  expect(fields().weight.value).toBe(''); // 清空時不會被塞回 0
  setInput(fields().weight, '80.5');
  setInput(fields().age, '28');

  const save = buttonByText('儲存設定');
  expect(save.disabled).toBe(false);
  click(save);
  expect(saved).toMatchObject({ age: 28, height: 175, weight: 80.5 });
  expect(saved.targetCalories).toBeGreaterThan(0);
});

test('年齡用整數鍵盤，身高體重用小數鍵盤', () => {
  renderCalc();
  expect(fields().age.getAttribute('inputmode')).toBe('numeric');
  expect(fields().height.getAttribute('inputmode')).toBe('decimal');
  expect(fields().weight.getAttribute('inputmode')).toBe('decimal');
});
