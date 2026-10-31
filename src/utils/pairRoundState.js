// 配對動作（superset）休息狀態 derived helpers
//
// 純函式：給定 pair 設定 + 當前 logs，回傳 round 狀態機與相關 timestamp。
// 不引入新 logs 欄位、不需要 schema migration。

import { SUPERSET_PAIRS } from '../constants/workouts.js';

const isSettled = (log) => Boolean(log?.done || log?.skipped);

const getLogKey = (week, day, exerciseId, setIdx) =>
  `w${week}-d${day}-${exerciseId}-s${setIdx}`;

const parseLogKey = (logKey) => {
  const m = logKey.match(/^w(\d+)-d(\d+)-(.+)-s(\d+)$/);
  if (!m) return null;
  return {
    week: parseInt(m[1], 10),
    day: parseInt(m[2], 10),
    exerciseId: m[3],
    setIdx: parseInt(m[4], 10),
  };
};

/**
 * 計算配對的 round 狀態。
 *
 * @param {{ primary: string, secondary: string, rest: number }} pair
 * @param {number} aSets - primary 設定組數
 * @param {number} bSets - secondary 設定組數
 * @param {number} currentWeek
 * @param {number} currentDay
 * @param {Record<string, any>} logs
 * @returns {{
 *   rounds: Array<{
 *     idx: number,
 *     aLog: object | undefined,
 *     bLog: object | undefined,
 *     aSettled: boolean,
 *     bSettled: boolean,
 *     complete: boolean,
 *     endTs: number | null,
 *   }>,
 *   state: 'idle' | 'mid-round' | 'between-rounds' | 'done',
 *   currentRoundIdx: number,
 *   lastCompleteRoundEndTs: number | null,
 *   midRoundAnchorTs: number | null,
 *   coreRoundCount: number,
 * }}
 */
export const getPairRoundState = (pair, aSets, bSets, currentWeek, currentDay, logs) => {
  const coreRoundCount = Math.min(aSets, bSets);
  const rounds = [];

  for (let i = 0; i < coreRoundCount; i++) {
    const aLog = logs[getLogKey(currentWeek, currentDay, pair.primary, i)];
    const bLog = logs[getLogKey(currentWeek, currentDay, pair.secondary, i)];
    const aSettled = isSettled(aLog);
    const bSettled = isSettled(bLog);
    const complete = aSettled && bSettled;

    let endTs = null;
    if (complete) {
      const aDoneTs = aLog?.done ? aLog.completedAt ?? null : null;
      const bDoneTs = bLog?.done ? bLog.completedAt ?? null : null;
      if (aDoneTs != null && bDoneTs != null) endTs = Math.max(aDoneTs, bDoneTs);
      else if (aDoneTs != null) endTs = aDoneTs;
      else if (bDoneTs != null) endTs = bDoneTs;
      // 兩組皆 skipped → endTs 維持 null
    }

    rounds.push({ idx: i, aLog, bLog, aSettled, bSettled, complete, endTs });
  }

  // 派生狀態機
  let state = 'idle';
  let currentRoundIdx = 0;
  let midRoundAnchorTs = null;
  let lastCompleteRoundEndTs = null;

  if (rounds.length === 0) {
    state = 'done';
  } else {
    const allComplete = rounds.every(r => r.complete);
    if (allComplete) {
      state = 'done';
      currentRoundIdx = rounds.length - 1;
      for (let i = rounds.length - 1; i >= 0; i--) {
        if (rounds[i].endTs != null) { lastCompleteRoundEndTs = rounds[i].endTs; break; }
      }
    } else {
      // 找第一個未 complete 的 round
      const firstIncompleteIdx = rounds.findIndex(r => !r.complete);
      currentRoundIdx = firstIncompleteIdx;
      const cur = rounds[firstIncompleteIdx];

      if (cur.aSettled || cur.bSettled) {
        // 恰好一邊 settled → mid-round
        state = 'mid-round';
        const settledLog = cur.aSettled ? cur.aLog : cur.bLog;
        // 只有 done 才有 completedAt；skipped 不貢獻 anchor
        midRoundAnchorTs = settledLog?.done ? settledLog.completedAt ?? null : null;
      } else {
        // 都未 settled
        if (firstIncompleteIdx === 0) {
          state = 'idle';
        } else {
          state = 'between-rounds';
          // 取最近一個有 endTs 的 round
          for (let i = firstIncompleteIdx - 1; i >= 0; i--) {
            if (rounds[i].endTs != null) { lastCompleteRoundEndTs = rounds[i].endTs; break; }
          }
          // 全前段 round 都 skipped → 沒有起算點、退為 idle 語意
          if (lastCompleteRoundEndTs == null) state = 'idle';
        }
      }
    }
  }

  return {
    rounds,
    state,
    currentRoundIdx,
    lastCompleteRoundEndTs,
    midRoundAnchorTs,
    coreRoundCount,
  };
};

/**
 * 一個動作（或配對的兩個動作）每組都完成或跳過時，回傳完成組裡最晚的 completedAt。
 * 還有組沒 settled、或每組都跳過 → null。
 *
 * @param {Array<{ exerciseId: string, sets: number }>} exercises
 */
export const getExercisesEndTimestamp = (exercises, currentWeek, currentDay, logs) => {
  let end = null;
  for (const { exerciseId, sets } of exercises) {
    for (let i = 0; i < sets; i++) {
      const log = logs[getLogKey(currentWeek, currentDay, exerciseId, i)];
      if (!isSettled(log)) return null;
      if (log.done && log.completedAt != null) end = end == null ? log.completedAt : Math.max(end, log.completedAt);
    }
  }
  return end;
};

/**
 * 取得 pair 完成後給「下一個 group」起算的 timestamp。
 * 整個配對（核心輪 + tail 組）每組都完成或跳過才算結束，回傳完成組裡最晚的 completedAt；
 * 還沒結束或全部跳過 → null。
 */
export const getPairEndTimestamp = (pair, aSets, bSets, currentWeek, currentDay, logs) =>
  getExercisesEndTimestamp([
    { exerciseId: pair.primary, sets: aSets },
    { exerciseId: pair.secondary, sets: bSets },
  ], currentWeek, currentDay, logs);

/**
 * 在指定 session 內、找出包含 exerciseId 的 pair 設定。
 * @returns {{ primary: string, secondary: string, rest: number, pairIdx: number } | null}
 */
export const getPairForExerciseId = (workoutKey, exerciseId) => {
  const pairs = SUPERSET_PAIRS[workoutKey] || [];
  for (let i = 0; i < pairs.length; i++) {
    const p = pairs[i];
    if (p.primary === exerciseId || p.secondary === exerciseId) {
      return { ...p, pairIdx: i };
    }
  }
  return null;
};

/**
 * 判斷某 set 是否為 pair tail（超出 coreRoundCount 的尾組）。
 * tail 組視為單動作語意、不參與 round 計算。
 */
export const isPairTailSet = (pair, aSets, bSets, exerciseId, setIdx) => {
  const coreRoundCount = Math.min(aSets, bSets);
  if (setIdx < coreRoundCount) return false;
  return exerciseId === pair.primary || exerciseId === pair.secondary;
};

/**
 * pair tail 組進度（只有組數較多的一方有 tail）。
 * 核心輪全部 complete 不代表 pair 做完；tail 組全 settled 才算。
 * @returns {{ total: number, settled: number }}
 */
export const getPairTailProgress = (pair, aSets, bSets, currentWeek, currentDay, logs) => {
  const coreRoundCount = Math.min(aSets, bSets);
  const [exerciseId, sets] = aSets > bSets ? [pair.primary, aSets] : [pair.secondary, bSets];
  let settled = 0;
  for (let i = coreRoundCount; i < sets; i++) {
    if (isSettled(logs[getLogKey(currentWeek, currentDay, exerciseId, i)])) settled++;
  }
  return { total: sets - coreRoundCount, settled };
};

/**
 * 最近一筆 done log（completedAt 最晚）所在的週 / 天。休息通知綁這一天，不綁畫面上正在看的那天，
 * 休息中切去看別天 / 別週，通知照樣排程。沒有任何 done log → null。
 *
 * @returns {{ week: number, day: number } | null}
 */
export const getLatestDoneSession = (logs) => {
  let latest = null;
  let latestTs = 0;
  for (const [key, log] of Object.entries(logs)) {
    if (!log?.done) continue;
    const ts = log.completedAt ?? 0;
    if (ts <= latestTs) continue;
    const parsed = parseLogKey(key);
    if (!parsed) continue;
    latest = { week: parsed.week, day: parsed.day };
    latestTs = ts;
  }
  return latest;
};

/**
 * 通知排程 context。依「當日最近一筆 done log」推得。
 *
 * type:
 *   - idle: 當日無任何 done set、或無剩餘工作（不排程）
 *   - in-set: 單動作、同動作下一組 pending（排程、全域 delay）
 *   - in-pair-mid-round: pair round 內單邊 settled（不排程）
 *   - in-pair-between-rounds: pair round 完成、下一輪未開始（排程、pair rest）
 *   - between-exercises: 某動作末組完成、後續仍有未完成動作（排程、全域 delay）
 *
 * @param {object} args
 * @param {Record<string, any>} args.logs
 * @param {number} args.currentWeek
 * @param {number} args.currentDay
 * @param {string} args.workoutKey
 * @param {Array<{ exercise: object, sets: number }>} args.sessionPlan
 * @param {number} args.globalDelay - 使用者全域 restNotificationDelay（秒）
 * @returns {{
 *   type: 'idle' | 'in-set' | 'in-pair-mid-round' | 'in-pair-between-rounds' | 'between-exercises',
 *   delay: number | null,
 *   anchorTs: number | null,
 *   notifyKey: string,
 * }}
 */
export const getRestContext = ({
  logs,
  currentWeek,
  currentDay,
  workoutKey,
  sessionPlan,
  globalDelay,
}) => {
  const prefix = `w${currentWeek}-d${currentDay}-`;
  const keyBase = `${workoutKey}:${currentDay}`;

  // 1. 找出當日最近一筆 done log
  let latestKey = null;
  let latestTs = 0;
  for (const [key, log] of Object.entries(logs)) {
    if (!key.startsWith(prefix)) continue;
    if (!log?.done) continue;
    const ts = log.completedAt ?? 0;
    if (ts > latestTs) { latestTs = ts; latestKey = key; }
  }

  const idle = () => ({
    type: 'idle', delay: null, anchorTs: null,
    notifyKey: `${keyBase}:idle`,
  });

  if (!latestKey) return idle();

  const parsed = parseLogKey(latestKey);
  if (!parsed) return idle();

  const { exerciseId, setIdx } = parsed;

  // 2. 是否屬於 pair
  const pair = getPairForExerciseId(workoutKey, exerciseId);

  // 3. 檢查 session 是否還有未完成工作（排除當前已完成的部分）
  const hasPendingInPlan = () => {
    for (const entry of sessionPlan) {
      const exId = entry.exercise.id;
      for (let i = 0; i < entry.sets; i++) {
        const k = `${prefix}${exId}-s${i}`;
        const l = logs[k];
        if (!l?.done && !l?.skipped) return true;
      }
    }
    return false;
  };

  // 4. Pair 路徑
  if (pair) {
    const aEntry = sessionPlan.find(e => e.exercise.id === pair.primary);
    const bEntry = sessionPlan.find(e => e.exercise.id === pair.secondary);
    if (!aEntry || !bEntry) {
      // sessionPlan 不含 pair 成員（理論上不會發生）；退回單動作邏輯
      return fallbackSingle({ keyBase, exerciseId, setIdx, latestTs, globalDelay, prefix, logs, sessionPlan });
    }

    const tail = isPairTailSet(pair, aEntry.sets, bEntry.sets, exerciseId, setIdx);
    if (tail) {
      // tail set：以單動作語意處理
      return fallbackSingle({ keyBase, exerciseId, setIdx, latestTs, globalDelay, prefix, logs, sessionPlan });
    }

    const pairState = getPairRoundState(
      pair, aEntry.sets, bEntry.sets, currentWeek, currentDay, logs,
    );

    if (pairState.state === 'mid-round') {
      return {
        type: 'in-pair-mid-round',
        delay: null,
        anchorTs: pairState.midRoundAnchorTs,
        notifyKey: `${keyBase}:in-pair-mid-round:${pairState.midRoundAnchorTs ?? 'na'}`,
      };
    }
    if (pairState.state === 'between-rounds') {
      return {
        type: 'in-pair-between-rounds',
        delay: pair.rest,
        anchorTs: pairState.lastCompleteRoundEndTs,
        notifyKey: `${keyBase}:in-pair-between-rounds:${pairState.lastCompleteRoundEndTs}`,
      };
    }
    if (pairState.state === 'done') {
      const anchor = pairState.lastCompleteRoundEndTs ?? latestTs;
      // 核心輪做完但還有 tail 組 → 同動作下一組（tail 為單動作語意）
      const tail = getPairTailProgress(
        pair, aEntry.sets, bEntry.sets, currentWeek, currentDay, logs,
      );
      if (tail.settled < tail.total) {
        return {
          type: 'in-set',
          delay: globalDelay,
          anchorTs: anchor,
          notifyKey: `${keyBase}:in-set:${anchor}`,
        };
      }
      // pair 整體完成 → 接 between-exercises（若還有工作）或 idle
      if (!hasPendingInPlan()) return idle();
      return {
        type: 'between-exercises',
        delay: globalDelay,
        anchorTs: anchor,
        notifyKey: `${keyBase}:between-exercises:${anchor}`,
      };
    }
    // pair idle 情形下、但有 latestKey 不會發生（因為 latestKey 屬於 pair 成員）
    return idle();
  }

  // 5. 非 pair 路徑
  return fallbackSingle({ keyBase, exerciseId, setIdx, latestTs, globalDelay, prefix, logs, sessionPlan });
};

const fallbackSingle = ({
  keyBase, exerciseId, setIdx, latestTs, globalDelay, prefix, logs, sessionPlan,
}) => {
  const entry = sessionPlan.find(e => e.exercise.id === exerciseId);
  const setsCount = entry?.sets ?? (setIdx + 1);

  // 5a. 同動作下一個沒跳過的組還沒做 → in-set（中間組跳過時往後找）
  let nextIdx = setIdx + 1;
  while (nextIdx < setsCount && logs[`${prefix}${exerciseId}-s${nextIdx}`]?.skipped) nextIdx++;
  if (nextIdx < setsCount) {
    const nextLog = logs[`${prefix}${exerciseId}-s${nextIdx}`];
    if (!nextLog?.done) {
      return {
        type: 'in-set',
        delay: globalDelay,
        anchorTs: latestTs,
        notifyKey: `${keyBase}:in-set:${latestTs}`,
      };
    }
  }

  // 5b. 動作末組（或下一組已 settled）→ 檢查後續還有沒有工作
  let hasMore = false;
  for (const e of sessionPlan) {
    if (e.exercise.id === exerciseId) continue;
    for (let i = 0; i < e.sets; i++) {
      const k = `${prefix}${e.exercise.id}-s${i}`;
      const l = logs[k];
      if (!l?.done && !l?.skipped) { hasMore = true; break; }
    }
    if (hasMore) break;
  }
  // 同動作後面如果還有更後段 set 未 settled 也算 in-set（少見、可能因 skipped 中段而跳過）
  if (!hasMore) {
    for (let i = setIdx + 1; i < setsCount; i++) {
      const k = `${prefix}${exerciseId}-s${i}`;
      const l = logs[k];
      if (!l?.done && !l?.skipped) { hasMore = true; break; }
    }
  }

  if (!hasMore) {
    return {
      type: 'idle', delay: null, anchorTs: null,
      notifyKey: `${keyBase}:idle`,
    };
  }
  return {
    type: 'between-exercises',
    delay: globalDelay,
    anchorTs: latestTs,
    notifyKey: `${keyBase}:between-exercises:${latestTs}`,
  };
};
