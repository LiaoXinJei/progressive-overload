import React from 'react';
import { Dumbbell, Utensils } from 'lucide-react';

// 底部 tab 列：半透明材質，49px 高 + home indicator 安全區。
// App 主內容的底部 padding 有算進這個高度（訓練頁休息膠囊浮在它上方 8px）
const TabNavigation = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'training', label: '訓練', icon: Dumbbell },
    { id: 'nutrition', label: '營養', icon: Utensils },
  ];

  return (
    <nav aria-label="主選單" className="kb-fix material hairline-t fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
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
              className={`flex h-[49px] flex-col items-center justify-center gap-0.5 transition-colors duration-200
                ${isActive ? 'text-accent-text' : 'text-label-3'}`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              <span className="text-caption font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default TabNavigation;
