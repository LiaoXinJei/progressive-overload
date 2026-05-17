## 1. 抽出共享 round state hook

- [x] 1.1 新增 `src/hooks/usePairRoundState.js`、輸入 `{ logs, currentWeek, currentDay, workoutKey, currentSessionPlan }`、回傳 `{ pairs: [{ pairIdx, primary, secondary, restSeconds, rounds, state, currentRoundIdx, lastCompleteRoundEndTs, midRoundAnchorTs, endTs }] }` — 改採 pure util 路線（與 fix-superset-rest-timer 一致），實作於 `src/utils/pairRoundState.js` 的 `getRestContext` + 既有 `getPairRoundState`
- [x] 1.2 在 hook 內提供 helper：`getPairForExerciseId(exerciseId)`、`getRestContextForLog(logKey)`、`isPairTailSet(logKey)` — `getPairForExerciseId` / `isPairTailSet` 已加入；`getRestContextForLog` 概念被 `getRestContext` 取代（直接從最新 done log 算）
- [x] 1.3 把 `fix-superset-rest-timer` 落地後 `TrainingView.jsx` 內的 round derived 邏輯重構為呼叫此 hook（同步驗證 UI 行為不退化）— TrainingView 與 App.jsx 共用同一份 `getPairRoundState` / `getPairEndTimestamp`；`getSessionPlan` 也抽到 `src/utils/sessionPlan.js` 供雙方共用
- [x] 1.4 單元測試覆蓋：idle / mid-round / between-rounds / done 四狀態、skipped 邊界、tail set 邊界、跨 round 切換 — `src/utils/restContext.test.js` 新增 20 個測試（含 LEGS 90s、tail、skipped/done 並存、notifyKey 變動）

## 2. 重構 useRestNotification 介面

- [x] 2.1 修改 `src/hooks/useRestNotification.js` 介面為 `useRestNotification({ restContext })`、舊 `lastCompletedAt` / `restNotificationDelay` 參數移除
- [x] 2.2 hook 內：當 `restContext.type` 屬於 `idle` 或 `in-pair-mid-round` 時、cancel 任何已排程通知、不 schedule 新通知 — 透過 `SCHEDULABLE_TYPES` 白名單實作
- [x] 2.3 hook 內：當 `restContext.notifyKey` 變更（不論新 type 為何）、先 cancel 舊通知、再依新 context 決定是否 schedule
- [x] 2.4 schedule 計算：`remaining = restContext.delay * 1000 - (Date.now() - restContext.anchorTs)`、若 ≤ 0 則不 schedule
- [x] 2.5 visibilitychange 行為保留：前景 cancel、背景 schedule（schedule 內部讀取最新 restContext）
- [x] 2.6 文案：通知 title 與 body 依 restContext.type 微調（`in-pair-between-rounds` 提示「下一輪開始」、其餘維持「該做下一組」）— `buildMessage()` 依 type 分支三種文案

## 3. App.jsx 串接

- [x] 3.1 在 `App.jsx` 引入 `usePairRoundState`、傳入當前 workoutKey 等 — 改採 pure util：`buildSessionPlan` + `getRestContext`，包在 `useMemo` 內
- [x] 3.2 新增 `restContext` 計算（取代既有 `restActive`、`lastCompletedAt` 推導）：用 `getRestContext({ logs, currentWeek, currentDay, workoutKey, sessionPlan, globalDelay })`
- [x] 3.3 計算 `notifyKey = ${workoutKey}:${currentDay}:${type}:${anchorTs}` — 由 `getRestContext` 內部產出
- [x] 3.4 移除 `restActive` 舊邏輯（保留註解 commit 指向本 change）— 已移除、註解指向 `pairRoundState.js#getRestContext`
- [x] 3.5 確認設定頁 `restNotificationDelay` 輸入仍只控制 `in-set` 與 `between-exercises` 兩種狀態的 delay、行為說明更新（必要時於設定頁副標補一句）— 設定頁副標已補「Superset 配對的輪間休息採配對自身設定、不受此處影響」

## 4. 驗證

- [ ] 4.1 在 dev 環境用瀏覽器 visibilitychange + Notification API 模擬背景：
  - 完成單動作一組、切背景 → 90 秒（或全域設定）後收到通知 ✓
  - 完成 lateral_raise_1（mid-round）、切背景 → 不應收到通知 ✓
  - 完成 lateral_raise_1 + tri_pushdown_1（between-rounds）、切背景 → 75 秒後收到通知 ✓
  - 完成 LEGS pair → 90 秒後收到通知 ✓
  - 完成 pair 最後一輪、切背景 → 全域 delay 後收到通知 ✓
- [ ] 4.2 連續切換 context 測試：mid-round 排程被 between-rounds 取消、再被新 mid-round 取消、不發出殘留通知
- [ ] 4.3 在實機（iOS / Android PWA）驗證背景通知行為、確認 Service Worker 排程在新介面下不退化

## 5. 收尾

- [x] 5.1 更新 `docs/guide/core-modules.md` 中「休息通知」段、描述新的 context-aware 行為 — 加入 restContext 五種型別表 + flow + notifyKey 說明
- [x] 5.2 必要時更新 `docs/stories/` 對應 story 的相關實作表 — 現存 story 無「相關實作」表需更新；本 change 影響面已記錄於 `docs/guide/core-modules.md`
- [x] 5.3 移除 `App.jsx` 內 `fix-superset-rest-timer` 落地時留下的 TODO 註記（如有）— 已移除（行 93-95 的 TODO 隨 `restActive` 一併替換）
