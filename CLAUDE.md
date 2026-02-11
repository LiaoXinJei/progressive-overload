# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

RP FOCUS PRO 是一個基於 Renaissance Periodization (RP) 原則的漸進式訓練追蹤應用。核心目標是透過科學化的訓練量管理，在有限的恢復能力下最大化上肢肌群發展，同時維持下肢功能。

## 核心訓練邏輯

### 5-Day Rotation Model
專案使用獨特的「5 個訓練菜單（A, B, C, D, E）循環於每週 4 天訓練」的排程系統：
- 物理時間：每週 4 個訓練日（Day 0-3）
- 邏輯循環：5 個菜單依序輪替（PUSH A → PULL A → PUSH B → PULL B → LEGS）
- 位移效果：每週起始菜單不同，確保恢復時間分佈均勻

計算當前訓練日應執行哪個菜單的核心公式：
```javascript
const offset = ((week - 1) * 4) % 5;
const workoutIndex = (offset + dayIndex) % 5;
```

### 訓練量管理（Volume Management）
- **上肢（Push/Pull）**：追求 MAV（最大適應量），每週遞增組數
- **下肢（Legs）**：鎖定 MEV（最低有效量），組數不隨週數增加（維持模式）
- **減量週（W5, W10）**：所有肌群組數降為 50%
- **增重模式**：上肢起始容量 +1，下肢每 4 週 +1 組
- **單動作天花板機制**：預設 6 組上限（小肌群例外：側三角、後三角、小腿 8 組），防止垃圾容量

詳細演算法邏輯請參考 `spec/PRD.md` 第 2.2 節。

## 開發命令

```bash
# 安裝依賴
npm install

# 本地開發（預設 http://localhost:5173）
npm run dev

# 建置生產版本
npm run build

# 預覽建置結果
npm run preview
```

## 專案架構

### 單體架構設計
整個應用邏輯集中在 `src/App.jsx` 單一檔案中（~620 行），採用 React Hooks 進行狀態管理：
- **狀態管理**：使用 `useState` 管理 logs、history、mode、currentWeek、currentDay 等狀態
- **數據持久化**：透過 `useEffect` 同步所有狀態至 localStorage（key: `rp_focus_pro_data`）
- **無後端依賴**：完全基於瀏覽器本地儲存

### 關鍵資料結構
```javascript
{
  "logs": {
    "w1-d0-bp_flat-s0": { weight: 100, reps: 10, done: true }
  },
  "history": {
    "bp_flat": 100  // 用於 Auto-Fill 機制
  },
  "mode": "maintenance",  // "maintenance" | "bulking"
  "viewState": {
    "currentWeek": 1,     // 1-10
    "currentDay": 0,      // 0-3
    "showStats": true
  }
}
```

### 核心函數
- `getWorkoutForDay(week, dayIndex)`：計算當前訓練日的菜單
- `calculateSets(week, exercise, trainingMode)`：計算動作組數（實作 PRD 2.2 邏輯）
- `completeSet(logKey, exerciseId)`：完成組數時的 Auto-Fill 邏輯

## 重要檔案

- `spec/PRD.md`：完整的產品需求文件（PRD），包含詳細的訓練演算法、數據模型和功能規格
- `src/App.jsx`：主要應用程式邏輯，包含所有 UI 和業務邏輯
- `src/index.css`：Tailwind CSS 配置和全域樣式

## 修改指南

### 調整訓練菜單
修改 `WORKOUTS` 物件來新增/移除動作或調整 baseSets：
```javascript
const WORKOUTS = {
  A: { name: 'PUSH A', exercises: [...] },
  // ...
}
```

### 修改訓練量計算邏輯
編輯 `calculateSets()` 函數，確保遵循 PRD 第 2.2 節的容量控制模型。函數最後會套用「單動作天花板機制」：

```javascript
// 單動作天花板機制 (Per-Exercise Ceiling)
const isSmallMuscle = muscle === 'SIDE_DELT' || muscle === 'REAR_DELT' || muscle === 'CALVES';
const ceiling = isSmallMuscle ? 8 : 6;
return Math.min(calculatedSets, ceiling);
```

此機制防止後期訓練量過高導致神經疲勞與垃圾容量（例如 W9 胸部從 29 組降至 24 組）。

### 修改 UI 樣式
專案使用 Tailwind CSS，所有樣式直接寫在 JSX className 中。主題色系：
- Push 動作：藍色系
- Pull 動作：綠色系
- Legs 動作：橙色系
- 背景：neutral-950（深色主題）

## 測試與驗證

測試 5-Day Rotation 邏輯時，建議驗證：
1. W1-D0 應為 'A'，W1-D3 應為 'D'
2. W2-D0 應為 'E'（延續上週進度）
3. W3-D0 應為 'D'（每週位移一格）

測試組數計算時，確認：
- 維持模式下，上肢每週 +1 組，下肢固定
- 增重模式下，上肢起始 +1 且遞增，下肢每 4 週 +1
- W5 與 W10 所有動作組數降為 50%（無條件捨去）
