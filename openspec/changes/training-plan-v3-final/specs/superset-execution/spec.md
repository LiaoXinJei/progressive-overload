## ADDED Requirements

### Requirement: Antagonist Superset 配對定義

系統 SHALL 提供 `SUPERSET_PAIRS` 常數、為 A、B、C、D、E 五個 session 各定義 antagonist isolation 動作的配對清單。每個配對 SHALL 包含 `primary`、`secondary`、`rest` 三個欄位。

#### Scenario: PUSH A 配對
- **WHEN** 讀取 `SUPERSET_PAIRS.A`
- **THEN** 包含 `{ primary: 'lateral_raise', secondary: 'tri_pushdown', rest: 75 }` 與 `{ primary: 'lateral_raise_lean', secondary: 'tri_cross_body', rest: 75 }`

#### Scenario: PULL A 配對
- **WHEN** 讀取 `SUPERSET_PAIRS.B`
- **THEN** 包含 `{ primary: 'rear_fly', secondary: 'bi_curl', rest: 75 }` 與 `{ primary: 'rear_delt_cable', secondary: 'bi_preacher', rest: 75 }`

#### Scenario: LEGS 配對救時間
- **WHEN** 讀取 `SUPERSET_PAIRS.E`
- **THEN** 包含 `{ primary: 'rdl_db', secondary: 'calf_standing_heavy', rest: 90 }`

### Requirement: 複合動作排除於 Superset

複合動作（type='compound'）SHALL NOT 出現在任何 `SUPERSET_PAIRS` 配對中。所有臥推、引體、划船、肩推、腿推、保加利亞分腿蹲 SHALL 維持直線組執行。

#### Scenario: bp_flat 不在配對中
- **WHEN** 檢查 `SUPERSET_PAIRS` 所有 session
- **THEN** `bp_flat`、`bp_incline_db`、`pullup`、`db_row`、`leg_press`、`bulgarian_split_db` 等動作 id 不出現於任何 primary / secondary

### Requirement: 配對組間休息

配對動作完成一輪後 SHALL 休息 75 秒（或規格中標示的 rest 值）、不可低於該值。組間休息 UI 計時 SHALL 採用該值。

#### Scenario: 上身配對採 75 秒
- **WHEN** 使用者完成 PUSH A 的 lateral_raise + tri_pushdown 一輪
- **THEN** 組間休息計時器 SHALL 顯示 75 秒

#### Scenario: LEGS 配對採 90 秒
- **WHEN** 使用者完成 LEGS 的 rdl_db + calf_standing_heavy 一輪
- **THEN** 組間休息計時器 SHALL 顯示 90 秒

### Requirement: Fri 腿彎舉 RIR 強制

`WORKOUTS.D` 的 `lying_leg_curl_d` SHALL 帶 `noteRIR: '2-3'` 欄位、確保 UI 提示「不可至力竭」、以保護週六腿日 RDL 品質。

#### Scenario: 動作定義帶 noteRIR
- **WHEN** 讀取 `WORKOUTS.D` 中的 `lying_leg_curl_d`
- **THEN** 該物件包含 `noteRIR: '2-3'`
