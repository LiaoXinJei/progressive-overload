## ADDED Requirements

### Requirement: Pair 浮動休息 Timer

Superset 配對卡片 SHALL 在卡片頂端內部顯示一條 sticky 浮動 timer bar、作為該配對唯一的休息時間呈現載體。bar SHALL 使用 `position: sticky; top: 0`、於使用者捲動 pair 內容時黏附於 pair 卡片頂端。

bar 內容 SHALL 依配對狀態（見 `superset-execution` 之「配對組間休息」）切換：

| 配對狀態 | bar 顯示 | 顏色語意 |
|----------|----------|----------|
| `idle` | 「準備開始 R1」 | neutral |
| `mid-round` | 「⏱ 切換中: m:ss」（自最近 settled 組 completedAt 起算） | amber |
| `between-rounds`（≤ 目標） | 「🟢 輪間休息: m:ss / 目標 m:ss」 | emerald |
| `between-rounds`（> 目標） | 「🔴 輪間休息: m:ss / 目標 m:ss」 | rose |
| `done` | 「✓ 完成 · N 輪」 | emerald 弱化 |

bar 左側 SHALL 顯示 round dots（A、B 各一列、每列 N 個小圓對應 N 組）、用以視覺化各 round 的兩組 settled 狀態：未 settled 為空心、done 為實心、skipped 為斜線。

#### Scenario: idle 狀態顯示準備提示
- **WHEN** 進入 PUSH A 後尚未完成任何配對組
- **THEN** pair1 卡片頂端 sticky bar SHALL 顯示「準備開始 R1」

#### Scenario: between-rounds 顯示目標倒數
- **WHEN** 完成 lateral_raise_1 與 tri_pushdown_1、距 round_1.end_ts 30 秒
- **THEN** sticky bar SHALL 顯示「🟢 輪間休息: 0:30 / 目標 1:15」（75s = 1:15）

#### Scenario: between-rounds 超時轉紅
- **WHEN** 距 round_1.end_ts 100 秒、目標 75 秒
- **THEN** sticky bar SHALL 切換為 rose 顏色、文案保持「輪間休息: 1:40 / 目標 1:15」

#### Scenario: mid-round 不顯示輪間休息
- **WHEN** 完成 lateral_raise_2、tri_pushdown_2 尚未 settled
- **THEN** sticky bar SHALL 顯示「⏱ 切換中: m:ss」、不顯示「輪間休息」文案

#### Scenario: round dots 反映 settled 狀態
- **WHEN** lateral_raise 設為 3 組、tri_pushdown 設為 3 組、使用者完成 lateral_raise_1 + tri_pushdown_1
- **THEN** round dots 第一列（A）第 1 個圓為實心、第 2、3 個為空心、第二列（B）相同

### Requirement: Pair 內 set 列不顯示 inline 休息

Superset 配對卡片內、個別動作的 set 列 SHALL NOT 顯示任何「休息時間: X」或「休息中: X」inline 文字。所有休息相關訊息 SHALL 統一由 Pair sticky bar 呈現。

#### Scenario: pair 內 set 列無 inline rest
- **WHEN** 完成 lateral_raise_1
- **THEN** lateral_raise_1 該列底下 SHALL NOT 出現「休息時間」或「休息中」字串

#### Scenario: 單動作仍顯示 inline rest
- **WHEN** 完成 bp_flat（非 pair）的某一組
- **THEN** 該組下方 SHALL 依舊顯示「休息時間: X」或「休息中: X」（單動作行為不受本 requirement 影響）

### Requirement: Pair 邊界動作間休息

進入與離開 Superset 配對的邊界 SHALL 各自顯示正確的「動作間休息」資訊：

**進入 pair（前一獨立動作 → pair）**：
- 當配對狀態為 `idle` 且前一獨立動作存在 completedAt 時、pair sticky bar 上方 SHALL 顯示一行 inline 文字「上一動作完成 m:ss 前 · 進入 superset」
- 一旦配對狀態離開 `idle`、該行 SHALL 消失

**離開 pair（pair → 後一獨立動作）**：
- 後一獨立動作的「動作間休息」起算點 SHALL 為 `pair.end_ts` = `max(lastRound.A_n.completedAt, lastRound.B_n.completedAt)`、其中 lastRound 為該配對的最後一個 complete round
- SHALL NOT 固定使用 secondary 動作的最後一組為起算點

#### Scenario: bp_incline_db 完成後進入 pair1 顯示提示
- **WHEN** 使用者完成 bp_incline_db 最後一組、進入 pair1 但尚未開始任何組
- **THEN** pair1 sticky bar 上方 SHALL 顯示「上一動作完成 m:ss 前 · 進入 superset」、m:ss 自 bp_incline_db 最後一組 completedAt 起算

#### Scenario: 進入 pair 後提示消失
- **WHEN** 使用者完成 lateral_raise_1（配對進入 mid-round 或之後狀態）
- **THEN** 「上一動作完成」提示 SHALL 不再顯示

#### Scenario: pair → leg_ext 動作間休息以 max 取 timestamp
- **WHEN** pair2 完成最後一輪、其中 lateral_raise_lean_3 早於 tri_cross_body_3 完成
- **THEN** leg_ext 卡片上方「動作間休息」起算點 SHALL 為 `tri_cross_body_3.completedAt`（兩者較晚者）

#### Scenario: pair → 後動作 timestamp 取 primary 較晚
- **WHEN** 使用者反輪替先做完 A 再補 B 的特殊情形、`lateral_raise_lean_3.completedAt > tri_cross_body_3.completedAt`
- **THEN** leg_ext 動作間休息起算點 SHALL 為 `lateral_raise_lean_3.completedAt`、不固定取 secondary
