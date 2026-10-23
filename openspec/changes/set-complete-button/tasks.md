## 1. 實作

- [x] 1.1 `completeSet(logKey, historyKey, historyEntry)`：未完成 → 完成（空白用上次紀錄、重量預設 0）、已完成 → 取消
- [x] 1.2 移除 `handleRepsChange`，次數欄 onChange 改用 `updateLog`（完成後同步 history 沿用 `syncHistoryIfDone`）
- [x] 1.3 組數列加 ✓ 按鈕（`data-complete-btn`、`aria-pressed`），沒有次數時停用，跳過的組不顯示
- [x] 1.4 sm 以下縮小列的 gap / padding / 重量框，390px 一列放得下

## 2. 測試

- [x] 2.1 `TrainingView.test.jsx` 自體重測試改成按 ✓ 完成
- [x] 2.2 `TrainingView.logging.test.jsx` BUG-03 / 11 / 16 測試改成按 ✓ 完成，保留原本保護的行為（history 存完整次數、只跟最後一組、替換動作不借原動作歷史）
- [x] 2.3 新增 ✓ 測試：輸入不自動完成、按下完成、取消、帶入後完成、直接用上次紀錄完成、空白重量當 0 kg、沒次數不能按、跳過的組不顯示

## 3. 文件

- [x] 3.1 `docs/stories/訓練紀錄與歷史回填.md`
- [x] 3.2 `docs/guide/core-modules.md`

## 4. 驗證

- [x] 4.1 `npm test`、`npm run build`
- [ ] 4.2 手機實機 390px 寬確認一列放得下、✓ 好按
