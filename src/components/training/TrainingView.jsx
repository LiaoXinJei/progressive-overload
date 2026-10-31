import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, GripVertical, Link, Minus,
  MoreHorizontal, Plus, Repeat, Search, Settings, Trash2, Wind,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  WORKOUTS, MUSCLE_GROUPS, PHASE_CONFIG, MAX_SETS_PER_EXERCISE,
  SUPERSET_PAIRS, SESSION_TYPE_THEME,
} from '../../constants/workouts';
import {
  getPairRoundState, getPairEndTimestamp, getPairTailProgress, getExercisesEndTimestamp,
  getRestContext,
} from '../../utils/pairRoundState';
import {
  buildSessionPlan, getWorkoutForDay, getPhase, getRepRange, getWeeklyMuscleVolume,
  customSetsKey, withoutCustomSets,
} from '../../utils/sessionPlan';
import BottomSheet from '../shared/BottomSheet';

const LOWER_MUSCLES = new Set(['QUADS', 'HAMS', 'CALVES']);

// 重量 0 是有效值（自體重），只有空白才算沒填
const hasWeight = (w) => w !== undefined && w !== null && w !== '';
const hasReps = (r) => r !== undefined && r !== null && r !== '';

// 完成後這段時間內取消完成，當成誤按 ✓（重新完成用當下時間，不沿用誤按的時間）
const MISTAP_UNDO_MS = 60 * 1000;

// App 沒傳休息目標時（測試）用的值，同 App 的 restNotificationDelay 預設
const DEFAULT_REST_TARGET = 90;
// superset 兩個動作之間的切換目標（見 SUPERSET_PAIRS 註解）
const SWITCH_TARGET_SEC = 15;

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

// 次數區間、RIR 顯示用 en dash（8–12、2–3）
const enDash = (range) => String(range).replace('-', '–');

const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// 三盞裁判燈：待做 = 暗燈、完成 = 三盞白燈、跳過 = 三盞紅燈。
// light：剛按 ✓ 完成的那組，三盞依序亮起（.lamps-light，見 index.css）。
// 讀檔、換天時已經是完成的組不播（App 先畫空資料再讀檔，用狀態變化判斷會每次開 App 都播）
const Lamps = ({ state, onPaper = false, light = false }) => {
  const tone = state === 'done'
    ? (onPaper ? 'bg-white ring-1 ring-inset ring-paper-ink' : 'bg-judge-white')
    : state === 'skip'
      ? 'bg-judge-red'
      : `ring-[1.5px] ring-inset ${onPaper ? 'ring-paper-line' : 'ring-fg-3'}`;
  return (
    <span className={`flex gap-[3px] ${light && state === 'done' ? 'lamps-light' : ''}`} aria-hidden="true">
      {[0, 1, 2].map(i => <span key={i} className={`h-2 w-2 rounded-full ${tone}`} />)}
    </span>
  );
};

// 休息顯示。live（還在休息）：琥珀色 + 到目標的進度條；done（已結束）：次要文字。
// data-rest / data-rest-label 給測試找，label 文字是「休息中 1:24」「休息 1:52」「動作間休息 2:00」
const RestLine = ({ kind, label, time, seconds = 0, target = 0, className = '' }) => {
  if (!kind.endsWith('live')) {
    return (
      <div data-rest={kind} className={`flex h-7 items-center px-2 text-xs text-fg-3 ${className}`}>
        <span data-rest-label>{label} <span className="font-num text-sm tabular-nums">{time}</span></span>
      </div>
    );
  }
  const elapsed = Math.max(0, Math.floor(seconds));
  const over = target > 0 && elapsed > target;
  const pct = target > 0 ? Math.min(100, (elapsed / target) * 100) : 0;
  return (
    <div data-rest={kind} role="timer" className={`flex h-8 items-center gap-2 px-2 text-clock ${className}`}>
      <span data-rest-label className="whitespace-nowrap text-sm font-medium">
        {label} <span className="font-num text-base font-semibold tabular-nums">{time}</span>
      </span>
      <span className="whitespace-nowrap text-xs">
        {over ? `超過 ${formatMmSs(elapsed - target)}` : `/ 目標 ${formatMmSs(target)}`}
      </span>
      <span className="h-0.5 min-w-6 flex-1 rounded-full bg-surface-hi" aria-hidden="true">
        <span className="block h-full rounded-full bg-clock" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
};

// superset 輪次小燈：上排 A、下排 B
const RoundLamps = ({ rounds }) => (
  <div className="flex flex-col gap-1" aria-hidden="true">
    {['a', 'b'].map(side => (
      <div key={side} className="flex gap-1">
        {rounds.map(r => {
          const log = side === 'a' ? r.aLog : r.bLog;
          const tone = log?.skipped ? 'bg-judge-red' : log?.done ? 'bg-judge-white' : 'ring-[1.5px] ring-inset ring-fg-3';
          return <span key={r.idx} className={`h-2 w-2 rounded-full ${tone}`} />;
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
  let progress = null;
  if (state === 'idle') {
    mainNode = (
      <span className="text-sm text-fg-2">
        準備開始 R{currentRoundIdx + 1}
      </span>
    );
  } else if (state === 'mid-round') {
    const elapsed = midRoundAnchorTs != null
      ? Math.floor((currentTime - midRoundAnchorTs) / 1000)
      : 0;
    mainNode = (
      <span className="text-sm font-medium text-clock">
        切換中 <span className="font-num text-base font-semibold tabular-nums">{formatMmSs(elapsed)}</span>
      </span>
    );
  } else if (state === 'between-rounds') {
    const elapsed = lastCompleteRoundEndTs != null
      ? Math.floor((currentTime - lastCompleteRoundEndTs) / 1000)
      : 0;
    // 超過目標也維持琥珀色（紅色只給跳過），用文字講超過多少
    const over = elapsed > targetSec;
    progress = Math.min(100, (Math.max(0, elapsed) / targetSec) * 100);
    mainNode = (
      <span className="text-sm font-medium text-clock">
        輪間休息 <span className="font-num text-base font-semibold tabular-nums">{formatMmSs(elapsed)}</span>
        {' '}
        <span className="text-xs font-normal">
          {over ? `超過 ${formatMmSs(elapsed - targetSec)}` : `/ 目標 ${formatMmSs(targetSec)}`}
        </span>
      </span>
    );
  } else if (state === 'done' && tailProgress.settled < tailProgress.total) {
    // 核心輪做完、還有 tail 組（休息顯示在 tail 前的 set 列）
    mainNode = (
      <span className="text-sm text-fg-2">
        {rounds.length} 輪完成 · 尾組 {tailProgress.settled}/{tailProgress.total}
      </span>
    );
  } else if (state === 'done') {
    mainNode = (
      <span className="inline-flex items-center gap-1 text-sm text-fg-2">
        <Check size={16} aria-hidden="true" />完成 · {rounds.length} 輪
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
      className="sticky z-30 border-y border-line bg-hall-2 px-3 py-2"
      // 黏在訓練頁頂部 bar 下方；--app-header-h 由 TrainingView 量測頂部 bar 高度寫入
      style={{ top: 'var(--app-header-h, 0px)' }}
    >
      {showEnterPair && (
        <div className="mb-1.5 text-xs text-fg-2 tabular-nums">
          {enterPairLabel}完成 {formatMmSs(enterPairElapsed)} 前 · 進入 superset
        </div>
      )}
      <div className="flex min-h-8 items-center justify-between gap-3">
        <RoundLamps rounds={rounds} />
        <div className="text-right">{mainNode}</div>
      </div>
      {progress !== null && (
        <div className="mt-2 h-0.5 rounded-full bg-surface-hi" aria-hidden="true">
          <div className="h-full rounded-full bg-clock" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

// 動作選項 sheet 裡的一列
const SheetAction = ({ icon: Icon, children, ...props }) => (
  <button
    type="button"
    className="flex h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-base text-fg transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:text-fg-3 disabled:hover:bg-transparent"
    {...props}
  >
    <Icon size={20} className="shrink-0 text-fg-2" aria-hidden="true" />
    {children}
  </button>
);

const TrainingView = ({
  logs, setLogs,
  history, setHistory,
  currentWeek, currentDay, setCurrentDay,
  customExerciseNames, setCustomExerciseNames,
  customExercises, setCustomExercises,
  customSets, setCustomSets,
  exerciseOrder, setExerciseOrder,
  exerciseLibrary, exerciseOverrides, setExerciseOverrides,
  weightIncrement,
  currentTime,
  restTarget = DEFAULT_REST_TARGET,
  onSelectWeek,
  onOpenSettings,
}) => {
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newEx, setNewEx] = useState({ name: '', muscle: 'CHEST', type: 'isolation' });
  const [pickerForExId, setPickerForExId] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  // 開著的 sheet：{ kind: 'week' | 'volume' } 或 { kind: 'options', exId }
  const [sheet, setSheet] = useState(null);
  // 使用者最後聚焦過輸入框的那一組（log key），決定試舉卡在哪一組
  const [focusedKey, setFocusedKey] = useState(null);
  // 剛按 ✓ 完成的那一組（log key），它的裁判燈播亮燈動畫
  const [litKey, setLitKey] = useState(null);

  // 頂部 bar 是唯一的 sticky header，高度（含 safe area）寫進 --app-header-h 給 superset 的 sticky bar 當 top
  const barRef = useRef(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty('--app-header-h', `${el.offsetHeight}px`);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ==================== 核心邏輯函數 ====================

  const getSessionPlan = (week, workoutKey) => buildSessionPlan(week, workoutKey, {
    customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary,
  });

  // 頂部 bar、週次 sheet 顯示的階段文字與 RIR
  const getWeeklyGuidance = (week) => {
    const phase = getPhase(week);
    if (phase === 'deload') return { rir: '4+', label: '減量週' };
    if (week === 4) return { rir: '0–1', label: '肌肥大 · 衝刺週' };
    if (week === 9) return { rir: '0–1', label: '肌力 · 衝刺週' };
    if (phase === 'hypertrophy') return { rir: '2–3', label: '肌肥大 · 累積期' };
    return { rir: '2–3', label: '肌力 · 累積期' };
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
  // 完成超過 MISTAP_UNDO_MS 才取消是事後修正數字：完成時間另存在 firstCompletedAt，重新完成時用回去，
  // 休息計時、訓練時長才不會被推到現在。完成後馬上取消是誤按，不保留，之後真的做完用當下時間
  const uncomplete = (log) => {
    const next = { ...log, done: false, completedAt: undefined };
    const isMistap = log.completedAt == null || Date.now() - log.completedAt < MISTAP_UNDO_MS;
    if (isMistap) delete next.firstCompletedAt;
    else next.firstCompletedAt = log.completedAt;
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
    // 有紀錄的週保留組數，做過的組才不會被藏起來；沒紀錄的週回到週期演算法的預設
    setCustomSets(prev => withoutCustomSets(prev, workoutKey, exerciseId, logs));
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

  const removeCustomExercise = (exerciseId, name) => {
    if (!window.confirm(`刪除「${name}」？`)) return;
    setCustomExercises(prev => ({
      ...prev,
      [workoutKey]: (prev[workoutKey] || []).filter(ex => ex.id !== exerciseId)
    }));
    setExerciseOrder(prev => ({
      ...prev,
      [workoutKey]: (prev[workoutKey] || []).filter(id => id !== exerciseId)
    }));
    setCustomSets(prev => withoutCustomSets(prev, workoutKey, exerciseId));
    // 替換設定也一起清，不然留著沒有動作對應的 key
    setExerciseOverrides(prev => {
      const overrideKey = `${workoutKey}-${exerciseId}`;
      if (!(overrideKey in prev)) return prev;
      const updated = { ...prev };
      delete updated[overrideKey];
      return updated;
    });
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
  const phase = getPhase(currentWeek);
  const currentOverrideId = pickerForExId
    ? exerciseOverrides[`${workoutKey}-${pickerForExId}`]
    : null;

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
  // 前一 group 每組都完成或跳過才算結束，取完成組最晚的時間；最後一組跳過也照算
  const groupBoundaries = groupedPlan.map((_, idx) => {
    if (idx === 0) return { prevEndTs: null, prevKind: null };
    const prev = groupedPlan[idx - 1];
    if (prev.type === 'single') {
      const ts = getExercisesEndTimestamp(
        [{ exerciseId: prev.item.exercise.id, sets: prev.item.sets }], currentWeek, currentDay, logs,
      );
      return { prevEndTs: ts, prevKind: 'single' };
    }
    const [a, b] = prev.items;
    const pairCfg = { primary: a.exercise.id, secondary: b.exercise.id, rest: prev.rest };
    const ts = getPairEndTimestamp(pairCfg, a.sets, b.sets, currentWeek, currentDay, logs);
    return { prevEndTs: ts, prevKind: 'pair' };
  });

  // pairRest：pair 成員才有 { coreRoundCount, coreDone, coreEndTs }，單動作為 null
  // 次數欄按 Enter 要跳去的重量欄。單動作照畫面順序；superset 照輪次（A1 → B1 → A2 → B2 …，tail 組接在後面，
  // pairOrder 是這個順序的 log key），配對最後一組接畫面上配對後面的第一個重量欄。跳過的組沒有輸入框，自然略過
  const findNextWeightInput = (repsInput, logKey, pairOrder) => {
    const allWeightInputs = [...document.querySelectorAll('[data-weight-input]')];
    if (!pairOrder) {
      const allRepsInputs = [...document.querySelectorAll('[data-reps-input]')];
      return allWeightInputs[allRepsInputs.indexOf(repsInput) + 1] ?? null;
    }
    const group = repsInput.closest('[data-pair-group]');
    for (const k of pairOrder.slice(pairOrder.indexOf(logKey) + 1)) {
      const input = group?.querySelector(`[data-weight-input][data-log-key="${k}"]`);
      if (input) return input;
    }
    let lastInPair = -1;
    allWeightInputs.forEach((input, i) => { if (group?.contains(input)) lastInPair = i; });
    return allWeightInputs[lastInPair + 1] ?? null;
  };

  // ==================== 試舉卡與平台看板 ====================

  // 整個 session 照做的順序排好的組：單動作照畫面順序；superset 照輪次 A1 → B1 → A2 …，tail 組接在後面
  const slotOf = (entry, idx) => ({ key: `w${currentWeek}-d${currentDay}-${entry.exercise.id}-s${idx}`, entry, idx });
  const sessionOrder = [];
  groupedPlan.forEach(group => {
    if (group.type === 'single') {
      for (let i = 0; i < group.item.sets; i++) sessionOrder.push(slotOf(group.item, i));
      return;
    }
    const [a, b] = group.items;
    for (let i = 0; i < Math.max(a.sets, b.sets); i++) {
      if (i < a.sets) sessionOrder.push(slotOf(a, i));
      if (i < b.sets) sessionOrder.push(slotOf(b, i));
    }
  });
  const isSettledKey = (key) => Boolean(logs[key]?.done || logs[key]?.skipped);
  const firstPendingSlot = sessionOrder.find(s => !isSettledKey(s.key)) ?? null;
  // 目前這組 = 最後聚焦過輸入框的那一組（跳過的不算）；沒有就是第一個沒完成也沒跳過的組。畫面上只有一張試舉卡
  const focusedSlot = focusedKey
    ? sessionOrder.find(s => s.key === focusedKey && !logs[s.key]?.skipped) ?? null
    : null;
  const currentSlot = focusedSlot ?? firstPendingSlot;
  const currentKey = currentSlot?.key ?? null;
  // 看板顯示下一組：目前這組還沒做就是它，不然是第一個還沒做的組
  const boardSlot = currentSlot && !logs[currentSlot.key]?.done ? currentSlot : firstPendingSlot;
  const finished = sessionOrder.length > 0 && !firstPendingSlot;

  const boardEx = boardSlot?.entry.exercise ?? null;
  const boardName = boardEx ? (customExerciseNames[boardEx.id] || boardEx.name) : '';
  const boardHistory = boardEx ? history[boardEx._libraryId ?? boardEx.id] : null;
  const boardLast = boardHistory && (hasWeight(boardHistory.weight) || hasReps(boardHistory.reps))
    ? `${hasWeight(boardHistory.weight) ? boardHistory.weight : '—'} × ${hasReps(boardHistory.reps) ? boardHistory.reps : '—'}`
    : null;
  const boardPos = boardSlot ? sessionOrder.indexOf(boardSlot) : -1;
  const prevBoardLog = boardPos > 0 ? logs[sessionOrder[boardPos - 1].key] : null;
  const prevLamp = prevBoardLog?.done ? 'done' : prevBoardLog?.skipped ? 'skip' : null;

  // 看板的休息倒數跟休息通知同一個來源（getRestContext），只顯示今天的
  const restContext = getRestContext({
    logs, currentWeek, currentDay, workoutKey,
    sessionPlan: currentSessionPlan, globalDelay: restTarget,
  });
  const REST_LABELS = {
    'in-set': '休息',
    'between-exercises': '動作間休息',
    'in-pair-between-rounds': '輪間休息',
    'in-pair-mid-round': '切換',
  };
  const boardRest = boardSlot && REST_LABELS[restContext.type] && restContext.anchorTs != null
    && isSameDay(restContext.anchorTs, currentTime)
    ? (() => {
      const target = restContext.delay ?? SWITCH_TARGET_SEC;
      const elapsed = Math.max(0, Math.floor((currentTime - restContext.anchorTs) / 1000));
      return { label: REST_LABELS[restContext.type], target, elapsed, over: elapsed > target };
    })()
    : null;

  const scrollToSet = (logKey) => {
    const row = document.querySelector(`[data-weight-input][data-log-key="${logKey}"]`)?.closest('[data-set-row]');
    if (!row) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const closeSheet = () => setSheet(null);
  const optionsEntry = sheet?.kind === 'options'
    ? currentSessionPlan.find(e => e.exercise.id === sheet.exId) ?? null
    : null;

  // pairOrder：pair 成員才有（見 findNextWeightInput），單動作為 undefined
  const renderExerciseInner = ({ entry, dragHandleProps, hideInterRest, pairRest, prevEndTs, pairOrder }) => {
    const { exercise: ex, sets: setsCount } = entry;
    const exName = customExerciseNames[ex.id] || ex.name;

    const completedCount = [...Array(setsCount)].filter((_, idx) => {
      const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
      return logs[logKey]?.done;
    }).length;
    const skippedCount = [...Array(setsCount)].filter((_, idx) => {
      const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
      return logs[logKey]?.skipped;
    }).length;

    // 動作間休息看第一個沒跳過的組；整個動作都跳過就不顯示
    const firstActiveLog = [...Array(setsCount)]
      .map((_, idx) => logs[`w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`] || {})
      .find(log => !log.skipped);
    const hasPrevEndTs = !hideInterRest && typeof prevEndTs === 'number' && firstActiveLog !== undefined;

    return (
      <section data-exercise data-exercise-id={ex.id} className="py-4">
        {/* 動作間休息：放在動作標題上方 */}
        {hasPrevEndTs && (() => {
          if (!firstActiveLog.done) {
            const elapsed = Math.floor((currentTime - prevEndTs) / 1000);
            return (
              <RestLine
                kind="exercise-live" label="動作間休息" time={formatTime(elapsed)}
                seconds={elapsed} target={restTarget} className="mb-2"
              />
            );
          }
          if (firstActiveLog.completedAt) {
            const restSeconds = Math.floor((firstActiveLog.completedAt - prevEndTs) / 1000);
            return restSeconds >= 0 ? (
              <RestLine kind="exercise-done" label="動作間休息" time={formatTime(restSeconds)} className="mb-1" />
            ) : null;
          }
          return null;
        })()}

        {/* Exercise Header */}
        <div className="flex items-start gap-1">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              aria-label={`拖曳排序：${exName}`}
              className="-ml-3 flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-fg-3 hover:text-fg-2 active:cursor-grabbing"
            >
              <GripVertical size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-2">
            <h3 className="text-xl font-bold leading-tight text-fg">{exName}</h3>
            <p className="mt-1 text-sm text-fg-2">
              {MUSCLE_GROUPS[ex.muscle] ?? '未知'} · {ex.type === 'compound' ? '複合' : '隔離'} · {enDash(getRepRange(ex.type, currentWeek))} 下 × {setsCount} 組
            </p>
            {ex.noteRIR && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-fg">
                <AlertTriangle size={14} className="text-fg-2" aria-hidden="true" />
                RIR {enDash(ex.noteRIR)} · 不可至力竭
              </p>
            )}
            {ex.noteText && (
              <p className="mt-1.5 text-sm text-fg-3">{ex.noteText}</p>
            )}
          </div>
          <div className="flex shrink-0 items-start">
            <div className="pt-1 text-right">
              <p className="font-num text-28 font-semibold tabular-nums text-fg">
                {completedCount}<span className="text-xl text-fg-3">/{setsCount}</span>
              </p>
              {skippedCount > 0 && <p className="text-xs text-fg-2">跳過 {skippedCount}</p>}
            </div>
            <button
              type="button"
              onClick={() => setSheet({ kind: 'options', exId: ex.id })}
              aria-label="動作選項"
              aria-haspopup="dialog"
              className="-mr-2 ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface hover:text-fg"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>
        </div>

        {/* Sets List */}
        <div className="mt-3">
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
            // 帶入上次紀錄：已完成的組不帶，不然會用歷史（可能是後面組的數字）蓋掉這組
            const canFill = !logData.skipped && !logData.done && hasHistory;
            // 試舉卡：目前這組整列用卡紙色
            const isCurrent = logKey === currentKey;
            const lampState = logData.skipped ? 'skip' : logData.done ? 'done' : 'off';

            const completeClass = logData.done
              ? `bg-judge-white text-paper-ink ${isCurrent ? 'ring-1 ring-inset ring-paper-ink' : ''}`
              : !canComplete
                ? `cursor-not-allowed ${isCurrent ? 'border border-paper-line text-paper-ink-2' : 'bg-hall-2 text-fg-3'}`
                : isCurrent
                  ? 'bg-ipf text-white hover:bg-ipf/90'
                  : 'border border-line text-fg-2 hover:bg-surface hover:text-fg';

            return (
              <React.Fragment key={idx}>
                {/* 一列：組號 + 三盞燈 / − 重量 + / 次數 / ✓。360px 寬也放得下，輸入框至少 52px */}
                <div
                  data-set-row
                  data-current={isCurrent ? '' : undefined}
                  className={isCurrent
                    ? 'my-1 rounded-xl bg-paper px-2 py-2 text-paper-ink caret-paper-ink [--focus-ring:theme(colors.ipf.DEFAULT)]'
                    : 'px-2 py-1'}
                >
                  <div className="flex min-h-12 items-center gap-1">
                    <div className="flex w-9 shrink-0 flex-col items-start gap-1.5">
                      <span className={`font-num text-xl font-semibold leading-none tabular-nums ${isCurrent ? 'text-paper-ink' : logData.skipped ? 'text-fg-2' : 'text-fg'}`}>
                        {idx + 1}
                      </span>
                      <Lamps state={lampState} onPaper={isCurrent} light={litKey === logKey} />
                    </div>
                    {logData.skipped ? (
                      <>
                        <p className="flex-1 text-sm text-fg-2">已跳過</p>
                        <button
                          type="button"
                          onClick={() => skipSet(logKey)}
                          title="取消跳過"
                          className="h-11 shrink-0 rounded-lg border border-line px-4 text-sm font-medium text-fg transition-colors hover:bg-surface"
                        >
                          復原
                        </button>
                      </>
                    ) : (
                      <>
                        <div className={`flex h-12 min-w-0 flex-1 items-stretch rounded-lg border ${isCurrent ? 'border-paper-line' : 'border-line'}`}>
                          <button
                            type="button"
                            onClick={() => adjustWeight(logKey, -1, historyWeight)}
                            title={`-${weightIncrement}kg`}
                            aria-label={`第 ${idx + 1} 組重量減 ${weightIncrement} 公斤`}
                            className={`flex w-11 shrink-0 items-center justify-center rounded-l-lg transition-colors ${isCurrent ? 'text-paper-ink-2 hover:bg-paper-ink/5' : 'text-fg-2 hover:bg-surface hover:text-fg'}`}
                          >
                            <Minus size={18} />
                          </button>
                          <input
                            data-weight-input
                            data-log-key={logKey}
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            step={weightIncrement}
                            aria-label={`第 ${idx + 1} 組重量（公斤）`}
                            value={logData.weight ?? ''}
                            onChange={(e) => updateLog(logKey, 'weight', e.target.value)}
                            onFocus={() => setFocusedKey(logKey)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const repsInput = e.currentTarget.closest('[data-set-row]')?.querySelector('[data-reps-input]');
                                repsInput?.focus();
                                repsInput?.select();
                              }
                            }}
                            placeholder={hasWeight(historyWeight) ? String(historyWeight) : '—'}
                            className={`w-0 min-w-[52px] flex-1 rounded-none text-center font-num text-xl font-semibold tabular-nums ${isCurrent
                              ? 'bg-white text-paper-ink ring-[1.5px] ring-inset ring-paper-ink placeholder:font-medium placeholder:text-paper-ink-2'
                              : 'bg-surface-hi text-fg placeholder:font-medium placeholder:text-fg-3'}`}
                          />
                          <button
                            type="button"
                            onClick={() => adjustWeight(logKey, 1, historyWeight)}
                            title={`+${weightIncrement}kg`}
                            aria-label={`第 ${idx + 1} 組重量加 ${weightIncrement} 公斤`}
                            className={`flex w-11 shrink-0 items-center justify-center rounded-r-lg transition-colors ${isCurrent ? 'text-paper-ink-2 hover:bg-paper-ink/5' : 'text-fg-2 hover:bg-surface hover:text-fg'}`}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                        <input
                          data-reps-input
                          type="number"
                          inputMode="numeric"
                          enterKeyHint="next"
                          aria-label={`第 ${idx + 1} 組次數`}
                          value={logData.reps || ''}
                          onChange={(e) => updateLog(logKey, 'reps', e.target.value)}
                          onFocus={() => setFocusedKey(logKey)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nextWeightInput = findNextWeightInput(e.currentTarget, logKey, pairOrder);
                              if (nextWeightInput) {
                                nextWeightInput.focus();
                                nextWeightInput.select();
                              }
                            }
                          }}
                          placeholder={historyReps !== undefined && historyReps !== '' ? String(historyReps) : '—'}
                          className={`h-12 w-16 shrink-0 rounded-lg text-center font-num text-xl font-semibold tabular-nums ${isCurrent
                            ? 'bg-white text-paper-ink ring-[1.5px] ring-inset ring-paper-ink placeholder:font-medium placeholder:text-paper-ink-2'
                            : 'border border-line bg-surface-hi text-fg placeholder:font-medium placeholder:text-fg-3'}`}
                        />
                        <button
                          type="button"
                          data-complete-btn
                          onClick={() => {
                            completeSet(logKey, historyKey, historyEntry);
                            if (!logData.done) {
                              setLitKey(logKey);
                              // 做完目前這組，試舉卡換到下一組
                              if (focusedKey === logKey) setFocusedKey(null);
                            }
                          }}
                          disabled={!canComplete}
                          title={logData.done ? '取消完成' : canComplete ? '完成此組' : '先輸入次數'}
                          aria-label={logData.done ? '取消完成' : '完成此組'}
                          aria-pressed={Boolean(logData.done)}
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors ${completeClass}`}
                        >
                          <Check size={22} strokeWidth={3} />
                        </button>
                      </>
                    )}
                  </div>

                  {/* 試舉卡的次要動作：帶入上次、跳過這組（跟 ✓ 上下分開） */}
                  {isCurrent && !logData.skipped && (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        data-fill-history
                        onClick={() => canFill && fillFromHistory(logKey, historyKey)}
                        disabled={!canFill}
                        title={logData.done ? '已完成' : hasHistory ? '帶入上次重量與次數' : '尚無上次紀錄'}
                        className="h-11 min-w-0 rounded-lg px-2 text-left text-sm text-paper-ink-2 transition-colors enabled:hover:bg-paper-ink/5 disabled:cursor-default"
                      >
                        {hasHistory ? (
                          <>
                            上次 <span className="font-num text-base font-semibold tabular-nums text-paper-ink">{hasWeight(historyWeight) ? historyWeight : '—'}</span> kg
                            {' × '}
                            <span className="font-num text-base font-semibold tabular-nums text-paper-ink">{hasReps(historyReps) ? historyReps : '—'}</span>
                          </>
                        ) : '還沒有上次紀錄'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          skipSet(logKey);
                          if (focusedKey === logKey) setFocusedKey(null);
                        }}
                        title="跳過此組"
                        className="h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-paper-ink-2 transition-colors hover:bg-paper-ink/5"
                      >
                        跳過這組
                      </button>
                    </div>
                  )}
                </div>

                {/* 組間休息（pair 核心輪由 sticky bar 呈現；tail 組回到單動作 inline 休息） */}
                {(() => {
                  // pair 內只顯示「下一組是 tail 組」的休息
                  if (pairRest && idx + 1 < pairRest.coreRoundCount) return null;
                  // 最後一個核心組 → 第一個 tail 組：核心輪做完才開始算，從輪結束（兩邊較晚者）起算。
                  // 起算點看整輪，這組自己跳過也照樣顯示
                  const isCoreToTail = pairRest != null && idx < pairRest.coreRoundCount;
                  if (isCoreToTail ? !pairRest.coreDone : !logData.done) return null;
                  const restFromTs = isCoreToTail ? pairRest.coreEndTs : logData.completedAt;
                  if (restFromTs == null) return null;
                  // 下一組跳過就往後找第一個沒跳過的組
                  let nextIdx = idx + 1;
                  while (nextIdx < setsCount && logs[`w${currentWeek}-d${currentDay}-${ex.id}-s${nextIdx}`]?.skipped) nextIdx++;
                  if (nextIdx >= setsCount) return null;
                  const nextLogKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${nextIdx}`;
                  const nextLog = logs[nextLogKey];

                  if (nextLog?.done) {
                    const restTime = calculateRestTime(nextLogKey, restFromTs);
                    return restTime ? (
                      <RestLine kind="set-done" label="休息" time={restTime} />
                    ) : null;
                  }
                  const cRestTime = getCurrentRestTime(restFromTs);
                  return (
                    <RestLine
                      kind="set-live" label="休息中" time={cRestTime}
                      seconds={(currentTime - restFromTs) / 1000} target={restTarget}
                    />
                  );
                })()}
              </React.Fragment>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div>
      {/* ==================== 頂部 bar（唯一的 sticky header） ==================== */}
      <header ref={barRef} className="sticky top-0 z-40 border-b border-line bg-hall pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[480px] items-center gap-2 pl-2 pr-1">
          <button
            type="button"
            data-current-week
            onClick={() => setSheet({ kind: 'week' })}
            aria-label={`第 ${currentWeek} 週，切換週次`}
            aria-haspopup="dialog"
            className="flex h-11 min-w-11 shrink-0 items-center gap-0.5 rounded-lg px-2 text-fg transition-colors hover:bg-surface"
          >
            <span className="font-num text-28 font-semibold tabular-nums">W{currentWeek}</span>
            <ChevronDown size={16} className="text-fg-2" aria-hidden="true" />
          </button>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm text-fg">{guidance.label}</p>
            <p className="text-xs text-fg-2">RIR {guidance.rir}</p>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end">
            <span
              role="timer"
              aria-label="這次訓練時長"
              className={`font-num text-28 font-medium leading-none tabular-nums ${overMinutes > 0 ? 'text-clock' : sessionDuration > 0 ? 'text-fg' : 'text-fg-3'}`}
            >
              {formatTime(sessionDuration)}
            </span>
            {overMinutes > 0 && (
              <span data-overtime className="mt-1 text-xs leading-none text-clock">超時 {overMinutes} 分</span>
            )}
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            title="設定"
            aria-label="設定"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface hover:text-fg"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 pb-6">
        {/* ==================== D1–D5 ==================== */}
        <div role="group" aria-label="訓練日" className="mt-3 grid grid-cols-5 gap-1 rounded-xl bg-hall-2 p-1">
          {[0, 1, 2, 3, 4].map(d => {
            const wKey = getWorkoutForDay(currentWeek, d);
            const workout = WORKOUTS[wKey];
            const typeLabel = (SESSION_TYPE_THEME[workout.type] ?? SESSION_TYPE_THEME.push).label;
            const isActive = currentDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setCurrentDay(d)}
                aria-pressed={isActive}
                className={`flex h-12 flex-col items-center justify-center rounded-lg transition-colors
                ${isActive ? 'bg-ipf text-white' : 'text-fg-2 hover:bg-surface'}`}
              >
                <span className={`font-num text-xl font-semibold leading-none tabular-nums ${isActive ? 'text-white' : 'text-fg'}`}>D{d + 1}</span>
                <span className="mt-1 text-xs leading-none">{wKey} {typeLabel}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-sm text-fg-2">
          <span className="font-medium text-fg">{currentWorkout.name}</span> · {currentWorkout.subtitle}
        </p>

        {/* ==================== 平台看板 ==================== */}
        <section aria-label="平台看板" className="mt-3 rounded-2xl border border-line bg-surface">
          {boardSlot ? (
            <button
              type="button"
              onClick={() => scrollToSet(boardSlot.key)}
              className="block w-full rounded-t-2xl px-4 pb-3 pt-3 text-left"
            >
              <span className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-xl font-bold text-fg">{boardName}</span>
                {prevLamp && (
                  <span className="flex shrink-0 items-center gap-2 text-xs text-fg-2">
                    上一組 <Lamps state={prevLamp} />
                  </span>
                )}
              </span>
              <span className="mt-2 flex items-end gap-5">
                <span className="block shrink-0">
                  <span className="block text-xs text-fg-2">組</span>
                  <span className="block font-num text-44 font-semibold tabular-nums text-fg">
                    {boardSlot.idx + 1}<span className="text-xl text-fg-2">/{boardSlot.entry.sets}</span>
                  </span>
                </span>
                <span className="block min-w-0">
                  <span className="block text-xs text-fg-2">上次 kg × 次</span>
                  <span className={`block whitespace-nowrap font-num font-semibold tabular-nums ${boardLast ? 'text-fg' : 'text-fg-3'} ${boardLast && boardLast.length > 7 ? 'text-28' : 'text-44'}`}>
                    {boardLast ?? '—'}
                  </span>
                </span>
                {boardRest && (
                  <span className="ml-auto block shrink-0 text-right" role="timer">
                    <span className="block text-xs text-fg-2">{boardRest.label} / 目標 {formatMmSs(boardRest.target)}</span>
                    <span className="block font-num text-44 font-semibold tabular-nums text-clock">{formatMmSs(boardRest.elapsed)}</span>
                  </span>
                )}
              </span>
              {boardRest && (
                <span className="mt-3 block h-1 rounded-full bg-surface-hi" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-clock"
                    style={{ width: `${Math.min(100, (boardRest.elapsed / boardRest.target) * 100)}%` }}
                  />
                </span>
              )}
              {boardRest?.over && (
                <span className="mt-2 block text-sm text-clock">超過目標 {formatMmSs(boardRest.elapsed - boardRest.target)}</span>
              )}
              {overMinutes > 0 && (
                <span className="mt-2 block text-sm text-clock">考慮少做 1 組隔離動作</span>
              )}
            </button>
          ) : finished ? (
            <div className="px-4 py-4">
              <p className="text-xl font-bold text-fg">{sessionDuration > 0 ? '今天的課表做完了' : '這天的課表做完了'}</p>
              {sessionDuration > 0 && (
                <p className="mt-1 text-sm text-fg-2">
                  總時長 <span className="font-num text-28 font-semibold tabular-nums text-fg">{formatTime(sessionDuration)}</span>
                </p>
              )}
            </div>
          ) : null}
          <button
            type="button"
            data-open-volume
            onClick={() => setSheet({ kind: 'volume' })}
            aria-haspopup="dialog"
            className={`flex h-12 w-full items-center justify-between px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-hi ${boardSlot || finished ? 'rounded-b-2xl border-t border-line' : 'rounded-2xl'}`}
          >
            本週訓練量
            <ChevronRight size={18} className="text-fg-2" aria-hidden="true" />
          </button>
        </section>

        {/* ==================== 動作清單 ==================== */}
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
                className="mt-2"
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
                    // 輪次順序 A1 → B1 → A2 → B2 …，組數多的一方 tail 組接在後面
                    const pairOrder = [];
                    for (let i = 0; i < Math.max(a.sets, b.sets); i++) {
                      if (i < a.sets) pairOrder.push(`w${currentWeek}-d${currentDay}-${a.exercise.id}-s${i}`);
                      if (i < b.sets) pairOrder.push(`w${currentWeek}-d${currentDay}-${b.exercise.id}-s${i}`);
                    }
                    return (
                      <Draggable key={group.id} draggableId={group.id} index={groupIdx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            data-pair-group
                            className={`my-3 rounded-2xl border border-line ${snapshot.isDragging ? 'bg-surface shadow-2xl' : 'bg-hall'}`}
                          >
                            {/* Pair Header */}
                            <div className="flex h-12 items-center gap-1.5 pr-3">
                              <span
                                {...provided.dragHandleProps}
                                aria-label="拖曳排序：superset"
                                className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-fg-3 hover:text-fg-2 active:cursor-grabbing"
                              >
                                <GripVertical size={18} />
                              </span>
                              <Link size={16} className="shrink-0 text-fg-2" aria-hidden="true" />
                              <p className="min-w-0 text-sm text-fg-2">
                                <span className="font-medium text-fg">Superset</span> · 輪間 {group.rest} 秒 · 切換 {SWITCH_TARGET_SEC} 秒
                              </p>
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
                            <div className="divide-y divide-line px-3">
                              {group.items.map(entry => (
                                <React.Fragment key={entry.exercise.id}>
                                  {renderExerciseInner({
                                    entry,
                                    dragHandleProps: null,
                                    hideInterRest: true,
                                    pairRest,
                                    prevEndTs: null,
                                    pairOrder,
                                  })}
                                </React.Fragment>
                              ))}
                            </div>
                            {/* TMJ footer */}
                            <p className="flex h-10 items-center gap-2 border-t border-line px-4 text-sm text-fg-2">
                              <Wind size={16} aria-hidden="true" />
                              下顎放鬆 · 鼻吸口呼
                            </p>
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
                          className={`border-b border-line ${snapshot.isDragging ? 'rounded-2xl bg-surface px-3 shadow-2xl' : 'bg-hall'}`}
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

        {/* 新增動作 */}
        <button
          type="button"
          onClick={() => setShowAddExercise(true)}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-fg-2 transition-colors hover:bg-surface hover:text-fg"
        >
          <Plus size={18} aria-hidden="true" /> 新增動作
        </button>
      </main>

      {/* ==================== 週次 sheet ==================== */}
      {sheet?.kind === 'week' && (
        <BottomSheet title="週次" onClose={closeSheet}>
          <div className="p-2">
            {[...Array(10)].map((_, i) => {
              const w = i + 1;
              const g = getWeeklyGuidance(w);
              const isCurrent = w === currentWeek;
              return (
                <button
                  key={w}
                  type="button"
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    closeSheet();
                    onSelectWeek?.(w);
                  }}
                  className={`flex h-12 w-full items-center gap-4 rounded-xl px-3 text-left transition-colors ${isCurrent ? 'bg-ipf text-white' : 'text-fg hover:bg-surface'}`}
                >
                  <span className="w-10 font-num text-xl font-semibold tabular-nums">W{w}</span>
                  <span className="flex-1 text-sm">{g.label}</span>
                  <span className={`text-sm ${isCurrent ? 'text-white' : 'text-fg-2'}`}>RIR {g.rir}</span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* ==================== 本週訓練量 sheet ==================== */}
      {sheet?.kind === 'volume' && (
        <BottomSheet title="本週訓練量" onClose={closeSheet} data-volume-sheet>
          <div className="space-y-5 px-4 py-4">
            <ul className="space-y-3">
              {Object.entries(weeklyVolume).map(([muscle, sets]) => {
                if (sets === 0) return null;
                const target = getWeeklyMuscleVolume(muscle, currentWeek);
                const percentage = target > 0 ? Math.min(100, (sets / target) * 100) : 0;
                const shortfall = target > sets ? target - sets : 0;
                return (
                  <li key={muscle}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-fg">{MUSCLE_GROUPS[muscle]}</span>
                      <span className="text-fg-2"><span className="font-num text-base font-semibold tabular-nums text-fg">{sets}</span> / {target} 組{shortfall > 0 && (
                        <span className="ml-1.5 font-medium text-fg">↓{shortfall}</span>
                      )}</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-surface-hi" aria-hidden="true">
                      <div className="h-full rounded-full bg-fg-2" style={{ width: `${percentage}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs leading-relaxed text-fg-2">
              數字是實際 / 規格目標。↓N 是單動作 {MAX_SETS_PER_EXERCISE} 組上限造成的缺額，可以在動作選項的「增加一組」補回。
            </p>

            <section className="rounded-xl bg-surface p-4">
              <h4 className="text-sm font-bold text-fg">{PHASE_CONFIG[phase].label}</h4>
              <p className="mt-1 text-sm leading-relaxed text-fg-2">
                {phase === 'hypertrophy'
                  ? `W1–W4 肌肥大期：肌群週容量從 MEV 遞增到 MRV，複合動作 ${enDash(PHASE_CONFIG.hypertrophy.compound)} 下，隔離動作 ${enDash(PHASE_CONFIG.hypertrophy.isolation)} 下。`
                  : phase === 'strength'
                    ? `W6–W9 肌力期：總組數固定在 MEV，專注重量遞增。複合動作 ${enDash(PHASE_CONFIG.strength.compound)} 下，隔離動作 ${enDash(PHASE_CONFIG.strength.isolation)} 下。`
                    : '減量週：所有肌群組數降到 MEV 的 50%，降低疲勞累積，為下一階段做準備。'}
              </p>
            </section>

            <section>
              <h4 className="text-sm font-bold text-fg">本週循環</h4>
              <div className="mt-2 grid grid-cols-5 gap-1.5 text-center">
                {[0, 1, 2, 3, 4].map(d => {
                  const wKey = getWorkoutForDay(currentWeek, d);
                  const workout = WORKOUTS[wKey];
                  const typeLabel = (SESSION_TYPE_THEME[workout.type] ?? SESSION_TYPE_THEME.push).label;
                  return (
                    <div key={d} className="rounded-lg bg-surface py-2">
                      <p className="font-num text-sm tabular-nums text-fg-2">D{d + 1}</p>
                      <p className="font-num text-xl font-semibold text-fg">{wKey}</p>
                      <p className="text-xs text-fg-2">{typeLabel}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </BottomSheet>
      )}

      {/* ==================== 動作選項 sheet ==================== */}
      {optionsEntry && (() => {
        const ex = optionsEntry.exercise;
        const exName = customExerciseNames[ex.id] || ex.name;
        const setsCount = optionsEntry.sets;
        return (
          <BottomSheet title={exName} onClose={closeSheet}>
            <p className="px-4 pt-3 text-sm text-fg-2">
              這週 <span className="font-num text-base font-semibold tabular-nums text-fg">{setsCount}</span> 組
            </p>
            <div className="p-2">
              <SheetAction
                icon={Repeat}
                title="替換動作"
                onClick={() => {
                  closeSheet();
                  setPickerForExId(ex.id);
                  setPickerSearch('');
                }}
              >
                替換動作
              </SheetAction>
              <SheetAction
                icon={Plus}
                title="增加一組"
                disabled={setsCount >= 10}
                onClick={() => adjustExerciseSets(ex.id, 1, setsCount)}
              >
                增加一組
              </SheetAction>
              <SheetAction
                icon={Minus}
                title="減少一組"
                disabled={setsCount <= 1}
                onClick={() => adjustExerciseSets(ex.id, -1, setsCount)}
              >
                減少一組
              </SheetAction>
              {ex.isCustom && (
                <SheetAction
                  icon={Trash2}
                  title="刪除此動作"
                  onClick={() => removeCustomExercise(ex.id, exName)}
                >
                  刪除此動作
                </SheetAction>
              )}
            </div>
          </BottomSheet>
        );
      })()}

      {/* ==================== 替換動作 sheet ==================== */}
      {pickerForExId && (
        <BottomSheet
          title="替換動作"
          onClose={() => { setPickerForExId(null); setPickerSearch(''); }}
          footer={currentOverrideId && (
            <div className="border-t border-line p-4">
              <button
                type="button"
                onClick={() => resetExerciseOverride(pickerForExId)}
                className="h-12 w-full rounded-xl border border-line text-sm font-medium text-fg transition-colors hover:bg-surface"
              >
                恢復為原動作
              </button>
            </div>
          )}
        >
          <div className="sticky top-0 z-10 border-b border-line bg-hall-2 px-4 py-3">
            <label className="relative block">
              <span className="sr-only">搜尋動作或肌群</span>
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
              <input
                data-autofocus
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="搜尋動作或肌群"
                className="h-12 w-full rounded-xl border border-line bg-surface-hi pl-10 pr-3 text-base text-fg placeholder:text-fg-3"
              />
            </label>
          </div>
          <div className="p-2">
            {filteredLibrary.length === 0 ? (
              <p className="py-6 text-center text-sm text-fg-2">沒有符合的動作</p>
            ) : filteredLibrary.map(item => {
              const isCurrent = currentOverrideId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => applyLibraryToExercise(pickerForExId, item)}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors
                    ${isCurrent ? 'bg-ipf text-white' : 'text-fg hover:bg-surface'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{item.name}</span>
                    <span className={`mt-0.5 block text-xs ${isCurrent ? 'text-white' : 'text-fg-2'}`}>
                      {MUSCLE_GROUPS[item.muscle] ?? '未知'} · {item.type === 'compound' ? '複合' : '隔離'}
                    </span>
                  </span>
                  {isCurrent && <span className="shrink-0 text-xs font-medium">目前</span>}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {/* ==================== 新增動作 sheet ==================== */}
      {showAddExercise && (
        <BottomSheet
          title="新增動作"
          onClose={() => setShowAddExercise(false)}
          footer={(
            <div className="flex gap-3 border-t border-line p-4">
              <button
                type="button"
                onClick={() => setShowAddExercise(false)}
                className="h-12 flex-1 rounded-xl border border-line text-sm font-medium text-fg transition-colors hover:bg-surface"
              >
                取消
              </button>
              <button
                type="button"
                onClick={addCustomExercise}
                disabled={!newEx.name.trim()}
                className="h-12 flex-1 rounded-xl bg-ipf text-sm font-medium text-white transition-colors hover:bg-ipf/90 disabled:cursor-not-allowed disabled:bg-surface-hi disabled:text-fg-3"
              >
                新增
              </button>
            </div>
          )}
        >
          <div className="space-y-5 px-4 py-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-fg-2">動作名稱</span>
              <input
                data-autofocus
                type="text"
                value={newEx.name}
                onChange={(e) => setNewEx(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => {
                  // 注音 / 拼音選字時按 Enter 是確認選字，不是送出（Safari 選字時 keyCode 是 229）
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                  if (e.key === 'Enter') addCustomExercise();
                }}
                placeholder="例如：槓鈴深蹲"
                className="h-12 w-full rounded-xl border border-line bg-surface-hi px-4 text-base text-fg placeholder:text-fg-3"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-fg-2">肌群</span>
              <span className="relative block">
                <select
                  value={newEx.muscle}
                  onChange={(e) => setNewEx(prev => ({ ...prev, muscle: e.target.value }))}
                  className="h-12 w-full appearance-none rounded-xl border border-line bg-surface-hi pl-4 pr-10 text-base text-fg"
                >
                  {Object.entries(MUSCLE_GROUPS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-2" aria-hidden="true" />
              </span>
            </label>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-fg-2">類型</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'compound', label: '複合動作' },
                  { value: 'isolation', label: '隔離動作' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={newEx.type === value}
                    onClick={() => setNewEx(prev => ({ ...prev, type: value }))}
                    className={`h-12 rounded-xl border text-sm font-medium transition-colors
                    ${newEx.type === value
                      ? 'border-ipf bg-ipf text-white'
                      : 'border-line text-fg-2 hover:bg-surface hover:text-fg'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default TrainingView;
