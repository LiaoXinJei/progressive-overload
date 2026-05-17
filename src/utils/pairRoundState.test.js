// 執行：node --test src/utils/pairRoundState.test.js
// 使用 Node 內建 test runner、不需要額外 devDep。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPairRoundState, getPairEndTimestamp } from './pairRoundState.js';

const pair = { primary: 'A', secondary: 'B', rest: 75 };
const W = 1;
const D = 0;

const k = (id, i) => `w${W}-d${D}-${id}-s${i}`;
const done = (ts) => ({ done: true, completedAt: ts });
const skipped = () => ({ skipped: true });

test('idle: 無任何 set settled', () => {
  const logs = {};
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.state, 'idle');
  assert.equal(r.currentRoundIdx, 0);
  assert.equal(r.lastCompleteRoundEndTs, null);
  assert.equal(r.midRoundAnchorTs, null);
  assert.equal(r.coreRoundCount, 3);
});

test('mid-round: 只完成 A_0', () => {
  const logs = { [k('A', 0)]: done(1000) };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.state, 'mid-round');
  assert.equal(r.currentRoundIdx, 0);
  assert.equal(r.midRoundAnchorTs, 1000);
});

test('mid-round: 只完成 B_0', () => {
  const logs = { [k('B', 0)]: done(2000) };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.state, 'mid-round');
  assert.equal(r.midRoundAnchorTs, 2000);
});

test('between-rounds: 完成 round_0、目標起算 = max(A,B)', () => {
  const logs = {
    [k('A', 0)]: done(1000),
    [k('B', 0)]: done(1500),
  };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.state, 'between-rounds');
  assert.equal(r.currentRoundIdx, 1);
  assert.equal(r.lastCompleteRoundEndTs, 1500);
  assert.equal(r.rounds[0].endTs, 1500);
});

test('between-rounds: primary 較晚也吃得到', () => {
  const logs = {
    [k('A', 0)]: done(2000),
    [k('B', 0)]: done(1500),
  };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.state, 'between-rounds');
  assert.equal(r.lastCompleteRoundEndTs, 2000);
});

test('skipped 一邊：endTs 取 done 一方', () => {
  const logs = {
    [k('A', 0)]: done(1200),
    [k('B', 0)]: skipped(),
  };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.rounds[0].complete, true);
  assert.equal(r.rounds[0].endTs, 1200);
  assert.equal(r.state, 'between-rounds');
  assert.equal(r.lastCompleteRoundEndTs, 1200);
});

test('整輪皆 skipped：complete 但 endTs = null', () => {
  const logs = {
    [k('A', 0)]: skipped(),
    [k('B', 0)]: skipped(),
  };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.rounds[0].complete, true);
  assert.equal(r.rounds[0].endTs, null);
  // round_0 skipped、round_1 尚未開始 → 沒有起算 timestamp、退為 idle 語意
  assert.equal(r.state, 'idle');
  assert.equal(r.currentRoundIdx, 1);
});

test('全 skipped 後仍能繼續：round_0 整輪 skipped、進入 round_1 mid-round', () => {
  const logs = {
    [k('A', 0)]: skipped(),
    [k('B', 0)]: skipped(),
    [k('A', 1)]: done(3000),
  };
  const r = getPairRoundState(pair, 3, 3, W, D, logs);
  assert.equal(r.state, 'mid-round');
  assert.equal(r.currentRoundIdx, 1);
  assert.equal(r.midRoundAnchorTs, 3000);
});

test('done: 所有 round 皆 complete', () => {
  const logs = {
    [k('A', 0)]: done(1000),
    [k('B', 0)]: done(1100),
    [k('A', 1)]: done(2000),
    [k('B', 1)]: done(2200),
  };
  const r = getPairRoundState(pair, 2, 2, W, D, logs);
  assert.equal(r.state, 'done');
  assert.equal(r.lastCompleteRoundEndTs, 2200);
});

test('不等組數：coreRoundCount = min(A,B)、tail 不入 rounds', () => {
  const logs = {
    [k('A', 0)]: done(1000),
    [k('B', 0)]: done(1100),
    [k('A', 1)]: done(2000),
    [k('B', 1)]: done(2100),
    [k('A', 2)]: done(3000),
    // B 只有 2 組
  };
  const r = getPairRoundState(pair, 3, 2, W, D, logs);
  assert.equal(r.coreRoundCount, 2);
  assert.equal(r.rounds.length, 2);
  assert.equal(r.state, 'done');
});

test('getPairEndTimestamp：取最後一個 complete round 的 endTs', () => {
  const logs = {
    [k('A', 0)]: done(1000),
    [k('B', 0)]: done(1100),
    [k('A', 1)]: done(2000),
    [k('B', 1)]: done(2300),
  };
  const ts = getPairEndTimestamp(pair, 2, 2, W, D, logs);
  assert.equal(ts, 2300);
});

test('getPairEndTimestamp：最後一輪整 skipped → 退回前一輪 endTs', () => {
  const logs = {
    [k('A', 0)]: done(1000),
    [k('B', 0)]: done(1100),
    [k('A', 1)]: skipped(),
    [k('B', 1)]: skipped(),
  };
  const ts = getPairEndTimestamp(pair, 2, 2, W, D, logs);
  assert.equal(ts, 1100);
});

test('getPairEndTimestamp：未開始 → null', () => {
  const ts = getPairEndTimestamp(pair, 3, 3, W, D, {});
  assert.equal(ts, null);
});

test('done state: lastCompleteRoundEndTs 跳過全 skipped 末輪', () => {
  const logs = {
    [k('A', 0)]: done(1000),
    [k('B', 0)]: done(1100),
    [k('A', 1)]: skipped(),
    [k('B', 1)]: skipped(),
  };
  const r = getPairRoundState(pair, 2, 2, W, D, logs);
  assert.equal(r.state, 'done');
  assert.equal(r.lastCompleteRoundEndTs, 1100);
});
