# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

RP FOCUS PRO 是一個基於 Renaissance Periodization (RP) 原則的漸進式訓練追蹤應用。核心目標是透過科學化的訓練量管理，在有限的恢復能力下最大化上肢肌群發展，同時維持下肢功能。

## 核心訓練邏輯

### 非對稱推拉架構（4-Day Fixed Cycle）
專案使用固定 4 天週循環，取消獨立腿日，將微量腿部訓練分散到推拉日中，降低 CNS 系統負擔：
- 每週 4 個訓練日（Day 0-3），固定對應 4 個模組
- Day 0: PUSH A（水平推力 + 微量腿前）
- Day 1: PULL A（垂直拉力 + 微量腿後）
- Day 2: PUSH B（垂直推力，純上半身）
- Day 3: PULL B（水平拉力，純上半身）

排程函數極為簡單：
```javascript
const getWorkoutForDay = (week, dayIndex) => {
  return ['A', 'B', 'C', 'D'][dayIndex];
};
```

### 訓練量管理（Volume Management）

#### Exercise 資料結構
每個動作包含 `increments` 欄位，區分複合動作與隔離動作：
```javascript
{ id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', baseSets: 2, increments: true, isUpper: true, repRange: '5-8' }
```

#### 容量遞增邏輯
- **複合動作（`increments: true`）**：每週 +1 組，追求 MAV
- **隔離動作（`increments: false`）**：固定 baseSets，不隨週數增加
- **減量週（W5, W10）**：所有動作組數降為 50%
- **增重模式**：複合動作起始容量 +1（baseSets + 1）

#### Session Ceiling（每日上限）
每日總組數上限 15 組。超過時從複合動作扣減（優先扣副動作），由 `getSessionPlan()` 函數處理：
```javascript
const SESSION_CEILING = 15;
// W1=10 → W2=12 → W3=14 → W4=16→cap 15
```

詳細架構設計請參考 `spec/非對稱推拉架構/PRD.md`。

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

### 元件化設計
- `src/App.jsx`：應用入口，狀態管理與數據持久化
- `src/constants/workouts.js`：訓練菜單定義（WORKOUTS）與肌群映射（MUSCLE_GROUPS）
- `src/components/training/TrainingView.jsx`：訓練核心邏輯與 UI
- `src/components/nutrition/NutritionView.jsx`：營養追蹤模組
- **數據持久化**：透過 `useEffect` 同步所有狀態至 localStorage（key: `rp_focus_pro_data`，schemaVersion: 2）
- **無後端依賴**：完全基於瀏覽器本地儲存

### 關鍵資料結構
```javascript
{
  "schemaVersion": 2,
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

### 核心函數（TrainingView.jsx）
- `getWorkoutForDay(week, dayIndex)`：固定映射 Day 0-3 → A/B/C/D
- `calculateRawSets(week, exercise, trainingMode)`：計算單一動作的原始組數（未套用 session ceiling）
- `getSessionPlan(week, workoutKey, trainingMode)`：計算整日所有動作的組數（套用 15 組上限）
- `completeSet(logKey, exerciseId)`：完成組數時的 Auto-Fill 邏輯

## 重要檔案

- `spec/非對稱推拉架構/PRD.md`：非對稱推拉架構的設計文件
- `src/constants/workouts.js`：訓練菜單與肌群定義
- `src/components/training/TrainingView.jsx`：訓練核心邏輯
- `src/App.jsx`：應用入口與狀態管理
- `src/index.css`：Tailwind CSS 配置和全域樣式

## 修改指南

### 調整訓練菜單
修改 `src/constants/workouts.js` 中的 `WORKOUTS` 物件。每個動作須包含：
- `id`：唯一識別碼
- `increments: true/false`：是否參與週遞增
- `baseSets`：基礎組數（所有動作目前為 2）
- `repRange`：建議次數範圍

### 修改訓練量計算邏輯
編輯 `TrainingView.jsx` 中的 `calculateRawSets()` 和 `getSessionPlan()` 函數。

### 修改 UI 樣式
專案使用 Tailwind CSS，所有樣式直接寫在 JSX className 中。主題色系：
- 上肢動作圓點：藍色（bg-blue-500）
- 下肢動作圓點：橙色（bg-orange-500）
- 遞增動作標記：綠色（text-emerald-500）
- 背景：neutral-950（深色主題）

## 測試與驗證

排程驗證：任何週次的 Day 0-3 都固定對應 A/B/C/D，不再有 rotation。

測試組數計算時，確認：
- W1 每日總組數 = 10（MEV）
- W4 每日總組數 = 15（session ceiling 生效）
- W5 減量週每日 ≈ 5 組
- 增重模式 W1 = 12, W4 = 15
- 隔離動作組數不隨週次變化
