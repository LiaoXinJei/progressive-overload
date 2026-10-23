// 執行：npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildSessionPlan, getPhase, getWeeklyMuscleVolume, splitByWeights } from './sessionPlan.js';
import { getPairRoundState } from './pairRoundState.js';
import { SUPERSET_PAIRS, VOLUME_CONFIG, SESSION_WEIGHTS, MUSCLE_SESSION_MAP } from '../constants/workouts.js';

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

// ==================== BUG-15：各 session 照規格比例分配 ====================

const sessionTotals = (week) => {
  const totals = {};
  for (const key of KEYS) {
    for (const { exercise, sets } of buildSessionPlan(week, key, {})) {
      totals[exercise.muscle] ??= {};
      totals[exercise.muscle][key] = (totals[exercise.muscle][key] || 0) + sets;
    }
  }
  return totals;
};

test('W4 各 session 組數照規格比例（QUADS 週量用 VOLUME_CONFIG 的 16）', () => {
  assert.deepEqual(sessionTotals(4), {
    CHEST: { A: 8, C: 4 },
    BACK: { B: 9, D: 9 },
    SHOULDERS: { C: 6 },
    SIDE_DELT: { A: 7, C: 7 },
    REAR_DELT: { B: 6, D: 6 },
    TRICEPS: { A: 6, C: 3 },
    BICEPS: { B: 6, D: 6 },
    QUADS: { A: 4, C: 4, E: 8 },
    HAMS: { B: 3, D: 3, E: 8 },
    CALVES: { A: 2, B: 2, C: 2, D: 2, E: 6 },
  });
});

test('session 內餘數給最後一個動作', () => {
  const sets = Object.fromEntries(buildSessionPlan(4, 'A', {}).map(p => [p.exercise.id, p.sets]));
  assert.equal(sets.lateral_raise, 3);
  assert.equal(sets.lateral_raise_lean, 4);
});

test('非減量週每個肌群的週總組數等於 VOLUME_CONFIG 目標', () => {
  const diff = [];
  for (const week of WEEKS.filter(w => getPhase(w) !== 'deload')) {
    const totals = sessionTotals(week);
    for (const muscle of Object.keys(VOLUME_CONFIG)) {
      const sum = Object.values(totals[muscle] || {}).reduce((a, b) => a + b, 0);
      const target = getWeeklyMuscleVolume(muscle, week);
      if (sum !== target) diff.push(`W${week} ${muscle} ${sum}/${target}`);
    }
  }
  assert.deepEqual(diff, []);
});

test('SESSION_WEIGHTS 的 session 跟 MUSCLE_SESSION_MAP 一致', () => {
  for (const [muscle, sessions] of Object.entries(MUSCLE_SESSION_MAP)) {
    assert.deepEqual(Object.keys(SESSION_WEIGHTS[muscle] || {}), sessions, muscle);
  }
});

test('splitByWeights：最大餘數法、總和不變、同餘數給前面的 session', () => {
  assert.deepEqual(splitByWeights(16, ['A', 'C', 'E'], { A: 3, C: 3, E: 7 }), [4, 4, 8]);
  assert.deepEqual(splitByWeights(10, ['A', 'B', 'C', 'D', 'E'], { A: 2, B: 2, C: 2, D: 2, E: 6 }), [2, 2, 1, 1, 4]);
  // 沒有權重表：平均分，餘數給前面（舊行為）
  assert.deepEqual(splitByWeights(10, ['A', 'C', 'E']), [4, 3, 3]);
  assert.deepEqual(splitByWeights(0, ['A', 'C']), [0, 0]);
});
