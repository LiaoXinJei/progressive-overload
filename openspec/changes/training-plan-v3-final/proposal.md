## Why

使用者現行 4 練上身循環在腿部建底速度（QUADS/HAMS 每週僅 4 sets）、小腿訓練（從零）、上身 junk volume（CHEST W4=18 sets 已超出個人化劑量反應曲線最佳區間）三方面同時遇到瓶頸。另有脊椎側彎與 TMJ 兩項硬性限制、需把所有軸向加壓動作、俯身負重划船、站姿軍式推舉等列為禁區。`docs/stories/腿部訓練計劃.md` 經 v1→v2→v3 多輪取捨後鎖定 v3 FINAL 方案：5 練固定週、新增 LEGS 集中日、CALVES 高頻分散補刀、isolation antagonist superset 救 60 min 時長、上身肌群週量目標除 CHEST / TRICEPS 微調外不變。本提案把該規格轉為可執行變更。

## What Changes

- **BREAKING** `VOLUME_CONFIG` 結構：新增 CALVES key、CHEST/TRICEPS/QUADS/HAMS 數值全改
- **BREAKING** `WORKOUTS` 結構：A/B/C/D 的動作清單大幅替換、新增 WORKOUTS.E (LEGS, `type: 'legs'`)
- **BREAKING** localStorage schema v3 → v4：舊動作 history 部分清除、部分改名
- **BREAKING** 進度狀態重置：currentWeek=1, currentDay=0
- `MUSCLE_GROUPS` 新增 CALVES
- 新增 `SUPERSET_PAIRS` 常數，定義 5 個 session 的 antagonist superset 配對
- 新增 `SESSION_TYPE_THEME` map，給 push / pull / legs 三種視覺配色
- 動作 schema 擴增 `noteRIR` 與 `noteText` 兩個獨立字串欄位
- 訓練執行 UI 新增：5-day Day Selector、superset 配對卡片（兩動作上下並列含連結頭）、noteRIR/noteText 提示徽章、60min 超時橫幅、TMJ 提示
- 動作庫 `DEFAULT_EXERCISE_LIBRARY` 替換：移除飛鳥類 / 站姿軸向類 / 軸向高風險深蹲類；新增脊椎友善替代、推類設備變化、CALVES 系列
- Migration 連帶清除 customSets / exerciseOverrides / customExercises / exerciseOrder 中參照已移除動作 ID 的 entries（不保留覆寫）

## Capabilities

### New Capabilities
（目前 `openspec/specs/` 為空、本變更建立的均為新 capability）

- `training-program`：訓練菜單結構、肌群週容量目標、週期化模型（hypertrophy / strength / deload）、session 輪替規則、Volume 分配演算法
- `superset-execution`：antagonist superset 配對定義、UI 呈現規則、複合動作不參與 superset 的劃分原則
- `workout-execution-ui`：訓練執行介面的卡片結構、提示徽章（noteRIR / noteText）、session 配色、超時警示、TMJ 提示
- `exercise-library`：預設動作庫內容、使用者自訂動作機制、被排除動作清單與替代品
- `data-persistence`：localStorage schema 版本管理、跨版本 migration、進度狀態（currentWeek / currentDay）持久化

### Modified Capabilities
（無、specs 目錄為空）

## Impact

**程式碼**：
- `src/constants/workouts.js` — 5 個 export 大幅改寫、新增 2 個 export
- `src/App.jsx` — schemaVersion bump、migration block、進度 reset
- `src/components/training/TrainingView.jsx` — Day Selector 4→5、卡片結構重整（superset 配對）、提示渲染、配色、超時 banner
- `src/components/settings/ExerciseLibraryManager.jsx` — 不受本變更影響（safetyTag 排除）

**資料**：
- 既有使用者的 localStorage 中、被移除動作（`pec_deck`、`ohp`、`fly_cable`、`bp_machine`、`tri_kickback`、`bb_row`、`leg_curl`、`tri_overhead`）的 history / logs / overrides 將被清除或改名。`tri_overhead → tri_overhead_seated`、`bp_machine → lib_machine_press_flat` 兩個動作的 history 改名保留以延續進步紀錄。

**不影響**：
- `PHASE_CONFIG`、`MAX_SETS_PER_EXERCISE`、`MUSCLE_SESSION_MAP` 自動生成、`useRestNotification`、`sw.js`、營養模組
