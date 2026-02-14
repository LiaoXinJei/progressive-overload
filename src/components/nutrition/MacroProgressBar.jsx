import React from 'react';

const MacroProgressBar = ({ label, current, target, color, unit = 'g' }) => {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isOver = current > target;

  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold mb-1.5">
        <span className="text-neutral-400 uppercase tracking-wider">{label}</span>
        <span className={`font-mono ${isOver ? 'text-rose-400' : 'text-neutral-300'}`}>
          {Math.round(current)} / {target} {unit}
        </span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOver ? 'bg-rose-500' : color
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default MacroProgressBar;
