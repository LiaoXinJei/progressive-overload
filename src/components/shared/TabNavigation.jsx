import React from 'react';
import { Dumbbell, UtensilsCrossed } from 'lucide-react';

const TabNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'training', label: '訓練', icon: Dumbbell },
    { id: 'nutrition', label: '營養', icon: UtensilsCrossed },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-neutral-900 border-t border-neutral-800 safe-area-bottom">
      <div className="max-w-6xl mx-auto flex">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors
                ${isActive
                  ? 'text-emerald-500'
                  : 'text-neutral-600 hover:text-neutral-400'}`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabNavigation;
