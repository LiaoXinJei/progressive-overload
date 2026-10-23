## ADDED Requirements

### Requirement: 每組 ✓ 完成按鈕

每個組數列 SHALL 在最右側顯示 ✓ 按鈕。組數 SHALL 只在使用者按下 ✓ 時標記為完成；輸入重量或次數 SHALL NOT 自動完成。

按下 ✓ 時：
- 未完成的組 SHALL 標記 `done: true`、`completedAt` 為按下的時間，並開始休息計時
- 空白的重量與次數 SHALL 依序採用自己填的值、該動作上次紀錄；重量兩者都沒有時 SHALL 記為 0 kg（自體重）
- 若同動作後面沒有已完成的組，SHALL 把這組的重量與次數寫進 history
- 已完成的組 SHALL 取消完成（`done: false`、清掉 `completedAt`），重量與次數保留；若完成時有寫 history，SHALL 把 history 回復成完成前的值

次數自己沒填、上次紀錄也沒有次數時，✓ SHALL 停用。跳過的組 SHALL NOT 顯示 ✓。

已完成的組修改重量或次數時，SHALL 依既有規則同步 history（兩欄都有值、且同動作後面沒有已完成的組）。

手機 390px 寬時，組號、重量 ±、次數、跳過、✓ SHALL 排在同一列，不出現橫向捲動。

#### Scenario: 輸入不會自動完成
- **WHEN** 使用者在引體向上第 1 組輸入重量 60、次數 12
- **THEN** 這組 SHALL 仍是未完成、history 不變、不顯示「休息中」

#### Scenario: 按 ✓ 完成
- **WHEN** 使用者輸入重量 60、次數 12 後按 ✓
- **THEN** 這組 SHALL 完成、completedAt 為按下的時間、history 為 `{ weight: 60, reps: '12' }`、這組下方顯示「休息中」

#### Scenario: 再按一次取消
- **WHEN** 使用者對已完成的組再按 ✓
- **THEN** 這組 SHALL 回到未完成、completedAt 清掉、重量與次數保留、「休息中」消失

#### Scenario: 打錯重量完成後取消
- **WHEN** history 有 `{ weight: 60, reps: '8' }`，使用者重量打 600、按 ✓、再按 ✓ 取消、改按跳過
- **THEN** history SHALL 回到 `{ weight: 60, reps: '8' }`，下一組空白按 ✓ 記成 60

#### Scenario: 帶入上次紀錄後完成
- **WHEN** history 有 `{ weight: 20, reps: '8' }`，使用者點組號帶入後按 ✓
- **THEN** 這組 SHALL 以 20 kg × 8 完成

#### Scenario: 自體重第一次做
- **WHEN** 重量空白、沒有 history，使用者只輸入次數 8 後按 ✓
- **THEN** 這組 SHALL 以 0 kg × 8 完成，history 為 `{ weight: 0, reps: '8' }`

#### Scenario: 沒有次數不能完成
- **WHEN** 次數空白、history 也沒有次數
- **THEN** ✓ SHALL 停用
