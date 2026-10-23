## Why

f3a0c9b 拿掉每組的完成按鈕，改成「重量有值、輸入次數的第一個字就自動完成」。實際用下來同一個根因造成四個問題：

- BUG-03：打「12」時第一個字就完成，history 只存到「1」，completedAt 是打第一個字的時間
- BUG-04：重量空白又沒有歷史（自體重動作第一次做）永遠完成不了
- BUG-11：完成後再改數字不會更新 history（已由 po-logging 補同步）
- BUG-19：沒有手動完成或取消；點組號帶入上次紀錄後也完成不了

老闆選了「加回 ✓ 按鈕」（design-3-4 #4 選項 C），一次解決。

## What Changes

- 輸入重量或次數不再自動完成
- 每組右側加 ✓ 按鈕：按下才標 done、寫 history、開始休息計時，completedAt 用按下的時間
- 再按一次 ✓ 取消完成（done 清掉、completedAt 清掉、數字保留）
- 按 ✓ 時空白欄位用上次紀錄（就是 placeholder 顯示的值）；重量連上次紀錄都沒有就當 0 kg（自體重）
- 次數是唯一必填：沒填也沒有上次次數時 ✓ 不能按
- 完成後改數字照舊同步 history（BUG-11 的行為不變）
- 手機版（sm 以下）縮小組數列的 gap、padding 與重量框，390px 寬一列放得下 組號 / 重量± / 次數 / 跳過 / ✓

不在本 change 範圍：BUG-02、BUG-14、BUG-15；logs / history 結構不變，不需要 migration。

## Capabilities

### Modified Capabilities
- `workout-execution-ui`：新增 requirement「每組 ✓ 完成按鈕」

## Impact

- `src/components/training/TrainingView.jsx`：`completeSet` 接到 ✓ 按鈕並改寫；移除 `handleRepsChange`，次數欄改用 `updateLog`；組數列手機排版
- 測試：`TrainingView.test.jsx`、`TrainingView.logging.test.jsx` 改成按 ✓ 才完成，另加 ✓ 完成 / 取消 / 帶入後完成 / 空白重量完成等測試
- 文件：`docs/stories/訓練紀錄與歷史回填.md`、`docs/guide/core-modules.md`
- 休息通知（`useRestNotification`）從 logs 的 done / completedAt 推算，不用改
