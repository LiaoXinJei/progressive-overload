// 執行：npm test

import { test, vi, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { analyzeFood } from './geminiApi.js';

// 不打真的 API：攔截 fetch，檢查送出的請求
const stubFetch = () => {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"items":[{"name":"白飯","portion":"一碗","calories":280,"protein":5,"carbs":62,"fat":0.5}]}',
              thoughtSignature: 'sig',
            }],
          },
        }],
      }),
    };
  });
  return calls;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test('analyzeFood 使用仍在服務的 gemini-3.6-flash（gemini-2.0-flash 已於 2026-06-01 停用）', async () => {
  const calls = stubFetch();
  await analyzeFood('KEY', 'BASE64', 'image/jpeg');
  const model = calls[0].url.match(/\/models\/([^:]+):generateContent/)?.[1];
  assert.equal(model, 'gemini-3.6-flash');
});

test('generationConfig 符合 Gemini 3：溫度用預設、限制思考層級、輸出上限容得下思考 token', async () => {
  const calls = stubFetch();
  await analyzeFood('KEY', 'BASE64', 'image/jpeg');
  const config = calls[0].body.generationConfig;
  assert.equal(config.temperature, undefined);
  assert.equal(config.thinkingConfig?.thinkingLevel, 'low');
  assert.ok(config.maxOutputTokens >= 4096, `maxOutputTokens = ${config.maxOutputTokens}`);
});

test('回應帶 thoughtSignature 時仍能解析食物清單', async () => {
  stubFetch();
  const items = await analyzeFood('KEY', 'BASE64', 'image/jpeg');
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '白飯');
  assert.equal(items[0].calories, 280);
});
