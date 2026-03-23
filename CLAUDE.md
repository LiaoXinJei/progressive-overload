# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

RP FOCUS PRO 是一個基於 Renaissance Periodization (RP) 原則的漸進式訓練追蹤應用。核心目標是透過科學化的訓練量管理，在有限的恢復能力下最大化上肢肌群發展，同時維持下肢功能。

## 核心訓練邏輯

### 非對稱推拉架構（4-Day Fixed Cycle）
固定 4 天週循環，無獨立腿日，微量腿部訓練分散到推拉日：
- Day 0: PUSH A（水平推力 + 微量腿前）
- Day 1: PULL A（垂直拉力 + 微量腿後）
- Day 2: PUSH B（垂直推力，純上半身）
- Day 3: PULL B（水平拉力，純上半身）

### 雙週期制（Dual Periodization）
10 週為一個大週期：
- **W1-W4 肌肥大期**：肌群週容量從 MEV 遞增至 MRV，複合動作 8-12 下，隔離動作 10-15 下
- **W5 減量週**：所有肌群降至 MEV 的 50%
- **W6-W9 肌力期**：總組數固定於 MEV，重量遞增，複合動作 3-6 下，隔離動作 8-10 下
- **W10 減量週**：同 W5

### 肌群週容量模型（Volume-Driven Model）
訓練量以**肌群週目標組數**為核心，自動分配到各 session 和動作：
```
CHEST:     [12, 14, 16, 18]  // W1(MEV) → W4(MRV)
BACK:      [12, 14, 16, 18]
SIDE_DELT: [8, 10, 12, 14]
REAR_DELT: [8, 9, 10, 12]   // 非線性
TRICEPS:   [8, 9, 10, 12]   // 非線性
BICEPS:    [8, 9, 10, 12]   // 非線性
QUADS:     [4, 4, 4, 4]     // 固定（純維持）
HAMS:      [4, 4, 4, 4]     // 固定（純維持）
```

分配演算法：
1. 查找肌群週目標 → 2. 均分到包含該肌群的 sessions → 3. 再均分到各動作（第一個動作拿餘數）

## 開發命令

```bash
npm install      # 安裝依賴
npm run dev      # 本地開發（http://localhost:5173）
npm run build    # 建置生產版本
npm run preview  # 預覽建置結果
```

## 專案架構

### 關鍵檔案
- `src/constants/workouts.js`：WORKOUTS 菜單、VOLUME_CONFIG 肌群容量、PHASE_CONFIG 週期配置、MUSCLE_SESSION_MAP 預計算映射
- `src/components/training/TrainingView.jsx`：訓練核心邏輯與 UI
- `src/App.jsx`：應用入口、狀態管理、localStorage 持久化（schemaVersion: 2）
- `src/components/nutrition/NutritionView.jsx`：營養追蹤模組
- `spec/非對稱推拉架構/PRD.md`：架構設計文件

### Exercise 資料結構
```javascript
{ id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', type: 'compound', isUpper: true }
```
- `type: 'compound' | 'isolation'`：決定該階段的建議次數範圍
- `isUpper`：UI 圓點顏色（上肢藍/下肢橙）
- 不再有 baseSets — 組數完全由 VOLUME_CONFIG 和分配演算法決定

### 核心函數（TrainingView.jsx）
- `getPhase(week)`：回傳 'hypertrophy' | 'strength' | 'deload'
- `getWeeklyMuscleVolume(muscle, week)`：查 VOLUME_CONFIG 取得該肌群當週目標
- `getSessionPlan(week, workoutKey)`：分配週容量到各動作，回傳 `[{ exercise, sets }]`
- `getRepRange(exerciseType, week)`：依階段和動作類型回傳建議次數範圍

## 修改指南

### 調整肌群容量
修改 `src/constants/workouts.js` 中的 `VOLUME_CONFIG`。每個陣列 4 個值對應 W1-W4。

### 調整訓練菜單
修改 `WORKOUTS` 物件。新增/移除動作後，`MUSCLE_SESSION_MAP` 會自動重新計算。

### 修改週期配置
修改 `PHASE_CONFIG`，可調整各階段的建議次數範圍。

### UI 樣式
Tailwind CSS，深色主題（neutral-950）。肌肥大期綠色系，肌力期青色系。
