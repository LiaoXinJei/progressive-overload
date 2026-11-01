import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RotateCcw, AlertTriangle, TrendingUp, ShieldCheck, Settings2, Bell,
} from 'lucide-react';
import { useRestNotification, requestNotificationPermission } from './hooks/useRestNotification';
import TrainingView from './components/training/TrainingView';
import NutritionView from './components/nutrition/NutritionView';
import TabNavigation from './components/shared/TabNavigation';
import BottomSheet, { SheetPresence } from './components/shared/BottomSheet';
import ExerciseLibraryManager from './components/settings/ExerciseLibraryManager';
import { DEFAULT_EXERCISE_LIBRARY } from './constants/workouts';
import { buildSessionPlan, getWorkoutForDay, customSetsKey } from './utils/sessionPlan';
import { getRestContext, getLatestDoneSession } from './utils/pairRoundState';

const STORAGE_KEY = 'rp_focus_pro_data';
const SCHEMA_VERSION = 7;
// 讀不了的存檔另存的 key 前綴，後面接時間戳
const CORRUPT_KEY_PREFIX = `${STORAGE_KEY}_corrupt_`;

// v6 → v7 改名前的歷代預設名稱（動作庫從 b0a44d2 起才存進 localStorage）。
// 存檔名稱還是其中之一才換成現在的預設名，使用者自己改過的不動
const V7_OLD_LIBRARY_NAMES = {
  lib_skullcrusher: ['骷髏粉碎機'],
  tri_dips: ['雙槓臂屈伸', '雙槓臂屈伸（身體前傾、胸偏）'],
  lib_weighted_dips: ['負重雙槓臂屈伸'],
  bulgarian_split_db: ['保加利亞分腿蹲（啞鈴垂兩側）'],
  lib_step_up_db: ['啞鈴登階（啞鈴垂兩側）'],
  back_ext_45: ['45° 背伸展（負重於胸前）'],
  leg_press: ['腿推（45°）'],
  rear_fly: ['反向飛鳥（後三角）'],
  rear_delt_machine: ['機械反向飛鳥（後三角）'],
  lib_rear_delt_db_chest: ['胸靠俯身啞鈴飛鳥（後三角）'],
  rear_delt_cable: ['繩索後三角飛鳥'],
  lib_belt_squat: ['Belt squat（首選、若場館可用）'],
  lib_pendulum_squat_noload: ['Pendulum 深蹲（限無肩墊版本）'],
  lib_reverse_hyper: ['Reverse Hyper（若場館可用）'],
  lib_t_bar_row_chest: ['T-Bar 划船（胸靠版）'],
  lib_smith_incline: ['Smith 上斜臥推'],
  lib_smith_flat: ['Smith 平板臥推'],
  lib_smith_seated_press: ['Smith 坐姿肩推'],
  lib_calf_smith_standing: ['Smith 站姿提踵'],
  lib_sissy_squat: ['Sissy squat'],
  lib_nordic_curl: ['Nordic 腿彎舉'],
  lib_calf_donkey: ['Donkey 提踵'],
  lib_glute_ham_raise: ['Glute-Ham Raise'],
  lateral_raise_cable: ['單臂滑輪側平舉'],
  face_pull: ['滑輪面拉'],
  pulldown_narrow: ['窄距下拉'],
  lib_tri_rope_overhead_seated: ['坐姿繩索過頭三頭'],
  chest_supported_row: ['胸靠支撐划船'],
  lateral_raise_lean: ['傾斜側平舉'],
};
// v6 → v7 改 type 的動作，值是舊預設 type
const V7_OLD_LIBRARY_TYPES = {
  back_ext_45: 'compound',
  lib_cable_pullthrough: 'compound',
  seated_row: 'isolation',
};

const hasValue = (v) => v !== undefined && v !== null && v !== '';
// 這組有沒有紀錄：完成、跳過或填過數字
const hasLogContent = (log) => Boolean(log) && (log.done || log.skipped || hasValue(log.weight) || hasValue(log.reps));

// 讀不了的存檔另存一份再照空資料啟動，之後的寫回才不會把它蓋掉。
// 回傳備份的 key（內容一樣的備份已經有就沿用，StrictMode 跑兩次不會存兩份），存不進去回傳 null
const backupCorruptData = (raw) => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CORRUPT_KEY_PREFIX) && localStorage.getItem(key) === raw) return key;
    }
    const key = `${CORRUPT_KEY_PREFIX}${Date.now()}`;
    localStorage.setItem(key, raw);
    return key;
  } catch (e) {
    console.error('備份讀不了的存檔失敗:', e);
    return null;
  }
};

// 畫面狀態（週次、天數、統計面板開關、頁籤）每個視窗各自一份，多視窗同步只同步其他資料
const splitViewState = ({ viewState, activeTab, ...data }) => ({
  data: JSON.stringify(data),
  view: JSON.stringify({ viewState, activeTab }),
});
// storage 字串去掉畫面狀態後的資料部分，讀不了回傳 null
const dataPartOf = (json) => {
  try {
    return splitViewState(JSON.parse(json)).data;
  } catch {
    return null;
  }
};

// 存檔跑完各版遷移，回傳要放進 state 的值。啟動讀檔、別的視窗寫入（storage 事件）共用
const migrateSavedData = (data) => {
  // history 結構遷移：v2 number → v3 { weight, reps }
  const rawHistory = data.history || {};
  let migratedHistory = {};
  Object.entries(rawHistory).forEach(([k, v]) => {
    if (typeof v === 'number') {
      migratedHistory[k] = { weight: v, reps: '' };
    } else if (v && typeof v === 'object') {
      migratedHistory[k] = { weight: v.weight ?? '', reps: v.reps ?? '' };
    }
  });

  let migratedLogs = data.logs || {};
  let migratedCustomSets = data.customSets || {};
  let migratedOverrides = data.exerciseOverrides || {};
  let migratedCustomExercises = data.customExercises || {};
  let migratedExerciseOrder = data.exerciseOrder || {};
  let migratedViewState = data.viewState || {};
  let migratedCustomExerciseNames = data.customExerciseNames || {};

  // v3 → v4 migration：腿部訓練計劃 v3 FINAL 升級
  const needsV4Migration = (data.schemaVersion ?? 3) < 4;
  if (needsV4Migration) {
    const REMOVED_IDS = ['pec_deck', 'ohp', 'fly_cable', 'tri_kickback', 'bb_row', 'leg_curl'];
    const RENAMED_IDS = {
      tri_overhead: 'tri_overhead_seated',
      bp_machine: 'lib_machine_press_flat',
    };

    // 1. history 改名 + 清除
    Object.entries(RENAMED_IDS).forEach(([oldId, newId]) => {
      if (migratedHistory[oldId] !== undefined) {
        migratedHistory[newId] = migratedHistory[oldId];
        delete migratedHistory[oldId];
      }
    });
    REMOVED_IDS.forEach(id => { delete migratedHistory[id]; });

    // 2. logs 改名 + 清除
    const nextLogs = {};
    Object.entries(migratedLogs).forEach(([key, value]) => {
      const match = key.match(/^(w\d+-d\d+-)(.+)(-s\d+)$/);
      if (!match) {
        nextLogs[key] = value;
        return;
      }
      const exId = match[2];
      if (REMOVED_IDS.includes(exId)) return;
      if (RENAMED_IDS[exId]) {
        nextLogs[`${match[1]}${RENAMED_IDS[exId]}${match[3]}`] = value;
        return;
      }
      nextLogs[key] = value;
    });
    migratedLogs = nextLogs;

    // 3. customSets / exerciseOverrides 清除（含改名動作的舊覆寫、依對齊決策一併清掉）
    const purgeOverrideMap = (map) => {
      const next = {};
      Object.entries(map).forEach(([key, value]) => {
        const dashIdx = key.indexOf('-');
        const exId = dashIdx >= 0 ? key.slice(dashIdx + 1) : key;
        if (REMOVED_IDS.includes(exId)) return;
        if (RENAMED_IDS[exId]) return;
        next[key] = value;
      });
      return next;
    };
    migratedCustomSets = purgeOverrideMap(migratedCustomSets);
    migratedOverrides = purgeOverrideMap(migratedOverrides);

    // 4. customExercises 清除
    const nextCustomEx = {};
    Object.entries(migratedCustomExercises).forEach(([wKey, list]) => {
      if (!Array.isArray(list)) return;
      nextCustomEx[wKey] = list.filter(ex =>
        !REMOVED_IDS.includes(ex.id) && !RENAMED_IDS[ex.id]
      );
    });
    migratedCustomExercises = nextCustomEx;

    // 5. exerciseOrder 清除/改名
    const nextOrder = {};
    Object.entries(migratedExerciseOrder).forEach(([wKey, ids]) => {
      if (!Array.isArray(ids)) return;
      nextOrder[wKey] = ids
        .filter(id => !REMOVED_IDS.includes(id))
        .map(id => RENAMED_IDS[id] ?? id);
    });
    migratedExerciseOrder = nextOrder;

    // 6. 使用者改的動作名稱跟著改名的 id 搬（key 是動作 id）
    const nextNames = { ...migratedCustomExerciseNames };
    Object.entries(RENAMED_IDS).forEach(([oldId, newId]) => {
      if (nextNames[oldId] === undefined) return;
      nextNames[newId] = nextNames[oldId];
      delete nextNames[oldId];
    });
    migratedCustomExerciseNames = nextNames;

    // 7. 進度重置：W1、Day 0
    migratedViewState = {
      ...migratedViewState,
      currentWeek: 1,
      currentDay: 0,
    };
  }

  let migratedLibrary = Array.isArray(data.exerciseLibrary) && data.exerciseLibrary.length > 0
    ? data.exerciseLibrary
    : DEFAULT_EXERCISE_LIBRARY;

  // v4 → v5 migration：動作庫與替換設定對齊 v3 FINAL
  // v4 migration 沒動 exerciseLibrary、exerciseOverrides 只按 key 清，
  // 升級上來的使用者還留著 v3 的動作庫，替換設定也可能指向已移除的動作
  const needsV5Migration = (data.schemaVersion ?? 3) < 5;
  if (needsV5Migration) {
    // v3 有、v3 FINAL 拿掉的預設動作（含改名前的舊 id）
    const REMOVED_LIBRARY_IDS = [
      'pec_deck', 'leg_curl', 'ohp', 'fly_cable', 'bp_machine', 'tri_overhead', 'tri_kickback', 'bb_row',
      'lib_db_fly', 'lib_low_cable_fly', 'lib_decline_press', 'lib_t_bar_row', 'lib_chest_supported_row',
      'lib_deadlift', 'lib_arnold_press', 'lib_machine_press', 'lib_rear_delt_db', 'lib_tri_rope_overhead',
      'lib_squat_bb', 'lib_hack_squat', 'lib_leg_press', 'lib_bulgarian_split', 'lib_rdl',
      'lib_seated_leg_curl', 'lib_good_morning',
    ];
    // v3 FINAL 新增的預設動作（v3 就有、被使用者刪掉的不補回）
    const ADDED_LIBRARY_IDS = [
      'calf_standing_a', 'seated_leg_curl_b', 'calf_seated_b', 'machine_press', 'tri_overhead_seated',
      'single_leg_press', 'calf_standing_c', 'chest_supported_row', 'lying_leg_curl_d', 'calf_seated_d',
      'leg_press', 'bulgarian_split_db', 'rdl_db', 'back_ext_45', 'calf_standing_heavy', 'calf_press_legpress',
      'lib_flat_db_press', 'lib_machine_press_flat', 'lib_machine_press_incline', 'lib_smith_incline',
      'lib_smith_flat', 'lib_weighted_dips', 'lib_incline_bb_press', 'lib_t_bar_row_chest', 'lib_machine_row',
      'lib_arnold_press_seated', 'lib_smith_seated_press', 'lib_rear_delt_db_chest',
      'lib_tri_rope_overhead_seated', 'lib_belt_squat', 'lib_pendulum_squat_noload', 'lib_sissy_squat',
      'lib_step_up_db', 'lib_leg_ext_alt', 'lib_nordic_curl', 'lib_cable_pullthrough', 'lib_reverse_hyper',
      'lib_machine_hip_hinge', 'lib_glute_ham_raise', 'lib_calf_donkey', 'lib_calf_single_leg_db',
      'lib_calf_smith_standing', 'lib_calf_seated_alt',
    ];

    // 1. 動作庫：補上新增的、拿掉移除的
    if (migratedLibrary !== DEFAULT_EXERCISE_LIBRARY) {
      const storedById = new Map(migratedLibrary.map(item => [item.id, item]));
      const defaultIds = new Set(DEFAULT_EXERCISE_LIBRARY.map(item => item.id));
      migratedLibrary = [
        // 預設動作照新的順序，使用者改過的版本優先
        ...DEFAULT_EXERCISE_LIBRARY
          .filter(item => storedById.has(item.id) || ADDED_LIBRARY_IDS.includes(item.id))
          .map(item => storedById.get(item.id) ?? item),
        // 使用者自訂動作接在後面
        ...migratedLibrary.filter(item =>
          !defaultIds.has(item.id) && !REMOVED_LIBRARY_IDS.includes(item.id)
        ),
      ];
    }

    // 2. exerciseOverrides：替換成已移除（含改名）動作的設定清掉，同 v4 的對齊決策不保留
    const nextOverrides = {};
    Object.entries(migratedOverrides).forEach(([key, libId]) => {
      if (REMOVED_LIBRARY_IDS.includes(libId)) return;
      nextOverrides[key] = libId;
    });
    migratedOverrides = nextOverrides;
  }

  // v5 → v6 migration：組數覆寫改成分週（key 加週次）
  // 舊 key 分不出是哪一週設定的。那個動作有 log 的週轉成分週 key，保住當時的組數，
  // 不然按過 +1 做完的第 4、5 組會被藏起來；沒 log 的週清掉，組數回到週期演算法的預設
  const needsV6Migration = (data.schemaVersion ?? 3) < 6;
  if (needsV6Migration) {
    const nextCustomSets = {};
    Object.keys(migratedLogs).forEach(logKey => {
      const match = logKey.match(/^w(\d+)-d(\d+)-(.+)-s\d+$/);
      if (!match) return;
      const week = Number(match[1]);
      const oldKey = `${getWorkoutForDay(week, Number(match[2]))}-${match[3]}`;
      if (migratedCustomSets[oldKey] === undefined) return;
      nextCustomSets[`w${week}-${oldKey}`] = migratedCustomSets[oldKey];
    });
    migratedCustomSets = nextCustomSets;

    // 同一版把 lib_skullcrusher 加進 WORKOUTS.C 當內建動作（BUG-02）。之前把 C 日某個動作替換成
    // 骷髏粉碎機的使用者會出現兩個骷髏粉碎機。保留內建那格、拿掉替換：內建動作不能刪，而且它是
    // 第二組 superset 的搭檔；兩格的歷史 key 都是 lib_skullcrusher，上次紀錄不會掉。
    // 被替換的那格回到原動作，它過去週次的 log 會顯示在原動作名下（跟按「恢復原動作」一樣）
    const nextOverrides = {};
    Object.entries(migratedOverrides).forEach(([key, libId]) => {
      if (key.startsWith('C-') && key !== 'C-lib_skullcrusher' && libId === 'lib_skullcrusher') return;
      nextOverrides[key] = libId;
    });
    migratedOverrides = nextOverrides;
  }

  // v6 → v7 migration：動作改名（統一用語、拿掉括號說明，說明改到 EXERCISE_NOTES）、type 修正，
  // 再把 v5 → v6 換預設組數後被藏起來的組補回來
  const needsV7Migration = (data.schemaVersion ?? 3) < 7;
  if (needsV7Migration) {
    // 1. 動作庫：名稱 / type 還是歷代預設值的換成現在的預設。使用者改過的、自訂的不動，刪掉的不補回
    const defaultsById = new Map(DEFAULT_EXERCISE_LIBRARY.map(item => [item.id, item]));
    migratedLibrary = migratedLibrary.map(item => {
      const current = defaultsById.get(item.id);
      if (!current) return item;
      const renamed = V7_OLD_LIBRARY_NAMES[item.id]?.includes(item.name);
      const retyped = V7_OLD_LIBRARY_TYPES[item.id] === item.type;
      if (!renamed && !retyped) return item;
      return {
        ...item,
        ...(renamed && { name: current.name }),
        ...(retyped && { type: current.type }),
      };
    });

    // 2. v6 改了 SESSION_WEIGHTS、C 日多了 lib_skullcrusher，預設組數變少，畫面只畫到計畫組數，
    //    v5 照課表做完的組被藏起來（例如 W1 PUSH B 坐姿過頭三頭做完 4 組，升級後只剩 1 組）。
    //    有 log 的動作，最後一組超過計畫組數就寫那一週的組數覆寫補回來
    const loggedSets = {};
    Object.entries(migratedLogs).forEach(([logKey, log]) => {
      const match = logKey.match(/^(w\d+-d\d+-.+)-s(\d+)$/);
      if (!match || !hasLogContent(log)) return;
      loggedSets[match[1]] = Math.max(loggedSets[match[1]] ?? 0, Number(match[2]) + 1);
    });
    const nextCustomSets = { ...migratedCustomSets };
    for (let week = 1; week <= 10; week++) {
      for (let day = 0; day < 5; day++) {
        const workoutKey = getWorkoutForDay(week, day);
        const plan = buildSessionPlan(week, workoutKey, {
          customExercises: migratedCustomExercises,
          customSets: migratedCustomSets,
          exerciseOverrides: migratedOverrides,
          exerciseLibrary: migratedLibrary,
        });
        plan.forEach(({ exercise, sets }) => {
          const logged = loggedSets[`w${week}-d${day}-${exercise.id}`] ?? 0;
          if (logged > sets) nextCustomSets[customSetsKey(week, workoutKey, exercise.id)] = logged;
        });
      }
    }
    migratedCustomSets = nextCustomSets;
  }

  return {
    logs: migratedLogs,
    history: migratedHistory,
    mode: data.mode || 'maintenance',
    currentWeek: migratedViewState.currentWeek || 1,
    currentDay: migratedViewState.currentDay || 0,
    showStats: migratedViewState.showStats ?? true,
    customExerciseNames: migratedCustomExerciseNames,
    customExercises: migratedCustomExercises,
    customSets: migratedCustomSets,
    exerciseOrder: migratedExerciseOrder,
    exerciseLibrary: migratedLibrary,
    exerciseOverrides: migratedOverrides,
    weightIncrement: data.weightIncrement ?? 2,
    restNotificationDelay: data.restNotificationDelay ?? 90,
    activeTab: data.activeTab || 'training',
    nutritionProfile: data.nutritionProfile || null,
    nutritionLogs: data.nutritionLogs || {},
  };
};

// 重量步長輸入：輸入中的暫時值（清空、0、0.）先留著，>= 0.25 才寫進設定；
// 離開欄位時清掉暫時值，不合法就回到上一個合法值
const WeightIncrementInput = ({ value, onChange }) => {
  // text 是輸入中的字串，value 是它對應的設定值；設定值被別的地方改掉（例如點常用值）就改顯示設定值
  const [draft, setDraft] = useState(null);
  const showDraft = draft !== null && draft.value === value;
  return (
    <input
      type="number"
      min="0.25"
      step="0.25"
      value={showDraft ? draft.text : value}
      onChange={(e) => {
        const text = e.target.value;
        const parsed = parseFloat(text);
        const legal = parsed >= 0.25;
        setDraft({ text, value: legal ? parsed : value });
        if (legal) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
      inputMode="decimal"
      aria-label="重量增減步長（公斤）"
      className="h-12 min-w-0 flex-1 rounded-xl bg-elevated px-4 text-center font-num text-title3 font-semibold tabular-nums text-label"
    />
  );
};

const RPFocusPro = () => {
  // ==================== 狀態管理 ====================
  const [logs, setLogs] = useState({});
  const [history, setHistory] = useState({});
  const [mode, setMode] = useState('maintenance');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentDay, setCurrentDay] = useState(0);
  // 舊統計面板的開關。本週訓練量改成 sheet 之後畫面不再用，存檔結構不動所以照樣讀寫
  const [showStats, setShowStats] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('training');

  // 訓練功能狀態
  const [customExerciseNames, setCustomExerciseNames] = useState({});
  const [customExercises, setCustomExercises] = useState({});
  const [customSets, setCustomSets] = useState({});
  const [exerciseOrder, setExerciseOrder] = useState({});
  const [exerciseLibrary, setExerciseLibrary] = useState(DEFAULT_EXERCISE_LIBRARY);
  const [exerciseOverrides, setExerciseOverrides] = useState({});
  const [weightIncrement, setWeightIncrement] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [restNotificationDelay, setRestNotificationDelay] = useState(90);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // 營養功能狀態
  const [nutritionProfile, setNutritionProfile] = useState(null);
  const [nutritionLogs, setNutritionLogs] = useState({});

  // ==================== 計時器邏輯 ====================

  // 訓練時長由 TrainingView 頂部 bar 顯示（sessionDuration），這裡只負責每秒更新現在時間
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // restContext 依最近一筆 done log + sessionPlan + SUPERSET_PAIRS 推得。
  // 綁最近一筆 done log 所在的週 / 天，不綁畫面：休息中切去看別天 / 別週，背景通知照樣排程。
  // 最近一筆是以前的課表也沒關係，起算點早就過了，useRestNotification 不會排程。
  // 詳見 src/utils/pairRoundState.js#getRestContext。
  const latestDoneSession = useMemo(() => getLatestDoneSession(logs), [logs]);
  const restWeek = latestDoneSession?.week ?? currentWeek;
  const restDay = latestDoneSession?.day ?? currentDay;
  const restWorkoutKey = getWorkoutForDay(restWeek, restDay);
  const restSessionPlan = useMemo(
    () => buildSessionPlan(restWeek, restWorkoutKey, {
      customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary,
    }),
    [restWeek, restWorkoutKey, customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary],
  );
  const restContext = useMemo(
    () => getRestContext({
      logs, currentWeek: restWeek, currentDay: restDay, workoutKey: restWorkoutKey,
      sessionPlan: restSessionPlan, globalDelay: restNotificationDelay,
    }),
    [logs, restWeek, restDay, restWorkoutKey, restSessionPlan, restNotificationDelay],
  );

  useRestNotification({ restContext });

  // 週次 sheet（在 TrainingView）選週：點目前這週不動；換週才回到 D1
  const selectWeek = (w) => {
    if (w === currentWeek) return;
    setCurrentWeek(w);
    setCurrentDay(0);
  };

  const openSettings = () => setShowSettings(true);

  // ==================== 資料持久化 ====================

  // 讀檔成功前不寫回。StrictMode（dev）會把 effect 跑兩次，
  // 不擋的話第一次寫回的初始空狀態會被第二次讀檔讀到，資料被清空。
  // 讀檔失敗時原始字串先另存一份才開始寫回；連備份都存不進去就維持 false，保留原本的 localStorage。
  const [isHydrated, setIsHydrated] = useState(false);
  // 讀檔 / 寫入失敗的提示
  const [storageNotice, setStorageNotice] = useState(null);
  // 寫入失敗只提示一次，成功寫入後才會再提示
  const saveFailedRef = useRef(false);
  // 這個視窗上次寫進（或看到 storage 已經是）的畫面狀態，用來判斷畫面狀態有沒有在這個視窗改過
  const lastViewRef = useRef(null);

  // 資料：啟動讀檔和別的視窗寫入都會套用
  const applySavedData = useCallback((s) => {
    setLogs(s.logs);
    setHistory(s.history);
    setMode(s.mode);
    setCustomExerciseNames(s.customExerciseNames);
    setCustomExercises(s.customExercises);
    setCustomSets(s.customSets);
    setExerciseOrder(s.exerciseOrder);
    setExerciseLibrary(s.exerciseLibrary);
    setExerciseOverrides(s.exerciseOverrides);
    setWeightIncrement(s.weightIncrement);
    setRestNotificationDelay(s.restNotificationDelay);
    setNutritionProfile(s.nutritionProfile);
    setNutritionLogs(s.nutritionLogs);
  }, []);

  // 畫面狀態：只在啟動讀檔時套用，別的視窗寫入時留著這個視窗的
  const applySavedView = useCallback((s) => {
    setCurrentWeek(s.currentWeek);
    setCurrentDay(s.currentDay);
    setShowStats(s.showStats);
    setActiveTab(s.activeTab);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const loaded = migrateSavedData(JSON.parse(saved));
        applySavedData(loaded);
        applySavedView(loaded);
      } catch (e) {
        console.error('載入資料失敗:', e);
        const backupKey = backupCorruptData(saved);
        if (!backupKey) {
          setStorageNotice('讀取存檔失敗，也沒辦法另存備份。為了不蓋掉原本的存檔，這次的變更不會儲存。');
          return;
        }
        setStorageNotice(`讀取存檔失敗，這次從空白資料開始。原本的存檔另外備份在 ${backupKey}，不會被蓋掉。`);
      }
    }
    setIsHydrated(true);
  }, [applySavedData, applySavedView]);

  // 同時開兩個視窗（分頁 + PWA）時，別的視窗寫入就重新載入資料，舊視窗才不會用整份舊狀態蓋掉新資料。
  // 週次、天數、頁籤留在這個視窗；modal 開關不在存檔裡，也不會被關掉
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        applySavedData(migrateSavedData(JSON.parse(e.newValue)));
        setIsHydrated(true);
      } catch (err) {
        console.error('載入別的視窗寫入的資料失敗:', err);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applySavedData]);

  useEffect(() => {
    if (!isHydrated) return;
    const state = {
      schemaVersion: SCHEMA_VERSION,
      logs, history, mode,
      viewState: { currentWeek, currentDay, showStats },
      customExerciseNames, customExercises, customSets, exerciseOrder,
      exerciseLibrary, exerciseOverrides,
      weightIncrement, restNotificationDelay, activeTab,
      nutritionProfile, nutritionLogs
    };
    const json = JSON.stringify(state);
    const { data, view } = splitViewState(state);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // 不寫的情況：跟 storage 現值一樣；或資料跟 storage 一樣、畫面狀態也沒在這個視窗改過
      // （剛從別的視窗同步資料過來）。後者不擋的話，兩個視窗畫面狀態不同時會互相觸發寫入
      if (saved === json || (view === lastViewRef.current && data === dataPartOf(saved))) {
        lastViewRef.current = view;
        return;
      }
      localStorage.setItem(STORAGE_KEY, json);
      lastViewRef.current = view;
      saveFailedRef.current = false;
    } catch (e) {
      console.error('儲存資料失敗:', e);
      if (saveFailedRef.current) return;
      saveFailedRef.current = true;
      setStorageNotice('儲存失敗，瀏覽器的儲存空間可能滿了，剛才的變更沒有存到。');
    }
  }, [isHydrated, logs, history, mode, currentWeek, currentDay, showStats, customExerciseNames, customExercises, customSets, exerciseOrder, exerciseLibrary, exerciseOverrides, weightIncrement, restNotificationDelay, activeTab, nutritionProfile, nutritionLogs]);

  // ==================== 重設 ====================

  const resetData = () => {
    setLogs({});
    setHistory({});
    setCurrentWeek(1);
    setCurrentDay(0);
    setCustomExerciseNames({});
    setCustomExercises({});
    setCustomSets({});
    setExerciseOrder({});
    setExerciseOverrides({});
    setExerciseLibrary(DEFAULT_EXERCISE_LIBRARY);
    // Gemini API Key 是裝置設定、不是訓練資料，重設時保留
    setNutritionProfile(prev => (prev?.geminiApiKey ? { geminiApiKey: prev.geminiApiKey } : null));
    setNutritionLogs({});
    setShowResetConfirm(false);
  };

  // ==================== 渲染 ====================

  // 設定 sheet 裡的小標題、分段按鈕與常用值按鈕
  const settingLabel = 'mb-2 flex items-center gap-2 text-subhead font-semibold text-label';
  const segment = (active) => `flex h-11 items-center justify-center gap-2 rounded-[10px] text-subhead font-medium transition-colors duration-200
    ${active ? 'bg-thumb text-label shadow-[0_3px_8px_rgba(0,0,0,0.35)]' : 'text-label-2'}`;
  const chip = (active) => `h-11 min-w-11 rounded-full px-4 text-subhead font-medium transition-colors duration-200
    ${active ? 'bg-accent/20 text-accent-text' : 'bg-elevated text-label-2'}`;
  const fieldClass = 'h-12 rounded-xl bg-elevated text-label placeholder:text-label-2';

  return (
    // 底部留 tab 列（49px）+ home indicator 的空間，最後一個元素不會被蓋住；休息膠囊的空間由訓練頁自己留
    <div className="min-h-screen bg-canvas pb-[calc(73px+env(safe-area-inset-bottom))] font-sans text-label">

      {/* ==================== Main Content ==================== */}
      {/* 訓練頁的頂部 bar 由 TrainingView 自己畫（週次、計時、設定、大標題） */}
      {activeTab === 'training' ? (
        <TrainingView
          logs={logs} setLogs={setLogs}
          history={history} setHistory={setHistory}
          currentWeek={currentWeek} currentDay={currentDay} setCurrentDay={setCurrentDay}
          customExerciseNames={customExerciseNames} setCustomExerciseNames={setCustomExerciseNames}
          customExercises={customExercises} setCustomExercises={setCustomExercises}
          customSets={customSets} setCustomSets={setCustomSets}
          exerciseOrder={exerciseOrder} setExerciseOrder={setExerciseOrder}
          exerciseLibrary={exerciseLibrary}
          exerciseOverrides={exerciseOverrides} setExerciseOverrides={setExerciseOverrides}
          weightIncrement={weightIncrement}
          currentTime={currentTime}
          restTarget={restNotificationDelay}
          onSelectWeek={selectWeek}
          onOpenSettings={openSettings}
        />
      ) : (
        <>
          <header className="material hairline-b sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
            <div className="mx-auto flex h-14 max-w-[480px] items-center justify-between pl-4 pr-3">
              <h1 className="text-title2 font-bold text-label">營養</h1>
              <button
                type="button"
                onClick={openSettings}
                title="設定"
                aria-label="設定"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated text-label-2 transition-colors duration-200 active:bg-fill"
              >
                <Settings2 size={20} aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-[480px]">
            <NutritionView
              nutritionProfile={nutritionProfile}
              setNutritionProfile={setNutritionProfile}
              nutritionLogs={nutritionLogs}
              setNutritionLogs={setNutritionLogs}
            />
          </div>
        </>
      )}

      {/* ==================== Tab Navigation ==================== */}
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ==================== Reset Alert ==================== */}
      {/* z-[60]：疊在同樣 z-50、DOM 在前面的底部 TabNavigation 上面 */}
      {showResetConfirm && (
        <div className="sheet-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-8">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-desc"
            className="w-full max-w-[320px] overflow-hidden rounded-[20px] bg-elevated text-center text-label shadow-[0_20px_48px_rgba(0,0,0,0.5)]"
          >
            <div className="px-5 pb-4 pt-5">
              <h3 id="reset-title" className="text-body font-semibold">重設所有資料？</h3>
              <p id="reset-desc" className="mt-1.5 text-footnote text-label-2">
                會清掉所有訓練紀錄、營養資料和進度，清掉就救不回來。Gemini API Key 會保留。
              </p>
            </div>
            <div className="hairline-t grid grid-cols-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="h-12 text-body text-accent-text transition-colors active:bg-fill"
              >
                取消
              </button>
              <button
                type="button"
                onClick={resetData}
                className="h-12 border-l-[0.5px] border-white/[0.12] text-body font-semibold text-skip-text transition-colors active:bg-fill"
              >
                確定重設
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Settings Sheet ==================== */}
      <SheetPresence>
        {showSettings && (
          <BottomSheet title="設定" doneLabel="完成" onClose={() => setShowSettings(false)}>
            <div className="px-4 pb-8 pt-2">
              {/* Settings Tabs */}
              <div role="group" aria-label="設定分類" className="mb-6 grid h-[52px] grid-cols-2 gap-1 rounded-[14px] bg-elevated p-1">
                {[['general', '一般'], ['library', '動作庫']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSettingsTab(key)}
                    aria-pressed={settingsTab === key}
                    className={segment(settingsTab === key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {settingsTab === 'library' ? (
                <ExerciseLibraryManager
                  exerciseLibrary={exerciseLibrary}
                  setExerciseLibrary={setExerciseLibrary}
                  exerciseOverrides={exerciseOverrides}
                  setExerciseOverrides={setExerciseOverrides}
                />
              ) : (
              <div className="space-y-8">
              {/* Weight Increment Setting */}
              <section>
                <h4 className={settingLabel}>重量增減步長</h4>
                <div className="flex items-center gap-3">
                  <WeightIncrementInput value={weightIncrement} onChange={setWeightIncrement} />
                  <span className="text-subhead text-label-2">kg</span>
                </div>
                <p className="mt-3 text-footnote text-label-2">按 − / + 時重量變多少。常用值：</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[1, 1.25, 2, 2.5, 5].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setWeightIncrement(val)}
                      aria-pressed={weightIncrement === val}
                      className={`${chip(weightIncrement === val)} font-num tabular-nums`}
                    >
                      {val}kg
                    </button>
                  ))}
                </div>
              </section>

              {/* Rest Notification Setting */}
              <section>
                <h4 className={settingLabel}>
                  <Bell size={16} className="text-label-2" aria-hidden="true" /> 休息計時推播通知
                </h4>
                <p className="mb-3 text-footnote text-label-2">
                  離開 App 後，休息超過設定時間就發通知提醒做下一組。這也是訓練頁組間休息的目標時間。
                  Superset 的輪間休息照配對自己的設定（75 / 90 秒），不受這裡影響。
                </p>

                {/* Permission button */}
                {notifPermission !== 'granted' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await requestNotificationPermission();
                      setNotifPermission(p);
                    }}
                    disabled={notifPermission === 'denied' || notifPermission === 'unsupported'}
                    className="mb-3 h-12 w-full rounded-xl bg-accent/20 text-subhead font-semibold text-accent-text transition-colors duration-200 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-label-2"
                  >
                    {notifPermission === 'denied' ? '通知已被封鎖（請到系統設定解除）'
                      : notifPermission === 'unsupported' ? '這台裝置不支援推播通知'
                      : '啟用推播通知'}
                  </button>
                ) : (
                  <p className="mb-3 flex items-center gap-2 rounded-xl bg-elevated px-4 py-3 text-subhead text-label">
                    <Bell size={14} className="text-accent-text" aria-hidden="true" /> 推播通知已啟用
                  </p>
                )}

                {/* Custom time input */}
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="59"
                    aria-label="休息目標（分）"
                    value={Math.floor(restNotificationDelay / 60)}
                    onChange={(e) => {
                      const mins = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setRestNotificationDelay(mins * 60 + (restNotificationDelay % 60));
                    }}
                    className={`${fieldClass} w-16 text-center font-num text-title3 font-semibold tabular-nums`}
                  />
                  <span className="font-num text-title3 font-semibold text-label-2">:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="59"
                    aria-label="休息目標（秒）"
                    value={String(restNotificationDelay % 60).padStart(2, '0')}
                    onChange={(e) => {
                      const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                      setRestNotificationDelay(Math.floor(restNotificationDelay / 60) * 60 + secs);
                    }}
                    className={`${fieldClass} w-16 text-center font-num text-title3 font-semibold tabular-nums`}
                  />
                  <span className="text-subhead text-label-2">分 : 秒</span>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap items-center gap-2">
                  {[60, 90, 120, 150, 180].map(val => {
                    const label = `${Math.floor(val / 60)}:${String(val % 60).padStart(2, '0')}`;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRestNotificationDelay(val)}
                        aria-pressed={restNotificationDelay === val}
                        className={`${chip(restNotificationDelay === val)} font-num tabular-nums`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 維持 / 增重：目前只存著，不影響課表 */}
              <section>
                <h4 className={settingLabel}>模式</h4>
                <div role="group" aria-label="模式" className="grid h-[52px] grid-cols-2 gap-1 rounded-[14px] bg-elevated p-1">
                  {[
                    { value: 'maintenance', label: '維持模式', icon: ShieldCheck },
                    { value: 'bulking', label: '增重模式', icon: TrendingUp },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      aria-pressed={mode === value}
                      className={segment(mode === value)}
                    >
                      <Icon size={16} aria-hidden="true" /> {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-footnote text-label-2">目前只記錄選擇，不會改變課表。</p>
              </section>

              {/* Gemini API Key Setting */}
              <section>
                <label htmlFor="gemini-key" className={settingLabel}>Gemini API Key</label>
                <input
                  id="gemini-key"
                  type="password"
                  value={nutritionProfile?.geminiApiKey || ''}
                  onChange={(e) => setNutritionProfile(prev => ({
                    ...(prev || {}),
                    geminiApiKey: e.target.value
                  }))}
                  placeholder="輸入 Google Gemini API Key"
                  className={`${fieldClass} w-full px-4 text-body`}
                />
                <p className="mt-2 text-footnote text-label-2">
                  AI 食物照片分析用，可以到 Google AI Studio 申請。
                </p>
              </section>

              {/* 重設資料 */}
              <section>
                <h4 className={settingLabel}>資料</h4>
                <button
                  type="button"
                  onClick={() => { setShowSettings(false); setShowResetConfirm(true); }}
                  title="重設所有資料"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-elevated text-subhead font-semibold text-skip-text transition-colors duration-200 active:bg-fill"
                >
                  <RotateCcw size={16} aria-hidden="true" /> 重設所有資料
                </button>
              </section>
              </div>
              )}
            </div>
          </BottomSheet>
        )}
      </SheetPresence>

      {/* ==================== 讀檔 / 寫入失敗提示 ==================== */}
      {storageNotice && (
        <div
          role="alert"
          className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto flex max-w-md items-start gap-3 rounded-[20px] bg-elevated p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rest" aria-hidden="true" />
          <p className="min-w-0 flex-1 break-words text-subhead text-label">{storageNotice}</p>
          <button
            type="button"
            onClick={() => setStorageNotice(null)}
            className="-my-2 h-11 shrink-0 rounded-full px-3 text-subhead font-semibold text-accent-text transition-colors active:bg-fill"
          >
            知道了
          </button>
        </div>
      )}
    </div>
  );
};

export default RPFocusPro;
