// Session plan 計算的 pure helpers
//
// 從 TrainingView 抽出、讓 App.jsx 也能計算當前 session 的動作清單與組數、
// 供 restContext 推導使用。

import {
  WORKOUTS, VOLUME_CONFIG, PHASE_CONFIG, SESSION_WEIGHTS,
  MUSCLE_SESSION_MAP, MAX_SETS_PER_EXERCISE,
} from '../constants/workouts';

const LOWER_MUSCLES = new Set(['QUADS', 'HAMS']);

export const getWorkoutForDay = (week, dayIndex) => {
  return ['A', 'B', 'C', 'D', 'E'][dayIndex];
};

export const getPhase = (week) => {
  if (week === 5 || week === 10) return 'deload';
  if (week <= 4) return 'hypertrophy';
  return 'strength';
};

export const getWeeklyMuscleVolume = (muscle, week) => {
  const targets = VOLUME_CONFIG[muscle];
  if (!targets) return 0;
  const phase = getPhase(week);
  if (phase === 'deload') {
    return Math.max(2, Math.floor(targets[0] * 0.5));
  }
  if (phase === 'strength') {
    return targets[0];
  }
  return targets[week - 1];
};

/**
 * 最大餘數法：total 照 weights 比例分成整數，總和不變。
 * 餘數一樣時給 keys 裡排前面的；沒給 weights 就平均分。
 */
export const splitByWeights = (total, keys, weights) => {
  const w = keys.map(k => (weights ? weights[k] ?? 0 : 1));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) return keys.map(() => 0);
  const quotas = w.map(x => (total * x) / sum);
  const result = quotas.map(Math.floor);
  const left = total - result.reduce((a, b) => a + b, 0);
  const order = keys
    .map((_, i) => i)
    .sort((a, b) => (quotas[b] - result[b]) - (quotas[a] - result[a]) || a - b);
  for (let i = 0; i < left; i++) result[order[i]] += 1;
  return result;
};

export const getRepRange = (exerciseType, week) => {
  const phase = getPhase(week);
  const config = PHASE_CONFIG[phase];
  return exerciseType === 'compound' ? config.compound : config.isolation;
};

/**
 * 計算指定週次 + workoutKey 的 session plan。
 * Pure 函式、不依賴 React state（所有 override 由 caller 傳入）。
 *
 * @param {number} week
 * @param {string} workoutKey - 'A' | 'B' | 'C' | 'D' | 'E'
 * @param {object} opts
 * @param {Record<string, Array<object>>} opts.customExercises
 * @param {Record<string, number>} opts.customSets
 * @param {Record<string, string[]>} opts.exerciseOrder
 * @param {Record<string, string>} opts.exerciseOverrides
 * @param {Array<object>} opts.exerciseLibrary
 * @returns {Array<{ exercise: object, sets: number }>}
 */
export const buildSessionPlan = (week, workoutKey, opts) => {
  const {
    customExercises = {},
    customSets = {},
    exerciseOrder = {},
    exerciseOverrides = {},
    exerciseLibrary = [],
  } = opts || {};

  const workout = WORKOUTS[workoutKey];
  if (!workout) return [];
  const customExsForDay = customExercises[workoutKey] || [];

  // 計算內建動作的組數
  const muscleExCounts = {};
  workout.exercises.forEach(ex => {
    muscleExCounts[ex.muscle] = (muscleExCounts[ex.muscle] || 0) + 1;
  });

  const muscleSessionTargets = {};
  for (const muscle of Object.keys(muscleExCounts)) {
    const sessions = MUSCLE_SESSION_MAP[muscle];
    const targets = splitByWeights(getWeeklyMuscleVolume(muscle, week), sessions, SESSION_WEIGHTS[muscle]);
    muscleSessionTargets[muscle] = targets[sessions.indexOf(workoutKey)];
  }

  const muscleAssigned = {};
  let allResults = workout.exercises.map(ex => {
    const sessionTarget = muscleSessionTargets[ex.muscle];
    const exCount = muscleExCounts[ex.muscle];
    const idx = muscleAssigned[ex.muscle] || 0;
    muscleAssigned[ex.muscle] = idx + 1;
    const base = Math.floor(sessionTarget / exCount);
    const remainder = sessionTarget % exCount;
    // 每個動作至少 1 組：減量週目標太低時均分會出現 0 組（例如 W5 LEGS 日）
    const sets = Math.min(Math.max(1, base + (idx >= exCount - remainder ? 1 : 0)), MAX_SETS_PER_EXERCISE);
    return { exercise: ex, sets };
  });

  customExsForDay.forEach(ex => {
    allResults.push({ exercise: ex, sets: 3 });
  });

  allResults = allResults.map(({ exercise, sets }) => {
    const overrideKey = `${workoutKey}-${exercise.id}`;
    const overrideId = exerciseOverrides[overrideKey];
    if (overrideId) {
      const lib = exerciseLibrary.find(l => l.id === overrideId);
      if (lib) {
        return {
          exercise: {
            ...exercise,
            name: lib.name,
            muscle: lib.muscle,
            type: lib.type,
            isUpper: !LOWER_MUSCLES.has(lib.muscle),
            _libraryId: lib.id,
          },
          sets,
        };
      }
    }
    return { exercise, sets };
  });

  allResults = allResults.map(({ exercise, sets }) => {
    const overrideKey = `${workoutKey}-${exercise.id}`;
    return { exercise, sets: customSets[overrideKey] ?? sets };
  });

  const order = exerciseOrder[workoutKey];
  if (order && order.length > 0) {
    const orderMap = new Map(order.map((id, i) => [id, i]));
    allResults.sort((a, b) => {
      const ai = orderMap.has(a.exercise.id) ? orderMap.get(a.exercise.id) : Infinity;
      const bi = orderMap.has(b.exercise.id) ? orderMap.get(b.exercise.id) : Infinity;
      return ai - bi;
    });
  }

  return allResults;
};
