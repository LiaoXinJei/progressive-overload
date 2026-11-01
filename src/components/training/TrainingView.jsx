import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  AlertTriangle, ArrowUpDown, BellRing, Check, ChevronDown, ChevronRight, GripVertical, Link, Minus, MoreHorizontal, Plus,
  Repeat, Search, Settings2, Timer, Trash2, Undo2, Wind,
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
import BottomSheet, { SheetPresence } from '../shared/BottomSheet';
import Presence, { canAnimate, prefersReducedMotion } from '../shared/Presence';
import {
  userInput, trackUserInput, isUserScrollingWithin, smoothScrollTo,
} from '../../utils/userInput';
import GymScene from './gym/GymScene';
import { stationOf } from './gym/stations';


const LOWER_MUSCLES = new Set(['QUADS', 'HAMS', 'CALVES']);
// 健身房模式：點器材開始後這段時間內的第二下不算完成（防連點）
const GYM_DOUBLE_TAP_MS = 1000;

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

// 休息膠囊只顯示這段時間內開始的休息（不綁日曆日，跨午夜照樣顯示）
const REST_PILL_WINDOW_MS = 3 * 60 * 60 * 1000;

// SSR（superset 結構測試用 renderToStaticMarkup）沒有 layout effect
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// 浮卡從舊的目前這組滑到新的目前這組（FLIP 的位移曲線與長度）
const HIGHLIGHT_MOVE = 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1), height 300ms cubic-bezier(0.32, 0.72, 0, 1), width 300ms cubic-bezier(0.32, 0.72, 0, 1)';

// 階段的短名稱與顏色（週次膠囊、RIR 徽章、週次 sheet、本週訓練量）
const PHASE_STYLE = {
  hypertrophy: { short: '肌肥大', text: 'text-phase-hypertrophy', dot: 'bg-phase-hypertrophy', chip: 'bg-phase-hypertrophy/[0.16] text-phase-hypertrophy' },
  strength: { short: '肌力', text: 'text-phase-strength', dot: 'bg-phase-strength', chip: 'bg-phase-strength/[0.16] text-phase-strength' },
  deload: { short: '減量', text: 'text-phase-deload', dot: 'bg-phase-deload', chip: 'bg-phase-deload/[0.16] text-phase-deload' },
};

// session 類型（推 / 拉 / 腿）的文字與圓點（只用在 D1–D5、本週循環）
const sessionThemeOf = (type) => SESSION_TYPE_THEME[type] ?? SESSION_TYPE_THEME.push;

// 休息膠囊、目前這組的退場長度
const PILL_EXIT_MS = 260;

// 休息顯示：組與組之間一行置中的字，兩側各一條 hairline。還在休息用琥珀色，已結束用第三層色。
// 超過目標（overText）時線變實、後面加「· 超過 1:00」（紅色只給跳過，這裡維持琥珀）。
// data-rest / data-rest-label 給測試找，label 文字是「休息中 1:24」「休息 1:52」「動作間休息 2:00」
const RestLine = ({ kind, label, time, overText = null, className = '' }) => {
  const live = kind.endsWith('live');
  const line = `h-[0.5px] min-w-4 flex-1 ${live ? (overText ? 'bg-rest' : 'bg-rest/40') : 'bg-separator'}`;
  return (
    <div data-rest={kind} data-over={overText ? '' : undefined} role={live ? 'timer' : undefined} className={`flex h-7 items-center gap-2.5 px-2 ${className}`}>
      <span className={line} aria-hidden="true" />
      <span className={`whitespace-nowrap text-footnote ${live ? 'font-semibold text-rest' : 'text-label-3'}`}>
        <span data-rest-label>{label} <span className="font-num tabular-nums">{time}</span></span>
        {overText && <span className="font-num tabular-nums"> · 超過 {overText}</span>}
      </span>
      <span className={line} aria-hidden="true" />
    </div>
  );
};

// superset 輪次圓點：上排 A、下排 B。完成綠、跳過紅、待做外框
const RoundDots = ({ rounds }) => (
  <div className="flex flex-col gap-1" aria-hidden="true">
    {['a', 'b'].map(side => (
      <div key={side} className="flex gap-1">
        {rounds.map(r => {
          const log = side === 'a' ? r.aLog : r.bLog;
          const tone = log?.skipped ? 'bg-skip' : log?.done ? 'bg-done' : 'ring-[1.5px] ring-inset ring-label-3';
          return <span key={r.idx} className={`h-2 w-2 rounded-full transition-colors duration-200 ${tone}`} />;
        })}
      </div>
    ))}
  </div>
);

// superset 狀態條：黏在頂部 bar 下方的半透明材質條（輪次圓點 + 切換 / 輪間休息計時）
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
      <span className="text-subhead text-label-2">
        準備開始 R{currentRoundIdx + 1}
      </span>
    );
  } else if (state === 'mid-round') {
    const elapsed = midRoundAnchorTs != null
      ? Math.floor((currentTime - midRoundAnchorTs) / 1000)
      : 0;
    mainNode = (
      <span className="text-subhead font-semibold text-rest">
        切換中 <span className="font-num tabular-nums">{formatMmSs(elapsed)}</span>
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
      <span className="text-subhead font-semibold text-rest">
        輪間休息 <span className="font-num tabular-nums">{formatMmSs(elapsed)}</span>
        {' '}
        <span className={`text-footnote font-normal ${over ? 'text-rest' : 'text-label-2'}`}>
          {over ? `超過 ${formatMmSs(elapsed - targetSec)}` : `/ ${formatMmSs(targetSec)}`}
        </span>
      </span>
    );
  } else if (state === 'done' && tailProgress.settled < tailProgress.total) {
    // 核心輪做完、還有 tail 組（休息顯示在 tail 前的 set 列）
    mainNode = (
      <span className="text-subhead text-label-2">
        {rounds.length} 輪完成 · 尾組 {tailProgress.settled}/{tailProgress.total}
      </span>
    );
  } else if (state === 'done') {
    mainNode = (
      <span className="inline-flex items-center gap-1 text-subhead text-label-2">
        <Check size={16} strokeWidth={3} className="text-done" aria-hidden="true" />完成 · {rounds.length} 輪
      </span>
    );
  }

  // enter-pair 提示：僅 idle 時、且前一動作完成 timestamp 存在
  const showEnterPair = state === 'idle' && enterPairFromTs != null;
  const enterPairElapsed = showEnterPair
    ? Math.floor((currentTime - enterPairFromTs) / 1000)
    : 0;

  return (
    // 黏在訓練頁頂部 bar 下方；--app-header-h 由 TrainingView 量測頂部 bar 高度寫入。
    // 外層透明、留 8px 上緣，黏住時看起來是浮在頂部 bar 下面的一條
    <div className="sticky z-30 px-2 pt-2" style={{ top: 'var(--app-header-h, 0px)' }}>
      <div className="material-elevated rounded-[14px] px-3 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.35)]">
        {showEnterPair && (
          <div className="mb-1.5 text-footnote tabular-nums text-label-2">
            {enterPairLabel}完成 {formatMmSs(enterPairElapsed)} 前 · 進入 superset
          </div>
        )}
        <div className="flex min-h-8 items-center justify-between gap-3">
          <RoundDots rounds={rounds} />
          <div className="min-w-0 text-right">{mainNode}</div>
        </div>
        {progress !== null && (
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-rest/20" aria-hidden="true">
            <div className="h-full rounded-full bg-rest transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </div>
  );
};

// 動作選項 sheet 裡的一列
const SheetAction = ({ icon: Icon, destructive = false, children, ...props }) => (
  <button
    type="button"
    className={`flex h-[52px] w-full items-center gap-3 px-4 text-left text-body transition-colors duration-150 active:bg-fill disabled:cursor-not-allowed disabled:text-label-3 disabled:active:bg-transparent
      ${destructive ? 'text-skip-text' : 'text-label'}`}
    {...props}
  >
    <Icon size={20} className={`shrink-0 ${destructive ? 'text-skip-text' : 'text-accent-text'}`} aria-hidden="true" />
    {children}
  </button>
);

// 休息膠囊：休息中時浮在 tab bar 上方，點了把目前這組捲到畫面中間。
// 時間格式跟休息線同一個（formatTime，超過一小時是 1:06:00）。
// 超過目標（overText）：標籤改「該做下一組了」、大字顯示超出多少、進度條滿格、膠囊加淡琥珀底、圖示換成鈴。
// 窄螢幕：標籤和「第 N 組」永遠完整；放不下時先拿掉右邊的小字（已休 … / 目標），再截動作名
const RestPill = ({ label, elapsedText, targetText, overText = null, pct, nextName, nextSetNo, onClick, exiting = false }) => {
  const over = Boolean(overText);
  const bigText = over ? `+${overText}` : elapsedText;
  const title = over ? '該做下一組了' : label;
  // 超過目標時標籤已經寫「該做下一組了」，第二行不再重複「下一組：」
  const namePart = over ? nextName : `下一組：${nextName}`;
  const setPart = `第 ${nextSetNo} 組`;
  const extraText = over ? `已休 ${elapsedText}` : `/ ${targetText}`;

  const midRef = useRef(null);
  const titleRef = useRef(null);
  const setRef = useRef(null);
  const extraRef = useRef(null);
  const extraWidthRef = useRef(0);
  const [tight, setTight] = useState(false);
  // 量中間欄放不放得下標籤 +「第 N 組」+ 至少兩個字的動作名；放不下就收右邊的小字，空間回來再放回去
  useIsomorphicLayoutEffect(() => {
    const mid = midRef.current;
    // jsdom 沒有版面（寬度都是 0），不判斷
    if (!mid?.clientWidth || !titleRef.current || !setRef.current) return;
    const need = Math.max(titleRef.current.scrollWidth, setRef.current.offsetWidth + 28);
    if (!tight) {
      if (extraRef.current) extraWidthRef.current = extraRef.current.offsetWidth + 4;
      if (mid.clientWidth < need) setTight(true);
    } else if (mid.clientWidth - extraWidthRef.current >= need + 8) {
      setTight(false);
    }
  });

  return (
    <button
      type="button"
      data-rest-pill
      data-over={over ? '' : undefined}
      onClick={exiting ? undefined : onClick}
      aria-label={over
        ? `該做下一組了，已休息 ${elapsedText}，超過目標 ${overText}。下一組：${nextName} ${setPart}。捲到這組`
        : `${label} ${elapsedText}，目標 ${targetText}。下一組：${nextName} ${setPart}。捲到這組`}
      className={`material-elevated fixed inset-x-3 bottom-[calc(57px+env(safe-area-inset-bottom))] z-[45] mx-auto flex h-[60px] max-w-[456px] items-center gap-3 overflow-hidden rounded-[30px] border-[0.5px] pl-2.5 pr-[18px] text-left shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition-colors duration-300
        ${over ? 'border-rest/40' : 'border-white/[0.12]'}
        ${exiting ? 'pill-out pointer-events-none' : 'pill-in'}`}
    >
      {/* 超過目標的淡琥珀底 */}
      <span className={`absolute inset-0 bg-rest/[0.14] transition-opacity duration-300 ${over ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rest ${over ? 'bg-rest/30' : 'bg-rest/20'}`} aria-hidden="true">
        {over ? <BellRing size={20} /> : <Timer size={20} />}
      </span>
      <span ref={midRef} className="relative min-w-0 flex-1" aria-hidden="true">
        <span ref={titleRef} data-pill-title className="block whitespace-nowrap text-subhead font-semibold text-label">{title}</span>
        <span className="flex min-w-0 whitespace-nowrap text-footnote text-label-2">
          <span data-pill-name className="truncate">{namePart}</span>
          <span ref={setRef} data-pill-set className="shrink-0">&nbsp;{setPart}</span>
        </span>
      </span>
      <span className="relative shrink-0 whitespace-nowrap" aria-hidden="true">
        <span className={`font-num font-semibold tabular-nums text-rest ${bigText.length > 5 ? 'text-title3' : 'text-[24px] leading-7'}`}>{bigText}</span>
        {!tight && (
          <span ref={extraRef} data-pill-extra className="ml-1 font-num text-footnote tabular-nums text-label-2">{extraText}</span>
        )}
      </span>
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-rest/20" aria-hidden="true">
        <span className="block h-full bg-rest transition-[width] duration-1000 ease-linear" style={{ width: `${over ? 100 : pct}%` }} />
      </span>
    </button>
  );
};

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
  gymMode = false,
}) => {
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [newEx, setNewEx] = useState({ name: '', muscle: 'CHEST', type: 'isolation' });
  const [pickerForExId, setPickerForExId] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');
  // 開著的 sheet：{ kind: 'week' | 'volume' } 或 { kind: 'options', exId }
  const [sheet, setSheet] = useState(null);
  // 使用者最後聚焦過輸入框的那一組（log key），決定浮卡（目前這組）在哪一組
  const [focusedKey, setFocusedKey] = useState(null);
  // 剛按 ✓ 完成的那一組（log key），它的勾勾圓鈕播彈一下的動畫。
  // 讀檔、換天時已經是完成的組不播（App 先畫空資料再讀檔，用狀態變化判斷會每次開 App 都播）
  const [litKey, setLitKey] = useState(null);
  // 大標題捲到頂部 bar 底下：scrolled = 開始被蓋住（bar 變材質），collapsed = 完全看不到（bar 中間淡入小標題）
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  // 頂部 bar 中間的小標題放不下（例如 320 寬又超時、計時膠囊變兩行）就不顯示，不要截成「PU…」
  const smallTitleRef = useRef(null);
  const [smallTitleFits, setSmallTitleFits] = useState(true);
  const measureSmallTitle = () => {
    const el = smallTitleRef.current;
    if (!el || (!el.clientWidth && !el.scrollWidth)) return; // jsdom 沒有版面
    setSmallTitleFits(el.scrollWidth <= el.clientWidth + 1);
  };
  useIsomorphicLayoutEffect(measureSmallTitle);
  // 視窗變寬變窄時不一定會重新 render（時間暫停時），寬度變了就重新量
  useEffect(() => {
    const el = smallTitleRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measureSmallTitle);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 按 ✓、Enter 跳格後，新的目前這組如果在畫面外（或被休息膠囊蓋住）就捲進來
  const revealNextRef = useRef(false);
  // 打開動作選項的那顆「⋯」：選項 sheet、從它開的替換動作 sheet 關掉後焦點回到這裡
  const optionsTriggerRef = useRef(null);
  // 浮卡（目前這組的浮起層）：絕對定位在 main 裡，換組時從舊列滑到新列
  const mainRef = useRef(null);
  const highlightRef = useRef(null);
  const highlightPosRef = useRef(null);

  // 排序模式（iOS 的「編輯排序」）：動作卡收成精簡列、右側出現把手，頂部 bar 的設定鈕換成「完成」
  const [reorderMode, setReorderMode] = useState(false);
  // 進排序模式前的捲動位置、從哪個動作的「⋯」進來（離開時捲回去、焦點回到那個「⋯」）
  const reorderReturnRef = useRef(null);
  const reorderDoneRef = useRef(null);
  const addExerciseRef = useRef(null);
  // 從選項 sheet 刪除自訂動作：刪掉之後焦點移到下一個動作的「⋯」（沒有就「新增動作」）
  const deleteFocusRef = useRef(null);

  // 健身房模式：使用者自己選的站（動作 id）和選的當下「目前這組」是哪一組。
  // 目前這組變了（完成、跳過、聚焦、換天換週）就改跟著目前這組，見下面 gymIndex
  const [gymPick, setGymPick] = useState(null);
  // 點器材開始的那一組（人物在做動作），再點一下完成
  const [liftingKey, setLiftingKey] = useState(null);
  const liftStartRef = useRef(0);
  // 沒填次數就按完成時的提示（哪一組）
  const [gymNeedReps, setGymNeedReps] = useState(null);
  // 剛新增的自訂動作：出現在清單後選它那一站
  const pendingGymExRef = useRef(null);
  // 選中的動作卡換了：浮卡不從已經卸載的卡片滑過來
  const gymGroupRef = useRef(null);

  // 改已完成的組時，手指 / 滑鼠按下當下焦點就在那一組：放開前它維持目前這組
  // （不然按別組的 ✓ 時這組先收起來，列變矮，按到一半的按鈕會跑掉、點不到）。
  // 按下時焦點不在那一組（例如先點空白處收掉了、之後再按住畫面捲動），就不豁免
  const pressFocusKeyRef = useRef(null);
  // 焦點在按著的時候離開了已完成的組：放開（click 跑完）之後再把它從目前這組拿掉
  const blurPendingKeyRef = useRef(null);
  useEffect(() => {
    trackUserInput();
    let timer = null;
    const rowKeyOf = (el) => el?.closest?.('[data-set-row]')?.querySelector('[data-weight-input]')?.dataset.logKey ?? null;
    const release = () => {
      clearTimeout(timer);
      timer = null;
      const pending = blurPendingKeyRef.current;
      pressFocusKeyRef.current = null;
      blurPendingKeyRef.current = null;
      if (pending && rowKeyOf(document.activeElement) !== pending) {
        setFocusedKey(k => (k === pending ? null : k));
      }
    };
    const down = () => { pressFocusKeyRef.current = rowKeyOf(document.activeElement); };
    // click 在 pointerup 之後才派發（iOS 還隔一個 task），等 click 跑完；沒有 click（捲動）就等 400ms
    const up = () => { clearTimeout(timer); timer = setTimeout(release, 400); };
    const click = () => { setTimeout(release, 0); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('click', click, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
      document.removeEventListener('click', click, true);
    };
  }, []);

  // 換天、換週：剛按 ✓ 的彈一下不要在換回來時重播
  useEffect(() => {
    setLitKey(null);
  }, [currentDay, currentWeek]);

  // 頂部 bar 是唯一的 sticky header，高度（含 safe area）寫進 --app-header-h 給 superset 的 sticky bar 當 top
  const barRef = useRef(null);
  const titleRef = useRef(null);
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

  useEffect(() => {
    const title = titleRef.current;
    if (!title || typeof IntersectionObserver === 'undefined') return undefined;
    const barHeight = barRef.current?.offsetHeight ?? 0;
    const io = new IntersectionObserver(([entry]) => {
      setScrolled(entry.intersectionRatio < 0.95);
      setCollapsed(!entry.isIntersecting);
    }, { rootMargin: `-${barHeight}px 0px 0px 0px`, threshold: [0, 0.95] });
    io.observe(title);
    return () => io.disconnect();
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

  // ✓ 和健身房模式的「再點一下」共用：完成 / 取消完成這組，加上彈一下、震動、浮卡換組
  const completeSlot = (logKey, historyKey, historyEntry, logData = logs[logKey] || {}) => {
    completeSet(logKey, historyKey, historyEntry);
    dropDoneFocus(logKey);
    if (logData.done) {
      if (litKey === logKey) setLitKey(null);
      return;
    }
    setLitKey(logKey);
    navigator.vibrate?.(10);
    revealNextRef.current = true;
    if (gymMode) {
      setLiftingKey(k => (k === logKey ? null : k));
      setGymNeedReps(null);
      // 換到照做順序的下一個待做組（superset 會換到另一個動作）；不設 null，
      // 不然不照順序做時會被拉回第一個沒做的動作
      const at = sessionOrder.findIndex(s => s.key === logKey);
      const rest = at < 0 ? sessionOrder : [...sessionOrder.slice(at + 1), ...sessionOrder.slice(0, at)];
      setFocusedKey(rest.find(s => !isSettledKey(s.key))?.key ?? null);
    } else if (focusedKey === logKey) {
      // 做完目前這組，浮卡換到下一組
      setFocusedKey(null);
    }
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
    if (gymMode) pendingGymExRef.current = id;
  };

  const removeCustomExercise = (exerciseId, name) => {
    if (!window.confirm(`刪除「${name}」？`)) return;
    // 健身房模式刪掉選中的那站：換到下一站（沒有就上一站），不跳回第一站
    if (gymMode) {
      const i = gymStations.findIndex(st => st.id === exerciseId);
      const neighbor = i >= 0 ? (gymStations[i + 1] ?? gymStations[i - 1]) : null;
      if (neighbor) pickGymExercise(neighbor.id);
    }
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

  // ==================== 目前這組與休息膠囊 ====================

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
  // 目前這組 = 最後聚焦過輸入框的那一組（跳過的不算）；沒有就是第一個沒完成也沒跳過的組。畫面上只有一張浮卡。
  // 已完成的組只有在使用者正在改它（焦點還在那一列裡）時才算，不然回到自動選的那一組，
  // 免得浮卡卡在做完的組上、按「跳過」把做完的組改成跳過
  const focusInRow = (key) => {
    if (typeof document === 'undefined') return false;
    const row = document.activeElement?.closest?.('[data-set-row]');
    return row?.querySelector('[data-weight-input]')?.dataset.logKey === key;
  };
  const focusedSlot = focusedKey
    ? sessionOrder.find(s => s.key === focusedKey && !logs[s.key]?.skipped
      && (!logs[s.key]?.done || focusInRow(s.key) || pressFocusKeyRef.current === s.key)) ?? null
    : null;
  const currentSlot = focusedSlot ?? firstPendingSlot;
  const currentKey = currentSlot?.key ?? null;
  // 休息膠囊的「下一組」：目前這組還沒做就是它，不然是第一個還沒做的組
  const nextSlot = currentSlot && !logs[currentSlot.key]?.done ? currentSlot : firstPendingSlot;
  const finished = sessionOrder.length > 0 && !firstPendingSlot;

  // 今天進度：完成組數 / 計畫組數（跳過的組不算進分母，做完時進度條剛好滿）
  const doneCount = sessionOrder.filter(s => logs[s.key]?.done).length;
  const plannedCount = sessionOrder.length - sessionOrder.filter(s => logs[s.key]?.skipped).length;
  const progressPct = plannedCount > 0 ? Math.min(100, (doneCount / plannedCount) * 100) : 0;

  // 本週訓練量入口的摘要：今天組數最多的兩個肌群，本週完成組數 / 週目標
  const weeklyDone = useMemo(() => {
    const done = {};
    [0, 1, 2, 3, 4].forEach(dayIndex => {
      const plan = getSessionPlan(currentWeek, getWorkoutForDay(currentWeek, dayIndex));
      plan.forEach(({ exercise, sets }) => {
        for (let i = 0; i < sets; i++) {
          if (logs[`w${currentWeek}-d${dayIndex}-${exercise.id}-s${i}`]?.done) {
            done[exercise.muscle] = (done[exercise.muscle] || 0) + 1;
          }
        }
      });
    });
    return done;
  }, [logs, currentWeek, customExercises, customSets, exerciseOrder, exerciseOverrides, exerciseLibrary]);
  const todaySetsByMuscle = {};
  currentSessionPlan.forEach(({ exercise, sets }) => {
    todaySetsByMuscle[exercise.muscle] = (todaySetsByMuscle[exercise.muscle] || 0) + sets;
  });
  const volumeSummary = Object.entries(todaySetsByMuscle)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([muscle]) => `${MUSCLE_GROUPS[muscle] ?? muscle} ${weeklyDone[muscle] ?? 0}/${getWeeklyMuscleVolume(muscle, currentWeek)}`)
    .join(' · ');

  // 休息膠囊跟休息通知同一個來源（getRestContext，目標是 restNotificationDelay）。
  // 只顯示 3 小時內開始的休息（不綁日曆日：半夜練跨過午夜照樣顯示；通知那邊只排還沒到時間的，不會矛盾）
  const restContext = getRestContext({
    logs, currentWeek, currentDay, workoutKey,
    sessionPlan: currentSessionPlan, globalDelay: restTarget,
  });
  const REST_LABELS = {
    'in-set': '休息中',
    'between-exercises': '動作間休息',
    'in-pair-between-rounds': '輪間休息',
    'in-pair-mid-round': '切換中',
  };
  const restPill = nextSlot && REST_LABELS[restContext.type] && restContext.anchorTs != null
    && currentTime - restContext.anchorTs < REST_PILL_WINDOW_MS
    ? (() => {
      const nextEx = nextSlot.entry.exercise;
      const target = restContext.delay ?? SWITCH_TARGET_SEC;
      const elapsed = Math.max(0, Math.floor((currentTime - restContext.anchorTs) / 1000));
      return {
        key: nextSlot.key,
        label: REST_LABELS[restContext.type],
        elapsedText: formatTime(elapsed),
        targetText: formatTime(target),
        overText: elapsed > target ? formatTime(elapsed - target) : null,
        pct: target > 0 ? Math.min(100, (elapsed / target) * 100) : 0,
        nextName: customExerciseNames[nextEx.id] || nextEx.name,
        nextSetNo: nextSlot.idx + 1,
      };
    })()
    : null;
  // 組間 / 動作間休息線超過目標時顯示超過多少
  const overTextOf = (seconds) => (seconds > restTarget ? formatTime(seconds - restTarget) : null);

  // ==================== 健身房模式 ====================
  // 一個動作一站（superset 兩站排在一起），每站記它的組、第一個待做組、像素器材
  const gymStations = gymMode ? groupedPlan.flatMap((group, groupIdx) => (
    group.type === 'pair' ? group.items : [group.item]
  ).map(entry => {
    const ex = entry.exercise;
    const slots = sessionOrder.filter(s => s.entry.exercise.id === ex.id);
    const firstPending = slots.find(s => !isSettledKey(s.key)) ?? null;
    const { key: familyKey, family } = stationOf(ex);
    return {
      id: ex.id, groupIdx, pair: group.type === 'pair', slots, firstPending, familyKey, family,
      name: customExerciseNames[ex.id] || ex.name,
      doneSets: slots.filter(s => logs[s.key]?.done).length,
    };
  })) : [];
  // 正在做的組：只算目前這組（使用者改點別組，第二下完成的就不是原本那組）
  const lifting = gymMode && liftingKey && liftingKey === currentKey && !isSettledKey(liftingKey) ? liftingKey : null;
  // 選中的站：使用者選的那一站，直到目前這組變了；之後跟著目前這組所在的站（做完就停在最後一站）。
  // 用推導不用 effect：App 每秒更新時間，effect 跟隨會一直把使用者拉回目前這組
  const gymStamp = `${currentWeek}-${currentDay}-${currentKey}`;
  const stationIndexOf = (exId) => gymStations.findIndex(st => st.id === exId);
  const pickedIdx = gymPick?.stamp === gymStamp ? stationIndexOf(gymPick.exId) : -1;
  const currentStationIdx = currentSlot ? stationIndexOf(currentSlot.entry.exercise.id) : -1;
  const gymIndex = pickedIdx >= 0 ? pickedIdx : currentStationIdx >= 0 ? currentStationIdx : Math.max(0, gymStations.length - 1);
  const gymGroupIdx = gymMode ? (gymStations[gymIndex]?.groupIdx ?? -1) : -1;
  const gymGroupNowRef = useRef(gymGroupIdx);
  gymGroupNowRef.current = gymGroupIdx;
  const pickGymExercise = (exId) => setGymPick({ exId, stamp: gymStamp });

  // 每站的 HUD：組數、提示、中間按鈕念的字
  const gymStationView = gymStations.map(st => {
    const liftSlot = lifting ? st.slots.find(s => s.key === lifting) : null;
    const next = st.firstPending;
    let hint;
    let hintTone = 'default';
    let actionLabel;
    if (liftSlot) {
      const needReps = gymNeedReps === lifting;
      hint = needReps ? '先填次數再點完成' : `做完再點一下 · 第 ${liftSlot.idx + 1} 組`;
      hintTone = needReps ? 'rest' : 'accent';
      actionLabel = `完成 ${st.name} 第 ${liftSlot.idx + 1} 組`;
    } else if (finished) {
      hint = '今天的課表做完了';
      hintTone = 'done';
      actionLabel = `${st.name}，今天的課表做完了`;
    } else if (!next) {
      hint = '這個動作做完了';
      hintTone = 'done';
      actionLabel = `${st.name} 做完了`;
    } else {
      if (restPill) {
        hint = restPill.overText ? `該做下一組了 · 超過 ${restPill.overText}` : `${restPill.label} ${restPill.elapsedText} / ${restPill.targetText}`;
        hintTone = 'rest';
      } else {
        hint = `點器材開始第 ${next.idx + 1} 組`;
      }
      actionLabel = `開始 ${st.name} 第 ${next.idx + 1} 組`;
    }
    return {
      id: st.id, family: st.family, familyKey: st.familyKey, name: st.name, pair: st.pair, done: !next,
      setText: `${st.doneSets}/${st.slots.length} 組`, hint, hintTone, actionLabel,
    };
  });

  const focusRepsOf = (logKey) => {
    const row = document.querySelector(`[data-weight-input][data-log-key="${logKey}"]`)?.closest('[data-set-row]');
    row?.querySelector('[data-reps-input]')?.focus();
  };
  // 點中間：正在做這站 → 完成；不然開始這個動作第一個待做組（不聚焦輸入框，不跳鍵盤）
  const onGymTap = (i) => {
    const st = gymStations[i];
    if (!st) return;
    const liftSlot = lifting ? st.slots.find(s => s.key === lifting) : null;
    if (liftSlot) {
      if (Date.now() - liftStartRef.current < GYM_DOUBLE_TAP_MS) return;
      const ex = liftSlot.entry.exercise;
      const historyKey = ex._libraryId ?? ex.id;
      const historyEntry = history[historyKey] || {};
      const logData = logs[liftSlot.key] || {};
      if (!logData.reps && !hasReps(historyEntry.reps)) {
        setGymNeedReps(liftSlot.key);
        focusRepsOf(liftSlot.key);
        return;
      }
      completeSlot(liftSlot.key, historyKey, historyEntry, logData);
      return;
    }
    if (!st.firstPending) return;
    setGymNeedReps(null);
    setFocusedKey(st.firstPending.key);
    setLiftingKey(st.firstPending.key);
    liftStartRef.current = Date.now();
    navigator.vibrate?.(10);
  };

  // 換天換週：清掉做到一半的那組
  useEffect(() => {
    setLiftingKey(null);
    setGymNeedReps(null);
  }, [currentWeek, currentDay]);
  // 那組完成或跳過了（場景、✓、另一個視窗都算）就清掉，之後取消完成人物也不會又開始做
  useEffect(() => {
    if (liftingKey && isSettledKey(liftingKey)) setLiftingKey(null);
  }, [liftingKey, logs]);
  // 剛新增的自訂動作出現在清單上：選它那一站
  useEffect(() => {
    const id = pendingGymExRef.current;
    if (!id || !gymStations.some(st => st.id === id)) return;
    pendingGymExRef.current = null;
    pickGymExercise(id);
  });

  const rowOf = (logKey) => document.querySelector(`[data-weight-input][data-log-key="${logKey}"]`)?.closest('[data-set-row]');

  // 休息膠囊的版面位置（不含進場動畫的位移）；沒有膠囊就是 tab 列頂端
  const pillBand = () => {
    const navTop = document.querySelector('nav[aria-label="主選單"]')?.getBoundingClientRect().top ?? window.innerHeight;
    const pill = document.querySelector('[data-rest-pill]');
    return pill ? { top: pill.offsetTop, bottom: pill.offsetTop + pill.offsetHeight } : { top: navTop, bottom: navTop };
  };

  // 自動捲到 targetY（文件座標）。大標題不停在半收合：落在「開始被蓋住」到「完全收合」之間就捲到完全收合；
  // 完全收合會把要看的列推進頂部 bar 底下時，改停在大標題剛好完整的位置
  const scrollPageTo = (targetY, row) => {
    const barH = barRef.current?.offsetHeight ?? 0;
    let y = Math.max(0, targetY);
    const title = titleRef.current?.getBoundingClientRect();
    if (title?.height) {
      const titleTop = title.top + window.scrollY;
      const startCover = titleTop - barH;
      const fullCover = titleTop + title.height - barH;
      if (y > startCover && y < fullCover) {
        const r = row?.getBoundingClientRect();
        const rowTopAfter = r ? r.top + window.scrollY - fullCover : Infinity;
        y = rowTopAfter >= barH ? fullCover : Math.max(0, startCover);
      }
    }
    if (Math.abs(y - window.scrollY) < 1) return;
    // 平滑捲動中使用者一滾輪 / 按下 / 觸控就停下來交給使用者（見 utils/userInput）
    smoothScrollTo(y, { reduce: prefersReducedMotion() });
  };

  // 點休息膠囊：把下一組捲到頂部 bar 與膠囊之間的中間
  const scrollToSet = (logKey) => {
    const r = rowOf(logKey)?.getBoundingClientRect();
    if (!r?.height) return;
    const barH = barRef.current?.offsetHeight ?? 0;
    const center = (barH + pillBand().top) / 2;
    scrollPageTo(window.scrollY + r.top + r.height / 2 - center, rowOf(logKey));
  };

  // 把目前這組捲到看得到的地方：不被頂部 bar（superset 再多讓出狀態條）、休息膠囊、tab 列蓋住。
  // auto（進頁、換天換週、膠囊第一次出現）只在目前這組底緣低於膠囊頂端時才捲，而且使用者 1 秒內在捲動 / 輸入就不動；
  // 使用者動作（按 ✓、跳過、Enter 跳格）之後只要被蓋住就捲。
  // 讀 ref 拿最新的目前這組（從 requestAnimationFrame 呼叫時，closure 可能是舊的）
  const currentKeyRef = useRef(currentKey);
  currentKeyRef.current = currentKey;
  const revealCurrent = ({ auto = false } = {}) => {
    const key = currentKeyRef.current;
    if (!key) return;
    const row = rowOf(key);
    const rect = row?.getBoundingClientRect();
    if (!rect?.height) return; // jsdom 沒有版面；排序模式沒有組列
    const band = pillBand();
    // auto：目前這組底緣低於膠囊頂端就捲（被膠囊蓋住、在膠囊或 tab 列底下、整個在畫面外都算）
    if (auto) {
      // 使用者 1 秒內自己捲過（滾輪、拖超過 10px、捲動鍵）就不動；這個 view 之後也不補捲，使用者已經接手
      if (isUserScrollingWithin(1000)) return;
      if (rect.bottom <= band.top) return;
    }
    const top = (barRef.current?.offsetHeight ?? 0) + (row.closest('[data-pair-group]') ? 72 : 12);
    const bottom = band.top - 12;
    if (rect.bottom > bottom) scrollPageTo(window.scrollY + rect.bottom - bottom, row);
    else if (rect.top < top) scrollPageTo(window.scrollY + rect.top - top, row);
  };

  // 按 ✓、跳過、次數欄按 Enter 跳格之後，新的目前這組在畫面外就平滑捲進來
  useEffect(() => {
    if (!revealNextRef.current) return;
    revealNextRef.current = false;
    revealCurrent();
  }, [currentKey, logs]);

  // 休息膠囊第一次出現、進訓練頁、換天 / 換週時膠囊已經在：目前這組剛好被膠囊蓋住才捲一次
  const pillShown = Boolean(restPill);
  const pillRevealedForRef = useRef(null);
  useEffect(() => {
    if (!pillShown || reorderMode) {
      if (!pillShown) pillRevealedForRef.current = null;
      return undefined;
    }
    const view = `${currentWeek}-${currentDay}`;
    if (pillRevealedForRef.current === view) return undefined;
    // 等版面（膠囊、浮卡）就位再量
    const id = requestAnimationFrame(() => {
      pillRevealedForRef.current = view;
      revealCurrent({ auto: true });
    });
    return () => cancelAnimationFrame(id);
  }, [pillShown, currentWeek, currentDay, reorderMode]);

  // 浮卡（目前這組的浮起層）跟著目前這組：換組時從舊列滑到新列（FLIP：位置量出來，只動 transform），
  // 減少動態效果時直接換位置再淡入。同一組因為版面變動移位時不播動畫
  const syncHighlight = () => {
    const hl = highlightRef.current;
    const main = mainRef.current;
    if (!hl || !main) return;
    // 健身房模式換了動作卡：舊卡片已經卸載，浮卡原地淡入，不從舊位置滑過來
    if (gymGroupRef.current !== gymGroupNowRef.current) {
      gymGroupRef.current = gymGroupNowRef.current;
      highlightPosRef.current = null;
    }
    const key = currentKeyRef.current;
    const row = key ? main.querySelector(`[data-weight-input][data-log-key="${key}"]`)?.closest('[data-set-row]') : null;
    if (!row) {
      hl.style.opacity = '0';
      highlightPosRef.current = null;
      return;
    }
    const m = main.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (!r.height) return; // jsdom 沒有版面
    const pos = { key, x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height };
    const prev = highlightPosRef.current;
    if (prev && prev.key === pos.key && prev.x === pos.x && prev.y === pos.y && prev.w === pos.w && prev.h === pos.h) return;
    const moving = Boolean(prev) && prev.key !== pos.key;
    const reduce = prefersReducedMotion();
    hl.style.transition = moving && !reduce ? HIGHLIGHT_MOVE : 'none';
    hl.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    hl.style.width = `${pos.w}px`;
    hl.style.height = `${pos.h}px`;
    hl.style.opacity = '1';
    if (moving && reduce) hl.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    highlightPosRef.current = pos;
  };
  useIsomorphicLayoutEffect(syncHighlight);
  // 版面變動但沒有重新 render（字型載入、視窗大小）也要跟上
  useEffect(() => {
    const main = mainRef.current;
    if (!main || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => syncHighlight());
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  const closeSheet = () => setSheet(null);
  const optionsEntry = sheet?.kind === 'options'
    ? currentSessionPlan.find(e => e.exercise.id === sheet.exId) ?? null
    : null;

  const phaseStyle = PHASE_STYLE[phase] ?? PHASE_STYLE.hypertrophy;
  const rirChip = `${guidance.label.includes('衝刺') ? '衝刺週 · ' : ''}RIR ${guidance.rir}`;
  // 已完成的組當浮卡時，去按別組的 ✓ / 跳過：浮卡回到自動選的組
  const dropDoneFocus = (exceptKey) => {
    setFocusedKey(k => (k && k !== exceptKey && logs[k]?.done ? null : k));
  };
  // 目前這組裡的按鈕（stepper、帶入、跳過）按下時不搶走輸入框的焦點：
  // 改已完成的組時焦點一離開那一列它就不再是目前這組，按鈕會在 click 之前消失（iOS 點按鈕不會給按鈕焦點）
  const keepInputFocus = (e) => e.preventDefault();

  // ==================== 排序模式 ====================
  // 進來時記住捲動位置和從哪個動作進來、捲到頂、焦點到「完成」（指標進入時不顯示焦點框）。
  // 離開時：順序沒變捲回原位、焦點回到那個動作的「⋯」；有動過順序就把被移動的動作捲進畫面、焦點給它的「⋯」；
  // 換週回到頂部；從休息膠囊離開就捲到目前這組。
  // 浮卡在排序模式沒有組列可以跟，自然藏起來；休息膠囊照常顯示但不自動捲
  const reorderExitedRef = useRef(false);
  const reorderListRef = useRef(null);
  // 正在拖、剛用 Esc 取消拖曳：這時的 Esc 是 dnd 的，不離開排序模式
  const draggingRef = useRef(false);
  const dragCancelledAtRef = useRef(0);
  // 這次排序模式裡最後被移動的動作（draggable id）
  const movedGroupRef = useRef(null);
  const groupOrderKey = () => groupedPlan.map(g => g.id).join(',');
  const enterReorder = (exId) => {
    reorderReturnRef.current = { scrollY: window.scrollY, exId, orderBefore: groupOrderKey() };
    movedGroupRef.current = null;
    setFocusedKey(null);
    closeSheet();
    setReorderMode(true);
  };
  // then：'top'（換週）、{ scrollToKey }（點休息膠囊）；沒給就照順序有沒有變決定
  const exitReorder = (then = null) => {
    if (reorderReturnRef.current) reorderReturnRef.current.then = then;
    // 健身房模式一次只畫一個動作：離開時選要捲過去的那個（膠囊的下一組 > 被移動的 > 從哪個進來的）
    if (gymMode) {
      const pillSlot = then?.scrollToKey ? sessionOrder.find(s => s.key === then.scrollToKey) : null;
      const exId = pillSlot?.entry.exercise.id
        ?? (movedGroupRef.current ? exerciseIdOfGroup(movedGroupRef.current) : null)
        ?? reorderReturnRef.current?.exId;
      if (exId) pickGymExercise(exId);
    }
    reorderExitedRef.current = true;
    setReorderMode(false);
  };
  const onReorderDragStart = () => {
    draggingRef.current = true;
  };
  const onReorderDragEnd = (result) => {
    draggingRef.current = false;
    if (result.reason === 'CANCEL') dragCancelledAtRef.current = Date.now();
    if (result.destination && result.destination.index !== result.source.index) movedGroupRef.current = result.draggableId;
    handleDragEnd(result);
  };
  // 排序模式的 Esc：拖曳中、或這一下 Esc 剛取消了拖曳，交給 dnd；有 sheet 開著時是關 sheet
  const onReorderEscape = (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (draggingRef.current || Date.now() - dragCancelledAtRef.current < 300) return;
    if (document.querySelector('[role="dialog"]')) return;
    exitReorder();
  };
  // 動作（或配對）的 draggable id → 它第一個動作的 id
  const exerciseIdOfGroup = (groupId) => {
    const group = groupedPlan.find(g => g.id === groupId);
    if (!group) return null;
    return group.type === 'pair' ? group.items[0].exercise.id : group.item.exercise.id;
  };
  useEffect(() => {
    if (reorderMode) {
      if (canAnimate()) window.scrollTo({ top: 0 });
      // 鍵盤進來才把焦點框顯示在「完成」；觸控 / 滑鼠進來焦點放在清單上（不畫框），之後按 Tab 一樣從這裡開始
      if (userInput.modality === 'keyboard') {
        reorderDoneRef.current?.focus({ preventScroll: true });
      } else {
        reorderListRef.current?.focus({ preventScroll: true });
      }
      const onKeyDown = (e) => onReorderEscape(e);
      document.addEventListener('keydown', onKeyDown);
      return () => document.removeEventListener('keydown', onKeyDown);
    }
    const ret = reorderReturnRef.current;
    if (!ret) return undefined;
    reorderReturnRef.current = null;
    const optionsBtn = (exId) => document.querySelector(`[data-exercise-id="${exId}"] button[aria-label="動作選項"]`);
    const instant = (y) => { if (canAnimate()) window.scrollTo({ top: y }); };
    if (ret.then === 'top') {
      instant(0);
      (optionsBtn(ret.exId) ?? document.querySelector('[data-current-week]'))?.focus({ preventScroll: true });
    } else if (ret.then?.scrollToKey) {
      instant(ret.scrollY);
      scrollToSet(ret.then.scrollToKey);
    } else if (movedGroupRef.current && ret.orderBefore !== groupOrderKey()) {
      // 拖過去又拖回原位不算，進來前後的順序真的不一樣才算動過
      // 有動過順序：舊的捲動位置已經對不上，改把被移動的動作捲到畫面中間
      const exId = exerciseIdOfGroup(movedGroupRef.current) ?? ret.exId;
      const section = document.querySelector(`[data-exercise-id="${exId}"]`);
      const r = section?.getBoundingClientRect();
      if (r?.height && canAnimate()) {
        const barH = barRef.current?.offsetHeight ?? 0;
        const target = window.scrollY + r.top - barH - 12;
        window.scrollTo({ top: Math.max(0, target) });
      }
      optionsBtn(exId)?.focus({ preventScroll: true });
    } else {
      instant(ret.scrollY);
      optionsBtn(ret.exId)?.focus({ preventScroll: true });
    }
    movedGroupRef.current = null;
    return undefined;
  }, [reorderMode]);

  // 刪除自訂動作之後（確認框按了刪除）：焦點移到下一個動作的「⋯」，沒有下一個就「新增動作」
  useEffect(() => {
    const pending = deleteFocusRef.current;
    if (!pending) return;
    deleteFocusRef.current = null;
    if (currentSessionPlan.some(e => e.exercise.id === pending.exId)) return; // 確認框按了取消
    const next = pending.nextId
      && document.querySelector(`[data-exercise-id="${pending.nextId}"] button[aria-label="動作選項"]`);
    (next || addExerciseRef.current)?.focus({ preventScroll: true });
  });

  // inPair：superset 卡片裡的動作，不自己畫卡片底色
  // pairOrder：pair 成員才有（見 findNextWeightInput），單動作為 undefined
  const renderExerciseInner = ({
    entry, hideInterRest, pairRest, prevEndTs, pairOrder, inPair = false,
  }) => {
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
      <section data-exercise data-exercise-id={ex.id}>
        {/* 動作間休息：放在動作卡上方 */}
        {hasPrevEndTs && (() => {
          if (!firstActiveLog.done) {
            const elapsed = Math.floor((currentTime - prevEndTs) / 1000);
            return <RestLine kind="exercise-live" label="動作間休息" time={formatTime(elapsed)} overText={overTextOf(elapsed)} className="mb-2" />;
          }
          if (firstActiveLog.completedAt) {
            const restSeconds = Math.floor((firstActiveLog.completedAt - prevEndTs) / 1000);
            return restSeconds >= 0 ? (
              <RestLine kind="exercise-done" label="動作間休息" time={formatTime(restSeconds)} className="mb-2" />
            ) : null;
          }
          return null;
        })()}

        <div
          className={inPair
            ? 'px-2.5 pb-3 pt-4'
            : 'rounded-[20px] bg-card px-2.5 pb-3 pt-4'}
        >
          {/* 動作標題（排序走「⋯」→「調整順序」的排序模式，平常沒有把手） */}
          <div className="flex select-none items-start gap-1 px-1.5">
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="text-title3 font-semibold text-label">{exName}</h3>
              <p className="mt-0.5 text-footnote text-label-2">
                {MUSCLE_GROUPS[ex.muscle] ?? '未知'} · {ex.type === 'compound' ? '複合' : '隔離'} · {enDash(getRepRange(ex.type, currentWeek))} 下 × {setsCount} 組
                {skippedCount > 0 && ` · 跳過 ${skippedCount}`}
              </p>
              {ex.noteRIR && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-rest/[0.16] px-2.5 py-1 text-footnote font-semibold text-rest">
                  <AlertTriangle size={14} aria-hidden="true" />
                  RIR {enDash(ex.noteRIR)} · 不可至力竭
                </p>
              )}
              {ex.noteText && (
                <p className="mt-1.5 text-footnote text-label-3">{ex.noteText}</p>
              )}
            </div>
            <div className="-mr-1.5 flex shrink-0 items-center">
              <p className="font-num text-body font-semibold tabular-nums text-label">
                {completedCount}<span className="text-label-3">/{setsCount}</span>
              </p>
              <button
                type="button"
                onClick={(e) => {
                  optionsTriggerRef.current = e.currentTarget;
                  setSheet({ kind: 'options', exId: ex.id });
                }}
                aria-label="動作選項"
                aria-haspopup="dialog"
                className="flex h-11 w-11 items-center justify-center rounded-full text-label-2 transition-colors duration-150 active:bg-elevated"
              >
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* 動作進度條：跟今天進度同一個完成綠（推拉腿色只留在 D1–D5） */}
          <div className="mx-1.5 mt-2.5 h-1 overflow-hidden rounded-full bg-fill" aria-hidden="true">
            <div
              data-exercise-progress
              className="h-full rounded-full bg-done transition-[width] duration-[400ms] ease-out"
              style={{ width: `${setsCount > 0 ? (completedCount / setsCount) * 100 : 0}%` }}
            />
          </div>

          {/* 欄位標題，對齊下面的組列 */}
          <div className="set-grid mt-2 px-2 pb-0.5 text-caption text-label-3" aria-hidden="true">
            <span className="text-center">組</span>
            <span className="text-center">重量 kg</span>
            <span className="text-center">次數</span>
            <span />
          </div>

          {/* Sets List */}
          <div className="flex flex-col gap-1.5">
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
              const isCurrent = logKey === currentKey;
              const isDone = Boolean(logData.done);
              // 完成的組平常只顯示數字（輸入框做成純文字外觀，點了照樣能改，點了就變成目前這組）；
              // 目前這組、待做的組才有 − / + stepper
              const showStepper = isCurrent || !isDone;
              const weightValue = logData.weight ?? '';
              const repsValue = logData.reps || '';
              const weightPlaceholder = hasWeight(historyWeight) ? String(historyWeight) : 'kg';
              // 超過 4 個字（例如 102.5）縮一級，360 寬也放得下
              const numSize = (v) => (String(v).length > 4 ? 'text-body' : 'text-title3');
              const fieldBg = isCurrent ? 'bg-fill' : 'bg-elevated';

              // 目前這組的浮起底色、陰影、藍框在 main 裡那一層浮卡上（換組時滑過去），列本身透明
              const rowTone = isCurrent
                ? 'rounded-2xl py-2'
                : isDone
                  ? 'rounded-[14px] bg-done/[0.08]'
                  : 'rounded-[14px]';
              const numTone = isCurrent ? 'text-accent-text' : logData.skipped ? 'text-label-2' : isDone ? 'text-done' : 'text-label-3';
              const completeClass = isDone
                ? 'bg-done text-black'
                : isCurrent && canComplete
                  ? 'bg-accent/20 text-accent-text'
                  : `border-[1.5px] border-fill text-label-3 ${canComplete ? '' : 'cursor-not-allowed'}`;

              return (
                <React.Fragment key={idx}>
                  {/* 一列：組號 / − 重量 + / 次數 / ✓ */}
                  <div
                    data-set-row
                    data-current={isCurrent ? '' : undefined}
                    // 已完成的組：焦點離開這一列就不再是目前這組（改完數字點別的地方，浮卡回到下一組）。
                    // 按下時焦點就在這一組的話，等放開（click 跑完）再收，不然列變矮、按到一半的按鈕會跑掉
                    onBlur={isDone && isCurrent ? (e) => {
                      if (e.currentTarget.contains(e.relatedTarget)) return;
                      if (pressFocusKeyRef.current === logKey) blurPendingKeyRef.current = logKey;
                      else setFocusedKey(k => (k === logKey ? null : k));
                    } : undefined}
                    className={`relative z-[1] px-2 transition-[background-color] duration-200 ${rowTone}`}
                  >
                    <div className={`set-grid items-center ${isCurrent ? 'min-h-12' : 'min-h-[52px]'}`}>
                      <span className={`text-center font-num text-body font-semibold tabular-nums transition-colors duration-200 ${numTone}`}>
                        {idx + 1}
                      </span>
                      {logData.skipped ? (
                        <>
                          <span className="text-subhead font-medium text-skip">已跳過</span>
                          <button
                            type="button"
                            onClick={() => {
                              skipSet(logKey);
                              dropDoneFocus(logKey);
                            }}
                            title="取消跳過"
                            className="col-span-2 ml-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-subhead font-semibold text-accent-text transition-colors duration-150 active:bg-elevated"
                          >
                            <Undo2 size={16} aria-hidden="true" />復原
                          </button>
                        </>
                      ) : (
                        <>
                          {/* label：完成的組輸入框只有數字寬，點整格任何地方都會聚焦到它（觸控範圍是整欄） */}
                          <label className={`flex h-11 min-w-0 cursor-text items-center rounded-xl transition-colors duration-200 ${showStepper ? fieldBg : 'justify-center'}`}>
                            {showStepper && (
                              <button
                                type="button"
                                onMouseDown={isCurrent ? keepInputFocus : undefined}
                                onClick={() => adjustWeight(logKey, -1, historyWeight)}
                                title={`-${weightIncrement}kg`}
                                aria-label={`第 ${idx + 1} 組重量減 ${weightIncrement} 公斤`}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-xl text-label transition-colors duration-150 active:bg-white/[0.08]"
                              >
                                <Minus size={18} />
                              </button>
                            )}
                            <input
                              data-weight-input
                              data-log-key={logKey}
                              type="number"
                              inputMode="decimal"
                              enterKeyHint="next"
                              step={weightIncrement}
                              aria-label={`第 ${idx + 1} 組重量（公斤）`}
                              value={weightValue}
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
                              placeholder={weightPlaceholder}
                              // 純文字外觀時寬度貼著數字，「kg」才會緊跟在後面（重量 0 是有效值，不能用 || 判斷）
                              style={showStepper ? undefined : { width: `calc(${String(hasWeight(weightValue) ? weightValue : weightPlaceholder).length}ch + 4px)` }}
                              className={`h-11 min-w-0 rounded-none bg-transparent text-center font-num font-semibold tabular-nums text-label ${showStepper ? 'w-0 flex-1' : 'flex-none'} ${numSize(hasWeight(weightValue) ? weightValue : weightPlaceholder)}`}
                            />
                            {!showStepper && hasWeight(weightValue) && (
                              <span className="ml-0.5 text-footnote text-label-2">kg</span>
                            )}
                            {showStepper && (
                              <button
                                type="button"
                                onMouseDown={isCurrent ? keepInputFocus : undefined}
                                onClick={() => adjustWeight(logKey, 1, historyWeight)}
                                title={`+${weightIncrement}kg`}
                                aria-label={`第 ${idx + 1} 組重量加 ${weightIncrement} 公斤`}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-xl text-label transition-colors duration-150 active:bg-white/[0.08]"
                              >
                                <Plus size={18} />
                              </button>
                            )}
                          </label>
                          <input
                            data-reps-input
                            type="number"
                            inputMode="numeric"
                            enterKeyHint="next"
                            aria-label={`第 ${idx + 1} 組次數`}
                            value={repsValue}
                            onChange={(e) => updateLog(logKey, 'reps', e.target.value)}
                            onFocus={() => setFocusedKey(logKey)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                let nextWeightInput = findNextWeightInput(e.currentTarget, logKey, pairOrder);
                                // 健身房模式一次只畫一個動作：最後一組按 Enter 先換到下一站，再聚焦它第一個重量欄。
                                // flushSync 讓 focus 留在這次按鍵裡，iOS 才會跳鍵盤
                                const nextGroup = !nextWeightInput && gymMode ? groupedPlan[gymGroupIdx + 1] : null;
                                if (nextGroup) {
                                  const first = nextGroup.type === 'pair' ? nextGroup.items[0] : nextGroup.item;
                                  flushSync(() => pickGymExercise(first.exercise.id));
                                  nextWeightInput = document.querySelector('[data-weight-input]');
                                }
                                if (nextWeightInput) {
                                  // 跳到的組被休息膠囊 / tab 列蓋住就捲出來（聚焦後它變成目前這組，列會變高）
                                  revealNextRef.current = true;
                                  nextWeightInput.focus();
                                  nextWeightInput.select();
                                }
                              }
                            }}
                            placeholder={hasReps(historyReps) ? String(historyReps) : '次'}
                            className={`h-11 w-full min-w-0 rounded-xl text-center font-num font-semibold tabular-nums text-label transition-colors duration-200 ${isDone && !isCurrent ? 'bg-transparent' : fieldBg} ${numSize(repsValue)}`}
                          />
                          <button
                            type="button"
                            data-complete-btn
                            onClick={() => completeSlot(logKey, historyKey, historyEntry, logData)}
                            // 彈一下播完就清掉，換天再回來不會重播
                            onAnimationEnd={() => setLitKey(k => (k === logKey ? null : k))}
                            disabled={!canComplete}
                            title={logData.done ? '取消完成' : canComplete ? '完成此組' : '先輸入次數'}
                            aria-label={logData.done ? '取消完成' : '完成此組'}
                            aria-pressed={Boolean(logData.done)}
                            className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-200 ${completeClass} ${isDone && litKey === logKey ? 'check-pop' : ''}`}
                          >
                            <Check size={22} strokeWidth={3} />
                          </button>
                        </>
                      )}
                    </div>

                    {/* 目前這組的下排：帶入上次、跳過這組（已完成的組在改數字時是「改成跳過」，講清楚會把做完的組改掉） */}
                    {isCurrent && !logData.skipped && (
                      <div className="fade-in flex items-center justify-between gap-2">
                        <button
                          type="button"
                          data-fill-history
                          onMouseDown={keepInputFocus}
                          onClick={() => canFill && fillFromHistory(logKey, historyKey)}
                          disabled={!canFill}
                          title={logData.done ? '已完成' : hasHistory ? '帶入上次重量與次數' : '尚無上次紀錄'}
                          className={`-ml-1 h-11 min-w-0 truncate rounded-full px-1.5 text-left text-subhead transition-colors duration-150 disabled:cursor-default ${canFill ? 'font-semibold text-accent-text active:bg-white/[0.06]' : 'text-label-2'}`}
                        >
                          {hasHistory ? (
                            <>
                              上次 <span className="font-num tabular-nums">{hasWeight(historyWeight) ? historyWeight : '—'}</span> kg
                              {' × '}
                              <span className="font-num tabular-nums">{hasReps(historyReps) ? historyReps : '—'}</span>
                              {canFill && ' · 帶入'}
                            </>
                          ) : '還沒有上次紀錄'}
                        </button>
                        <button
                          type="button"
                          onMouseDown={keepInputFocus}
                          onClick={() => {
                            skipSet(logKey);
                            dropDoneFocus(logKey);
                            revealNextRef.current = true;
                            if (focusedKey === logKey) setFocusedKey(null);
                          }}
                          title="跳過此組"
                          className="-mr-1 h-11 shrink-0 rounded-full px-2 text-subhead text-label-2 transition-colors duration-150 active:bg-white/[0.06]"
                        >
                          {isDone ? '改成跳過' : '跳過這組'}
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
                    return (
                      <RestLine
                        kind="set-live" label="休息中" time={getCurrentRestTime(restFromTs)}
                        overText={overTextOf(Math.floor((currentTime - restFromTs) / 1000))}
                      />
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div>
      {/* ==================== 頂部 bar（唯一的 sticky header） ==================== */}
      {/* 捲到頂時透明；大標題開始被蓋住就變半透明材質，完全捲過去時中間淡入小標題 */}
      <header
        ref={barRef}
        className={`sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 ${scrolled ? 'material hairline-b' : 'bg-transparent'}`}
      >
        <div className="mx-auto flex h-14 max-w-[480px] items-center gap-2 px-4">
          <button
            type="button"
            data-current-week
            onClick={() => setSheet({ kind: 'week' })}
            aria-label={`第 ${currentWeek} 週，${phaseStyle.short}，切換週次`}
            aria-haspopup="dialog"
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full pl-3 pr-2.5 transition-colors duration-200 ${scrolled ? 'bg-elevated' : 'bg-card'}`}
          >
            <span className="font-num text-body font-bold tabular-nums text-label">W{currentWeek}</span>
            {/* 窄螢幕捲動後中間要放小標題，階段名先收起來（週次 sheet、大標題旁的 RIR 徽章都還看得到） */}
            <span className={`text-footnote font-semibold ${phaseStyle.text} ${collapsed ? 'max-[374px]:hidden' : ''}`}>{phaseStyle.short}</span>
            <ChevronDown size={16} className="text-label-3" aria-hidden="true" />
          </button>
          <p
            ref={smallTitleRef}
            aria-hidden="true"
            className={`min-w-0 flex-1 truncate text-center text-body font-semibold text-label transition-opacity duration-200 ${collapsed && smallTitleFits ? 'opacity-100' : 'opacity-0'}`}
          >
            {currentWorkout.name}
          </p>
          <div
            role="timer"
            aria-label="這次訓練時長"
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 transition-colors duration-200 ${scrolled ? 'bg-elevated' : 'bg-card'}`}
          >
            <Timer size={16} className={overMinutes > 0 ? 'text-rest' : 'text-label-3'} aria-hidden="true" />
            {overMinutes > 0 ? (
              <span className="flex flex-col items-start">
                <span className="font-num text-subhead font-semibold leading-[18px] tabular-nums text-rest">{formatTime(sessionDuration)}</span>
                <span data-overtime className="text-caption font-medium leading-[14px] text-rest">超時 {overMinutes} 分</span>
              </span>
            ) : (
              <span className={`font-num text-body font-semibold tabular-nums ${sessionDuration > 0 ? 'text-label' : 'text-label-2'}`}>
                {formatTime(sessionDuration)}
              </span>
            )}
          </div>
          {reorderMode ? (
            <button
              ref={reorderDoneRef}
              type="button"
              data-reorder-done
              onClick={exitReorder}
              className="flex h-11 shrink-0 items-center justify-center rounded-full bg-accent/20 px-4 text-body font-semibold text-accent-text"
            >
              完成
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              title="設定"
              aria-label="設定"
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-label-2 transition-colors duration-200 ${scrolled ? 'bg-elevated' : 'bg-card'}`}
            >
              <Settings2 size={20} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* 底部 padding：休息膠囊出現時多留它的高度，最後一個動作不會被蓋住 */}
      <main ref={mainRef} className={`relative mx-auto max-w-[480px] px-4 ${restPill ? 'pb-[60px]' : 'pb-2'}`}>
        {/* 目前這組的浮卡：位置由 syncHighlight 寫進 style（z-0 在卡片底色之上、組列 z-[1] 之下） */}
        <div
          ref={highlightRef}
          data-current-highlight
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 rounded-2xl bg-elevated opacity-0 shadow-[0_10px_24px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3)] outline outline-[1.5px] outline-accent [outline-offset:-1.5px]"
        />
        {/* ==================== 大標題 ==================== */}
        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <h1 ref={titleRef} className="truncate text-large-title font-bold text-label">{currentWorkout.name}</h1>
            <p className="mt-0.5 text-subhead text-label-2">{currentWorkout.subtitle}</p>
          </div>
          <span className={`mb-0.5 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-footnote font-semibold ${phaseStyle.chip}`}>
            {rirChip}
          </span>
        </div>

        {/* 排序模式時收起 D1–D5 和今天進度，只留要排的清單 */}
        {!reorderMode && (
        <div className={reorderExitedRef.current ? 'mode-fade' : undefined}>
        {/* ==================== D1–D5 分段控制 ==================== */}
        <div role="group" aria-label="訓練日" className="relative mt-3.5 grid h-[52px] grid-cols-5 rounded-[14px] bg-card p-1">
          {/* 選中塊：換天時滑過去 */}
          <span
            className="absolute bottom-1 left-1 top-1 rounded-[10px] bg-thumb shadow-[0_3px_8px_rgba(0,0,0,0.35),0_1px_1px_rgba(0,0,0,0.2)] transition-transform duration-300 ease-ios motion-reduce:transition-none"
            style={{ width: 'calc((100% - 8px) / 5)', transform: `translateX(${currentDay * 100}%)` }}
            aria-hidden="true"
          />
          {[0, 1, 2, 3, 4].map(d => {
            const wKey = getWorkoutForDay(currentWeek, d);
            const workout = WORKOUTS[wKey];
            const isActive = currentDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setCurrentDay(d)}
                aria-pressed={isActive}
                aria-label={`D${d + 1}，${workout.name}`}
                className="relative flex h-11 flex-col items-center justify-center gap-1 rounded-[10px]"
              >
                <span className="font-num text-subhead font-semibold leading-none tabular-nums text-label">D{d + 1}</span>
                <span className={`flex items-center gap-1 text-caption leading-none transition-colors duration-200 ${isActive ? 'text-label' : 'text-label-2'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${sessionThemeOf(workout.type).dot}`} aria-hidden="true" />
                  {sessionThemeOf(workout.type).label}
                </span>
              </button>
            );
          })}
        </div>

        {/* ==================== 今天進度 ==================== */}
        <section aria-label="今天進度" className="mt-3 rounded-[20px] bg-card px-4 pt-3.5">
          {finished ? (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-body font-semibold text-label">{sessionDuration > 0 ? '今天的課表做完了' : '這天的課表做完了'}</p>
              {sessionDuration > 0 && (
                <p className="text-footnote text-label-2">
                  總時長 <span className="font-num text-body font-semibold tabular-nums text-label">{formatTime(sessionDuration)}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-footnote text-label-2">今天進度</h2>
              <p className="font-num tabular-nums">
                <span className="text-title2 font-semibold text-label">{doneCount}</span>
                <span className="text-body text-label-3"> / {plannedCount} 組</span>
              </p>
            </div>
          )}
          <div
            role="progressbar"
            aria-label="今天完成的組數"
            aria-valuemin={0}
            aria-valuemax={plannedCount}
            aria-valuenow={doneCount}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-fill"
          >
            <div className="h-full rounded-full bg-done transition-[width] duration-[400ms] ease-out" style={{ width: `${progressPct}%` }} />
          </div>
          {overMinutes > 0 && !finished && (
            <p className="mt-2.5 flex items-center gap-1.5 text-footnote font-medium text-rest">
              <AlertTriangle size={14} aria-hidden="true" />
              考慮少做 1 組隔離動作
            </p>
          )}
          <button
            type="button"
            data-open-volume
            onClick={() => setSheet({ kind: 'volume' })}
            aria-haspopup="dialog"
            className="hairline-t mt-3 flex h-12 w-full items-center justify-between gap-3 text-left"
          >
            <span className="shrink-0 text-body text-label">本週訓練量</span>
            <span className="flex min-w-0 items-center gap-1 text-footnote text-label-2">
              <span className="truncate font-num tabular-nums">{volumeSummary}</span>
              <ChevronRight size={16} className="shrink-0 text-label-3" aria-hidden="true" />
            </span>
          </button>
        </section>

        {/* ==================== 健身房模式 ==================== */}
        {gymMode && gymStationView.length > 0 && (
          <GymScene
            stations={gymStationView}
            index={gymIndex}
            onSelect={(i) => {
              setGymNeedReps(null);
              pickGymExercise(gymStations[i].id);
            }}
            onTap={onGymTap}
            character={{
              liftIndex: lifting ? gymStations.findIndex(st => st.slots.some(s => s.key === lifting)) : -1,
              rest: restPill && !lifting ? { over: Boolean(restPill.overText) } : null,
              finished,
            }}
          />
        )}
        </div>
        )}

        {/* ==================== 動作清單 ==================== */}
        {reorderMode ? (
          // 排序模式：每個動作（superset 是一整個配對）收成一列，只有右側把手能拖
          <div className="mode-fade">
            <p className="mt-3 px-1 text-footnote text-label-2">按住右側把手拖曳，調整這天的動作順序。</p>
            <DragDropContext
              onDragStart={onReorderDragStart}
              onDragEnd={onReorderDragEnd}
              dragHandleUsageInstructions="按空白鍵拿起動作，用上下方向鍵移動，再按空白鍵放下，按 Esc 取消。"
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
                    ref={(el) => { provided.innerRef(el); reorderListRef.current = el; }}
                    {...provided.droppableProps}
                    data-reorder-list
                    tabIndex={-1}
                    role="group"
                    aria-label="動作順序"
                    className="focus:outline-none"
                  >
                    {groupedPlan.map((group, groupIdx) => {
                      const names = group.type === 'pair'
                        ? group.items.map(it => customExerciseNames[it.exercise.id] || it.exercise.name)
                        : [customExerciseNames[group.item.exercise.id] || group.item.exercise.name];
                      const single = group.type === 'single' ? group.item : null;
                      return (
                        <Draggable key={group.id} draggableId={group.id} index={groupIdx}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} data-reorder-item={group.id} className="pt-2">
                              <div className={`flex min-h-[64px] items-center gap-2 rounded-[16px] py-2.5 pl-4 pr-1 transition-[background-color,box-shadow] duration-200 ${snapshot.isDragging ? 'bg-elevated shadow-[0_20px_44px_rgba(0,0,0,0.6)]' : 'bg-card'}`}>
                                <div className="min-w-0 flex-1">
                                  {single ? (
                                    <>
                                      <p className="truncate text-body font-semibold text-label">{names[0]}</p>
                                      <p className="truncate text-footnote text-label-2">
                                        {MUSCLE_GROUPS[single.exercise.muscle] ?? '未知'} · {single.exercise.type === 'compound' ? '複合' : '隔離'} · {single.sets} 組
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="flex items-center gap-1.5 text-footnote text-label-2">
                                        <Link size={13} aria-hidden="true" />Superset
                                      </p>
                                      {names.map(n => <p key={n} className="truncate text-subhead font-semibold text-label">{n}</p>)}
                                    </>
                                  )}
                                </div>
                                <div
                                  {...provided.dragHandleProps}
                                  aria-label={`拖曳排序：${names.join(' + ')}`}
                                  className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-label-3 active:cursor-grabbing"
                                >
                                  <GripVertical size={20} aria-hidden="true" />
                                </div>
                              </div>
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
          </div>
        ) : (
          <div className={reorderExitedRef.current ? 'mode-fade' : undefined}>
            {groupedPlan.map((group, groupIdx) => {
              // 健身房模式只畫選中那站的動作（superset 是整張配對卡）；照舊跑 map，groupBoundaries 才對得上
              if (gymMode && groupIdx !== gymGroupIdx) return null;
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
                  <div key={group.id} data-pair-group data-pair-id={group.id} className="pt-3">
                    <div className="rounded-[20px] bg-card pb-1">
                      {/* Pair Header */}
                      <div className="flex min-h-11 items-center gap-2 px-4 pt-2">
                        <Link size={16} className="shrink-0 text-label-2" aria-hidden="true" />
                        <p className="min-w-0 text-footnote text-label-2">
                          <span className="font-semibold text-label">Superset</span> · 輪間 {group.rest} 秒 · 切換 {SWITCH_TARGET_SEC} 秒
                        </p>
                      </div>
                      {/* Sticky 狀態條（pair 唯一休息呈現載體） */}
                      <PairStickyBar
                        pairState={pairState}
                        pairInfo={pairCfg}
                        tailProgress={tailProgress}
                        currentTime={currentTime}
                        enterPairFromTs={prevEndTs}
                        enterPairLabel={enterPairLabel}
                      />
                      {/* Inner exercises */}
                      <div className="divide-y-[0.5px] divide-separator">
                        {group.items.map(entry => (
                          <React.Fragment key={entry.exercise.id}>
                            {renderExerciseInner({
                              entry,
                              hideInterRest: true,
                              pairRest,
                              prevEndTs: null,
                              pairOrder,
                              inPair: true,
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                      {/* TMJ footer */}
                      <p className="hairline-t mx-4 flex h-11 items-center gap-2 text-footnote text-label-2">
                        <Wind size={16} aria-hidden="true" />
                        下顎放鬆 · 鼻吸口呼
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={group.id} className="pt-3">
                  {renderExerciseInner({
                    entry: group.item,
                    hideInterRest: false,
                    pairRest: null,
                    prevEndTs,
                  })}
                </div>
              );
            })}

            {/* 新增動作 */}
            <button
              ref={addExerciseRef}
              type="button"
              onClick={() => setShowAddExercise(true)}
              className="mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-card text-body font-semibold text-accent-text transition-colors duration-150 active:bg-elevated"
            >
              <Plus size={20} aria-hidden="true" /> 新增動作
            </button>
          </div>
        )}
      </main>

      {/* ==================== 休息膠囊 ==================== */}
      <Presence exitMs={PILL_EXIT_MS}>
        {/* 健身房模式做組中不顯示（人物正在做下一組）；底部留白和膠囊出現的紀錄照舊用 restPill */}
        {restPill && !lifting && (
          <RestPill
            label={restPill.label}
            elapsedText={restPill.elapsedText}
            targetText={restPill.targetText}
            overText={restPill.overText}
            pct={restPill.pct}
            nextName={restPill.nextName}
            nextSetNo={restPill.nextSetNo}
            onClick={() => {
              if (reorderMode) {
                exitReorder({ scrollToKey: restPill.key });
                return;
              }
              // 健身房模式：先換到下一組那站（同步畫出它的動作卡）再捲過去
              const slot = gymMode ? sessionOrder.find(s => s.key === restPill.key) : null;
              if (slot) flushSync(() => pickGymExercise(slot.entry.exercise.id));
              scrollToSet(restPill.key);
            }}
          />
        )}
      </Presence>

      {/* ==================== 週次 sheet ==================== */}
      <SheetPresence>
        {sheet?.kind === 'week' && (
          <BottomSheet title="週次" onClose={closeSheet}>
            <div className="px-4 pb-6 pt-2">
              <div className="divide-y-[0.5px] divide-separator overflow-hidden rounded-[14px] bg-elevated">
                {[...Array(10)].map((_, i) => {
                  const w = i + 1;
                  const g = getWeeklyGuidance(w);
                  const wPhase = PHASE_STYLE[getPhase(w)] ?? PHASE_STYLE.hypertrophy;
                  const isCurrent = w === currentWeek;
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-current={isCurrent ? 'true' : undefined}
                      onClick={() => {
                        closeSheet();
                        // 排序模式中換到別週：先離開排序模式，回到頂部
                        if (reorderMode && w !== currentWeek) exitReorder('top');
                        onSelectWeek?.(w);
                      }}
                      className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left transition-colors duration-150 active:bg-fill"
                    >
                      <span className="w-11 shrink-0 font-num text-body font-semibold tabular-nums text-label">W{w}</span>
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-subhead text-label-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${wPhase.dot}`} aria-hidden="true" />
                        <span className="truncate">{g.label}</span>
                      </span>
                      <span className="w-[72px] shrink-0 whitespace-nowrap text-right font-num text-subhead tabular-nums text-label-2">RIR {g.rir}</span>
                      <span className="flex w-5 shrink-0 justify-end">
                        {isCurrent && <Check size={18} strokeWidth={2.5} className="text-accent-text" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </BottomSheet>
        )}
      </SheetPresence>

      {/* ==================== 本週訓練量 sheet ==================== */}
      <SheetPresence>
        {sheet?.kind === 'volume' && (
          <BottomSheet title="本週訓練量" onClose={closeSheet} data-volume-sheet>
            <div className="space-y-5 px-4 pb-6 pt-2">
              <ul className="divide-y-[0.5px] divide-separator overflow-hidden rounded-[14px] bg-elevated">
                {Object.entries(weeklyVolume).map(([muscle, sets]) => {
                  if (sets === 0) return null;
                  const target = getWeeklyMuscleVolume(muscle, currentWeek);
                  const percentage = target > 0 ? Math.min(100, (sets / target) * 100) : 0;
                  const shortfall = target > sets ? target - sets : 0;
                  return (
                    <li key={muscle} className="px-4 py-3">
                      <div className="flex items-baseline justify-between text-subhead">
                        <span className="text-label">{MUSCLE_GROUPS[muscle]}</span>
                        <span className="text-label-2"><span className="font-num font-semibold tabular-nums text-label">{sets}</span> / {target} 組{shortfall > 0 && (
                          <span className="ml-1.5 font-semibold text-label">↓{shortfall}</span>
                        )}</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                        <div className={`h-full rounded-full ${phaseStyle.dot}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="px-1 text-footnote text-label-2">
                數字是實際 / 規格目標。↓N 是單動作 {MAX_SETS_PER_EXERCISE} 組上限造成的缺額，可以在動作選項的「增加一組」補回。
              </p>

              <section className="rounded-[14px] bg-elevated p-4">
                <h4 className="flex items-center gap-2 text-subhead font-semibold text-label">
                  <span className={`h-2 w-2 rounded-full ${phaseStyle.dot}`} aria-hidden="true" />
                  {PHASE_CONFIG[phase].label}
                </h4>
                <p className="mt-1.5 text-subhead text-label-2">
                  {phase === 'hypertrophy'
                    ? `W1–W4 肌肥大期：肌群週容量從 MEV 遞增到 MRV，複合動作 ${enDash(PHASE_CONFIG.hypertrophy.compound)} 下，隔離動作 ${enDash(PHASE_CONFIG.hypertrophy.isolation)} 下。`
                    : phase === 'strength'
                      ? `W6–W9 肌力期：總組數固定在 MEV，專注重量遞增。複合動作 ${enDash(PHASE_CONFIG.strength.compound)} 下，隔離動作 ${enDash(PHASE_CONFIG.strength.isolation)} 下。`
                      : '減量週：所有肌群組數降到 MEV 的 50%，降低疲勞累積，為下一階段做準備。'}
                </p>
              </section>

              <section>
                <h4 className="px-1 text-subhead font-semibold text-label">本週循環</h4>
                <div className="mt-2 grid grid-cols-5 gap-1.5 text-center">
                  {[0, 1, 2, 3, 4].map(d => {
                    const wKey = getWorkoutForDay(currentWeek, d);
                    const workout = WORKOUTS[wKey];
                    return (
                      <div key={d} className="rounded-xl bg-elevated py-2">
                        <p className="font-num text-caption tabular-nums text-label-2">D{d + 1}</p>
                        <p className="font-num text-title3 font-semibold text-label">{wKey}</p>
                        <p className="flex items-center justify-center gap-1 text-caption text-label-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${sessionThemeOf(workout.type).dot}`} aria-hidden="true" />
                          {sessionThemeOf(workout.type).label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </BottomSheet>
        )}
      </SheetPresence>

      {/* ==================== 動作選項 sheet ==================== */}
      <SheetPresence>
        {optionsEntry && (() => {
          const ex = optionsEntry.exercise;
          const exName = customExerciseNames[ex.id] || ex.name;
          const setsCount = optionsEntry.sets;
          return (
            <BottomSheet title={exName} onClose={closeSheet} returnFocusRef={optionsTriggerRef}>
              <div className="px-4 pb-6">
                <p className="pb-3 text-center text-footnote text-label-2">
                  這週 <span className="font-num font-semibold tabular-nums text-label">{setsCount}</span> 組
                </p>
                <div className="divide-y-[0.5px] divide-separator overflow-hidden rounded-[14px] bg-elevated">
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
                  {/* superset 成員也有：排序的單位是整個配對 */}
                  <SheetAction
                    icon={ArrowUpDown}
                    title="調整順序"
                    onClick={() => enterReorder(ex.id)}
                  >
                    調整順序
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
                      destructive
                      title="刪除此動作"
                      onClick={() => {
                        const ids = groupedPlan.flatMap(g => (g.type === 'pair' ? g.items.map(it => it.exercise.id) : [g.item.exercise.id]));
                        deleteFocusRef.current = { exId: ex.id, nextId: ids[ids.indexOf(ex.id) + 1] ?? null };
                        removeCustomExercise(ex.id, exName);
                      }}
                    >
                      刪除此動作
                    </SheetAction>
                  )}
                </div>
              </div>
            </BottomSheet>
          );
        })()}
      </SheetPresence>

      {/* ==================== 替換動作 sheet ==================== */}
      <SheetPresence>
        {pickerForExId && (
          <BottomSheet
            title="替換動作"
            onClose={() => { setPickerForExId(null); setPickerSearch(''); }}
            returnFocusRef={optionsTriggerRef}
            footer={currentOverrideId && (
              <div className="hairline-t px-4 pb-4 pt-3">
                <button
                  type="button"
                  onClick={() => resetExerciseOverride(pickerForExId)}
                  className="h-[50px] w-full rounded-[14px] bg-elevated text-body font-semibold text-accent-text transition-colors duration-150 active:bg-fill"
                >
                  恢復為原動作
                </button>
              </div>
            )}
          >
            <div className="sticky top-0 z-10 bg-card px-4 pb-3 pt-1">
              <label className="relative block">
                <span className="sr-only">搜尋動作或肌群</span>
                <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-label-2" aria-hidden="true" />
                <input
                  data-autofocus
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="搜尋動作或肌群"
                  className="h-11 w-full rounded-xl bg-elevated pl-10 pr-3 text-body text-label placeholder:text-label-2"
                />
              </label>
            </div>
            <div className="px-4 pb-4">
              {filteredLibrary.length === 0 ? (
                <p className="py-6 text-center text-subhead text-label-2">沒有符合的動作</p>
              ) : (
                <div className="divide-y-[0.5px] divide-separator overflow-hidden rounded-[14px] bg-elevated">
                  {filteredLibrary.map(item => {
                    const isCurrent = currentOverrideId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isCurrent ? 'true' : undefined}
                        onClick={() => applyLibraryToExercise(pickerForExId, item)}
                        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors duration-150 active:bg-fill"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body text-label">{item.name}</span>
                          <span className="mt-0.5 block text-footnote text-label-2">
                            {MUSCLE_GROUPS[item.muscle] ?? '未知'} · {item.type === 'compound' ? '複合' : '隔離'}
                          </span>
                        </span>
                        {isCurrent && (
                          <span className="flex shrink-0 items-center gap-1 text-footnote font-semibold text-accent-text">
                            <Check size={16} strokeWidth={2.5} aria-hidden="true" />目前
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </BottomSheet>
        )}
      </SheetPresence>

      {/* ==================== 新增動作 sheet ==================== */}
      <SheetPresence>
        {showAddExercise && (
          <BottomSheet
            title="新增動作"
            onClose={() => setShowAddExercise(false)}
            footer={(
              <div className="flex gap-3 px-4 pb-4 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddExercise(false)}
                  className="h-[50px] flex-1 rounded-[14px] bg-elevated text-body font-semibold text-label transition-colors duration-150 active:bg-fill"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={addCustomExercise}
                  disabled={!newEx.name.trim()}
                  className="h-[50px] flex-1 rounded-[14px] bg-accent/20 text-body font-semibold text-accent-text transition-colors duration-150 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-label-3"
                >
                  新增
                </button>
              </div>
            )}
          >
            <div className="space-y-5 px-4 pb-4 pt-2">
              <label className="block">
                <span className="mb-2 block px-1 text-footnote font-medium text-label-2">動作名稱</span>
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
                  className="h-12 w-full rounded-xl bg-elevated px-4 text-body text-label placeholder:text-label-2"
                />
              </label>

              <label className="block">
                <span className="mb-2 block px-1 text-footnote font-medium text-label-2">肌群</span>
                <span className="relative block">
                  <select
                    value={newEx.muscle}
                    onChange={(e) => setNewEx(prev => ({ ...prev, muscle: e.target.value }))}
                    className="h-12 w-full appearance-none rounded-xl bg-elevated pl-4 pr-10 text-body text-label"
                  >
                    {Object.entries(MUSCLE_GROUPS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-label-2" aria-hidden="true" />
                </span>
              </label>

              <fieldset>
                <legend className="mb-2 px-1 text-footnote font-medium text-label-2">類型</legend>
                <div className="grid h-[52px] grid-cols-2 gap-1 rounded-[14px] bg-elevated p-1">
                  {[
                    { value: 'compound', label: '複合動作' },
                    { value: 'isolation', label: '隔離動作' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={newEx.type === value}
                      onClick={() => setNewEx(prev => ({ ...prev, type: value }))}
                      className={`h-11 rounded-[10px] text-subhead font-medium transition-colors duration-200
                      ${newEx.type === value
                        ? 'bg-thumb text-label shadow-[0_3px_8px_rgba(0,0,0,0.35)]'
                        : 'text-label-2'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </BottomSheet>
        )}
      </SheetPresence>
    </div>
  );
};

export default TrainingView;
