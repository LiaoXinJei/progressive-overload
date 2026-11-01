// 執行：npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildSessionPlan, getPhase, getWeeklyMuscleVolume, splitByWeights } from './sessionPlan.js';
import { getPairRoundState } from './pairRoundState.js';
import { SUPERSET_PAIRS, VOLUME_CONFIG, SESSION_WEIGHTS, MUSCLE_SESSION_MAP, DEFAULT_EXERCISE_LIBRARY } from '../constants/workouts.js';

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

// ==================== BUG-14：組數覆寫分週 ====================

const setsOf = (week, key, id, opts = {}) =>
  buildSessionPlan(week, key, opts).find(p => p.exercise.id === id).sets;

test('組數覆寫只套用在設定的那一週', () => {
  const customSets = { 'w4-A-leg_ext': 2 };
  assert.equal(setsOf(4, 'A', 'leg_ext', { customSets }), 2);
  for (const week of [1, 3, 5, 10]) {
    assert.equal(setsOf(week, 'A', 'leg_ext', { customSets }), setsOf(week, 'A', 'leg_ext'), `W${week}`);
  }
});

test('舊格式（不分週）的組數覆寫不再套用', () => {
  assert.equal(setsOf(4, 'A', 'leg_ext', { customSets: { 'A-leg_ext': 1 } }), setsOf(4, 'A', 'leg_ext'));
});

// ==================== 備註跟著動作、RIR 限制跟著格子 ====================

const exerciseOf = (week, key, id, opts = {}) =>
  buildSessionPlan(week, key, opts).find(p => p.exercise.id === id).exercise;
const replaced = (key, slotId, libId) => ({
  exerciseOverrides: { [`${key}-${slotId}`]: libId },
  exerciseLibrary: DEFAULT_EXERCISE_LIBRARY,
});

test('內建動作顯示自己的備註', () => {
  assert.equal(exerciseOf(1, 'E', 'rdl_db').noteText, '建議使用助握帶（lifting straps）');
  assert.equal(exerciseOf(1, 'C', 'tri_dips').noteText, '身體前傾，重心放胸');
  assert.equal(exerciseOf(1, 'E', 'leg_press').noteText, undefined);
});

test('替換動作時備註換成替換上去那個動作的，原格子的備註不會留著', () => {
  assert.equal(exerciseOf(1, 'E', 'rdl_db', replaced('E', 'rdl_db', 'lib_machine_hip_hinge')).noteText, undefined);
  assert.equal(exerciseOf(1, 'E', 'rdl_db', replaced('E', 'rdl_db', 'lib_reverse_hyper')).noteText, '場館有才做');
  // 動作庫動作自己的備註（脊椎安全限制）換到哪一格都會顯示
  assert.equal(
    exerciseOf(1, 'E', 'leg_press', replaced('E', 'leg_press', 'lib_pendulum_squat_noload')).noteText,
    '只做無肩墊、不壓肩的版本',
  );
});

test('替換動作時 RIR 限制跟著格子留著（保護隔天 LEGS 日）', () => {
  const ex = exerciseOf(1, 'D', 'lying_leg_curl_d', replaced('D', 'lying_leg_curl_d', 'lib_nordic_curl'));
  assert.equal(ex.name, '北歐腿彎舉');
  assert.equal(ex.noteRIR, '2-3');
  assert.equal(ex.noteText, undefined);
});

test('替換成小腿動作算下肢', () => {
  assert.equal(exerciseOf(1, 'B', 'bi_curl', replaced('B', 'bi_curl', 'lib_calf_donkey')).isUpper, false);
  assert.equal(exerciseOf(1, 'E', 'leg_press', replaced('E', 'leg_press', 'lib_belt_squat')).isUpper, false);
});
