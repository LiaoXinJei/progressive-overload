// 執行：npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { WORKOUTS, SUPERSET_PAIRS, DEFAULT_EXERCISE_LIBRARY } from './workouts.js';
import { getPairForExerciseId } from '../utils/pairRoundState.js';

test('superset 配對的動作都在該 session 的菜單裡', () => {
  const missing = [];
  for (const [key, pairs] of Object.entries(SUPERSET_PAIRS)) {
    const ids = new Set(WORKOUTS[key].exercises.map(ex => ex.id));
    pairs.forEach(({ primary, secondary }) => {
      if (!ids.has(primary)) missing.push(`${key} ${primary}`);
      if (!ids.has(secondary)) missing.push(`${key} ${secondary}`);
    });
  }
  assert.deepEqual(missing, []);
});

test('同一個動作不會出現在兩組 superset（BUG-02）', () => {
  const dup = [];
  for (const [key, pairs] of Object.entries(SUPERSET_PAIRS)) {
    const seen = new Set();
    pairs.forEach(({ primary, secondary }) => {
      [primary, secondary].forEach(id => {
        if (seen.has(id)) dup.push(`${key} ${id}`);
        seen.add(id);
      });
    });
  }
  assert.deepEqual(dup, []);
});

test('每組配對的動作都查得到自己那一組（通知用對的休息秒數）', () => {
  for (const [key, pairs] of Object.entries(SUPERSET_PAIRS)) {
    pairs.forEach((pair, idx) => {
      assert.equal(getPairForExerciseId(key, pair.primary)?.pairIdx, idx, `${key} ${pair.primary}`);
      assert.equal(getPairForExerciseId(key, pair.secondary)?.pairIdx, idx, `${key} ${pair.secondary}`);
    });
  }
});

test('預設動作庫沒有重複 id', () => {
  const ids = DEFAULT_EXERCISE_LIBRARY.map(item => item.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), []);
});
