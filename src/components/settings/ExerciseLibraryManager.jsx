import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, X, Search } from 'lucide-react';
import { MUSCLE_GROUPS } from '../../constants/workouts';

const emptyDraft = { name: '', muscle: 'CHEST', type: 'isolation', defaultSets: 3 };

const ExerciseLibraryManager = ({ exerciseLibrary, setExerciseLibrary }) => {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exerciseLibrary;
    return exerciseLibrary.filter(item =>
      item.name.toLowerCase().includes(q) ||
      MUSCLE_GROUPS[item.muscle]?.toLowerCase().includes(q)
    );
  }, [exerciseLibrary, search]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      muscle: item.muscle,
      type: item.type,
      defaultSets: item.defaultSets,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const saveEdit = () => {
    if (!draft.name.trim()) return;
    setExerciseLibrary(prev => prev.map(item =>
      item.id === editingId
        ? { ...item, name: draft.name.trim(), muscle: draft.muscle, type: draft.type, defaultSets: draft.defaultSets }
        : item
    ));
    cancelEdit();
  };

  const removeItem = (id) => {
    setExerciseLibrary(prev => prev.filter(item => item.id !== id));
  };

  const addItem = () => {
    if (!draft.name.trim()) return;
    const id = `lib_custom_${Date.now()}`;
    setExerciseLibrary(prev => [...prev, {
      id,
      name: draft.name.trim(),
      muscle: draft.muscle,
      type: draft.type,
      defaultSets: draft.defaultSets,
    }]);
    setDraft(emptyDraft);
    setShowAdd(false);
  };

  const renderForm = (onConfirm, onCancel) => (
    <div className="space-y-3 bg-neutral-800/50 p-3 rounded-xl border border-neutral-700">
      <input
        type="text"
        value={draft.name}
        onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
        placeholder="動作名稱"
        className="w-full bg-neutral-900 px-3 py-2 rounded-lg text-sm text-neutral-100
          focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={draft.muscle}
          onChange={(e) => setDraft(d => ({ ...d, muscle: e.target.value }))}
          className="bg-neutral-900 px-3 py-2 rounded-lg text-sm text-neutral-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
        >
          {Object.entries(MUSCLE_GROUPS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={draft.type}
          onChange={(e) => setDraft(d => ({ ...d, type: e.target.value }))}
          className="bg-neutral-900 px-3 py-2 rounded-lg text-sm text-neutral-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
        >
          <option value="compound">複合</option>
          <option value="isolation">隔離</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-neutral-400">預設組數</label>
        <input
          type="number"
          min="1"
          max="10"
          value={draft.defaultSets}
          onChange={(e) => setDraft(d => ({ ...d, defaultSets: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) }))}
          className="w-16 bg-neutral-900 px-2 py-1 rounded-lg text-sm font-mono text-center text-neutral-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-400 text-xs font-bold hover:bg-neutral-700"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={!draft.name.trim()}
          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          儲存
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋動作或肌群"
          className="w-full bg-neutral-800 pl-9 pr-3 py-2 rounded-xl text-sm text-neutral-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-neutral-700"
        />
      </div>

      {/* Add button or form */}
      {showAdd ? (
        <div className="mb-3">{renderForm(addItem, () => { setShowAdd(false); setDraft(emptyDraft); })}</div>
      ) : (
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); setDraft(emptyDraft); }}
          className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-neutral-700 text-neutral-500 hover:border-emerald-600 hover:text-emerald-500 text-xs font-bold"
        >
          <Plus size={14} /> 新增動作
        </button>
      )}

      {/* List */}
      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-neutral-600 py-4">沒有符合的動作</p>
        ) : filtered.map(item => (
          editingId === item.id ? (
            <div key={item.id}>{renderForm(saveEdit, cancelEdit)}</div>
          ) : (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-neutral-800/50 border border-neutral-800 rounded-xl"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-neutral-100 truncate">{item.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold bg-neutral-900 text-neutral-400 px-1.5 py-0.5 rounded">
                    {MUSCLE_GROUPS[item.muscle]}
                  </span>
                  <span className={`text-[10px] font-bold ${item.type === 'compound' ? 'text-cyan-500' : 'text-neutral-500'}`}>
                    {item.type === 'compound' ? '複合' : '隔離'}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">{item.defaultSets} 組</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 text-neutral-500 hover:text-emerald-500 transition-colors"
                  title="編輯"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-neutral-600 hover:text-rose-500 transition-colors"
                  title="刪除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default ExerciseLibraryManager;
