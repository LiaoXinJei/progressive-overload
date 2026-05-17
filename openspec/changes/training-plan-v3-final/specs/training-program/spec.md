## ADDED Requirements

### Requirement: 肌群週容量配置

系統 SHALL 為每個肌群維護一組 4 元素陣列 `[W1, W2, W3, W4]`、代表 MEV → MAV1 → MAV2 → MRV 四週遞增的目標組數。肌力期（W6–W9）SHALL 固定使用 W1 值。減量週（W5、W10）SHALL 使用 W1 值的 50%。

#### Scenario: 上身肌群維持目標
- **WHEN** 系統載入 `VOLUME_CONFIG`
- **THEN** `BACK = [12,14,16,18]`、`SHOULDERS = [4,5,6,6]`、`SIDE_DELT = [8,10,12,14]`、`REAR_DELT = [8,9,10,12]`、`BICEPS = [8,9,10,12]` 維持不變

#### Scenario: CHEST 與 TRICEPS 微調
- **WHEN** 系統載入 `VOLUME_CONFIG`
- **THEN** `CHEST = [10,11,12,12]`、`TRICEPS = [8,8,9,9]`

#### Scenario: 腿部建底配置
- **WHEN** 系統載入 `VOLUME_CONFIG`
- **THEN** `QUADS = [10,12,14,16]`、`HAMS = [8,10,12,14]`、`CALVES = [10,12,14,14]`

#### Scenario: 肌力期取 W1
- **WHEN** `currentWeek` 為 6、7、8 或 9
- **THEN** 所有肌群的目標組數等於對應陣列的索引 0 值

#### Scenario: 減量週折半
- **WHEN** `currentWeek` 為 5 或 10
- **THEN** 所有肌群的目標組數等於對應陣列索引 0 值的 50%

### Requirement: 5-day Session 輪替

系統 SHALL 提供 5 個 session（A=PUSH A、B=PULL A、C=PUSH B、D=PULL B、E=LEGS）、依序輪替、不綁定星期幾。

#### Scenario: Day index 對應 session
- **WHEN** `currentDay` 為 0、1、2、3、4
- **THEN** 對應 session 為 'A'、'B'、'C'、'D'、'E'

#### Scenario: 第 5 天循環
- **WHEN** 使用者完成 day 4（E LEGS）並進入下一天
- **THEN** 系統回到 day 0（A PUSH A）

### Requirement: LEGS Session 結構

WORKOUTS.E SHALL 為新增的 LEGS session、`type: 'legs'`、包含 QUADS×2、HAMS×2、CALVES×2 共 6 個動作。

#### Scenario: LEGS 動作組成
- **WHEN** 系統載入 `WORKOUTS.E`
- **THEN** 動作清單依序為 `leg_press`、`bulgarian_split_db`、`rdl_db`、`back_ext_45`、`calf_standing_heavy`、`calf_press_legpress`

#### Scenario: rdl_db 帶助握帶提示
- **WHEN** 系統載入 `rdl_db` 動作定義
- **THEN** 該動作物件包含 `noteText: '建議使用助握帶（lifting straps）'`

### Requirement: Volume 自動分配

系統 SHALL 依「肌群週目標 → 均分到包含該肌群的 sessions → 再均分到該 session 中該肌群的動作（第一個動作拿餘數）」演算法計算每動作組數、上限為 `MAX_SETS_PER_EXERCISE = 4`。

#### Scenario: CHEST W4 分配
- **WHEN** `currentWeek = 4`、計算 CHEST 分配
- **THEN** A session 8 組（bp_flat 4 + bp_incline_db 4）、C session 4 組（tri_dips 4）、合計 12 組

#### Scenario: CALVES W4 分配
- **WHEN** `currentWeek = 4`、計算 CALVES 分配
- **THEN** A=2、B=2、C=2、D=2、E=6 組、合計 14 組

#### Scenario: QUADS W4 受密度上限影響
- **WHEN** `currentWeek = 4`、計算 QUADS 分配
- **THEN** 合計 13 組（小於目標 16）、差額來自 MAX_SETS_PER_EXERCISE × 動作數的上限、為可接受結果

### Requirement: 肌群 → Session 映射自動生成

`MUSCLE_SESSION_MAP` SHALL 由 `WORKOUTS` reduce 自動產生、不需人工維護。

#### Scenario: CALVES 出現在 5 個 session
- **WHEN** 系統初始化
- **THEN** `MUSCLE_SESSION_MAP.CALVES = ['A','B','C','D','E']`

#### Scenario: SHOULDERS 僅 C session
- **WHEN** 系統初始化
- **THEN** `MUSCLE_SESSION_MAP.SHOULDERS = ['C']`

### Requirement: 脊椎與 TMJ 限制

系統的預設菜單與動作庫 SHALL NOT 包含背槓深蹲、前蹲、傳統硬舉、彎腰負重划船、站姿軍式推舉、Walking lunge 背槓、Hack squat、Zercher squat、Good Morning、含肩墊版本的 Pendulum squat。

#### Scenario: WORKOUTS 不含禁區動作
- **WHEN** 檢查 `WORKOUTS` 的所有 exercises id
- **THEN** 不出現 `bb_row`、`ohp`、傳統硬舉、背槓深蹲、Good Morning 等任何禁區動作

#### Scenario: DEFAULT_EXERCISE_LIBRARY 不含禁區動作
- **WHEN** 檢查 `DEFAULT_EXERCISE_LIBRARY` 的所有 id
- **THEN** 不出現 `lib_deadlift`、`lib_squat_bb`、`lib_hack_squat`、`lib_good_morning`、`lib_arnold_press`（站姿版）、`lib_t_bar_row`（無支撐版）、`lib_rear_delt_db`（無支撐版）
