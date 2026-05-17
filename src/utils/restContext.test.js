// 執行：node --test src/utils/restContext.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPairForExerciseId,
  isPairTailSet,
  getRestContext,
} from './pairRoundState.js';

const W = 1;
const D = 0; // PUSH A
const workoutKey = 'A';

const k = (id, i) => `w${W}-d${D}-${id}-s${i}`;
const done = (ts) => ({ done: true, completedAt: ts });
const skipped = () => ({ skipped: true });

// 模擬 PUSH A 的 session plan（取 SUPERSET_PAIRS.A 的兩對 + 一些單動作）
const planA = [
  { exercise: { id: 'bp_flat' }, sets: 3 },
  { exercise: { id: 'lateral_raise' }, sets: 3 },     // pair1 primary
  { exercise: { id: 'tri_pushdown' }, sets: 3 },      // pair1 secondary
  { exercise: { id: 'lateral_raise_lean' }, sets: 3 }, // pair2 primary
  { exercise: { id: 'tri_cross_body' }, sets: 3 },     // pair2 secondary
  { exercise: { id: 'leg_ext' }, sets: 2 },
];

// ==================== getPairForExerciseId ====================

test('getPairForExerciseId: 命中 pair1 primary', () => {
  const p = getPairForExerciseId('A', 'lateral_raise');
  assert.equal(p?.primary, 'lateral_raise');
  assert.equal(p?.secondary, 'tri_pushdown');
  assert.equal(p?.rest, 75);
  assert.equal(p?.pairIdx, 0);
});

test('getPairForExerciseId: 命中 pair2 secondary', () => {
  const p = getPairForExerciseId('A', 'tri_cross_body');
  assert.equal(p?.primary, 'lateral_raise_lean');
  assert.equal(p?.pairIdx, 1);
});

test('getPairForExerciseId: 非 pair 動作回傳 null', () => {
  assert.equal(getPairForExerciseId('A', 'bp_flat'), null);
});

test('getPairForExerciseId: 不存在的 session 回傳 null', () => {
  assert.equal(getPairForExerciseId('X', 'anything'), null);
});

// ==================== isPairTailSet ====================

test('isPairTailSet: 等組數無 tail', () => {
  const pair = { primary: 'A', secondary: 'B', rest: 75 };
  assert.equal(isPairTailSet(pair, 3, 3, 'A', 2), false);
});

test('isPairTailSet: B 多一組、B_3 為 tail', () => {
  const pair = { primary: 'A', secondary: 'B', rest: 75 };
  assert.equal(isPairTailSet(pair, 3, 4, 'B', 3), true);
  assert.equal(isPairTailSet(pair, 3, 4, 'B', 2), false);
});

test('isPairTailSet: 動作 id 不屬於 pair', () => {
  const pair = { primary: 'A', secondary: 'B', rest: 75 };
  assert.equal(isPairTailSet(pair, 3, 4, 'X', 5), false);
});

// ==================== getRestContext: idle ====================

test('restContext: 當日無 done log → idle', () => {
  const ctx = getRestContext({
    logs: {}, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'idle');
  assert.equal(ctx.delay, null);
  assert.equal(ctx.anchorTs, null);
  assert.match(ctx.notifyKey, /idle/);
});

// ==================== getRestContext: in-set（單動作） ====================

test('restContext: 單動作下一組未 settled → in-set、global delay', () => {
  const logs = { [k('bp_flat', 0)]: done(1000) };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'in-set');
  assert.equal(ctx.delay, 90);
  assert.equal(ctx.anchorTs, 1000);
  assert.match(ctx.notifyKey, /in-set/);
});

// ==================== getRestContext: in-pair-mid-round ====================

test('restContext: pair 內僅 primary done → in-pair-mid-round、不排程', () => {
  const logs = { [k('lateral_raise', 0)]: done(2000) };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'in-pair-mid-round');
  assert.equal(ctx.delay, null);
  assert.equal(ctx.anchorTs, 2000);
});

test('restContext: pair 內僅 secondary done → in-pair-mid-round', () => {
  const logs = { [k('tri_pushdown', 0)]: done(2500) };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'in-pair-mid-round');
});

// ==================== getRestContext: in-pair-between-rounds ====================

test('restContext: pair round 完成 → in-pair-between-rounds、用 pair rest', () => {
  const logs = {
    [k('lateral_raise', 0)]: done(2000),
    [k('tri_pushdown', 0)]: done(2300),
  };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'in-pair-between-rounds');
  assert.equal(ctx.delay, 75); // SUPERSET_PAIRS.A[0].rest
  assert.equal(ctx.anchorTs, 2300); // max(A,B)
  assert.match(ctx.notifyKey, /in-pair-between-rounds:2300/);
});

test('restContext: LEGS pair rest = 90', () => {
  const planE = [
    { exercise: { id: 'rdl_db' }, sets: 2 },
    { exercise: { id: 'calf_standing_heavy' }, sets: 2 },
  ];
  const logs = {
    [`w1-d4-rdl_db-s0`]: done(1000),
    [`w1-d4-calf_standing_heavy-s0`]: done(1200),
  };
  const ctx = getRestContext({
    logs, currentWeek: 1, currentDay: 4, workoutKey: 'E',
    sessionPlan: planE, globalDelay: 90,
  });
  assert.equal(ctx.type, 'in-pair-between-rounds');
  assert.equal(ctx.delay, 90);
});

// ==================== getRestContext: between-exercises ====================

test('restContext: pair 完成所有 round、後續仍有工作 → between-exercises', () => {
  const logs = {
    [k('lateral_raise', 0)]: done(1000),
    [k('tri_pushdown', 0)]: done(1100),
    [k('lateral_raise', 1)]: done(2000),
    [k('tri_pushdown', 1)]: done(2200),
    [k('lateral_raise', 2)]: done(3000),
    [k('tri_pushdown', 2)]: done(3300),
  };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'between-exercises');
  assert.equal(ctx.delay, 90); // global
  assert.equal(ctx.anchorTs, 3300); // pair end timestamp
});

test('restContext: 單動作末組完成、仍有後續動作 → between-exercises', () => {
  const logs = {
    [k('bp_flat', 0)]: done(500),
    [k('bp_flat', 1)]: done(1000),
    [k('bp_flat', 2)]: done(1500),
  };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'between-exercises');
  assert.equal(ctx.delay, 90);
  assert.equal(ctx.anchorTs, 1500);
});

// ==================== getRestContext: session done → idle ====================

test('restContext: 所有動作皆 settled → idle', () => {
  const tinyPlan = [
    { exercise: { id: 'bp_flat' }, sets: 2 },
  ];
  const logs = {
    [k('bp_flat', 0)]: done(500),
    [k('bp_flat', 1)]: done(1000),
  };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: tinyPlan, globalDelay: 90,
  });
  assert.equal(ctx.type, 'idle');
});

// ==================== getRestContext: tail set 回退單動作邏輯 ====================

test('restContext: pair tail set 視為單動作', () => {
  // B 有 4 組、A 只有 3 組；user 完成到 B_3（tail）
  const planTail = [
    { exercise: { id: 'lateral_raise' }, sets: 3 },
    { exercise: { id: 'tri_pushdown' }, sets: 4 }, // 多一組
    { exercise: { id: 'bp_flat' }, sets: 2 },
  ];
  const logs = {
    // 完成完整 3 輪
    [k('lateral_raise', 0)]: done(100),
    [k('tri_pushdown', 0)]: done(150),
    [k('lateral_raise', 1)]: done(200),
    [k('tri_pushdown', 1)]: done(250),
    [k('lateral_raise', 2)]: done(300),
    [k('tri_pushdown', 2)]: done(350),
    // tail B_3
    [k('tri_pushdown', 3)]: done(400),
  };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planTail, globalDelay: 90,
  });
  // B_3 是 tail、視為單動作；後面沒有 B_4 → 檢查 session 還有 bp_flat 未做
  assert.equal(ctx.type, 'between-exercises');
  assert.equal(ctx.delay, 90);
  assert.equal(ctx.anchorTs, 400);
});

// ==================== getRestContext: notifyKey 變更觸發 ====================

test('restContext: 同 anchor 多次呼叫產出相同 notifyKey', () => {
  const logs = {
    [k('lateral_raise', 0)]: done(2000),
    [k('tri_pushdown', 0)]: done(2300),
  };
  const a = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  const b = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(a.notifyKey, b.notifyKey);
});

test('restContext: anchor 變更會產出不同 notifyKey', () => {
  const logs1 = {
    [k('lateral_raise', 0)]: done(2000),
    [k('tri_pushdown', 0)]: done(2300),
  };
  const logs2 = {
    [k('lateral_raise', 0)]: done(2000),
    [k('tri_pushdown', 0)]: done(2500), // anchor 變了
  };
  const a = getRestContext({
    logs: logs1, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  const b = getRestContext({
    logs: logs2, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.notEqual(a.notifyKey, b.notifyKey);
});

// ==================== 邊界：skipped + done 並存 ====================

test('restContext: pair round 內 skipped + done 仍進 between-rounds', () => {
  const logs = {
    [k('lateral_raise', 0)]: done(1000),
    [k('tri_pushdown', 0)]: skipped(),
  };
  const ctx = getRestContext({
    logs, currentWeek: W, currentDay: D, workoutKey,
    sessionPlan: planA, globalDelay: 90,
  });
  assert.equal(ctx.type, 'in-pair-between-rounds');
  assert.equal(ctx.anchorTs, 1000); // 只有 done 一方
});
