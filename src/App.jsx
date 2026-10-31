import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  RotateCcw, Activity, AlertTriangle, TrendingUp, ShieldCheck,
  Timer, Settings, Bell, BellOff, ChevronUp
} from 'lucide-react';
import { useRestNotification, requestNotificationPermission } from './hooks/useRestNotification';
import TrainingView from './components/training/TrainingView';
import NutritionView from './components/nutrition/NutritionView';
import TabNavigation from './components/shared/TabNavigation';
import ExerciseLibraryManager from './components/settings/ExerciseLibraryManager';
import { DEFAULT_EXERCISE_LIBRARY } from './constants/workouts';
import { buildSessionPlan, getWorkoutForDay, customSetsKey } from './utils/sessionPlan';
import { getRestContext } from './utils/pairRoundState';

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
      className="flex-1 bg-neutral-800 px-4 py-3 rounded-xl text-center font-mono text-lg
      focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
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

  // 回頂部按鈕
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // header 是 sticky，高度隨螢幕寬度與分頁改變；寫進 --app-header-h 給 pair sticky bar 當 top
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
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

  // ==================== 計時器邏輯 ====================

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 取得今日訓練的開始（最早）與結束（最晚）完成時間戳
  const workoutTimes = useMemo(() => {
    const prefix = `w${currentWeek}-d${currentDay}-`;
    const timestamps = Object.entries(logs)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, log]) => log?.completedAt)
      .filter(Boolean);
    if (timestamps.length === 0) return null;
    return { start: Math.min(...timestamps), end: Math.max(...timestamps) };
  }, [logs, currentWeek, currentDay]);

  // restContext 依當日最近一筆 done log + sessionPlan + SUPERSET_PAIRS 推得。
  // 詳見 src/utils/pairRoundState.js#getRestContext。
  const currentWorkoutKey = getWorkoutForDay(currentWeek, currentDay);
  const currentSessionPlan = useMemo(
    () => buildSessionPlan(currentWeek, currentWorkoutKey, {
      customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary,
    }),
    [currentWeek, currentWorkoutKey, customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary],
  );
  const restContext = useMemo(
    () => getRestContext({
      logs, currentWeek, currentDay, workoutKey: currentWorkoutKey,
      sessionPlan: currentSessionPlan, globalDelay: restNotificationDelay,
    }),
    [logs, currentWeek, currentDay, currentWorkoutKey, currentSessionPlan, restNotificationDelay],
  );

  useRestNotification({ restContext });

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== 資料持久化 ====================

  // 讀檔成功前不寫回。StrictMode（dev）會把 effect 跑兩次，
  // 不擋的話第一次寫回的初始空狀態會被第二次讀檔讀到，資料被清空。
  // 讀檔失敗時原始字串先另存一份才開始寫回；連備份都存不進去就維持 false，保留原本的 localStorage。
  const [isHydrated, setIsHydrated] = useState(false);
  // 讀檔 / 寫入失敗的提示
  const [storageNotice, setStorageNotice] = useState(null);
  // 寫入失敗只提示一次，成功寫入後才會再提示
  const saveFailedRef = useRef(false);

  const applySavedState = useCallback((s) => {
    setLogs(s.logs);
    setHistory(s.history);
    setMode(s.mode);
    setCurrentWeek(s.currentWeek);
    setCurrentDay(s.currentDay);
    setShowStats(s.showStats);
    setCustomExerciseNames(s.customExerciseNames);
    setCustomExercises(s.customExercises);
    setCustomSets(s.customSets);
    setExerciseOrder(s.exerciseOrder);
    setExerciseLibrary(s.exerciseLibrary);
    setExerciseOverrides(s.exerciseOverrides);
    setWeightIncrement(s.weightIncrement);
    setRestNotificationDelay(s.restNotificationDelay);
    setActiveTab(s.activeTab);
    setNutritionProfile(s.nutritionProfile);
    setNutritionLogs(s.nutritionLogs);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        applySavedState(migrateSavedData(JSON.parse(saved)));
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
  }, [applySavedState]);

  // 同時開兩個視窗（分頁 + PWA）時，別的視窗寫入就重新載入，舊視窗才不會用整份舊狀態蓋掉新資料
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        applySavedState(migrateSavedData(JSON.parse(e.newValue)));
        setIsHydrated(true);
      } catch (err) {
        console.error('載入別的視窗寫入的資料失敗:', err);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applySavedState]);

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
    try {
      // 跟 storage 現值一樣就不寫：剛從別的視窗載入的狀態不用再寫回去，兩個視窗不會互相觸發寫入
      if (localStorage.getItem(STORAGE_KEY) === json) return;
      localStorage.setItem(STORAGE_KEY, json);
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans pb-20">

      {/* ==================== Header ==================== */}
      <header ref={headerRef} className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">

            {/* Logo */}
            <h1 className="text-xl font-black italic tracking-tighter text-white flex items-center gap-2">
              <Activity className="text-emerald-500" /> RP FOCUS PRO
            </h1>

            {/* Mode Switcher - only show on training tab */}
            {activeTab === 'training' && (
              <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700 w-full md:w-auto">
                <button
                  onClick={() => setMode('maintenance')}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2
                  ${mode === 'maintenance' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  <ShieldCheck size={14} /> 維持模式
                </button>
                <button
                  onClick={() => setMode('bulking')}
                  className={`flex-1 md:flex-none px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2
                  ${mode === 'bulking' ? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  <TrendingUp size={14} /> 增重模式
                </button>
              </div>
            )}

            {/* Timer & Controls */}
            <div className="flex items-center gap-3">
              {activeTab === 'training' && workoutTimes && (
                <div className="flex items-center gap-2 bg-neutral-800 px-4 py-2 rounded-full border border-neutral-700">
                  <Timer size={16} className="text-emerald-500" />
                  <span className="font-mono text-sm min-w-[60px] text-center">
                    {formatTime(Math.floor((workoutTimes.end - workoutTimes.start) / 1000))}
                  </span>
                </div>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="text-neutral-600 hover:text-neutral-300 transition-colors"
                title="設定"
              >
                <Settings size={18} />
              </button>

              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-neutral-600 hover:text-red-500 transition-colors"
                title="重設所有資料"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {/* Week Tabs - only show on training tab */}
          {activeTab === 'training' && (
            <div className="flex space-x-2 overflow-x-auto py-4 no-scrollbar">
              {[...Array(10)].map((_, i) => {
                const w = i + 1;
                const isCurrent = currentWeek === w;
                const isDeload = w === 5 || w === 10;
                return (
                  <button
                    key={w}
                    onClick={() => {
                      // 點目前這週不動；換週才回到 D1
                      if (w === currentWeek) return;
                      setCurrentWeek(w);
                      setCurrentDay(0);
                    }}
                    className={`flex-shrink-0 w-12 h-10 rounded-lg text-xs font-bold transition-all border
                    ${isCurrent
                      ? 'bg-white text-black border-white scale-110 shadow-lg'
                      : isDeload
                      ? 'bg-amber-900 text-amber-400 border-amber-700 hover:border-amber-500'
                      : 'bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-500'}`}
                  >
                    W{w}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ==================== Main Content ==================== */}
      {activeTab === 'training' ? (
        <TrainingView
          logs={logs} setLogs={setLogs}
          history={history} setHistory={setHistory}
          mode={mode}
          currentWeek={currentWeek} currentDay={currentDay} setCurrentDay={setCurrentDay}
          showStats={showStats} setShowStats={setShowStats}
          customExerciseNames={customExerciseNames} setCustomExerciseNames={setCustomExerciseNames}
          customExercises={customExercises} setCustomExercises={setCustomExercises}
          customSets={customSets} setCustomSets={setCustomSets}
          exerciseOrder={exerciseOrder} setExerciseOrder={setExerciseOrder}
          exerciseLibrary={exerciseLibrary}
          exerciseOverrides={exerciseOverrides} setExerciseOverrides={setExerciseOverrides}
          weightIncrement={weightIncrement}
          currentTime={currentTime}
        />
      ) : (
        <NutritionView
          nutritionProfile={nutritionProfile}
          setNutritionProfile={setNutritionProfile}
          nutritionLogs={nutritionLogs}
          setNutritionLogs={setNutritionLogs}
        />
      )}

      {/* ==================== Tab Navigation ==================== */}
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ==================== Reset Modal ==================== */}
      {/* z-[60]：疊在同樣 z-50、DOM 在前面的底部 TabNavigation 上面 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black text-white mb-4 italic uppercase">重設所有資料？</h3>
            <p className="text-neutral-500 mb-8 text-sm font-medium">
              這將清除所有訓練記錄、營養資料和進度。此操作無法復原。
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-4 rounded-2xl bg-neutral-800 text-white font-black uppercase tracking-widest text-xs hover:bg-neutral-700 transition-all"
              >
                取消
              </button>
              <button
                onClick={resetData}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-red-500 transition-all shadow-lg shadow-red-900/50"
              >
                確定重設
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Scroll To Top Button ==================== */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 flex items-center justify-center hover:bg-emerald-500 active:scale-95 transition-all"
          aria-label="回到頂部"
        >
          <ChevronUp size={22} />
        </button>
      )}

      {/* ==================== Settings Modal ==================== */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-md w-full shadow-2xl overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
                <Settings size={24} className="text-emerald-500" /> 設定
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-neutral-600 hover:text-neutral-300 transition-colors text-2xl"
              >
                &times;
              </button>
            </div>

            {/* Settings Tabs */}
            <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700 mb-6">
              <button
                onClick={() => setSettingsTab('general')}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all
                ${settingsTab === 'general' ? 'bg-emerald-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                一般
              </button>
              <button
                onClick={() => setSettingsTab('library')}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all
                ${settingsTab === 'library' ? 'bg-emerald-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                動作庫
              </button>
            </div>

            {settingsTab === 'library' ? (
              <ExerciseLibraryManager
                exerciseLibrary={exerciseLibrary}
                setExerciseLibrary={setExerciseLibrary}
              />
            ) : (
            <>
            {/* Weight Increment Setting */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-neutral-300 mb-3">
                重量增減步長
              </label>
              <div className="flex items-center gap-3">
                <WeightIncrementInput value={weightIncrement} onChange={setWeightIncrement} />
                <span className="text-neutral-500 text-sm">kg</span>
              </div>
              <p className="text-neutral-500 text-xs mt-3 leading-relaxed">
                點擊 +/- 按鈕時的重量變化量。常用值：<br />
                <span className="inline-flex gap-2 mt-2 flex-wrap">
                  {[1, 1.25, 2, 2.5, 5].map(val => (
                    <button
                      key={val}
                      onClick={() => setWeightIncrement(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all
                      ${weightIncrement === val
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                    >
                      {val}kg
                    </button>
                  ))}
                </span>
              </p>
            </div>

            {/* Rest Notification Setting */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-neutral-300 mb-3 flex items-center gap-2">
                <Bell size={14} className="text-emerald-500" /> 休息計時推播通知
              </label>
              <p className="text-neutral-500 text-xs mb-3 leading-relaxed">
                離開 App 後，超過設定時間即發送通知提醒做下一組。<br/>
                <span className="text-neutral-600">
                  Superset 配對的輪間休息採配對自身設定（75 / 90 秒）、不受此處影響。
                </span>
              </p>

              {/* Permission button */}
              {notifPermission !== 'granted' ? (
                <button
                  onClick={async () => {
                    const p = await requestNotificationPermission();
                    setNotifPermission(p);
                  }}
                  disabled={notifPermission === 'denied' || notifPermission === 'unsupported'}
                  className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest mb-3 transition-all
                  ${notifPermission === 'denied' || notifPermission === 'unsupported'
                    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
                >
                  {notifPermission === 'denied' ? '通知已被封鎖（請至系統設定解除）'
                    : notifPermission === 'unsupported' ? '此裝置不支援推播通知'
                    : '啟用推播通知'}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-400 mb-3 bg-emerald-900/30 px-4 py-2 rounded-xl border border-emerald-800">
                  <Bell size={12} /> 推播通知已啟用
                </div>
              )}

              {/* Custom time input */}
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={Math.floor(restNotificationDelay / 60)}
                  onChange={(e) => {
                    const mins = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                    setRestNotificationDelay(mins * 60 + (restNotificationDelay % 60));
                  }}
                  className="w-16 bg-neutral-800 px-3 py-3 rounded-xl text-center font-mono text-lg
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
                />
                <span className="text-neutral-500 font-bold text-lg">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={String(restNotificationDelay % 60).padStart(2, '0')}
                  onChange={(e) => {
                    const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                    setRestNotificationDelay(Math.floor(restNotificationDelay / 60) * 60 + secs);
                  }}
                  className="w-16 bg-neutral-800 px-3 py-3 rounded-xl text-center font-mono text-lg
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
                />
                <span className="text-neutral-500 text-sm">min : sec</span>
              </div>

              {/* Quick presets */}
              <div className="flex items-center gap-2 flex-wrap">
                {[60, 90, 120, 150, 180].map(val => {
                  const label = `${Math.floor(val / 60)}:${String(val % 60).padStart(2, '0')}`;
                  return (
                    <button
                      key={val}
                      onClick={() => setRestNotificationDelay(val)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all
                      ${restNotificationDelay === val
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gemini API Key Setting */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-neutral-300 mb-3">
                Gemini API Key
              </label>
              <input
                type="password"
                value={nutritionProfile?.geminiApiKey || ''}
                onChange={(e) => setNutritionProfile(prev => ({
                  ...(prev || {}),
                  geminiApiKey: e.target.value
                }))}
                placeholder="輸入 Google Gemini API Key"
                className="w-full bg-neutral-800 px-4 py-3 rounded-xl font-mono text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
              />
              <p className="text-neutral-500 text-xs mt-2">
                用於 AI 食物照片分析功能。可從 Google AI Studio 取得。
              </p>
            </div>

            </>
            )}

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50 mt-4"
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* ==================== 讀檔 / 寫入失敗提示 ==================== */}
      {storageNotice && (
        <div
          role="alert"
          className="fixed top-4 inset-x-4 z-[70] mx-auto max-w-md bg-amber-950 border border-amber-700 rounded-2xl shadow-2xl p-4 flex items-start gap-3"
        >
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="flex-1 min-w-0 text-sm text-amber-100 leading-relaxed break-words">{storageNotice}</p>
          <button
            onClick={() => setStorageNotice(null)}
            className="shrink-0 text-xs font-bold text-amber-300 hover:text-amber-100 transition-colors"
          >
            知道了
          </button>
        </div>
      )}
    </div>
  );
};

export default RPFocusPro;
