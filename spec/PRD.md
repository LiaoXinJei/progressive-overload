Product Requirement Document (PRD)

Project: RP Focus Pro (Upper Specialization Edition)

Version: 1.0 Final
Date: 2026-02-11
Status: Ready for Execution

1. 產品核心哲學 (Core Philosophy)

本產品旨在解決「有限恢復能力」與「特定部位極大化」之間的矛盾。基於 Systemic Fatigue Management (系統性疲勞管理) 原則，通過將下肢訓練量控制在 MEV (最低有效訓練量) 邊緣，釋放中樞神經系統 (CNS) 的恢復資源，全力供給上肢肌群進行 Progressive Overload (漸進性超負荷)。

1.1 目標用戶

中高階健身者。

每週訓練頻率受限 (4天/週)。

目標明確：上肢維度顯著增長，下肢維持功能與線條。

2. 訓練演算法邏輯 (Training Algorithm)

2.1 時間與排程模型 (The 5-Day Rotation Model)

物理時間：每週 4 個訓練日 (Day 1 - Day 4)。

邏輯循環：5 個訓練菜單 (A, B, C, D, E) 依序循環。

菜單定義：

PUSH A (胸主導 + 三頭)

PULL A (背部厚度主導 + 二頭) [硬指標：背部 10 組]

PUSH B (肩膀主導 + 上胸)

PULL B (背部細節主導 + 後三角)

LEGS (下肢功能維持) [硬指標：保底 MEV]

位移邏輯：

W1: A, B, C, D

W2: E, A, B, C

W3: D, E, A, B ... (以此類推)

2.2 容量控制模型 (Volume Management)

A. 上肢 (Push/Pull) - 追求 MAV (最大適應量)

積累期 (W1-W4, W6-W9)：

維持模式 (Maintenance)：每週總組數 +1 ~ +2 (依據 RP 標準曲線)。

增重模式 (Bulking)：起始容量 (Base Sets) +1，每週增長幅度更激進。

B. 下肢 (Legs) - 鎖定 MEV (最低有效量)

策略：以高強度 (RIR 0-1) 配合低頻率 (每 8.75 天一次) 與低組數。

維持模式：

組數鎖定：W1 到 W9，深蹲/硬舉組數 不隨週數增加。

目的：避免下肢累積過多疲勞，影響隔天 Push A 的表現。

增重模式：

允許微幅增加 (每 4 週 +1 組)，以適應熱量盈餘。

C. 減量機制 (Deloading)

觸發點：Week 5 與 Week 10。

執行：所有肌群組數強制降為 Base Sets 的 50% (無條件捨去，最少 1 組)。

D. 單動作天花板機制 (Per-Exercise Ceiling)

背景：

在增重模式後期（如 W9），累積的訓練量可能導致單一動作組數過高（例如胸部單日 22 組），超過神經肌肉系統的有效刺激閾值，產生「垃圾容量 (Junk Volume)」。

科學依據：

根據 James Krieger 等人的統合分析，單一動作在第 4-5 組後，肌肥大刺激效果進入高原期。

第 7 組以上，重量通常因神經疲勞大幅下降，機械張力不足，無法產生有效微創傷。

執行規則：

預設天花板：6 組（適用於所有複合動作與大肌群孤立動作）

小肌群例外：8 組（適用於側三角 SIDE_DELT、後三角 REAR_DELT、小腿 CALVES）

理由：這些肌群恢復速度極快、慢縮肌纖維比例高、中樞神經系統負擔低。

實際影響：

W9 增重模式胸部訓練量從 29 組（危險區）降至 24 組（超量恢復區，Overreaching）。

二頭肌/三頭肌維持 6 組上限，避免在複合動作疲勞後堆疊過多孤立訓練量。

3. 功能規格 (Functional Specifications)

3.1 數據持久化 (State Persistence) - Critical

系統需使用 localStorage 實現「全狀態記憶」。用戶關閉分頁後重開，必須看到一模一樣的畫面。

Storage Key: rp_focus_pro_data

記憶標的：

currentWeek (1-10)

currentDay (0-3)

mode (maintenance/bulking)

logs (所有歷史輸入數據)

history (每個動作的最後一次重量，用於自動填入)

showStats (底部面板的開關狀態)

3.2 智能輸入系統 (Smart Input)

Auto-Fill (自動填入)：

若該組數據為空，點擊「完成」時，自動填入 history 中該動作的最新重量。

Quick Adjust (快速微調)：

重量欄位旁配置 + / - 按鈕。

增減幅度：建議設為 1.25kg 或 2.5kg (符合漸進負荷最小單位)。

3.3 視覺化反饋 (Visual Feedback)

進度追蹤：

未完成組：高亮顯示 / 預設透明度。

已完成組：變更背景色 (依照 Push/Pull/Legs 主題色)、降低不透明度。

統計面板 (Stats Panel)：

位置：底部 Sticky。

功能：計算並顯示「當前週次」的預計總組數。

邏輯：需考慮 5-Day Rotation 在當週 4 天內的實際分佈 (例如某週會有 2 次 Push，面板需反映出胸部組數暴增)。

4. 數據結構 (Data Schema)

{
  "logs": {
    "w1-d0-bp_flat-s0": { 
      "weight": 100, 
      "reps": 10, 
      "done": true 
    }
  },
  "history": {
    "bp_flat": 100,
    "sq_low_bar": 140
  },
  "mode": "maintenance", // enum: 'maintenance' | 'bulking'
  "viewState": {
    "currentWeek": 1,
    "currentDay": 0,
    "showStats": true
  }
}
