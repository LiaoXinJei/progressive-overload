## Why

`training-plan-v3-final` 引入 `SUPERSET_PAIRS` 後、計時 UI 沿用單動作時代的「組間 = 同動作下一組 − 上一組」公式、在 pair 內把 partner 的工作時間誤計為休息。`superset-execution` spec 已明文要求「配對動作完成一輪後 SHALL 休息 75 秒、組間休息 UI 計時 SHALL 採用該值」、但目前實作未滿足。此外 pair 兩成員的 `hideInterRest` 被寫死為 true、導致進入 pair、pair-to-pair、離開 pair 三個交界的「動作間休息」標籤失蹤或數值錯誤。

## What Changes

- 在 `superset-execution` 補強「以 round（A_n + B_n 皆 settled）為休息計算單位」的形式化定義與狀態機（idle / mid-round / between-rounds / done）
- 在 `workout-execution-ui` 新增 superset pair 卡片頂端 sticky 浮動 timer 行為規格；移除 pair 內部個別 set 的「休息時間 / 休息中」inline 顯示
- 在 `workout-execution-ui` 修正 pair 邊界的「動作間休息」行為：
  - 進入 pair：sticky bar 上方 inline 顯示「上一動作完成 X 前」（限 idle 狀態）
  - 離開 pair：以 `max(A_last_set, B_last_set).completedAt` 作為 pair end timestamp（取代原本固定使用 secondary）
- 新增 round dots 視覺輔助（A、B 各一列、N 個圓對應 N 組）
- 不等組數 pair 的 tail set（例如 A=3、B=4 的 B_3）以 single-tail 處理、回退為單動作組間休息語意

不在本 change 範圍：
- `useRestNotification` 的 group.rest vs 全域 delay context 切換（下一個 change）
- `logs` schema 變更
- `SUPERSET_PAIRS` 資料結構變更

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `superset-execution`：補一條 requirement「Pair 休息以 round 為計算單位」（包含 round 完成判定、end timestamp 計算、狀態機定義）
- `workout-execution-ui`：補三條 requirement「Pair sticky 浮動 timer」、「Pair 邊界動作間休息」、「Pair 內部不顯示 inline rest」

## Impact

**程式碼**：
- `src/components/training/TrainingView.jsx`
  - 新增 round derived state 計算（純 derived、無新增 logs 欄位）
  - pair 渲染：加 sticky bar、移除 pair 內成員 set 列的休息顯示
  - 修「離開 pair」inter-exercise rest 的 previousExerciseLastSetKey 來源（從 secondary 改為 max(A_last, B_last)）
  - 修「進入 pair」inter-exercise rest 由 sticky bar 接管顯示

**不影響**：
- `src/hooks/useRestNotification.js`（notification timing 留下個 change）
- `src/constants/workouts.js`（SUPERSET_PAIRS 不動）
- `src/App.jsx`（restActive、useRestNotification 串接不動）
- `localStorage` schema（無變更）

**OpenSpec 依賴**：
- 本 change 修改的兩個 capability spec 目前仍存在於 in-progress 的 `training-plan-v3-final/specs/` 下、尚未 archive 到 `openspec/specs/`。delta spec 將寫在本 change 的 `specs/` 目錄、以 ADDED / MODIFIED Requirement 形式表達、在父 change archive 後與其合併。
