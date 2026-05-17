## MODIFIED Requirements

### Requirement: 配對組間休息

配對動作 SHALL 以 **round** 為休息計算單位、而非以同一動作的相鄰組為單位。

**round 定義**：對配對 `{ primary: A, secondary: B }` 於第 n 組、round_n 由 `logs[A_n]` 與 `logs[B_n]` 共同構成。

**round 完成判定**：
- `round_n.complete` SHALL 為 true 當且僅當 `(logs[A_n].done || logs[A_n].skipped) && (logs[B_n].done || logs[B_n].skipped)`
- `round_n.end_ts` SHALL 為 `max(logs[A_n].completedAt, logs[B_n].completedAt)`、其中僅納入 `done === true` 的組；若兩組皆 `skipped`、`end_ts` SHALL 為 null（整輪略過）

**配對狀態機**：對某一配對於某 session、SHALL 派生以下四種狀態之一：
- `idle`：尚未有任何 round 開始（無任何 A_n 或 B_n 為 done）
- `mid-round`：存在某 round_k、其中 A_k 與 B_k 恰好一個 settled（另一個未 settled）
- `between-rounds`：存在 round_k 已 complete、且 round_{k+1} 兩組皆未 settled
- `done`：所有 round 皆 complete

**rest 計時來源**：
- `between-rounds` 狀態下、休息時間 SHALL 自 `round_k.end_ts` 起算、目標為 `SUPERSET_PAIRS[session][pairIdx].rest` 秒（75 或 90）
- `mid-round` 狀態下、SHALL 顯示「切換中」、自最近一個 settled 組的 completedAt 起算、不適用 rest 目標值

#### Scenario: 上身配對 round 完成後採 75 秒目標
- **WHEN** 使用者完成 PUSH A 的 lateral_raise_1 + tri_pushdown_1（兩組皆 done）
- **THEN** 配對狀態 SHALL 為 `between-rounds`、休息計時器目標 SHALL 顯示 75 秒、起算點 SHALL 為 `max(lateral_raise_1.completedAt, tri_pushdown_1.completedAt)`

#### Scenario: LEGS 配對 round 完成後採 90 秒目標
- **WHEN** 使用者完成 LEGS 的 rdl_db_1 + calf_standing_heavy_1
- **THEN** 配對狀態 SHALL 為 `between-rounds`、休息計時器目標 SHALL 顯示 90 秒

#### Scenario: round 內單邊完成進入 mid-round
- **WHEN** 使用者完成 lateral_raise_1（done）、但 tri_pushdown_1 尚未 settled
- **THEN** 配對狀態 SHALL 為 `mid-round`、UI SHALL 顯示「切換中」而非「輪間休息」

#### Scenario: round 中一組 skipped
- **WHEN** 使用者完成 lateral_raise_2、並將 tri_pushdown_2 標記為 skipped
- **THEN** round_2 SHALL 視為 complete、`round_2.end_ts` SHALL 為 `lateral_raise_2.completedAt`、狀態進入 `between-rounds`

#### Scenario: 整輪皆 skipped
- **WHEN** 使用者將 lateral_raise_3 與 tri_pushdown_3 皆標記為 skipped
- **THEN** round_3 SHALL complete、但 `round_3.end_ts` SHALL 為 null、不貢獻 between-rounds 計時起點

#### Scenario: 不等組數的 tail 組
- **WHEN** 配對中 A 設為 3 組、B 設為 4 組、使用者完成 B_4
- **THEN** B_4 SHALL 視為 single-tail、不參與 round 計算、其休息語意 SHALL 回退為「B_4.completedAt 起算」的單動作邏輯
