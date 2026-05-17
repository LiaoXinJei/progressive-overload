## ADDED Requirements

### Requirement: schemaVersion 升級至 4

系統 SHALL 將 localStorage 的 `rp_focus_pro_data.schemaVersion` 從 3 升級至 4。Migration SHALL 在 App 載入時的 `useEffect` 中自動執行、不需使用者操作、且須冪等（重複執行不出錯）。

#### Scenario: 首次載入觸發 migration
- **WHEN** App 載入時偵測 `localStorage.rp_focus_pro_data.schemaVersion === 3`
- **THEN** 執行 v3→v4 migration、寫回 `schemaVersion: 4`

#### Scenario: 已是 v4 不重複執行
- **WHEN** App 載入時偵測 `schemaVersion === 4`
- **THEN** 不執行 migration、不重置進度

#### Scenario: 全新使用者
- **WHEN** App 載入時 `localStorage` 無 `rp_focus_pro_data`
- **THEN** 走預設值（schemaVersion: 4、currentWeek: 1、currentDay: 0）、不執行 migration

### Requirement: 移除動作的 History 清除

Migration SHALL 清除以下動作的 `history` 與 `logs` entries：`pec_deck`、`ohp`、`fly_cable`、`tri_kickback`、`bb_row`、`leg_curl`。

#### Scenario: history 清除
- **WHEN** migration 執行
- **THEN** `history.pec_deck`、`history.ohp`、`history.fly_cable`、`history.tri_kickback`、`history.bb_row`、`history.leg_curl` 全部刪除

#### Scenario: logs 清除
- **WHEN** migration 執行
- **THEN** 所有 key 符合 `w{N}-d{N}-{removedId}-s{N}` 格式的 logs entry 全部刪除

### Requirement: 改名動作的 History 移轉

Migration SHALL 將以下動作的 `history` 改名（複製到新 key 後刪除舊 key）：
- `tri_overhead` → `tri_overhead_seated`
- `bp_machine` → `lib_machine_press_flat`

對應的 `logs` key 也 SHALL 改寫 ID 段。

#### Scenario: tri_overhead 改名
- **WHEN** migration 執行且 `history.tri_overhead` 存在
- **THEN** `history.tri_overhead_seated = history.tri_overhead`、且 `delete history.tri_overhead`

#### Scenario: bp_machine 改名
- **WHEN** migration 執行且 `history.bp_machine` 存在
- **THEN** `history.lib_machine_press_flat = history.bp_machine`、且 `delete history.bp_machine`

#### Scenario: logs key 對應改寫
- **WHEN** migration 執行、存在 `logs['w3-d2-tri_overhead-s1']`
- **THEN** 改寫為 `logs['w3-d2-tri_overhead_seated-s1']`、舊 key 刪除

### Requirement: Override 資料清除

Migration SHALL 清除 `customSets`、`exerciseOverrides`、`customExercises`、`exerciseOrder` 中所有參照已移除或已改名動作 ID 的 entries。改名動作不保留 override（一次清除）。

#### Scenario: customSets 清除
- **WHEN** migration 執行
- **THEN** `customSets` 中 key 含已移除動作 ID 的 entries 全部刪除

#### Scenario: exerciseOrder 清除
- **WHEN** migration 執行
- **THEN** `exerciseOrder` 各 workout 陣列中、已移除或已改名動作 ID 全部移除

### Requirement: 進度狀態重置

Migration SHALL 將 `currentWeek` 重置為 1、`currentDay` 重置為 0。重置 SHALL 與 schema 升級綁定、只在 v3→v4 時執行一次。

#### Scenario: 進度重置
- **WHEN** migration 執行
- **THEN** `viewState.currentWeek = 1`、`viewState.currentDay = 0`

#### Scenario: 不重複重置
- **WHEN** schemaVersion 已是 4
- **THEN** 不觸發進度重置（保留使用者當前進度）

### Requirement: Migration 失敗安全性

Migration SHALL 在執行前完整讀取舊資料、執行中不破壞舊資料的 in-memory 副本、僅在完成所有變更後一次寫回 localStorage。

#### Scenario: 中途錯誤不寫回
- **WHEN** migration 執行中拋出例外
- **THEN** localStorage 不被部分更新（保持 v3 狀態）

### Requirement: 移除動作的 UI Fallback 防呆

若 `customExercises` 或其他來源殘留已移除動作 ID、TrainingView SHALL NOT 崩潰、SHALL 以 fallback 文字（如「未知肌群」）安全渲染或略過該動作。

#### Scenario: 未知 muscle 不崩潰
- **WHEN** 動作物件的 `muscle` 在 `MUSCLE_GROUPS` 找不到對應
- **THEN** 顯示「未知」字串、不拋出 TypeError
