import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

  const lastCompletedAt = workoutTimes?.end ?? null;

  // 確認最近完成組的下一組是否仍需等待（未完成且未跳過）
  const restActive = useMemo(() => {
    if (!lastCompletedAt) return false;
    const prefix = `w${currentWeek}-d${currentDay}-`;
    const entry = Object.entries(logs).find(
      ([key, log]) => key.startsWith(prefix) && log?.completedAt === lastCompletedAt
    );
    if (!entry) return false;
    const match = entry[0].match(/^w\d+-d\d+-(.+)-s(\d+)$/);
    if (!match) return false;
    const nextKey = `${prefix}${match[1]}-s${parseInt(match[2]) + 1}`;
    const nextLog = logs[nextKey];
    if (!nextLog) return true;
    return !nextLog.skipped && !nextLog.done;
  }, [logs, lastCompletedAt, currentWeek, currentDay]);

  useRestNotification({ lastCompletedAt: restActive ? lastCompletedAt : null, restNotificationDelay });

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== 數據持久化 ====================

  useEffect(() => {
    const saved = localStorage.getItem('rp_focus_pro_data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setLogs(data.logs || {});
        // history 結構遷移：v2 number → v3 { weight, reps }
        const rawHistory = data.history || {};
        const migratedHistory = {};
        Object.entries(rawHistory).forEach(([k, v]) => {
          if (typeof v === 'number') {
            migratedHistory[k] = { weight: v, reps: '' };
          } else if (v && typeof v === 'object') {
            migratedHistory[k] = { weight: v.weight ?? '', reps: v.reps ?? '' };
          }
        });
        setHistory(migratedHistory);
        setMode(data.mode || 'maintenance');
        setCurrentWeek(data.viewState?.currentWeek || 1);
        setCurrentDay(data.viewState?.currentDay || 0);
        setShowStats(data.viewState?.showStats ?? true);
        setCustomExerciseNames(data.customExerciseNames || {});
        setCustomExercises(data.customExercises || {});
        setCustomSets(data.customSets || {});
        setExerciseOrder(data.exerciseOrder || {});
        setExerciseLibrary(
          Array.isArray(data.exerciseLibrary) && data.exerciseLibrary.length > 0
            ? data.exerciseLibrary
            : DEFAULT_EXERCISE_LIBRARY
        );
        setExerciseOverrides(data.exerciseOverrides || {});
        setWeightIncrement(data.weightIncrement ?? 2);
        setRestNotificationDelay(data.restNotificationDelay ?? 90);
        setActiveTab(data.activeTab || 'training');
        setNutritionProfile(data.nutritionProfile || null);
        setNutritionLogs(data.nutritionLogs || {});
      } catch (e) {
        console.error('載入數據失敗:', e);
      }
    }
  }, []);

  useEffect(() => {
    const state = {
      schemaVersion: 3,
      logs, history, mode,
      viewState: { currentWeek, currentDay, showStats },
      customExerciseNames, customExercises, customSets, exerciseOrder,
      exerciseLibrary, exerciseOverrides,
      weightIncrement, restNotificationDelay, activeTab,
      nutritionProfile, nutritionLogs
    };
    localStorage.setItem('rp_focus_pro_data', JSON.stringify(state));
  }, [logs, history, mode, currentWeek, currentDay, showStats, customExerciseNames, customExercises, customSets, exerciseOrder, exerciseLibrary, exerciseOverrides, weightIncrement, restNotificationDelay, activeTab, nutritionProfile, nutritionLogs]);

  // ==================== 重置 ====================

  const resetData = () => {
    setLogs({});
    setHistory({});
    setCurrentWeek(1);
    setCurrentDay(0);
    setCustomExercises({});
    setCustomSets({});
    setExerciseOrder({});
    setExerciseOverrides({});
    setExerciseLibrary(DEFAULT_EXERCISE_LIBRARY);
    setNutritionProfile(null);
    setNutritionLogs({});
    setShowResetConfirm(false);
  };

  // ==================== 渲染 ====================

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans pb-20">

      {/* ==================== Header ==================== */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50 shadow-2xl">
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
                title="重置所有數據"
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
                    onClick={() => { setCurrentWeek(w); setCurrentDay(0); }}
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
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black text-white mb-4 italic uppercase">重置所有數據？</h3>
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
                確定重置
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
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
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={weightIncrement}
                  onChange={(e) => setWeightIncrement(Math.max(0.25, parseFloat(e.target.value) || 0.25))}
                  className="flex-1 bg-neutral-800 px-4 py-3 rounded-xl text-center font-mono text-lg
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
                />
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
                離開 App 後，超過設定時間即發送通知提醒做下一組。
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
    </div>
  );
};

export default RPFocusPro;
