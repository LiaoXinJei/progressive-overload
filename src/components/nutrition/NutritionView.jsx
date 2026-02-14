import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Camera, Pencil, Trash2, Settings } from 'lucide-react';
import { calculateDailyTotals } from '../../utils/nutritionCalculations';
import MacroProgressBar from './MacroProgressBar';
import TDEECalculator from './TDEECalculator';
import MealEntry from './MealEntry';
import FoodPhotoAnalyzer from './FoodPhotoAnalyzer';

const NutritionView = ({ nutritionProfile, setNutritionProfile, nutritionLogs, setNutritionLogs }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [showTDEE, setShowTDEE] = useState(false);
  const [showMealEntry, setShowMealEntry] = useState(false);
  const [showPhotoAnalyzer, setShowPhotoAnalyzer] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const isToday = selectedDate === today;

  const navigateDate = (direction) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + direction);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatDateDisplay = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}/${d.getDate()} (${weekdays[d.getDay()]})`;
  };

  const dayData = nutritionLogs[selectedDate] || { meals: [] };
  const dailyTotals = useMemo(() => calculateDailyTotals(dayData.meals), [dayData.meals]);

  const hasProfile = nutritionProfile && nutritionProfile.targetCalories;

  const saveMeal = (meal) => {
    setNutritionLogs(prev => {
      const existing = prev[selectedDate] || { meals: [] };
      return {
        ...prev,
        [selectedDate]: {
          meals: [...existing.meals, meal].sort((a, b) => a.time.localeCompare(b.time))
        }
      };
    });
  };

  const deleteMeal = (mealId) => {
    setNutritionLogs(prev => {
      const existing = prev[selectedDate] || { meals: [] };
      return {
        ...prev,
        [selectedDate]: {
          meals: existing.meals.filter(m => m.id !== mealId)
        }
      };
    });
  };

  const handleSaveProfile = (profile) => {
    setNutritionProfile(prev => ({
      ...(prev || {}),
      ...profile,
      geminiApiKey: prev?.geminiApiKey || '',
    }));
  };

  // ==================== 未設定 Profile 引導畫面 ====================
  if (!hasProfile) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-900/30 border border-emerald-800 flex items-center justify-center mx-auto mb-6">
            <Settings size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-white italic mb-3">設定你的營養目標</h2>
          <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
            首先計算你的 TDEE（每日總消耗熱量），<br />
            系統將為你設定個人化的巨量營養素目標。
          </p>
          <button
            onClick={() => setShowTDEE(true)}
            className="px-8 py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs
            hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50"
          >
            開始計算 TDEE
          </button>
        </div>

        {showTDEE && (
          <TDEECalculator
            profile={nutritionProfile}
            onSave={handleSaveProfile}
            onClose={() => setShowTDEE(false)}
          />
        )}
      </main>
    );
  }

  // ==================== 主畫面 ====================
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateDate(-1)}
          className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className={`text-lg font-black ${isToday ? 'text-emerald-400' : 'text-white'}`}>
            {isToday ? '今天' : formatDateDisplay(selectedDate)}
          </div>
          {isToday && (
            <div className="text-[10px] text-neutral-500">{formatDateDisplay(selectedDate)}</div>
          )}
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="p-2 rounded-xl bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          disabled={selectedDate >= today}
        >
          <ChevronRight size={20} className={selectedDate >= today ? 'opacity-30' : ''} />
        </button>
      </div>

      {/* Daily Summary Card */}
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 shadow-2xl">
        {/* Calories */}
        <div className="text-center mb-6">
          <div className="text-[10px] font-bold text-neutral-500 uppercase mb-1">每日熱量</div>
          <div className="flex items-baseline justify-center gap-2">
            <span className={`text-4xl font-black font-mono ${
              dailyTotals.calories > nutritionProfile.targetCalories ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {Math.round(dailyTotals.calories)}
            </span>
            <span className="text-neutral-600 text-sm">/ {nutritionProfile.targetCalories} kcal</span>
          </div>
          <div className="text-xs text-neutral-600 mt-1">
            剩餘 {Math.max(0, nutritionProfile.targetCalories - Math.round(dailyTotals.calories))} kcal
          </div>
        </div>

        {/* Macro Progress Bars */}
        <div className="space-y-4">
          <MacroProgressBar
            label="蛋白質"
            current={dailyTotals.protein}
            target={nutritionProfile.targetProtein}
            color="bg-emerald-500"
          />
          <MacroProgressBar
            label="碳水化合物"
            current={dailyTotals.carbs}
            target={nutritionProfile.targetCarbs}
            color="bg-blue-500"
          />
          <MacroProgressBar
            label="脂肪"
            current={dailyTotals.fat}
            target={nutritionProfile.targetFat}
            color="bg-amber-500"
          />
        </div>

        {/* Edit TDEE */}
        <button
          onClick={() => setShowTDEE(true)}
          className="mt-4 w-full text-center text-[11px] text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          編輯 TDEE 設定
        </button>
      </div>

      {/* Meals List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white uppercase italic">餐點記錄</h3>
          <span className="text-[10px] text-neutral-600">{dayData.meals.length} 筆</span>
        </div>

        {dayData.meals.length === 0 ? (
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-8 text-center">
            <p className="text-neutral-600 text-sm">尚無餐點記錄</p>
            <p className="text-neutral-700 text-xs mt-1">點擊下方按鈕新增餐點</p>
          </div>
        ) : (
          dayData.meals.map(meal => {
            const mealTotals = (meal.items || []).reduce(
              (acc, item) => ({
                calories: acc.calories + (item.calories || 0),
                protein: acc.protein + (item.protein || 0),
                carbs: acc.carbs + (item.carbs || 0),
                fat: acc.fat + (item.fat || 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );

            return (
              <div key={meal.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-neutral-500">{meal.time}</span>
                    <span className="font-bold text-neutral-200 text-sm">{meal.name}</span>
                    {meal.source === 'ai' && (
                      <span className="text-[9px] font-bold bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded-full border border-purple-800">
                        AI
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteMeal(meal.id)}
                    className="text-neutral-700 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Food Items */}
                <div className="space-y-1.5 mb-3">
                  {meal.items.map(item => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="text-neutral-400">{item.name}</span>
                      <span className="text-neutral-600 font-mono">{item.calories} kcal</span>
                    </div>
                  ))}
                </div>

                {/* Meal Totals */}
                <div className="flex justify-between text-[10px] pt-2 border-t border-neutral-800">
                  <span className="font-bold text-neutral-400">{Math.round(mealTotals.calories)} kcal</span>
                  <div className="flex gap-3 text-neutral-600">
                    <span>P {Math.round(mealTotals.protein)}g</span>
                    <span>C {Math.round(mealTotals.carbs)}g</span>
                    <span>F {Math.round(mealTotals.fat)}g</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-3 z-40">
        <button
          onClick={() => setShowPhotoAnalyzer(true)}
          className="w-12 h-12 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-900/50
          hover:bg-purple-500 transition-all flex items-center justify-center"
          title="AI 食物分析"
        >
          <Camera size={20} />
        </button>
        <button
          onClick={() => setShowMealEntry(true)}
          className="w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/50
          hover:bg-emerald-500 transition-all flex items-center justify-center"
          title="手動新增餐點"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Modals */}
      {showTDEE && (
        <TDEECalculator
          profile={nutritionProfile}
          onSave={handleSaveProfile}
          onClose={() => setShowTDEE(false)}
        />
      )}
      {showMealEntry && (
        <MealEntry
          onSave={saveMeal}
          onClose={() => setShowMealEntry(false)}
        />
      )}
      {showPhotoAnalyzer && (
        <FoodPhotoAnalyzer
          apiKey={nutritionProfile?.geminiApiKey}
          onSave={saveMeal}
          onClose={() => setShowPhotoAnalyzer(false)}
          onNeedApiKey={() => alert('請先在設定中輸入 Gemini API Key')}
        />
      )}
    </main>
  );
};

export default NutritionView;
