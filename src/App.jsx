import React, { useState, useEffect } from 'react';
import {
  RotateCcw, Activity, AlertTriangle, TrendingUp, ShieldCheck,
  Timer, Play, Pause, RotateCw, Settings
} from 'lucide-react';
import TrainingView from './components/training/TrainingView';
import NutritionView from './components/nutrition/NutritionView';
import TabNavigation from './components/shared/TabNavigation';

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
  const [timerState, setTimerState] = useState({ startTime: null, elapsed: 0, isRunning: false });
  const [customExerciseNames, setCustomExerciseNames] = useState({});
  const [weightIncrement, setWeightIncrement] = useState(2);
  const [showSettings, setShowSettings] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // 營養功能狀態
  const [nutritionProfile, setNutritionProfile] = useState(null);
  const [nutritionLogs, setNutritionLogs] = useState({});

  // ==================== 計時器邏輯 ====================

  useEffect(() => {
    let interval;
    if (timerState.isRunning) {
      interval = setInterval(() => {
        setTimerState(prev => ({
          ...prev,
          elapsed: Math.floor((Date.now() - prev.startTime) / 1000)
        }));
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [timerState.isRunning, timerState.startTime]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTimer = () => {
    setTimerState(prev => {
      if (prev.isRunning) {
        return { ...prev, isRunning: false };
      } else {
        const now = Date.now();
        const startTime = prev.elapsed > 0 ? now - (prev.elapsed * 1000) : now;
        return { ...prev, isRunning: true, startTime };
      }
    });
  };

  const resetTimer = () => {
    setTimerState({ startTime: null, elapsed: 0, isRunning: false });
  };

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
        setHistory(data.history || {});
        setMode(data.mode || 'maintenance');
        setCurrentWeek(data.viewState?.currentWeek || 1);
        setCurrentDay(data.viewState?.currentDay || 0);
        setShowStats(data.viewState?.showStats ?? true);
        setCustomExerciseNames(data.customExerciseNames || {});
        setWeightIncrement(data.weightIncrement ?? 2);
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
      logs, history, mode,
      viewState: { currentWeek, currentDay, showStats },
      customExerciseNames, weightIncrement, activeTab,
      nutritionProfile, nutritionLogs
    };
    localStorage.setItem('rp_focus_pro_data', JSON.stringify(state));
  }, [logs, history, mode, currentWeek, currentDay, showStats, customExerciseNames, weightIncrement, activeTab, nutritionProfile, nutritionLogs]);

  // ==================== 重置 ====================

  const resetData = () => {
    setLogs({});
    setHistory({});
    setCurrentWeek(1);
    setCurrentDay(0);
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
              {activeTab === 'training' && (
                <div className="flex items-center gap-2 bg-neutral-800 px-4 py-2 rounded-full border border-neutral-700">
                  <Timer size={16} className="text-emerald-500" />
                  <span className="font-mono text-sm min-w-[60px] text-center">
                    {formatTime(timerState.elapsed)}
                  </span>
                  <button
                    onClick={toggleTimer}
                    className="text-neutral-400 hover:text-white transition-colors"
                    title={timerState.isRunning ? '暫停' : '開始'}
                  >
                    {timerState.isRunning ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="text-neutral-400 hover:text-white transition-colors"
                    title="重置計時器"
                  >
                    <RotateCw size={14} />
                  </button>
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
                    onClick={() => setCurrentWeek(w)}
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

      {/* ==================== Settings Modal ==================== */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-md w-full shadow-2xl">
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

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50"
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
