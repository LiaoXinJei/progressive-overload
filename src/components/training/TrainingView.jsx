import React, { useState, useMemo } from 'react';
import {
  Activity, BarChart2, ChevronDown, ChevronUp,
  TrendingUp, ShieldCheck, Plus, Minus, Check,
  Edit2, XCircle, GripVertical, Trash2, X, Search
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  WORKOUTS, MUSCLE_GROUPS, PHASE_CONFIG,
  SUPERSET_PAIRS, SESSION_TYPE_THEME,
} from '../../constants/workouts';
import { getPairRoundState, getPairEndTimestamp, getPairTailProgress } from '../../utils/pairRoundState';
import {
  buildSessionPlan, getWorkoutForDay, getPhase, getRepRange, getWeeklyMuscleVolume,
  customSetsKey, withoutCustomSets,
} from '../../utils/sessionPlan';

const LOWER_MUSCLES = new Set(['QUADS', 'HAMS']);

// 重量 0 是有效值（自體重），只有空白才算沒填
const hasWeight = (w) => w !== undefined && w !== null && w !== '';
const hasReps = (r) => r !== undefined && r !== null && r !== '';

const parseLogKey = (logKey) => {
  const m = logKey.match(/^w(\d+)-d(\d+)-(.+)-s(\d+)$/);
  return m ? { week: Number(m[1]), day: Number(m[2]), exerciseId: m[3], setIdx: Number(m[4]) } : null;
};

// 兩筆 log 的先後：課表順序（週 → 天 → 第幾組），同一格再比完成時間
const logRank = (pos, log) => [pos.week, pos.day, pos.setIdx, log.completedAt ?? 0];
const compareRank = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};

const formatMmSs = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const RoundDots = ({ rounds }) => (
  <div className="flex flex-col gap-1">
    {['a', 'b'].map(side => (
      <div key={side} className="flex gap-1">
        {rounds.map(r => {
          const log = side === 'a' ? r.aLog : r.bLog;
          const done = log?.done;
          const skipped = log?.skipped;
          if (skipped) {
            return (
              <span
                key={r.idx}
                className="w-2.5 h-2.5 rounded-full border border-orange-400/40 flex items-center justify-center text-[8px] text-orange-400/50 leading-none"
                title={`${side.toUpperCase()}${r.idx + 1} 跳過`}
              >
                /
              </span>
            );
          }
          return (
            <span
              key={r.idx}
              className={`w-2.5 h-2.5 rounded-full border ${
                done ? 'bg-orange-400 border-orange-400' : 'border-orange-400/40'
              }`}
              title={`${side.toUpperCase()}${r.idx + 1} ${done ? '完成' : '待做'}`}
            />
          );
        })}
      </div>
    ))}
  </div>
);

const PairStickyBar = ({
  pairState,
  pairInfo,
  tailProgress,
  currentTime,
  enterPairFromTs,
  enterPairLabel,
}) => {
  const { state, rounds, lastCompleteRoundEndTs, midRoundAnchorTs, currentRoundIdx } = pairState;
  const targetSec = pairInfo.rest;

  // 主訊息渲染
  let mainNode = null;
  if (state === 'idle') {
    mainNode = (
      <span className="text-orange-200/80 text-xs font-bold">
        準備開始 R{currentRoundIdx + 1}
      </span>
    );
  } else if (state === 'mid-round') {
    const elapsed = midRoundAnchorTs != null
      ? Math.floor((currentTime - midRoundAnchorTs) / 1000)
      : 0;
    mainNode = (
      <span className="text-amber-300 text-xs font-bold tabular-nums">
        ⏱ 切換中: {formatMmSs(elapsed)}
      </span>
    );
  } else if (state === 'between-rounds') {
    const elapsed = lastCompleteRoundEndTs != null
      ? Math.floor((currentTime - lastCompleteRoundEndTs) / 1000)
      : 0;
    const over = elapsed > targetSec;
    mainNode = (
      <span className={`text-xs font-bold tabular-nums ${over ? 'text-rose-400' : 'text-emerald-400'}`}>
        {over ? '🔴' : '🟢'} 輪間休息: {formatMmSs(elapsed)} / 目標 {formatMmSs(targetSec)}
      </span>
    );
  } else if (state === 'done' && tailProgress.settled < tailProgress.total) {
    // 核心輪做完、還有 tail 組（休息顯示在 tail 前的 set 列）
    mainNode = (
      <span className="text-orange-200/80 text-xs font-bold tabular-nums">
        {rounds.length} 輪完成 · 尾組 {tailProgress.settled}/{tailProgress.total}
      </span>
    );
  } else if (state === 'done') {
    mainNode = (
      <span className="text-emerald-300/80 text-xs font-bold">
        ✓ 完成 · {rounds.length} 輪
      </span>
    );
  }

  // enter-pair 提示：僅 idle 時、且前一動作完成 timestamp 存在
  const showEnterPair = state === 'idle' && enterPairFromTs != null;
  const enterPairElapsed = showEnterPair
    ? Math.floor((currentTime - enterPairFromTs) / 1000)
    : 0;

  return (
    <div
      className="sticky z-10 px-5 py-2.5 bg-neutral-950/85 backdrop-blur-sm border-b border-orange-800/40"
      // 黏在 App sticky header 下方；--app-header-h 由 App 量測 header 高度寫入
      style={{ top: 'var(--app-header-h, 0px)' }}
    >
      {showEnterPair && (
        <div className="text-[10px] text-orange-200/70 italic mb-1.5 tabular-nums">
          {enterPairLabel}完成 {formatMmSs(enterPairElapsed)} 前 · 進入 superset
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <RoundDots rounds={rounds} />
        <div className="text-right">{mainNode}</div>
      </div>
    </div>
  );
};

const TrainingView = ({
  logs, setLogs,
  history, setHistory,
  mode, currentWeek, currentDay, setCurrentDay,
  showStats, setShowStats,
  customExerciseNames, setCustomExerciseNames,
  customExercises, setCustomExercises,
  customSets, setCustomSets,
  exerciseOrder, setExerciseOrder,
  exerciseLibrary, exerciseOverrides, setExerciseOverrides,
  weightIncrement,
  currentTime
}) => {
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newEx, setNewEx] = useState({ name: '', muscle: 'CHEST', type: 'isolation' });
  const [pickerForExId, setPickerForExId] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // ==================== 核心邏輯函數 ====================

  const getSessionPlan = (week, workoutKey) => buildSessionPlan(week, workoutKey, {
    customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary,
  });

  const getWeeklyGuidance = (week) => {
    const phase = getPhase(week);
    if (phase === 'deload') return { rir: '4+', label: 'Deload', color: 'text-amber-400' };
    if (week === 4) return { rir: '0-1', label: '肌肥大 · Overreach', color: 'text-rose-500' };
    if (week === 9) return { rir: '0-1', label: '肌力 · Overreach', color: 'text-rose-500' };
    if (phase === 'hypertrophy') return { rir: '2-3', label: '肌肥大 · Accumulation', color: 'text-emerald-400' };
    return { rir: '2-3', label: '肌力 · Accumulation', color: 'text-cyan-400' };
  };

  // ==================== 工具函數 ====================

  // 休息 / 經過時間不會是負的。按 ✓ 的時間可能比畫面上的 currentTime 晚（App 每秒才更新），差值會短暫小於 0
  const formatTime = (rawSeconds) => {
    const seconds = Math.max(0, Math.floor(rawSeconds));
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateRestTime = (currentLogKey, restFromTs) => {
    const currentLog = logs[currentLogKey];
    if (!currentLog?.completedAt || !restFromTs) return null;
    const restSeconds = Math.floor((currentLog.completedAt - restFromTs) / 1000);
    return formatTime(restSeconds);
  };

  const getCurrentRestTime = (restFromTs) => {
    if (!restFromTs) return null;
    const restSeconds = Math.floor((currentTime - restFromTs) / 1000);
    return formatTime(restSeconds);
  };

  // ==================== 訓練記錄操作 ====================

  // 這筆 log 算哪個動作的歷史：完成時記在 log.historyKey；舊 log 沒記，照現在的替換設定推
  const historyKeyOfLog = (logKey, log) => {
    if (log?.historyKey) return log.historyKey;
    const pos = parseLogKey(logKey);
    if (!pos) return null;
    const overrideId = exerciseOverrides[`${getWorkoutForDay(pos.week, pos.day)}-${pos.exerciseId}`];
    return overrideId && exerciseLibrary.some(l => l.id === overrideId) ? overrideId : pos.exerciseId;
  };

  // 找這個動作在所有週裡最新（earliest 時找最早）的一筆完成組，回傳 log key。
  // 照課表順序比，不只看完成時間：回頭補記舊週的組，完成時間是現在，但它不是最近一次的訓練表現
  const findDoneLog = (allLogs, historyKey, { earliest = false, exceptKey = null, filter = () => true } = {}) => {
    let found = null;
    let foundRank = null;
    Object.entries(allLogs).forEach(([k, log]) => {
      if (k === exceptKey || !log?.done || !filter(log)) return;
      const pos = parseLogKey(k);
      if (!pos || historyKeyOfLog(k, log) !== historyKey) return;
      const rank = logRank(pos, log);
      const cmp = foundRank ? compareRank(rank, foundRank) : 0;
      if (!foundRank || (earliest ? cmp < 0 : cmp > 0)) {
        found = k;
        foundRank = rank;
      }
    });
    return found;
  };

  // 完成前的歷史，取消到這個動作一組完成的都不剩時還原用。已經有別的完成組就沿用它們記的值，
  // 不然會記到別組寫進歷史的數字（例如打錯、後來取消的那組）
  const historyBeforeFor = (allLogs, logKey, historyKey) => {
    const other = findDoneLog(allLogs, historyKey, {
      earliest: true, exceptKey: logKey, filter: log => 'historyBefore' in log,
    });
    return other ? allLogs[other].historyBefore : (history[historyKey] ?? null);
  };

  // 歷史 = 這個動作最新那筆完成組的重量 / 次數。只有動到最新那筆（改它、完成後成為最新、取消它）才改歷史；
  // 取消後一組完成的都不剩，就還原成第一次完成前的值（log.historyBefore）
  const syncHistory = (prevLogs, nextLogs, logKey) => {
    const changed = nextLogs[logKey]?.done ? nextLogs[logKey] : prevLogs[logKey];
    const historyKey = historyKeyOfLog(logKey, changed);
    if (!historyKey) return;
    const prevLatest = findDoneLog(prevLogs, historyKey);
    const nextLatest = findDoneLog(nextLogs, historyKey);
    if (prevLatest !== logKey && nextLatest !== logKey) return;
    setHistory(h => {
      if (nextLatest) {
        const { weight, reps } = nextLogs[nextLatest];
        // 任一欄空白就不寫，保留原值
        if (!hasWeight(weight) || !hasReps(reps)) return h;
        return { ...h, [historyKey]: { weight: parseFloat(weight), reps } };
      }
      const before = prevLogs[logKey];
      if (!before || !('historyBefore' in before)) return h;
      const updated = { ...h };
      if (before.historyBefore) updated[historyKey] = before.historyBefore;
      else delete updated[historyKey];
      return updated;
    });
  };

  const updateLog = (logKey, field, value) => {
    setLogs(prev => {
      const nextLogs = { ...prev, [logKey]: { ...prev[logKey], [field]: value } };
      if (nextLogs[logKey].done) syncHistory(prev, nextLogs, logKey);
      return nextLogs;
    });
  };

  const adjustWeight = (logKey, direction, fallback = 0) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const delta = direction * weightIncrement;
      const fallbackNum = typeof fallback === 'object' && fallback !== null
        ? parseFloat(fallback.weight) || 0
        : parseFloat(fallback) || 0;
      const base = current.weight !== '' && current.weight !== undefined
        ? (parseFloat(current.weight) || 0)
        : fallbackNum;
      const newWeight = base + delta;
      const nextLogs = { ...prev, [logKey]: { ...current, weight: Math.max(0, newWeight) } };
      if (current.done) syncHistory(prev, nextLogs, logKey);
      return nextLogs;
    });
  };

  // 取消完成（再按 ✓ 或直接跳過）。歷史由 syncHistory 處理：打錯的數字不會留在歷史、被下一組當成上次紀錄。
  // 完成時間另存在 firstCompletedAt，重新完成時用回去，休息計時、訓練時長才不會被推到現在
  const uncomplete = (log) => {
    const next = { ...log, done: false, completedAt: undefined, firstCompletedAt: log.firstCompletedAt ?? log.completedAt };
    delete next.historyBefore;
    delete next.historyKey;
    return next;
  };

  const skipSet = (logKey) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const newSkipped = !current.skipped;
      const base = current.done ? uncomplete(current) : current;
      const nextLogs = {
        ...prev,
        [logKey]: {
          ...base,
          skipped: newSkipped,
          done: false,
          completedAt: undefined
        }
      };
      if (current.done) syncHistory(prev, nextLogs, logKey);
      return nextLogs;
    });
  };

  // ✓ 按鈕：未完成 → 完成（空白欄位用上次紀錄，重量都沒有就當 0 kg 自體重）；已完成 → 取消完成。
  // 完成時把這組算哪個動作的歷史記在 log 上，之後替換動作再取消，還原的還是原本那個動作
  const completeSet = (logKey, historyKey, historyEntry = {}) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      let next;
      if (current.done) {
        next = uncomplete(current);
      } else {
        const reps = current.reps || (hasReps(historyEntry.reps) ? String(historyEntry.reps) : '');
        if (!reps) return prev;
        const weight = hasWeight(current.weight) ? current.weight
          : hasWeight(historyEntry.weight) ? historyEntry.weight : 0;
        // 取消過再重新完成，沿用第一次完成的時間
        next = {
          ...current, weight, reps, done: true, completedAt: current.firstCompletedAt ?? Date.now(),
          historyKey, historyBefore: historyBeforeFor(prev, logKey, historyKey),
        };
        delete next.firstCompletedAt;
      }
      const nextLogs = { ...prev, [logKey]: next };
      syncHistory(prev, nextLogs, logKey);
      return nextLogs;
    });
  };

  const fillFromHistory = (logKey, historyKey) => {
    const histEntry = history[historyKey];
    if (!histEntry || (histEntry.weight === '' && histEntry.reps === '')) return;
    setLogs(prev => ({
      ...prev,
      [logKey]: {
        ...(prev[logKey] || {}),
        weight: histEntry.weight !== undefined && histEntry.weight !== '' ? histEntry.weight : (prev[logKey]?.weight || ''),
        reps: histEntry.reps !== undefined && histEntry.reps !== '' ? String(histEntry.reps) : (prev[logKey]?.reps || ''),
      }
    }));
  };

  const applyLibraryToExercise = (exerciseId, libraryItem) => {
    const overrideKey = `${workoutKey}-${exerciseId}`;
    setExerciseOverrides(prev => ({ ...prev, [overrideKey]: libraryItem.id }));
    setCustomExerciseNames(prev => {
      if (!(exerciseId in prev)) return prev;
      const updated = { ...prev };
      delete updated[exerciseId];
      return updated;
    });
    setPickerForExId(null);
    setPickerSearch('');
  };

  const resetExerciseOverride = (exerciseId) => {
    const overrideKey = `${workoutKey}-${exerciseId}`;
    setExerciseOverrides(prev => {
      const updated = { ...prev };
      delete updated[overrideKey];
      return updated;
    });
    setCustomSets(prev => withoutCustomSets(prev, workoutKey, exerciseId));
    setPickerForExId(null);
    setPickerSearch('');
  };

  // ==================== 自訂動作操作 ====================

  const addCustomExercise = () => {
    if (!newEx.name.trim()) return;
    const id = `custom_${Date.now()}`;
    const exercise = {
      id,
      name: newEx.name.trim(),
      muscle: newEx.muscle,
      type: newEx.type,
      isUpper: !LOWER_MUSCLES.has(newEx.muscle),
      isCustom: true,
    };
    setCustomExercises(prev => ({
      ...prev,
      [workoutKey]: [...(prev[workoutKey] || []), exercise]
    }));
    setNewEx({ name: '', muscle: 'CHEST', type: 'isolation' });
    setShowAddExercise(false);
  };

  const removeCustomExercise = (exerciseId) => {
    setCustomExercises(prev => ({
      ...prev,
      [workoutKey]: (prev[workoutKey] || []).filter(ex => ex.id !== exerciseId)
    }));
    setExerciseOrder(prev => ({
      ...prev,
      [workoutKey]: (prev[workoutKey] || []).filter(id => id !== exerciseId)
    }));
    setCustomSets(prev => withoutCustomSets(prev, workoutKey, exerciseId));
  };

  const adjustExerciseSets = (exerciseId, delta, currentSets) => {
    const key = customSetsKey(currentWeek, workoutKey, exerciseId);
    const newSets = Math.max(1, Math.min(10, currentSets + delta));
    setCustomSets(prev => ({ ...prev, [key]: newSets }));
  };

  // ==================== 拖曳排序 ====================

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const next = [...groupedPlan];
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    const flatIds = [];
    next.forEach(g => {
      if (g.type === 'pair') {
        g.items.forEach(it => flatIds.push(it.exercise.id));
      } else {
        flatIds.push(g.item.exercise.id);
      }
    });
    setExerciseOrder(prev => ({ ...prev, [workoutKey]: flatIds }));
  };

  // ==================== 統計計算 ====================

  const filteredLibrary = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return exerciseLibrary;
    return exerciseLibrary.filter(item =>
      item.name.toLowerCase().includes(q) ||
      MUSCLE_GROUPS[item.muscle]?.toLowerCase().includes(q)
    );
  }, [exerciseLibrary, pickerSearch]);

  const sessionDuration = useMemo(() => {
    const prefix = `w${currentWeek}-d${currentDay}-`;
    const timestamps = Object.entries(logs)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, log]) => log?.completedAt)
      .filter(Boolean);
    if (timestamps.length === 0) return 0;
    const start = Math.min(...timestamps);
    // 第一組不是今天（在看以前的課表）就不算超時
    if (new Date(start).toDateString() !== new Date(currentTime).toDateString()) return 0;
    // 每組都完成或跳過就算結束，計時停在最後一組；還沒做完才用現在時間
    const plan = getSessionPlan(currentWeek, getWorkoutForDay(currentWeek, currentDay));
    const finished = plan.every(({ exercise, sets }) =>
      [...Array(sets)].every((_, idx) => {
        const log = logs[`${prefix}${exercise.id}-s${idx}`];
        return log?.done || log?.skipped;
      }));
    const end = finished ? Math.max(...timestamps) : currentTime;
    return Math.floor((end - start) / 1000);
  }, [logs, currentWeek, currentDay, currentTime, customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary]);

  const overMinutes = sessionDuration > 3600 ? Math.floor((sessionDuration - 3600) / 60) : 0;

  const weeklyVolume = useMemo(() => {
    const vol = {};
    Object.keys(MUSCLE_GROUPS).forEach(k => vol[k] = 0);
    [0, 1, 2, 3, 4].forEach(dayIndex => {
      const workoutKey = getWorkoutForDay(currentWeek, dayIndex);
      const plan = getSessionPlan(currentWeek, workoutKey);
      plan.forEach(({ exercise, sets }) => {
        vol[exercise.muscle] = (vol[exercise.muscle] || 0) + sets;
      });
    });
    return vol;
  }, [currentWeek, customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary]);

  // ==================== 渲染 ====================

  const workoutKey = getWorkoutForDay(currentWeek, currentDay);
  const currentWorkout = WORKOUTS[workoutKey];
  const currentSessionPlan = getSessionPlan(currentWeek, workoutKey);
  const guidance = getWeeklyGuidance(currentWeek);
  const currentOverrideId = pickerForExId
    ? exerciseOverrides[`${workoutKey}-${pickerForExId}`]
    : null;
  const sessionTheme = SESSION_TYPE_THEME[currentWorkout.type] ?? SESSION_TYPE_THEME.push;

  // 將動作清單依 SUPERSET_PAIRS 分組為 [pair, single, ...]
  const groupedPlan = (() => {
    const pairs = SUPERSET_PAIRS[workoutKey] || [];
    const pairMap = new Map();
    pairs.forEach(p => {
      pairMap.set(p.primary, { partner: p.secondary, rest: p.rest, role: 'primary' });
      pairMap.set(p.secondary, { partner: p.primary, rest: p.rest, role: 'secondary' });
    });
    const result = [];
    const used = new Set();
    currentSessionPlan.forEach(entry => {
      if (used.has(entry.exercise.id)) return;
      const pi = pairMap.get(entry.exercise.id);
      if (pi) {
        const partner = currentSessionPlan.find(e => e.exercise.id === pi.partner);
        if (partner && !used.has(partner.exercise.id)) {
          const primary = pi.role === 'primary' ? entry : partner;
          const secondary = pi.role === 'primary' ? partner : entry;
          result.push({
            type: 'pair',
            id: `pair-${primary.exercise.id}-${secondary.exercise.id}`,
            items: [primary, secondary],
            rest: pi.rest,
          });
          used.add(primary.exercise.id);
          used.add(secondary.exercise.id);
          return;
        }
      }
      result.push({ type: 'single', id: `s-${entry.exercise.id}`, item: entry });
      used.add(entry.exercise.id);
    });
    return result;
  })();

  // 計算每個 group 的「前一 group end timestamp + kind」
  // 用於 single：inter-exercise rest 起算點
  // 用於 pair：sticky bar 上方 enter-pair 提示
  const groupBoundaries = groupedPlan.map((_, idx) => {
    if (idx === 0) return { prevEndTs: null, prevKind: null };
    const prev = groupedPlan[idx - 1];
    if (prev.type === 'single') {
      const ex = prev.item.exercise;
      const lastKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${prev.item.sets - 1}`;
      return { prevEndTs: logs[lastKey]?.completedAt ?? null, prevKind: 'single' };
    }
    const [a, b] = prev.items;
    const pairCfg = { primary: a.exercise.id, secondary: b.exercise.id, rest: prev.rest };
    const ts = getPairEndTimestamp(pairCfg, a.sets, b.sets, currentWeek, currentDay, logs);
    return { prevEndTs: ts, prevKind: 'pair' };
  });

  // pairRest：pair 成員才有 { coreRoundCount, coreDone, coreEndTs }，單動作為 null
  const renderExerciseInner = ({ entry, dragHandleProps, hideInterRest, pairRest, prevEndTs }) => {
    const { exercise: ex, sets: setsCount } = entry;

    const completedCount = [...Array(setsCount)].filter((_, idx) => {
      const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
      return logs[logKey]?.done;
    }).length;
    const skippedCount = [...Array(setsCount)].filter((_, idx) => {
      const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
      return logs[logKey]?.skipped;
    }).length;
    const allDone = (completedCount + skippedCount) === setsCount;

    // 動作間休息看第一個沒跳過的組；整個動作都跳過就不顯示
    const firstActiveLog = [...Array(setsCount)]
      .map((_, idx) => logs[`w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`] || {})
      .find(log => !log.skipped);
    const hasPrevEndTs = !hideInterRest && typeof prevEndTs === 'number' && firstActiveLog !== undefined;

    return (
      <div className={`p-6 transition-all ${allDone ? 'bg-emerald-500/5 opacity-60' : ''}`}>
        {/* Exercise Header */}
        <div className="flex items-start gap-2 mb-4">
          {dragHandleProps ? (
            <div
              {...dragHandleProps}
              className="mt-1 text-neutral-700 hover:text-neutral-400 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
            >
              <GripVertical size={20} />
            </div>
          ) : (
            <div className="mt-1 w-5 flex-shrink-0" />
          )}
          <div className="flex-1 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${ex.isUpper ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                <h3 className="text-lg font-bold text-neutral-100">
                  {customExerciseNames[ex.id] || ex.name}
                </h3>
                <button
                  onClick={() => { setPickerForExId(ex.id); setPickerSearch(''); }}
                  className="text-neutral-600 hover:text-neutral-400 transition-colors"
                  title="替換動作"
                >
                  <Edit2 size={14} />
                </button>
                {ex.isCustom && (
                  <button
                    onClick={() => removeCustomExercise(ex.id)}
                    className="text-neutral-700 hover:text-rose-500 transition-colors"
                    title="刪除此動作"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[10px] font-black bg-neutral-800 text-neutral-400 px-2 py-1 rounded inline-block uppercase tracking-wider">
                  {MUSCLE_GROUPS[ex.muscle] ?? '未知'}
                </span>
                <span className="text-[10px] font-mono bg-neutral-800 text-neutral-500 px-2 py-1 rounded inline-block">
                  {getRepRange(ex.type, currentWeek)} 下
                </span>
                <span className={`text-[10px] font-bold ${ex.type === 'compound' ? 'text-cyan-500' : 'text-neutral-600'}`}>
                  {ex.type === 'compound' ? '複合' : '隔離'}
                </span>
                {ex.noteRIR && (
                  <span className="text-[10px] font-black bg-rose-900/40 text-rose-300 border border-rose-700/50 px-2 py-1 rounded uppercase tracking-wider">
                    ⚠ RIR {ex.noteRIR} · 不可至力竭
                  </span>
                )}
              </div>
              {ex.noteText && (
                <p className="text-[11px] text-neutral-500 mt-1.5 italic">
                  {ex.noteText}
                </p>
              )}
            </div>

            <div className="text-right flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjustExerciseSets(ex.id, -1, setsCount)}
                  className="p-1 text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                  title="減少一組"
                >
                  <Minus size={14} />
                </button>
                <div className="text-2xl font-black font-mono text-neutral-700 min-w-[2rem] text-center">
                  {setsCount}<span className="text-sm ml-0.5">組</span>
                </div>
                <button
                  onClick={() => adjustExerciseSets(ex.id, 1, setsCount)}
                  className="p-1 text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
                  title="增加一組"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="text-xs text-neutral-600">
                {completedCount}/{setsCount} 完成
                {skippedCount > 0 && (
                  <span className="ml-1 text-neutral-700">· {skippedCount} 跳過</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Inter-Exercise Rest Time */}
        {hasPrevEndTs && (() => {
          if (!firstActiveLog.done) {
            const elapsed = Math.floor((currentTime - prevEndTs) / 1000);
            return (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-xl">
                <div className="text-sm text-blue-400 font-semibold animate-pulse flex items-center gap-2">
                  動作間休息: {formatTime(elapsed)}
                </div>
              </div>
            );
          }
          if (firstActiveLog.completedAt) {
            const restSeconds = Math.floor((firstActiveLog.completedAt - prevEndTs) / 1000);
            return restSeconds >= 0 ? (
              <div className="mb-4 p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl">
                <div className="text-sm text-neutral-500 flex items-center gap-2">
                  動作間休息: {formatTime(restSeconds)}
                </div>
              </div>
            ) : null;
          }
          return null;
        })()}

        {/* Sets List */}
        <div className="space-y-3">
          {[...Array(setsCount)].map((_, idx) => {
            const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
            const logData = logs[logKey] || {};
            // 替換過的動作用替換後動作的歷史，不沿用原本那格的
            const historyKey = ex._libraryId ?? ex.id;
            const historyEntry = history[historyKey] || {};
            const historyWeight = historyEntry.weight;
            const historyReps = historyEntry.reps;
            const hasHistory = (historyWeight !== undefined && historyWeight !== '') || (historyReps !== undefined && historyReps !== '');
            // 次數是唯一必填：沒填也沒有上次次數時 ✓ 不能按；重量空白按 ✓ 當 0 kg
            const canComplete = logData.done || Boolean(logData.reps) || hasReps(historyReps);

            return (
              <React.Fragment key={idx}>
                {/* 手機 390px 一列要放下 組號 / 重量± / 次數 / 跳過 / ✓：sm 以下縮小 gap、padding 與重量框 */}
                <div
                  data-set-row
                  className={`flex items-center gap-2 p-2 sm:gap-3 sm:p-3 rounded-xl transition-all
                  ${logData.skipped
                    ? 'bg-neutral-800/20 border border-neutral-800 opacity-40'
                    : logData.done
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-neutral-800/30 border border-neutral-800'}`}
                >
                  <button
                    type="button"
                    onClick={() => !logData.skipped && hasHistory && fillFromHistory(logKey, historyKey)}
                    disabled={logData.skipped || !hasHistory}
                    title={hasHistory ? '帶入上次重量與次數' : '尚無上次紀錄'}
                    className={`text-xl font-black w-6 sm:w-8 flex-shrink-0 text-center transition-colors
                      ${logData.skipped ? 'text-neutral-700 line-through cursor-default'
                        : hasHistory ? 'text-neutral-600 hover:text-emerald-400 cursor-pointer'
                        : 'text-neutral-600 cursor-default'}`}
                  >
                    {idx + 1}
                  </button>
                  {logData.skipped ? (
                    <div className="flex-1 text-center text-sm text-neutral-600 font-bold tracking-wider uppercase py-2">
                      跳過
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <label className="text-[10px] text-neutral-500 block mb-1">重量 (kg)</label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustWeight(logKey, -1, historyWeight)}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                            title={`-${weightIncrement}kg`}
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            data-weight-input
                            type="number"
                            step={weightIncrement}
                            value={logData.weight ?? ''}
                            onChange={(e) => updateLog(logKey, 'weight', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const repsInput = e.currentTarget.closest('[data-set-row]')?.querySelector('[data-reps-input]');
                                repsInput?.focus();
                                repsInput?.select();
                              }
                            }}
                            placeholder={hasWeight(historyWeight) ? String(historyWeight) : '—'}
                            className="w-14 sm:w-20 bg-neutral-900 px-1 sm:px-3 py-2 rounded-lg text-center font-mono text-sm
                            focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            onClick={() => adjustWeight(logKey, 1, historyWeight)}
                            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                            title={`+${weightIncrement}kg`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-neutral-500 block mb-1">次數</label>
                        <input
                          data-reps-input
                          type="number"
                          value={logData.reps || ''}
                          onChange={(e) => updateLog(logKey, 'reps', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const allWeightInputs = document.querySelectorAll('[data-weight-input]');
                              const allRepsInputs = document.querySelectorAll('[data-reps-input]');
                              const currentIndex = Array.from(allRepsInputs).indexOf(e.currentTarget);
                              const nextWeightInput = allWeightInputs[currentIndex + 1];
                              if (nextWeightInput) {
                                nextWeightInput.focus();
                                nextWeightInput.select();
                              }
                            }
                          }}
                          placeholder={historyReps !== undefined && historyReps !== '' ? String(historyReps) : '—'}
                          className="w-full min-w-0 bg-neutral-900 px-1 sm:px-3 py-2 rounded-lg text-center font-mono text-sm
                          focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => skipSet(logKey)}
                    title={logData.skipped ? '取消跳過' : '跳過此組'}
                    className={`p-1.5 rounded-lg transition-colors flex-shrink-0
                    ${logData.skipped
                      ? 'text-neutral-500 hover:text-neutral-300'
                      : 'text-neutral-700 hover:text-rose-500'}`}
                  >
                    <XCircle size={16} />
                  </button>
                  {logData.skipped ? (
                    <div className="w-10 flex-shrink-0" />
                  ) : (
                    <button
                      type="button"
                      data-complete-btn
                      onClick={() => completeSet(logKey, historyKey, historyEntry)}
                      disabled={!canComplete}
                      title={logData.done ? '取消完成' : canComplete ? '完成此組' : '先輸入次數'}
                      aria-label={logData.done ? '取消完成' : '完成此組'}
                      aria-pressed={Boolean(logData.done)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                      ${logData.done
                        ? 'bg-emerald-500 text-black'
                        : canComplete
                          ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-emerald-400'
                          : 'bg-neutral-900 text-neutral-700 cursor-not-allowed'}`}
                    >
                      <Check size={18} strokeWidth={3} />
                    </button>
                  )}
                </div>

                {/* Rest Time Display（pair 核心輪由 sticky bar 呈現；tail 組回到單動作 inline 休息） */}
                {(() => {
                  if (logData.skipped) return null;
                  // pair 內只顯示「下一組是 tail 組」的休息
                  if (pairRest && idx + 1 < pairRest.coreRoundCount) return null;
                  // 最後一個核心組 → 第一個 tail 組：核心輪做完才開始算，從輪結束（兩邊較晚者）起算
                  const isCoreToTail = pairRest != null && idx < pairRest.coreRoundCount;
                  if (isCoreToTail && !pairRest.coreDone) return null;
                  const restFromTs = isCoreToTail ? pairRest.coreEndTs : logData.completedAt;
                  const isLastSet = idx === setsCount - 1;
                  const nextLogKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx + 1}`;
                  const nextLog = logs[nextLogKey];

                  if (logData.done && !isLastSet && nextLog?.done && !nextLog?.skipped) {
                    const restTime = calculateRestTime(nextLogKey, restFromTs);
                    return restTime ? (
                      <div className="text-xs text-neutral-500 mt-1 pl-11">
                        休息時間: {restTime}
                      </div>
                    ) : null;
                  }
                  if (logData.done && !isLastSet && !nextLog?.done && !nextLog?.skipped) {
                    const cRestTime = getCurrentRestTime(restFromTs);
                    return (
                      <div className="text-xs text-emerald-400 mt-1 pl-11 font-semibold animate-pulse">
                        休息中: {cRestTime}
                      </div>
                    );
                  }
                  return null;
                })()}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-12 gap-8">

      {/* ==================== 訓練區域 (左側) ==================== */}
      <div className="lg:col-span-8 space-y-6">

        {/* Day Selector */}
        <div className="grid grid-cols-5 gap-1.5">
          {[0, 1, 2, 3, 4].map(d => {
            const wKey = getWorkoutForDay(currentWeek, d);
            const workout = WORKOUTS[wKey];
            const theme = SESSION_TYPE_THEME[workout.type] ?? SESSION_TYPE_THEME.push;
            const isActive = currentDay === d;
            return (
              <button
                key={d}
                onClick={() => setCurrentDay(d)}
                className={`py-3 px-1.5 rounded-xl text-sm font-black transition-all border flex flex-col items-center gap-0.5
                ${isActive
                  ? theme.activeBtn
                  : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-neutral-600'}`}
              >
                <div className="text-[10px] opacity-60 font-normal">D{d + 1}</div>
                <div className="text-xl">{wKey}</div>
                <div className={`text-[9px] font-bold ${isActive ? 'opacity-80' : theme.accentText}`}>{theme.label}</div>
              </button>
            );
          })}
        </div>

        {/* 60 min 超時警示 */}
        {overMinutes > 0 && (
          <div className="p-3 rounded-2xl border bg-amber-900/30 border-amber-600 text-amber-300 text-sm font-bold flex items-center gap-2">
            <span>⏱</span>
            <span>已超時 {overMinutes} 分鐘 · 考慮跳過 1 組 isolation</span>
          </div>
        )}

        {/* Training Info Box */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between
          ${currentWeek % 5 === 0 ? 'bg-amber-900/20 border-amber-800' : 'bg-emerald-900/20 border-emerald-800'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${currentWeek % 5 === 0 ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>
              <Activity size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold opacity-60">當前階段建議</p>
              <p className="font-black text-lg tracking-tight">{guidance.label} | {guidance.rir} RIR</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold opacity-60 uppercase">週次 {currentWeek} · {currentWorkout.name}</p>
            <p className="text-xs text-neutral-500">{currentWorkout.subtitle}</p>
          </div>
        </div>

        {/* Exercise Card */}
        {/* overflow-clip 只裁圓角、不建立捲動容器；overflow-hidden 會讓 pair sticky bar 黏不住 */}
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl overflow-clip">
          <div className="px-8 py-6 border-b border-neutral-800 bg-neutral-800/30">
            <h2 className="text-2xl font-black text-white italic">{currentWorkout.name}</h2>
            <p className="text-neutral-500 text-sm mt-1">{currentWorkout.subtitle}</p>
          </div>

          <DragDropContext
            onDragEnd={handleDragEnd}
            autoScrollerOptions={{
              startFromPercentage: 0.15,
              maxScrollAtPercentage: 0.03,
              maxPixelScroll: 8,
              ease: (p) => p * p,
            }}
          >
            <Droppable droppableId={`exercises-${workoutKey}`}>
              {(provided) => (
                <div
                  className="divide-y divide-neutral-800"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {groupedPlan.map((group, groupIdx) => {
                    const { prevEndTs, prevKind } = groupBoundaries[groupIdx];
                    if (group.type === 'pair') {
                      const [a, b] = group.items;
                      const pairCfg = { primary: a.exercise.id, secondary: b.exercise.id, rest: group.rest };
                      const pairState = getPairRoundState(pairCfg, a.sets, b.sets, currentWeek, currentDay, logs);
                      const tailProgress = getPairTailProgress(pairCfg, a.sets, b.sets, currentWeek, currentDay, logs);
                      const pairRest = {
                        coreRoundCount: pairState.coreRoundCount,
                        coreDone: pairState.state === 'done',
                        coreEndTs: pairState.lastCompleteRoundEndTs,
                      };
                      const enterPairLabel = prevKind === 'pair' ? '上一配對' : '上一動作';
                      return (
                        <Draggable key={group.id} draggableId={group.id} index={groupIdx}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`transition-all ${snapshot.isDragging ? 'bg-neutral-800 shadow-2xl rounded-xl opacity-95' : ''}`}
                            >
                              {/* Pair Header */}
                              <div className="px-6 pt-4 pb-2 bg-orange-900/15 border-y border-orange-800/40 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-orange-300 font-black text-xs uppercase tracking-widest">
                                  <span
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing text-orange-400/70 touch-none"
                                  >
                                    <GripVertical size={16} />
                                  </span>
                                  <span>🔗 SUPERSET</span>
                                </div>
                                <div className="text-[10px] font-mono text-orange-200/70">
                                  切換 15s · 組間 {group.rest}s
                                </div>
                              </div>
                              {/* Sticky timer bar（pair 唯一休息呈現載體） */}
                              <PairStickyBar
                                pairState={pairState}
                                pairInfo={pairCfg}
                                tailProgress={tailProgress}
                                currentTime={currentTime}
                                enterPairFromTs={prevEndTs}
                                enterPairLabel={enterPairLabel}
                              />
                              {/* Inner exercises */}
                              <div className="divide-y divide-orange-900/30">
                                {group.items.map(entry => (
                                  <React.Fragment key={entry.exercise.id}>
                                    {renderExerciseInner({
                                      entry,
                                      dragHandleProps: null,
                                      hideInterRest: true,
                                      pairRest,
                                      prevEndTs: null,
                                    })}
                                  </React.Fragment>
                                ))}
                              </div>
                              {/* TMJ footer */}
                              <div className="px-6 pb-3 pt-1 bg-orange-900/15 border-b border-orange-800/40">
                                <p className="text-[11px] text-orange-200/60 italic">
                                  💨 下顎放鬆 · 鼻吸口呼
                                </p>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    }
                    return (
                      <Draggable key={group.id} draggableId={group.id} index={groupIdx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`transition-all ${snapshot.isDragging ? 'bg-neutral-800 shadow-2xl rounded-xl opacity-95' : ''}`}
                          >
                            {renderExerciseInner({
                              entry: group.item,
                              dragHandleProps: provided.dragHandleProps,
                              hideInterRest: false,
                              pairRest: null,
                              prevEndTs,
                            })}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* 新增動作按鈕 */}
          <div className="px-6 py-4 border-t border-neutral-800">
            <button
              onClick={() => setShowAddExercise(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:border-emerald-600 hover:text-emerald-500 transition-all text-sm font-bold"
            >
              <Plus size={16} /> 新增動作
            </button>
          </div>
        </div>
      </div>

      {/* ==================== 統計面板 (右側) ==================== */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 sticky top-24 shadow-2xl">

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-black text-sm uppercase italic flex items-center gap-2">
              <BarChart2 size={16} /> 本週訓練量
            </h3>
            <button
              onClick={() => setShowStats(!showStats)}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {showStats ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {showStats && (
            <>
              <div className="space-y-4 mb-6">
                {Object.entries(weeklyVolume).map(([muscle, sets]) => {
                  if (sets === 0) return null;
                  const target = getWeeklyMuscleVolume(muscle, currentWeek);
                  const percentage = target > 0 ? Math.min(120, (sets / target) * 100) : 0;
                  let color = 'bg-neutral-700';
                  if (percentage >= 100) color = 'bg-emerald-500';
                  else if (percentage >= 80) color = 'bg-amber-500';
                  else if (percentage > 0) color = 'bg-blue-500';
                  const shortfall = target > sets ? target - sets : 0;

                  return (
                    <div key={muscle}>
                      <div className="flex justify-between text-[11px] font-black uppercase mb-1.5 opacity-80">
                        <span>{MUSCLE_GROUPS[muscle]}</span>
                        <span className="font-mono">
                          {sets}<span className="text-neutral-500"> / {target}</span> 組
                          {shortfall > 0 && (
                            <span className="ml-1 text-amber-500/70 normal-case font-bold">↓{shortfall}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${Math.min(100, percentage)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-neutral-600 leading-relaxed mb-4 -mt-2">
                數字 = 實際 / 規格目標。<span className="text-amber-500/70">↓N</span> 表示因 4 組上限導致缺額、可在動作卡片「+1 組」手動補回。
              </p>

              <div className="p-4 bg-neutral-800/50 rounded-2xl border border-neutral-700 text-[11px] leading-relaxed text-neutral-400">
                <p className="text-white font-bold mb-2 flex items-center gap-2 italic">
                  <TrendingUp size={12}/> {PHASE_CONFIG[getPhase(currentWeek)].label}
                </p>
                {getPhase(currentWeek) === 'hypertrophy' ? (
                  <p>W1-W4 肌肥大期：肌群週容量從 MEV 遞增至 MRV，複合動作 {PHASE_CONFIG.hypertrophy.compound} 下，隔離動作 {PHASE_CONFIG.hypertrophy.isolation} 下。</p>
                ) : getPhase(currentWeek) === 'strength' ? (
                  <p>W6-W9 肌力期：總組數固定於 MEV，專注重量遞增。複合動作 {PHASE_CONFIG.strength.compound} 下，隔離動作 {PHASE_CONFIG.strength.isolation} 下。</p>
                ) : (
                  <p>減量週：所有肌群組數降至 MEV 的 50%，降低疲勞累積，為下一階段做準備。</p>
                )}
              </div>

              <div className="mt-4 p-4 bg-blue-900/20 rounded-2xl border border-blue-800 text-[11px] leading-relaxed text-neutral-400">
                <p className="text-blue-400 font-bold mb-2 uppercase tracking-wide">
                  本週循環
                </p>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[0, 1, 2, 3, 4].map(d => {
                    const wKey = getWorkoutForDay(currentWeek, d);
                    const workout = WORKOUTS[wKey];
                    const theme = SESSION_TYPE_THEME[workout.type] ?? SESSION_TYPE_THEME.push;
                    return (
                      <div key={d} className="bg-neutral-900/50 rounded-lg py-2">
                        <div className="text-[9px] text-neutral-600">D{d + 1}</div>
                        <div className={`text-lg font-black ${theme.accentText}`}>{wKey}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ==================== 替換動作 Picker Modal ==================== */}
      {pickerForExId && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] w-full max-w-sm shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white">替換動作</h3>
              <button
                onClick={() => { setPickerForExId(null); setPickerSearch(''); }}
                className="text-neutral-600 hover:text-neutral-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-neutral-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="搜尋動作或肌群"
                  autoFocus
                  className="w-full bg-neutral-800 pl-9 pr-3 py-2 rounded-xl text-sm text-neutral-100
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {filteredLibrary.length === 0 ? (
                <p className="text-center text-xs text-neutral-600 py-6">沒有符合的動作</p>
              ) : filteredLibrary.map(item => {
                const isCurrent = currentOverrideId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => applyLibraryToExercise(pickerForExId, item)}
                    className={`w-full text-left flex items-center justify-between gap-3 px-3 py-3 rounded-xl mb-1 transition-all border
                      ${isCurrent
                        ? 'bg-emerald-900/30 border-emerald-700'
                        : 'bg-neutral-800/30 border-transparent hover:bg-neutral-800/70'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-neutral-100 truncate">{item.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold bg-neutral-900 text-neutral-400 px-1.5 py-0.5 rounded">
                          {MUSCLE_GROUPS[item.muscle] ?? '未知'}
                        </span>
                        <span className={`text-[10px] font-bold ${item.type === 'compound' ? 'text-cyan-500' : 'text-neutral-500'}`}>
                          {item.type === 'compound' ? '複合' : '隔離'}
                        </span>
                      </div>
                    </div>
                    {isCurrent && <span className="text-[10px] font-black text-emerald-400 uppercase">目前</span>}
                  </button>
                );
              })}
            </div>

            {currentOverrideId && (
              <div className="px-6 pb-4 pt-2 border-t border-neutral-800">
                <button
                  onClick={() => resetExerciseOverride(pickerForExId)}
                  className="w-full py-2 rounded-xl bg-neutral-800 text-neutral-400 text-xs font-bold hover:bg-neutral-700 transition-all"
                >
                  恢復為原動作
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 新增動作 Modal ==================== */}
      {showAddExercise && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-[32px] w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-neutral-800">
              <h3 className="text-lg font-black text-white">新增動作</h3>
              <button
                onClick={() => setShowAddExercise(false)}
                className="text-neutral-600 hover:text-neutral-300 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 動作名稱 */}
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">動作名稱</label>
                <input
                  type="text"
                  value={newEx.name}
                  onChange={(e) => setNewEx(prev => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustomExercise(); }}
                  placeholder="例如：槓鈴深蹲"
                  autoFocus
                  className="w-full bg-neutral-800 px-4 py-3 rounded-xl text-sm font-medium text-neutral-100
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
                />
              </div>

              {/* 肌群 */}
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">肌群</label>
                <select
                  value={newEx.muscle}
                  onChange={(e) => setNewEx(prev => ({ ...prev, muscle: e.target.value }))}
                  className="w-full bg-neutral-800 px-4 py-3 rounded-xl text-sm font-medium text-neutral-100
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700 appearance-none"
                >
                  {Object.entries(MUSCLE_GROUPS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 動作類型 */}
              <div>
                <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">類型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'compound', label: '複合動作' },
                    { value: 'isolation', label: '隔離動作' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setNewEx(prev => ({ ...prev, type: value }))}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border
                      ${newEx.type === value
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowAddExercise(false)}
                className="flex-1 py-3 rounded-xl bg-neutral-800 text-neutral-400 font-bold text-sm hover:bg-neutral-700 transition-all"
              >
                取消
              </button>
              <button
                onClick={addCustomExercise}
                disabled={!newEx.name.trim()}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TrainingView;
