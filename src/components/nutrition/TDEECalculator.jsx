import React, { useState } from 'react';
import { Calculator, X } from 'lucide-react';
import { ACTIVITY_LEVELS, GOALS } from '../../constants/nutrition';
import { calculateBMR, calculateTDEE, calculateMacros } from '../../utils/nutritionCalculations';

// 合理範圍外（含清空）不能儲存，避免目標熱量變 0 或負數
const BODY_FIELDS = [
  { field: 'age', label: '年齡', unit: '歲', min: 10, max: 100, inputMode: 'numeric' },
  { field: 'height', label: '身高', unit: 'cm', min: 100, max: 250, inputMode: 'decimal' },
  { field: 'weight', label: '體重', unit: 'kg', min: 30, max: 300, inputMode: 'decimal' },
];

const TDEECalculator = ({ profile, onSave, onClose }) => {
  // 年齡 / 身高 / 體重存輸入框的原始字串，才能清空重打；計算和儲存時再轉數字
  const [form, setForm] = useState({
    gender: profile?.gender || 'male',
    age: String(profile?.age || 30),
    height: String(profile?.height || 175),
    weight: String(profile?.weight || 75),
    activityLevel: profile?.activityLevel || 1.55,
    goal: profile?.goal || 'maintain',
  });

  const body = {
    age: parseFloat(form.age),
    height: parseFloat(form.height),
    weight: parseFloat(form.weight),
  };
  // NaN 比大小都是 false，空白也會算不合法
  const invalidFields = BODY_FIELDS.filter(({ field, min, max }) => !(body[field] >= min && body[field] <= max));
  const bodyValid = invalidFields.length === 0;

  const bmr = bodyValid ? calculateBMR(form.gender, body.weight, body.height, body.age) : null;
  const tdee = bodyValid ? calculateTDEE(bmr, form.activityLevel) : null;
  const goalConfig = GOALS.find(g => g.value === form.goal) || GOALS[1];
  const targetCalories = bodyValid ? tdee + goalConfig.calorieAdjust : null;
  const macros = bodyValid ? calculateMacros(targetCalories, body.weight, form.goal) : null;
  // 範圍內的極端組合（例如 100 歲、30 kg、久坐、減脂）還是可能算出 ≤ 0
  const caloriesTooLow = bodyValid && targetCalories <= 0;
  const canSave = bodyValid && !caloriesTooLow;
  // 資料不合法時結果顯示 —
  const shown = (value) => (bodyValid ? value : '—');

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      ...form,
      ...body,
      tdee,
      targetCalories,
      targetProtein: macros.protein,
      targetFat: macros.fat,
      targetCarbs: macros.carbs,
    });
    onClose();
  };

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    // z-[60]：要疊在底部 tab 列（z-50）上面
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[40px] max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-white italic uppercase flex items-center gap-2">
            <Calculator size={24} className="text-emerald-500" /> TDEE 計算器
          </h3>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Gender */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-neutral-300 mb-2">性別</label>
          <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700">
            {[{ v: 'male', l: '男性' }, { v: 'female', l: '女性' }].map(opt => (
              <button
                key={opt.v}
                onClick={() => updateField('gender', opt.v)}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all
                ${form.gender === opt.v ? 'bg-emerald-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* Age / Height / Weight */}
        <div className={`grid grid-cols-3 gap-3 ${bodyValid ? 'mb-5' : 'mb-2'}`}>
          {BODY_FIELDS.map(({ field, label, unit, min, max, inputMode }) => {
            const invalid = invalidFields.some(f => f.field === field);
            return (
              <div key={field}>
                <label className="block text-[10px] font-bold text-neutral-500 mb-1 uppercase">{label}</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode={inputMode}
                    min={min} max={max}
                    value={form[field]}
                    onChange={(e) => updateField(field, e.target.value)}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `tdee-${field}-error` : undefined}
                    className={`w-full bg-neutral-800 px-3 py-3 rounded-xl text-center font-mono text-sm
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 border
                    ${invalid ? 'border-rose-500 text-rose-300' : 'border-neutral-700'}`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-600">{unit}</span>
                </div>
              </div>
            );
          })}
        </div>
        {!bodyValid && (
          <div className="mb-5 space-y-0.5">
            {invalidFields.map(({ field, label, unit, min, max }) => (
              <p key={field} id={`tdee-${field}-error`} className="text-xs text-rose-400">
                {label}請填 {min}–{max} {unit}
              </p>
            ))}
          </div>
        )}

        {/* Activity Level */}
        <div className="mb-5">
          <label className="block text-sm font-bold text-neutral-300 mb-2">活動等級</label>
          <div className="space-y-2">
            {ACTIVITY_LEVELS.map(level => (
              <button
                key={level.value}
                onClick={() => updateField('activityLevel', level.value)}
                className={`w-full text-left p-3 rounded-xl border transition-all text-sm
                ${form.activityLevel === level.value
                  ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                  : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-500'}`}
              >
                <div className="font-bold">{level.label}</div>
                <div className="text-[11px] opacity-70">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-neutral-300 mb-2">目標</label>
          <div className="flex bg-neutral-800 p-1 rounded-full border border-neutral-700">
            {GOALS.map(goal => (
              <button
                key={goal.value}
                onClick={() => updateField('goal', goal.value)}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all
                ${form.goal === goal.value ? 'bg-emerald-600 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                {goal.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="bg-neutral-800/50 rounded-2xl border border-neutral-700 p-4 mb-6">
          <p className="text-[10px] font-bold text-neutral-500 uppercase mb-3">計算結果</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-900/50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-neutral-500 uppercase">BMR</div>
              <div className="text-lg font-black font-mono text-neutral-300">{shown(Math.round(bmr))}</div>
              <div className="text-[10px] text-neutral-600">kcal</div>
            </div>
            <div className="bg-neutral-900/50 rounded-xl p-3 text-center">
              <div className="text-[10px] text-neutral-500 uppercase">TDEE</div>
              <div className="text-lg font-black font-mono text-neutral-300">{shown(tdee)}</div>
              <div className="text-[10px] text-neutral-600">kcal</div>
            </div>
            <div className="col-span-2 bg-emerald-900/20 border border-emerald-800 rounded-xl p-3 text-center">
              <div className="text-[10px] text-emerald-500 uppercase font-bold">每日目標攝取</div>
              <div className="text-2xl font-black font-mono text-emerald-400">{shown(targetCalories)}</div>
              <div className="text-[10px] text-emerald-600">kcal</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="text-center">
              <div className="text-[10px] text-neutral-500">蛋白質</div>
              <div className="font-black font-mono text-emerald-400">{shown(macros?.protein)}g</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-neutral-500">碳水</div>
              <div className="font-black font-mono text-blue-400">{shown(macros?.carbs)}g</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-neutral-500">脂肪</div>
              <div className="font-black font-mono text-amber-400">{shown(macros?.fat)}g</div>
            </div>
          </div>
        </div>

        {/* 欄位錯誤在上面，可能已經捲出畫面，按鈕旁再說一次為什麼不能存 */}
        {!canSave && (
          <p id="tdee-save-hint" className="text-xs text-rose-400 text-center mb-3">
            {caloriesTooLow
              ? `目標熱量必須大於 0（目前 ${targetCalories} kcal），請確認資料或換個目標`
              : '請先修正標紅的欄位'}
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={!canSave}
          aria-describedby={!canSave ? 'tdee-save-hint' : undefined}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50
          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
        >
          儲存設定
        </button>
      </div>
    </div>
  );
};

export default TDEECalculator;
