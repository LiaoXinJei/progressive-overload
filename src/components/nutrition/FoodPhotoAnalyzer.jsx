import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, Edit2, Save } from 'lucide-react';
import { analyzeFood, compressImage } from '../../utils/geminiApi';

const FoodPhotoAnalyzer = ({ apiKey, onSave, onClose, onNeedApiKey }) => {
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [mealName, setMealName] = useState('');
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;

    if (!apiKey) {
      onNeedApiKey();
      onClose();
      return;
    }

    setError(null);
    setResults(null);

    try {
      const { base64, mimeType } = await compressImage(file);
      setImagePreview(`data:${mimeType};base64,${base64}`);
      setAnalyzing(true);

      const items = await analyzeFood(apiKey, base64, mimeType);
      setResults(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const updateResult = (id, field, value) => {
    setResults(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: field === 'name' ? value : (parseFloat(value) || 0) } : item
    ));
  };

  const removeResult = (id) => {
    setResults(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = () => {
    if (!results || results.length === 0) return;

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    onSave({
      id: `m_${Date.now()}`,
      time,
      name: mealName || 'AI 分析餐點',
      source: 'ai',
      items: results,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[40px] max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-white italic uppercase flex items-center gap-2">
            <Camera size={20} className="text-emerald-500" /> AI 食物分析
          </h3>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Upload Area */}
        {!imagePreview && (
          <div className="space-y-3 mb-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-6 rounded-2xl border-2 border-dashed border-neutral-700 text-neutral-400
              hover:border-emerald-600 hover:text-emerald-400 transition-all flex flex-col items-center gap-2"
            >
              <Camera size={32} />
              <span className="text-sm font-bold">拍攝食物照片</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-2xl border border-neutral-700 text-neutral-500
              hover:border-neutral-500 hover:text-neutral-300 transition-all flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              <span className="text-sm font-bold">從相簿選擇</span>
            </button>
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-neutral-700">
            <img src={imagePreview} alt="食物照片" className="w-full max-h-48 object-cover" />
          </div>
        )}

        {/* Loading State */}
        {analyzing && (
          <div className="text-center py-8">
            <Loader2 size={32} className="animate-spin text-emerald-500 mx-auto mb-3" />
            <p className="text-neutral-400 text-sm font-bold">AI 正在分析食物...</p>
            <p className="text-neutral-600 text-xs mt-1">辨識食物種類與估算營養素</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm font-bold mb-1">分析失敗</p>
            <p className="text-red-500/70 text-xs">{error}</p>
            <button
              onClick={() => {
                setImagePreview(null);
                setError(null);
              }}
              className="mt-3 text-xs text-red-400 underline hover:text-red-300"
            >
              重新上傳
            </button>
          </div>
        )}

        {/* Results */}
        {results && results.length > 0 && (
          <>
            {/* Meal Name */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-neutral-500 mb-1 uppercase">餐點名稱</label>
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="AI 分析餐點"
                className="w-full bg-neutral-800 px-4 py-2 rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
              />
            </div>

            <div className="space-y-3 mb-6">
              {results.map((item) => (
                <div key={item.id} className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    {editingItem === item.id ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateResult(item.id, 'name', e.target.value)}
                        className="flex-1 bg-neutral-900 px-2 py-1 rounded text-sm font-bold
                        focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                        onBlur={() => setEditingItem(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                      />
                    ) : (
                      <span className="font-bold text-neutral-200 text-sm">{item.name}</span>
                    )}
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => setEditingItem(editingItem === item.id ? null : item.id)}
                        className="text-neutral-600 hover:text-neutral-400 transition-colors"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => removeResult(item.id)}
                        className="text-neutral-600 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { field: 'calories', label: '熱量', unit: 'kcal' },
                      { field: 'protein', label: '蛋白質', unit: 'g' },
                      { field: 'carbs', label: '碳水', unit: 'g' },
                      { field: 'fat', label: '脂肪', unit: 'g' },
                    ].map(({ field, label }) => (
                      <div key={field}>
                        <label className="block text-[9px] text-neutral-600 mb-1">{label}</label>
                        <input
                          type="number"
                          value={item[field]}
                          onChange={(e) => updateResult(item.id, field, e.target.value)}
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
              onClick={handleSave}
              className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-xs
              hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2"
            >
              <Save size={16} /> 儲存分析結果
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FoodPhotoAnalyzer;
