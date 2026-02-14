import React, { useState } from 'react';
import { Plus, Trash2, X, Save } from 'lucide-react';
import { DEFAULT_MEAL_NAMES } from '../../constants/nutrition';

const MealEntry = ({ onSave, onClose }) => {
  const [mealName, setMealName] = useState('');
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });
  const [items, setItems] = useState([
    { id: `i_${Date.now()}`, name: '', calories: '', protein: '', carbs: '', fat: '' }
  ]);

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, name: '', calories: '', protein: '', carbs: '', fat: '' }
    ]);
  };

  const removeItem = (id) => {
    if (items.length > 1) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const updateItem = (id, field, value) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSave = () => {
    const validItems = items
      .filter(item => item.name.trim())
      .map(item => ({
        id: item.id,
        name: item.name.trim(),
        calories: parseFloat(item.calories) || 0,
        protein: parseFloat(item.protein) || 0,
        carbs: parseFloat(item.carbs) || 0,
        fat: parseFloat(item.fat) || 0,
      }));

    if (validItems.length === 0) return;

    onSave({
      id: `m_${Date.now()}`,
      time,
      name: mealName || '餐點',
      source: 'manual',
      items: validItems,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[40px] max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-white italic uppercase">新增餐點</h3>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Meal Name Quick Select */}
        <div className="mb-4">
          <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase">餐點名稱</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {DEFAULT_MEAL_NAMES.map(name => (
              <button
                key={name}
                onClick={() => setMealName(name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${mealName === name ? 'bg-emerald-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
              >
                {name}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder="自訂名稱..."
            className="w-full bg-neutral-800 px-4 py-2 rounded-xl text-sm
            focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
          />
        </div>

        {/* Time */}
        <div className="mb-5">
          <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase">時間</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="bg-neutral-800 px-4 py-2 rounded-xl text-sm font-mono
            focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
          />
        </div>

        {/* Food Items */}
        <div className="space-y-3 mb-4">
          {items.map((item, idx) => (
            <div key={item.id} className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-neutral-500 uppercase">食物 {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-neutral-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                placeholder="食物名稱"
                className="w-full bg-neutral-900 px-3 py-2 rounded-lg text-sm mb-2
                focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
              />
              <div className="grid grid-cols-4 gap-2">
                {[
                  { field: 'calories', label: '熱量', unit: 'kcal' },
                  { field: 'protein', label: '蛋白質', unit: 'g' },
                  { field: 'carbs', label: '碳水', unit: 'g' },
                  { field: 'fat', label: '脂肪', unit: 'g' },
                ].map(({ field, label, unit }) => (
                  <div key={field}>
                    <label className="block text-[9px] text-neutral-600 mb-1">{label}</label>
                    <input
                      type="number"
                      value={item[field]}
                      onChange={(e) => updateItem(item.id, field, e.target.value)}
                      placeholder="0"
                      className="w-full bg-neutral-900 px-2 py-1.5 rounded-lg text-center font-mono text-xs
                      focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="w-full py-2 rounded-xl border border-dashed border-neutral-700 text-neutral-500 text-xs font-bold
          hover:border-neutral-500 hover:text-neutral-300 transition-all flex items-center justify-center gap-2 mb-6"
        >
          <Plus size={14} /> 新增食物項目
        </button>

        <button
          onClick={handleSave}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs
          hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"
        >
          <Save size={16} /> 儲存餐點
        </button>
      </div>
    </div>
  );
};

export default MealEntry;
