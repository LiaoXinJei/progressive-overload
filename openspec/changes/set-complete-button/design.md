## Context

完成狀態原本只有 `handleRepsChange` 一條路（打次數就完成）。`completeSet` 早就寫好但沒接到 UI。done / completedAt 是休息計時、superset 輪次、休息通知、超時警示的共同依據，所以只要改「什麼時候寫 done」，下游都不用動。

## Decisions

### D1：按 ✓ 時空白欄位用上次紀錄

placeholder 已經顯示上次的重量與次數，按 ✓ 就等於「照上次做」。順序：自己填的值 → 上次紀錄 → 重量 0 kg。次數沒有第三層，沒填也沒有上次次數時 ✓ 停用（title「先輸入次數」），避免存一筆沒有次數的完成組。

### D2：取消完成時 history 回復成完成前的值

原本取消不回復 history。Jim 的 branch review 2 找到情境：重量打錯 600 → ✓ → 取消 → 跳過，history 留著 600，下一組空白按 ✓ 就記成 600。改成完成時把寫入前的 history 存在 log 的 `historyBefore`（原本沒有就存 `null`），取消完成（再按 ✓、或已完成的組直接按跳過）時還原，`null` 就拿掉那筆 history。`historyBefore` 是選填欄位，舊 log 沒有就不還原，不用 bump schemaVersion。後面還有完成的組時（historyKey 為 null）完成和取消都不動 history，見 D3。

### D3：history 只跟著「這個動作最後一個完成的組」

沿用 po-logging 的 `historyWriteKey`：同動作後面還有完成的組時，前面的組完成或修改都不寫 history。

### D4：手機排版

390px 寬：main `px-4`、卡片邊框、`p-6` 之後組數列剩 306px。sm 以下列 `p-2`、`gap-2`，組號 `w-6`、重量框 `w-14 px-1`、次數框 `px-1 min-w-0`：

| 項目 | 寬度 |
|------|------|
| 列 padding | 16 |
| 組號 | 24 |
| 重量 − / 框 / + | 30 + 4 + 56 + 4 + 30 = 124 |
| 跳過 | 28 |
| ✓ | 40 |
| gap ×4 | 32 |
| 次數（剩下的） | 42 |

次數框內容寬 34px，放得下 3 位數。375px 剩 27px（2 位數）。sm 以上維持原本尺寸。跳過的組不顯示 ✓，用同寬的空 div 佔位，跳過按鈕不會跳位置。

## Risks

- 每組多按一下（f3a0c9b 想省掉的那一下）。換來的是 history 正確、自體重可記、可取消。
- 版面寬度是照 Tailwind 尺寸算的，沒在實機或瀏覽器量過。
