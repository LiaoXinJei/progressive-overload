## Why

`fix-superset-rest-timer` 已將 superset 內的 UI 計時對齊 round 語意、但背景通知（`useRestNotification` + Service Worker）仍使用單一全域 `restNotificationDelay`（預設 90 秒）、且 `App.jsx` 的 `restActive` 推斷「下一組為同動作下一組」、未考慮 pair 內 round-robin 節奏。結果是：

- pair 內 mid-round（A_n done、B_n 未做）會誤排休息通知、使用者切換到 partner 時還會收到「該做下一組」提示
- pair 內 between-rounds 該用 pair 的 75 / 90 秒目標、卻沿用全域 90 秒、與 UI 顯示的目標不一致

本 change 把通知排程也改為 context-aware、與 fix-superset-rest-timer 引入的 round derived state 共用 single source of truth。

## What Changes

- 重構 `useRestNotification` hook 介面：以 `restContext` 物件取代既有 `(lastCompletedAt, restNotificationDelay)` 散落參數、明確區分通知 timing 來源
- 抽出共用 hook `usePairRoundState`（或等價 utility）作為 `fix-superset-rest-timer` 的 UI 與本 change 的通知共用的 round 狀態計算入口
- `App.jsx` 計算 `restContext`：依「最近一次 completedAt」屬於哪個 pair / 哪個狀態、決定通知 delay 與 anchor
- 設定頁的 `restNotificationDelay` 保留語意為「非 pair 全域休息 delay」、不額外引入 pair 設定

## Capabilities

### New Capabilities
（無）

### Modified Capabilities
- `superset-execution`：補一條 requirement「Superset 休息通知 timing 規則」（含 mid-round 不排程、between-rounds 採 pair rest 值、跨邊界回退全域 delay）

## Impact

**程式碼**：
- `src/hooks/useRestNotification.js` — 介面重構（接受 restContext、依 type 決定是否排程及 delay）
- `src/App.jsx` — `restActive` 改為 `restContext` 計算、串接 `usePairRoundState`
- 新增 `src/hooks/usePairRoundState.js`（或共享 util）— 由 `fix-superset-rest-timer` 與本 change 共用
- `src/components/training/TrainingView.jsx` — 將本地的 round derived state 改用共享 hook、減少重複實作（fix-superset-rest-timer 落地後做這個切換）

**不影響**：
- `src/sw.js`（Service Worker 介面不變）
- `src/constants/workouts.js`（SUPERSET_PAIRS 不動）
- `localStorage` schema
- 設定頁 UI（`restNotificationDelay` 的 input 行為與意義不變）

**依賴**：
- 本 change SHALL 在 `fix-superset-rest-timer` 落地後再合併、避免 round derived state 兩處實作（或併在同 PR 串行套用）
- spec delta 寫於本 change 的 `specs/superset-execution/spec.md`、archive 順序需配合父 change `training-plan-v3-final` 與 `fix-superset-rest-timer`
