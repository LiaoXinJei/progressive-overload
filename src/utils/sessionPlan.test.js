// 執行：npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildSessionPlan } from './sessionPlan.js';
import { getPairRoundState } from './pairRoundState.js';
import { SUPERSET_PAIRS } from '../constants/workouts.js';

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KEYS = ['A', 'B', 'C', 'D', 'E'];

test('W1–W10 每個 session 的內建動作都至少 1 組', () => {
  const zeroSets = [];
  for (const week of WEEKS) {
    for (const key of KEYS) {
      for (const { exercise, sets } of buildSessionPlan(week, key, {})) {
        if (sets < 1) zeroSets.push(`W${week} ${key} ${exercise.id}`);
      }
    }
  }
  assert.deepEqual(zeroSets, []);
});

test('減量週 LEGS 日的 superset 至少 1 輪、未開始時不是 done', () => {
  const dayE = KEYS.indexOf('E');
  for (const week of [5, 10]) {
    const plan = buildSessionPlan(week, 'E', {});
    for (const pair of SUPERSET_PAIRS.E) {
      const a = plan.find(p => p.exercise.id === pair.primary);
      const b = plan.find(p => p.exercise.id === pair.secondary);
      const state = getPairRoundState(pair, a.sets, b.sets, week, dayE, {});
      assert.ok(state.coreRoundCount >= 1, `W${week} ${pair.primary}+${pair.secondary} 輪數 ${state.coreRoundCount}`);
      assert.equal(state.state, 'idle');
    }
  }
});
