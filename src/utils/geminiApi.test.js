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

// 回應的 text 欄位用指定字串
const stubFetchText = (text) => {
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }));
};

test('API 金鑰放在 x-goog-api-key header，不放進網址', async () => {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"items":[{"name":"白飯","calories":280}]}' }] } }] }),
    };
  });
  await analyzeFood('AIza-secret', 'BASE64', 'image/jpeg');
  assert.equal(calls[0].url.includes('AIza-secret'), false, calls[0].url);
  assert.equal(calls[0].url.includes('key='), false, calls[0].url);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'AIza-secret');
});

test('請求要求 Gemini 直接回 JSON（responseMimeType）', async () => {
  const calls = stubFetch();
  await analyzeFood('KEY', 'BASE64', 'image/jpeg');
  assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
});

test('G1 數字欄位回帶單位的字串（"約 750"、"30g"、"1,200 kcal"）時取出數字，不會變 NaN', async () => {
  stubFetchText(JSON.stringify({ items: [
    { name: '便當', calories: '約 750', protein: '30g', carbs: 90, fat: '25.6 g' },
    { name: '珍奶', calories: '1,200 kcal', protein: '300-400', carbs: null, fat: '不確定' },
  ] }));
  const items = await analyzeFood('KEY', 'B64', 'image/jpeg');
  assert.deepEqual(
    items.map(({ calories, protein, carbs, fat }) => ({ calories, protein, carbs, fat })),
    [
      { calories: 750, protein: 30, carbs: 90, fat: 26 },
      // 範圍取第一個數字；完全沒數字或 null 才當 0
      { calories: 1200, protein: 300, carbs: 0, fat: 0 },
    ],
  );
});

test('回應不是合法 JSON 時丟中文錯誤，不是 SyntaxError 的英文訊息', async () => {
  stubFetchText('抱歉，我看不出這是什麼食物');
  await assert.rejects(
    analyzeFood('KEY', 'B64', 'image/jpeg'),
    (err) => {
      assert.equal(err instanceof SyntaxError, false);
      assert.match(err.message, /AI 回傳的格式無法解析/);
      return true;
    },
  );
});

test('30 秒沒回應就中止請求，丟中文逾時錯誤', async () => {
  vi.useFakeTimers();
  try {
    let signal;
    vi.stubGlobal('fetch', (url, init) => {
      signal = init.signal;
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      });
    });
    const settled = analyzeFood('KEY', 'B64', 'image/jpeg').then(() => 'resolved', (err) => err);

    await vi.advanceTimersByTimeAsync(29_000);
    assert.equal(signal.aborted, false);

    await vi.advanceTimersByTimeAsync(1_000);
    assert.equal(signal.aborted, true);
    const err = await settled;
    assert.ok(err instanceof Error);
    assert.match(err.message, /逾時/);
  } finally {
    vi.useRealTimers();
  }
});

test('網路斷線（fetch 直接失敗）時丟中文錯誤', async () => {
  vi.stubGlobal('fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(analyzeFood('KEY', 'B64', 'image/jpeg'), /網路/);
});
