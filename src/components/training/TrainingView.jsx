import React, { useState, useMemo } from 'react';
import {
  Activity, BarChart2, ChevronDown, ChevronUp,
  TrendingUp, ShieldCheck, Plus, Minus, Check,
  Edit2, Save
} from 'lucide-react';
import { WORKOUTS, MUSCLE_GROUPS, VOLUME_CONFIG, PHASE_CONFIG, MUSCLE_SESSION_MAP, MAX_SETS_PER_EXERCISE } from '../../constants/workouts';

const TrainingView = ({
  logs, setLogs,
  history, setHistory,
  mode, currentWeek, currentDay, setCurrentDay,
  showStats, setShowStats,
  customExerciseNames, setCustomExerciseNames,
  weightIncrement,
  currentTime
}) => {
  const [editingExercise, setEditingExercise] = useState(null);

  // ==================== 核心邏輯函數 ====================

  const getWorkoutForDay = (week, dayIndex) => {
    return ['A', 'B', 'C', 'D'][dayIndex];
  };

  // 取得當前週次的訓練階段
  const getPhase = (week) => {
    if (week === 5 || week === 10) return 'deload';
    if (week <= 4) return 'hypertrophy';
    return 'strength';
  };

  // 取得某肌群在某週的目標組數
  const getWeeklyMuscleVolume = (muscle, week) => {
    const targets = VOLUME_CONFIG[muscle];
    if (!targets) return 0;
    const phase = getPhase(week);
    if (phase === 'deload') {
      return Math.max(2, Math.floor(targets[0] * 0.5));
    }
    if (phase === 'strength') {
      return targets[0]; // 固定在 MEV，重量遞增
    }
    // 肌肥大期：W1-W4 對應 targets[0]-targets[3]
    return targets[week - 1];
  };

  // 取得動作的建議次數範圍（依階段和動作類型）
  const getRepRange = (exerciseType, week) => {
    const phase = getPhase(week);
    const config = PHASE_CONFIG[phase];
    return exerciseType === 'compound' ? config.compound : config.isolation;
  };

  // 計算某日的完整訓練計畫（肌群週容量 → 分配到 session → 分配到動作）
  const getSessionPlan = (week, workoutKey) => {
    const workout = WORKOUTS[workoutKey];

    // 統計此 session 中每個肌群有幾個動作
    const muscleExCounts = {};
    workout.exercises.forEach(ex => {
      muscleExCounts[ex.muscle] = (muscleExCounts[ex.muscle] || 0) + 1;
    });

    // 計算每個肌群在此 session 分到的組數
    const muscleSessionTargets = {};
    for (const muscle of Object.keys(muscleExCounts)) {
      const weeklyTarget = getWeeklyMuscleVolume(muscle, week);
      const sessions = MUSCLE_SESSION_MAP[muscle];
      const totalSessions = sessions.length;
      const sessionIdx = sessions.indexOf(workoutKey);
      const base = Math.floor(weeklyTarget / totalSessions);
      const remainder = weeklyTarget % totalSessions;
      muscleSessionTargets[muscle] = base + (sessionIdx < remainder ? 1 : 0);
    }

    // 分配到各動作（餘數優先給後面的隔離/次要動作，不灌給主項複合動作）
    const muscleAssigned = {};
    return workout.exercises.map(ex => {
      const sessionTarget = muscleSessionTargets[ex.muscle];
      const exCount = muscleExCounts[ex.muscle];
      const idx = muscleAssigned[ex.muscle] || 0;
      muscleAssigned[ex.muscle] = idx + 1;

      const base = Math.floor(sessionTarget / exCount);
      const remainder = sessionTarget % exCount;
      // idx >= exCount - remainder → 後面的動作拿餘數
      const sets = Math.min(base + (idx >= exCount - remainder ? 1 : 0), MAX_SETS_PER_EXERCISE);

      return { exercise: ex, sets };
    });
  };

  const getWeeklyGuidance = (week) => {
    const phase = getPhase(week);
    if (phase === 'deload') return { rir: '4+', label: 'Deload', color: 'text-amber-400' };
    if (week === 4) return { rir: '0-1', label: '肌肥大 · Overreach', color: 'text-rose-500' };
    if (week === 9) return { rir: '0-1', label: '肌力 · Overreach', color: 'text-rose-500' };
    if (phase === 'hypertrophy') return { rir: '2-3', label: '肌肥大 · Accumulation', color: 'text-emerald-400' };
    return { rir: '2-3', label: '肌力 · Accumulation', color: 'text-cyan-400' };
  };

  // ==================== 工具函數 ====================

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateRestTime = (currentLogKey, previousLogKey) => {
    const currentLog = logs[currentLogKey];
    const previousLog = logs[previousLogKey];
    if (!currentLog?.completedAt || !previousLog?.completedAt) return null;
    const restSeconds = Math.floor((currentLog.completedAt - previousLog.completedAt) / 1000);
    return formatTime(restSeconds);
  };

  const getCurrentRestTime = (previousLogKey) => {
    const previousLog = logs[previousLogKey];
    if (!previousLog?.completedAt) return null;
    const restSeconds = Math.floor((currentTime - previousLog.completedAt) / 1000);
    return formatTime(restSeconds);
  };

  // ==================== 訓練記錄操作 ====================

  const updateLog = (logKey, field, value) => {
    setLogs(prev => ({
      ...prev,
      [logKey]: { ...prev[logKey], [field]: value }
    }));
  };

  const adjustWeight = (logKey, direction) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const delta = direction * weightIncrement;
      const newWeight = (parseFloat(current.weight) || 0) + delta;
      return {
        ...prev,
        [logKey]: { ...current, weight: Math.max(0, newWeight) }
      };
    });
  };

  const completeSet = (logKey, exerciseId) => {
    setLogs(prev => {
      const current = prev[logKey] || {};
      const weight = current.weight || history[exerciseId] || '';
      const newDone = !current.done;
      if (newDone && weight) {
        setHistory(h => ({ ...h, [exerciseId]: parseFloat(weight) }));
      }
      return {
        ...prev,
        [logKey]: {
          ...current, weight, done: newDone,
          completedAt: newDone ? Date.now() : undefined
        }
      };
    });
  };

  const saveCustomName = (exerciseId, customName) => {
    if (customName.trim()) {
      setCustomExerciseNames(prev => ({ ...prev, [exerciseId]: customName.trim() }));
    } else {
      setCustomExerciseNames(prev => {
        const updated = { ...prev };
        delete updated[exerciseId];
        return updated;
      });
    }
    setEditingExercise(null);
  };

  // ==================== 統計計算 ====================

  const weeklyVolume = useMemo(() => {
    const vol = {};
    Object.keys(MUSCLE_GROUPS).forEach(k => vol[k] = 0);
    [0, 1, 2, 3].forEach(dayIndex => {
      const workoutKey = getWorkoutForDay(currentWeek, dayIndex);
      const plan = getSessionPlan(currentWeek, workoutKey);
      plan.forEach(({ exercise, sets }) => {
        vol[exercise.muscle] = (vol[exercise.muscle] || 0) + sets;
      });
    });
    return vol;
  }, [currentWeek]);

  // ==================== 渲染 ====================

  const workoutKey = getWorkoutForDay(currentWeek, currentDay);
  const currentWorkout = WORKOUTS[workoutKey];
  const currentSessionPlan = getSessionPlan(currentWeek, workoutKey);
  const guidance = getWeeklyGuidance(currentWeek);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-12 gap-8">

      {/* ==================== 訓練區域 (左側) ==================== */}
      <div className="lg:col-span-8 space-y-6">

        {/* Day Selector (0-3) */}
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map(d => {
            const wKey = getWorkoutForDay(currentWeek, d);
            const workout = WORKOUTS[wKey];
            return (
              <button
                key={d}
                onClick={() => setCurrentDay(d)}
                className={`py-4 px-3 rounded-xl text-sm font-black transition-all border flex flex-col items-center gap-1
                ${currentDay === d
                  ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-neutral-600'}`}
              >
                <div className="text-xs opacity-60 font-normal">Day {d + 1}</div>
                <div className="text-2xl">{wKey}</div>
                <div className="text-[10px] font-normal opacity-75">{workout.name}</div>
              </button>
            );
          })}
        </div>

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
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-neutral-800 bg-neutral-800/30">
            <h2 className="text-2xl font-black text-white italic">{currentWorkout.name}</h2>
            <p className="text-neutral-500 text-sm mt-1">{currentWorkout.subtitle}</p>
          </div>

          <div className="divide-y divide-neutral-800">
            {currentSessionPlan.map(({ exercise: ex, sets: setsCount }, exIdx) => {
              const completedCount = [...Array(setsCount)].filter((_, idx) => {
                const logKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx}`;
                return logs[logKey]?.done;
              }).length;
              const allDone = completedCount === setsCount;

              const firstSetKey = `w${currentWeek}-d${currentDay}-${ex.id}-s0`;
              const firstSetLog = logs[firstSetKey];
              let previousExerciseLastSetKey = null;

              if (exIdx > 0) {
                const prevPlan = currentSessionPlan[exIdx - 1];
                previousExerciseLastSetKey = `w${currentWeek}-d${currentDay}-${prevPlan.exercise.id}-s${prevPlan.sets - 1}`;
              }

              return (
                <div key={ex.id} className={`p-6 transition-all ${allDone ? 'bg-emerald-500/5 opacity-60' : ''}`}>

                  {/* Exercise Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${ex.isUpper ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                        {editingExercise === ex.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              defaultValue={customExerciseNames[ex.id] || ex.name}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCustomName(ex.id, e.target.value);
                                else if (e.key === 'Escape') setEditingExercise(null);
                              }}
                              autoFocus
                              className="bg-neutral-800 px-2 py-1 rounded text-lg font-bold text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                              onClick={(e) => {
                                const input = e.currentTarget.previousSibling;
                                saveCustomName(ex.id, input.value);
                              }}
                              className="text-emerald-500 hover:text-emerald-400 transition-colors"
                              title="儲存"
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-lg font-bold text-neutral-100">
                              {customExerciseNames[ex.id] || ex.name}
                            </h3>
                            <button
                              onClick={() => setEditingExercise(ex.id)}
                              className="text-neutral-600 hover:text-neutral-400 transition-colors"
                              title="編輯動作名稱"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-black bg-neutral-800 text-neutral-400 px-2 py-1 rounded inline-block uppercase tracking-wider">
                          {MUSCLE_GROUPS[ex.muscle]}
                        </span>
                        <span className="text-[10px] font-mono bg-neutral-800 text-neutral-500 px-2 py-1 rounded inline-block">
                          {getRepRange(ex.type, currentWeek)} 下
                        </span>
                        <span className={`text-[10px] font-bold ${ex.type === 'compound' ? 'text-cyan-500' : 'text-neutral-600'}`}>
                          {ex.type === 'compound' ? '複合' : '隔離'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-neutral-700">
                        {setsCount}<span className="text-sm ml-1">組</span>
                      </div>
                      <div className="text-xs text-neutral-600">
                        {completedCount}/{setsCount} 完成
                      </div>
                    </div>
                  </div>

                  {/* Inter-Exercise Rest Time */}
                  {previousExerciseLastSetKey && (() => {
                    const prevLastSetLog = logs[previousExerciseLastSetKey];
                    if (prevLastSetLog?.completedAt && !firstSetLog?.done) {
                      const interExerciseRestTime = getCurrentRestTime(previousExerciseLastSetKey);
                      return (
                        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-800 rounded-xl">
                          <div className="text-sm text-blue-400 font-semibold animate-pulse flex items-center gap-2">
                            動作間休息: {interExerciseRestTime}
                          </div>
                        </div>
                      );
                    }
                    if (prevLastSetLog?.completedAt && firstSetLog?.completedAt) {
                      const interExerciseRestTime = calculateRestTime(firstSetKey, previousExerciseLastSetKey);
                      return interExerciseRestTime ? (
                        <div className="mb-4 p-3 bg-neutral-800/50 border border-neutral-700 rounded-xl">
                          <div className="text-sm text-neutral-500 flex items-center gap-2">
                            動作間休息: {interExerciseRestTime}
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
                      const historyWeight = history[ex.id];

                      return (
                        <React.Fragment key={idx}>
                          <div
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all
                            ${logData.done
                              ? 'bg-emerald-500/10 border border-emerald-500/30'
                              : 'bg-neutral-800/30 border border-neutral-800'}`}
                          >
                            <div className="text-xl font-black text-neutral-600 w-8 text-center">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">重量 (kg)</label>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => adjustWeight(logKey, -1)}
                                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                                  title={`-${weightIncrement}kg`}
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  step={weightIncrement}
                                  value={logData.weight || ''}
                                  onChange={(e) => updateLog(logKey, 'weight', e.target.value)}
                                  placeholder={historyWeight ? String(historyWeight) : '—'}
                                  className="w-20 bg-neutral-900 px-3 py-2 rounded-lg text-center font-mono text-sm
                                  focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                  onClick={() => adjustWeight(logKey, 1)}
                                  className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                                  title={`+${weightIncrement}kg`}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-neutral-500 block mb-1">次數</label>
                              <input
                                type="number"
                                value={logData.reps || ''}
                                onChange={(e) => updateLog(logKey, 'reps', e.target.value)}
                                placeholder="—"
                                className="w-full bg-neutral-900 px-3 py-2 rounded-lg text-center font-mono text-sm
                                focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <button
                              onClick={() => completeSet(logKey, ex.id)}
                              className={`p-3 rounded-lg transition-all flex items-center justify-center
                              ${logData.done
                                ? 'bg-emerald-500 text-black shadow-lg'
                                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'}`}
                            >
                              <Check size={20} strokeWidth={3} />
                            </button>
                          </div>

                          {/* Rest Time Display */}
                          {(() => {
                            const isLastSet = idx === setsCount - 1;
                            const nextLogKey = `w${currentWeek}-d${currentDay}-${ex.id}-s${idx + 1}`;
                            const nextLog = logs[nextLogKey];

                            if (logData.done && !isLastSet && nextLog?.done) {
                              const restTime = calculateRestTime(nextLogKey, logKey);
                              return restTime ? (
                                <div className="text-xs text-neutral-500 mt-1 pl-11">
                                  休息時間: {restTime}
                                </div>
                              ) : null;
                            }
                            if (logData.done && !isLastSet && !nextLog?.done) {
                              const cRestTime = getCurrentRestTime(logKey);
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
            })}
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
                  const percentage = Math.min(100, (sets / 24) * 100);
                  let color = 'bg-neutral-700';
                  if (sets >= 18) color = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]';
                  else if (sets >= 12) color = 'bg-emerald-500';
                  else if (sets > 0) color = 'bg-blue-500';

                  return (
                    <div key={muscle}>
                      <div className="flex justify-between text-[11px] font-black uppercase mb-1.5 opacity-80">
                        <span>{MUSCLE_GROUPS[muscle]}</span>
                        <span className="font-mono">{sets} 組</span>
                      </div>
                      <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

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
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[0, 1, 2, 3].map(d => {
                    const wKey = getWorkoutForDay(currentWeek, d);
                    return (
                      <div key={d} className="bg-neutral-900/50 rounded-lg py-2">
                        <div className="text-[9px] text-neutral-600">D{d + 1}</div>
                        <div className="text-lg font-black">{wKey}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default TrainingView;
