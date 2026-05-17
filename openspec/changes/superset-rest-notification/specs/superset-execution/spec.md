## ADDED Requirements

### Requirement: Superset 休息通知 timing 規則

休息結束通知（透過 `useRestNotification` 透過 Service Worker 排程的本地通知）的 delay 與排程條件 SHALL 依「最近一次完成組所屬的 rest context」決定、不沿用單一全域 delay。

定義 `restContext.type` 五種狀態（由最近一次 `done === true` 的 set log 推得）：

| type | 觸發條件 | delay 來源 | anchorTs |
|------|----------|------------|----------|
| `idle` | 當日無任何 done 組 | 不排程 | — |
| `in-set` | 最近完成組所屬動作的下一組未 settled、且該動作非 pair 成員 | 全域 `restNotificationDelay` | 該組 completedAt |
| `in-pair-mid-round` | 最近完成組屬 pair、該 round 另一組尚未 settled | **不排程** | — |
| `in-pair-between-rounds` | 最近完成組屬 pair、該 round 已 complete、下一 round 未開始 | `SUPERSET_PAIRS[session][pairIdx].rest` | `round.end_ts` |
| `between-exercises` | 最近完成組為某動作（含 pair 整體）的最後一組、且後續仍有未完成動作 | 全域 `restNotificationDelay` | 該組 completedAt 或 pair.end_ts |

通知 SHALL 僅在 `in-set`、`in-pair-between-rounds`、`between-exercises` 三種狀態下排程；`idle` 與 `in-pair-mid-round` SHALL NOT 排程任何通知。

當 `restContext` 切換時、原排程通知 SHALL 被取消、重新依新狀態決定是否排程。

#### Scenario: pair mid-round 不排程通知
- **WHEN** 使用者完成 PUSH A 的 lateral_raise_1（A done）、tri_pushdown_1 尚未 settled
- **THEN** restContext.type SHALL 為 `in-pair-mid-round`、SHALL NOT 排程任何休息結束通知

#### Scenario: pair between-rounds 採 pair rest 值
- **WHEN** 使用者完成 PUSH A 的 lateral_raise_1 + tri_pushdown_1（round 1 complete）
- **THEN** restContext.type SHALL 為 `in-pair-between-rounds`、delay SHALL 為 75 秒（取自 SUPERSET_PAIRS.A[0].rest）、anchorTs SHALL 為 round_1.end_ts

#### Scenario: LEGS pair 採 90 秒 delay
- **WHEN** 使用者完成 LEGS 的 rdl_db_1 + calf_standing_heavy_1
- **THEN** delay SHALL 為 90 秒（取自 SUPERSET_PAIRS.E[0].rest）

#### Scenario: 單動作沿用全域 delay
- **WHEN** 使用者完成 bp_flat_1、bp_flat_2 尚未 settled
- **THEN** restContext.type SHALL 為 `in-set`、delay SHALL 為使用者設定的全域 `restNotificationDelay`

#### Scenario: pair 最後一輪完成切換為 between-exercises
- **WHEN** 使用者完成 PUSH A 的 pair1 最後一輪、後續仍有 pair2 / leg_ext 等未完成動作
- **THEN** restContext.type SHALL 為 `between-exercises`、delay SHALL 為全域 `restNotificationDelay`、anchorTs SHALL 為 pair.end_ts

#### Scenario: 切換 restContext 時取消舊通知
- **WHEN** 已排程 in-pair-between-rounds 通知（75s）、使用者於 30 秒後切回前景並開始下一輪、完成 lateral_raise_2 進入 mid-round
- **THEN** 原 75 秒通知 SHALL 被取消、SHALL NOT 因進入 mid-round 而排新通知

#### Scenario: idle 不排程
- **WHEN** 使用者切換到當日尚無任何完成組的 session
- **THEN** SHALL NOT 排程任何通知
