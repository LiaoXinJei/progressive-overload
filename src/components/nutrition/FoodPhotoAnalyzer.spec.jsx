// @vitest-environment jsdom
// 執行：npx vitest run src/components/nutrition/FoodPhotoAnalyzer.spec.jsx

import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import FoodPhotoAnalyzer from './FoodPhotoAnalyzer';
import { analyzeFood } from '../../utils/geminiApi';

// 不打真的 API、不跑 canvas 壓縮
vi.mock('../../utils/geminiApi', () => ({
  compressImage: vi.fn(async () => ({ base64: 'B64', mimeType: 'image/jpeg' })),
  analyzeFood: vi.fn(),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
let saved;

beforeEach(() => {
  saved = null;
  analyzeFood.mockResolvedValue([
    { id: 'i_1', name: '白飯', calories: 280, protein: 5, carbs: 62, fat: 1 },
    { id: 'i_2', name: '滷雞腿', calories: 320, protein: 28, carbs: 2, fat: 22 },
  ]);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(
    <FoodPhotoAnalyzer apiKey="KEY" onSave={(m) => { saved = m; }} onClose={() => {}} onNeedApiKey={() => {}} />,
  ));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const buttonByText = (text) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text));

const pickPhoto = async () => {
  const input = container.querySelector('input[type="file"]');
  const file = new File(['x'], 'lunch.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
};

test('AI 結果全部刪光後有「重新拍照」入口，按了回到拍照 / 上傳畫面', async () => {
  await pickPhoto();
  expect(container.textContent).toContain('白飯');

  container.querySelectorAll('button[aria-label^="移除"]').forEach(btn => click(btn));
  expect(container.textContent).not.toContain('白飯');
  expect(buttonByText('儲存分析結果')).toBeUndefined();

  const retake = buttonByText('重新拍照');
  expect(retake).toBeTruthy();
  click(retake);
  expect(buttonByText('拍攝食物照片')).toBeTruthy();
  expect(buttonByText('從相簿選擇')).toBeTruthy();
  expect(container.querySelector('img')).toBeNull();

  // 重拍後可以正常分析、儲存
  await pickPhoto();
  click(buttonByText('儲存分析結果'));
  expect(saved.items.map(i => i.name)).toEqual(['白飯', '滷雞腿']);
});

test('營養素欄位用小數鍵盤、字級 16px（text-base），iOS 聚焦時不會放大畫面', async () => {
  await pickPhoto();
  const inputs = [...container.querySelectorAll('input[type="number"]')];
  expect(inputs).toHaveLength(8);
  inputs.forEach((input) => {
    expect(input.getAttribute('inputmode')).toBe('decimal');
    expect(input.className.split(/\s+/)).toContain('text-base');
    expect(input.className).not.toMatch(/(^|\s)text-(xs|sm)(\s|$)/);
  });
});
