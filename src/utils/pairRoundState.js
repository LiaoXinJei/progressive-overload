// 配對動作（superset）休息狀態 derived helpers
//
// 純函式：給定 pair 設定 + 當前 logs，回傳 round 狀態機與相關 timestamp。
// 不引入新 logs 欄位、不需要 schema migration。

const isSettled = (log) => Boolean(log?.done || log?.skipped);

const getLogKey = (week, day, exerciseId, setIdx) =>
  `w${week}-d${day}-${exerciseId}-s${setIdx}`;

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
 * 取得 pair 完成後給「下一個獨立動作」起算的 timestamp。
 * 等同於最後一個 complete round 的 endTs（max(A,B) 取 done 一方）。
 * 若不存在完整 round 或全 skipped、回傳 null。
 */
export const getPairEndTimestamp = (pair, aSets, bSets, currentWeek, currentDay, logs) => {
  const { rounds } = getPairRoundState(pair, aSets, bSets, currentWeek, currentDay, logs);
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].complete && rounds[i].endTs != null) return rounds[i].endTs;
  }
  return null;
};
