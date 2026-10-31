import React from 'react';
import { Dumbbell, UtensilsCrossed } from 'lucide-react';

// 底部 tab 列：56px 高 + home indicator 安全區。App 主內容的底部 padding 有算進這個高度
const TabNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'training', label: '訓練', icon: Dumbbell },
    { id: 'nutrition', label: '營養', icon: UtensilsCrossed },
  ];

  return (
    <nav aria-label="主選單" className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-hall pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-[480px] grid-cols-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-14 flex-col items-center justify-center gap-1 transition-colors
                ${isActive ? 'text-ipf-bright' : 'text-fg-2 hover:text-fg'}`}
            >
              {isActive && <span className="absolute inset-x-1/3 top-0 h-0.5 rounded-b bg-ipf-bright" aria-hidden="true" />}
              <Icon size={22} aria-hidden="true" />
              <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabNavigation;
