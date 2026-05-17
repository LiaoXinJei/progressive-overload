## 1. Round derived state

- [x] 1.1 在 `TrainingView.jsx` 新增 helper `getPairRoundState(pair, currentWeek, currentDay, logs)`，回傳 `{ rounds: [{ idx, aSettled, bSettled, complete, endTs }], state: 'idle'|'mid-round'|'between-rounds'|'done', currentRoundIdx, lastCompleteRoundEndTs, midRoundAnchorTs }`
- [x] 1.2 處理 skipped 組納入 settled、completedAt 取 done 一方的邏輯
- [x] 1.3 處理整輪皆 skipped（endTs = null、不參與 between-rounds 起算）
- [x] 1.4 處理 A、B 不等組數的 tail：以 `min(A_sets, B_sets)` 決定 core rounds、超出的視為 tail（不在 `rounds` 陣列、由 caller 另行處理）
- [x] 1.5 加單元測試：給定 logs 子集驗證四種狀態與 endTs 計算（含 skipped、tail）

## 2. Pair sticky timer bar

- [x] 2.1 在 `renderExerciseInner` 上層、pair 渲染段（line ~828–867）新增 `<PairStickyBar>` 元件、以 `position: sticky; top: 0` 黏附於 pair 卡片內部
- [x] 2.2 bar 依 `pairState` 切換內容：idle 顯示「準備開始 R{n+1}」、mid-round 顯示「⏱ 切換中: m:ss」（自 `midRoundAnchorTs` 起算）、between-rounds 顯示「{🟢|🔴} 輪間休息: m:ss / 目標 m:ss」（超目標轉 rose）、done 顯示「✓ 完成 · N 輪」
- [x] 2.3 bar 左側渲染 round dots（A、B 兩列、各 core round 數個圓）：done 實心、pending 空心、skipped 斜線
- [x] 2.4 套用既有 SUPERSET 橘色配色 + `backdrop-blur-sm` 樣式
- [ ] 2.5 於 iOS Safari 與 Chrome 行動版手動驗證 sticky 行為（pair 內捲動時黏附頂端、離開 pair 自然解除）

## 3. 移除 pair 內 set 列 inline rest

- [x] 3.1 在 `renderExerciseInner` 內、原本「Rest Time Display」段（line ~714–738）：當該動作隸屬 pair 時、SHALL NOT 渲染「休息時間」「休息中」字串
- [x] 3.2 透過 prop 或 context 把「是否在 pair 內」訊號傳入 renderExerciseInner（複用既有 `hideInterRest` 或新增專屬 flag 皆可）
- [x] 3.3 確保單動作（非 pair）路徑下 inline rest 行為不變

## 4. 進入 pair 邊界訊息

- [x] 4.1 找出 pair 的「前一個獨立動作」：依 `groupedPlan` 視覺順序、前一筆若為 `single`、其最後一組 completedAt 為起算來源
- [x] 4.2 當 `pairState === 'idle'` 且該 timestamp 存在時、在 sticky bar 上方渲染一行 inline「上一動作完成 m:ss 前 · 進入 superset」
- [x] 4.3 一旦 `pairState !== 'idle'`、該行隱藏
- [x] 4.4 若前一筆也是 pair（兩個 pair 相鄰）、以前一 pair 的 `lastCompleteRoundEndTs` 為起算來源、文案改為「上一配對完成 m:ss 前」

## 5. 離開 pair 邊界修正

- [x] 5.1 改寫 `renderExerciseInner` 內 `previousExerciseLastSetKey` 計算：若 `currentSessionPlan[flatIdx - 1]` 屬於某 pair 的成員、SHALL 改用該 pair 的 `getPairEndTimestamp()`（= `max(lastRound.A_n.completedAt, lastRound.B_n.completedAt)`、僅納入 done 組）作為起算 timestamp、而非該動作的最後一組 completedAt
- [x] 5.2 為此引入 helper `getPairEndTimestamp(pair, currentWeek, currentDay, logs)`、複用 task 1.1 的 `rounds` 結構
- [x] 5.3 確保「pair → 後一獨立動作」的 inline「動作間休息」顯示值在 primary 較晚、secondary 較晚兩種情形下都正確

## 6. 連動驗證

- [ ] 6.1 啟動 dev server、用 375px viewport 走完 PUSH A：bp_flat → bp_incline_db → pair1（lateral_raise + tri_pushdown） → pair2（lateral_raise_lean + tri_cross_body） → leg_ext → calf_standing_a、驗證所有 sticky bar 狀態與邊界訊息
- [ ] 6.2 驗證 PULL A（rear_fly + bi_curl、rear_delt_cable + bi_preacher）
- [ ] 6.3 驗證 LEGS（rdl_db + calf_standing_heavy）的 90 秒目標
- [ ] 6.4 驗證 skipped 一邊、skipped 整輪、unequal sets（手動 `adjustExerciseSets`）三個邊界
- [ ] 6.5 確認單動作（非 pair）的 inline rest 顯示與行為與本 change 前一致

## 7. 文件與收尾

- [x] 7.1 更新 `docs/stories/index.md` 與相關 story 的「相關實作」段（如有）— 評估後現存 story 無「相關實作」表需更新、`腿部訓練計劃.md` 第 11 節 UI 建議仍適用、不增重複條目
- [x] 7.2 視需要更新 `docs/guide/core-modules.md` 中與計時 / superset 相關章節 — 新增「Superset 配對休息計時」子節、含 helper / 狀態機 / 邊界訊息 / 規格連結
- [x] 7.3 confirm `useRestNotification` 行為未變、預留下一個 change（notification context-aware delay）的 TODO 註記於 `App.jsx` 或本 change README — TODO 已加在 `src/App.jsx` useRestNotification 呼叫點上方
