## ADDED Requirements

### Requirement: 預設動作庫內容

`DEFAULT_EXERCISE_LIBRARY` SHALL 由「`WORKOUTS` 內所有動作」與 `EXTRA_LIBRARY_ITEMS` 兩部分組成。`EXTRA_LIBRARY_ITEMS` SHALL 提供脊椎友善替代、推類設備變化、CALVES 系列等補充動作。

#### Scenario: CHEST 推類替代豐富
- **WHEN** 讀取 `DEFAULT_EXERCISE_LIBRARY` 篩選 CHEST
- **THEN** 包含至少 5 個推類設備變化（平板 / 上斜 / 雙槓三大類）、如 `lib_machine_press_flat`、`lib_machine_press_incline`、`lib_smith_incline`、`lib_smith_flat`、`lib_weighted_dips`、`lib_incline_bb_press`

#### Scenario: CHEST 不含飛鳥
- **WHEN** 讀取 `DEFAULT_EXERCISE_LIBRARY` 篩選 CHEST
- **THEN** 不出現 `lib_db_fly`、`lib_low_cable_fly`、`lib_decline_press`、`pec_deck`、`fly_cable`、任何含「飛鳥」名稱的動作

#### Scenario: CALVES 至少 4 個條目
- **WHEN** 讀取 `DEFAULT_EXERCISE_LIBRARY` 篩選 CALVES
- **THEN** 包含至少 4 個動作、含 `lib_calf_donkey`、`lib_calf_single_leg_db`、`lib_calf_smith_standing`、`lib_calf_seated_alt`

#### Scenario: QUADS 含脊椎友善替代
- **WHEN** 讀取 `DEFAULT_EXERCISE_LIBRARY` 篩選 QUADS
- **THEN** 包含 `lib_belt_squat`、`lib_pendulum_squat_noload`、`lib_sissy_squat`、`lib_step_up_db` 等脊椎友善替代

#### Scenario: HAMS 含脊椎友善替代
- **WHEN** 讀取 `DEFAULT_EXERCISE_LIBRARY` 篩選 HAMS
- **THEN** 包含 `lib_nordic_curl`、`lib_cable_pullthrough`、`lib_reverse_hyper`、`lib_machine_hip_hinge`、`lib_glute_ham_raise`

### Requirement: 動作 Schema 擴增欄位

動作物件（在 WORKOUTS、DEFAULT_EXERCISE_LIBRARY、自訂動作）的 schema SHALL 支援兩個 optional 字串欄位：`noteRIR` 與 `noteText`。兩者為兩個獨立欄位、不合併為物件。

#### Scenario: noteRIR 為字串
- **WHEN** 動作物件帶 `noteRIR`
- **THEN** 值為字串、例如 `'2-3'`

#### Scenario: noteText 為字串
- **WHEN** 動作物件帶 `noteText`
- **THEN** 值為字串、例如 `'建議使用助握帶（lifting straps）'`

### Requirement: 動作替換功能維持

既有「替換動作」功能 SHALL 持續運作、使用者 SHALL 能將 WORKOUTS 中任一動作替換為 `DEFAULT_EXERCISE_LIBRARY` 中同肌群的其他動作。

#### Scenario: 替換 bp_flat 為其他胸推
- **WHEN** 使用者在 PUSH A session 對 `bp_flat` 點「替換」
- **THEN** 下拉清單顯示同 `muscle: 'CHEST'` 且 `type: 'compound'` 的所有動作（如 `lib_machine_press_flat`、`lib_smith_flat`、`lib_incline_bb_press` 等）
