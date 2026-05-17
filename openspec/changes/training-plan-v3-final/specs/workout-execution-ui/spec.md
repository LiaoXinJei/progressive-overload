## ADDED Requirements

### Requirement: 5-day Day Selector

訓練畫面 SHALL 顯示 5 個 Day Selector 按鈕、對應 day 0 至 day 4。當前日按鈕 SHALL 以高亮樣式呈現。佈局 SHALL 在 375px 寬手機螢幕不破版。

#### Scenario: 顯示 5 按鈕
- **WHEN** 使用者進入訓練畫面
- **THEN** Day Selector 顯示 5 個按鈕、標籤為 A、B、C、D、E

#### Scenario: 手機尺寸不破版
- **WHEN** 螢幕寬度為 375px
- **THEN** 5 個按鈕不溢出視窗、不需橫向 scroll（或允許橫向 scroll 但按鈕大小一致）

### Requirement: Session 類型配色

系統 SHALL 為 push / pull / legs 三種 session type 提供區分的視覺配色、套用於 Day Selector 當前日按鈕與 session 標題行。

#### Scenario: PUSH session 配色
- **WHEN** 當前 session 的 `type === 'push'`
- **THEN** 主視覺色為紅色系

#### Scenario: PULL session 配色
- **WHEN** 當前 session 的 `type === 'pull'`
- **THEN** 主視覺色為藍色系

#### Scenario: LEGS session 配色
- **WHEN** 當前 session 的 `type === 'legs'`
- **THEN** 主視覺色為橘 / 棕色系（與 push、pull 區隔）

### Requirement: 動作卡片 noteRIR 徽章

若動作物件包含 `noteRIR` 字串、動作卡片 SHALL 顯示一個徽章「⚠ RIR {noteRIR}、不可至力竭」、使用醒目顏色（紅或琥珀）。

#### Scenario: lying_leg_curl_d 顯示警示
- **WHEN** 使用者進入 PULL B session
- **THEN** `lying_leg_curl_d` 動作卡片頂部顯示「⚠ RIR 2-3、不可至力竭」徽章

#### Scenario: 無 noteRIR 不顯示
- **WHEN** 動作物件無 `noteRIR` 欄位
- **THEN** 動作卡片不顯示 RIR 警示徽章

### Requirement: 動作卡片 noteText 提示

若動作物件包含 `noteText` 字串、動作卡片 SHALL 在 header 區顯示一行灰字提示。

#### Scenario: rdl_db 顯示助握帶提示
- **WHEN** 使用者進入 LEGS session
- **THEN** `rdl_db` 動作卡片顯示「建議使用助握帶（lifting straps）」灰字

### Requirement: Superset 配對卡片

若兩個動作出現在 `SUPERSET_PAIRS[currentSession]` 同一配對中、UI SHALL 將其合併為單一視覺容器、上下並列、共用 header「🔗 SUPERSET · {rest}s」。

#### Scenario: PUSH A 第一配對渲染
- **WHEN** 使用者進入 PUSH A session
- **THEN** `lateral_raise` 與 `tri_pushdown` 顯示在同一配對卡片內、共用 header「🔗 SUPERSET · 75s」

#### Scenario: 複合動作獨立卡片
- **WHEN** 渲染 `bp_flat` 動作
- **THEN** 該動作以獨立卡片呈現、不被合併

#### Scenario: 拖曳排序視配對為單位
- **WHEN** 使用者拖曳配對卡片
- **THEN** 兩個動作一起移動、不可拆對

### Requirement: TMJ 提示

Superset 配對卡片 SHALL 在底部顯示一行灰字提示「💨 下顎放鬆 · 鼻吸口呼」、隨配對卡片一起呈現、不使用 modal 或全域 toast。

#### Scenario: 配對卡片含 TMJ 提示
- **WHEN** 渲染任何 superset 配對卡片
- **THEN** 卡片底部顯示「💨 下顎放鬆 · 鼻吸口呼」

#### Scenario: 非配對動作不顯示
- **WHEN** 渲染獨立動作卡片
- **THEN** 不顯示 TMJ 提示

### Requirement: 60 分鐘超時警示

當 session 進行時間超過 60 分鐘、TrainingView SHALL 顯示一個橫幅、文案為「⏱ 已超時 X 分鐘、考慮跳過 1 組 isolation」、X 為實際超時分鐘數。

#### Scenario: 未超時不顯示
- **WHEN** `workoutTimes.duration < 3600`
- **THEN** 不顯示超時橫幅

#### Scenario: 超時顯示
- **WHEN** `workoutTimes.duration > 3600`
- **THEN** 顯示超時橫幅、X 為 `floor((duration - 3600) / 60)`
