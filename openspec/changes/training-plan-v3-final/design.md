## Context

本變更為跨資料層、狀態層、UI 層的同步升級、且包含 localStorage schema migration、ID 改名、進度狀態重置等不可逆操作、屬於需事先固化技術決策的類型。

來源規格 `docs/stories/腿部訓練計劃.md` 已詳列「該怎麼做」（VOLUME 數值、動作清單、SUPERSET 配對），本 design 不重複內容、僅針對規格留白的技術抉擇定案。

既有實作的相關座標（Explore 階段已測繪）：
- `src/constants/workouts.js:1-202` 全部常數
- `src/App.jsx:107-147` migration useEffect、`:151` schemaVersion 寫入
- `src/App.jsx:15-42` 狀態定義（含 `currentWeek` / `currentDay` / `logs` / `history`）
- `src/components/training/TrainingView.jsx:32-34` `getWorkoutForDay`
- `src/components/training/TrainingView.jsx:402-421` Day Selector
- `src/components/training/TrainingView.jsx:464-597` 動作卡片渲染
- `src/components/training/TrainingView.jsx:142-149` Phase 顏色 helper

## Goals / Non-Goals

**Goals:**
- 規格 §3–§7 的所有資料層變更逐項落地、Volume 分配自動計算驗證表（規格末）對得上
- localStorage 從 v3 自動升 v4、無需使用者手動操作、且 migration 冪等
- 訓練執行 UI 完整呈現 superset 配對、noteRIR / noteText 提示、5-day 輪替、配色
- 60 min 超時警示、TMJ 提示
- 所有變動在手機 375px 寬下不破版

**Non-Goals:**
- `safetyTag` 系統（已對齊不做）
- 排程綁定星期幾（已對齊不做、維持依序輪替）
- 跨裝置 sync、PWA 多端衝突解決
- 自訂 mesocycle / 自訂 phase 配置
- 既有 customSets / exerciseOverrides 的保留（已對齊全清）
- W6–W9 肌力期遺留資料的延續（已對齊重置至 W1）

## Decisions

### D1：Superset UI = 配對卡片（方案 B）

兩個 isolation 動作合併為單一視覺容器、上下並列、共用 header「🔗 SUPERSET · 75s」。

**理由**：方案 A（兩張獨立卡片互貼標籤）會導致使用者在手機上要 scroll 切換、且容易漏掉配對關係。配對卡片把「兩個動作要交替做」這件事在視覺層級就講清楚。

**取捨**：渲染邏輯需重構 `TrainingView.jsx:441-763` 的迭代結構、不能再單純 map exercises、而要先把 exercises 依 `SUPERSET_PAIRS[currentSession]` 分組為 [superset-group, single, superset-group, ...] 再渲染。組數計時邏輯不變、只是容器外觀重組。

### D2：`noteRIR` 與 `noteText` 為兩個獨立字串欄位

不引入 `notes: { rir?, text? }` 物件結構。動作 schema 直接擴增兩個 optional string field。

**理由**：(1) 規格 §5 只用了 `noteRIR`、自然延伸即可；(2) 物件式 schema 在 migration / serialization / TypeScript 推導都更費；(3) 目前只有 2 種提示類型、過早抽象沒收益。

**取捨**：未來若提示類型成長到 4+ 種、再重構為 `notes` 物件。

### D3：被排除動作清單寫死在 migration block 內

直接以 `const REMOVED_IDS = ['pec_deck', 'ohp', 'fly_cable', 'tri_kickback', 'bb_row', 'leg_curl']` 與 `const RENAMED_IDS = { tri_overhead: 'tri_overhead_seated', bp_machine: 'lib_machine_press_flat' }` 兩個 const 在 App.jsx 的 migration block 內定義。

**理由**：這份清單是「v3 → v4 的一次性事實」、不會變、不需要做成可配置。寫死在 migration block 內讓未來開發者能立刻看懂這次升級做了什麼。

### D4：Migration 全部 in-place 操作、無備份機制

不在 migration 前複製一份 `rp_focus_pro_data` 到 `rp_focus_pro_data_v3_backup`。

**理由**：(1) 使用者已對齊「全部清除」、不期望 rollback；(2) localStorage 容量有限、做備份消耗 quota；(3) 若真有需要、使用者開 DevTools 自己備份比較直接。

**風險與緩解**：若 migration 寫錯、舊資料無法救。緩解：(a) migration 寫好後在 dev 環境用既有 localStorage 跑一遍確認；(b) 在 PR 描述中提醒「升級前可手動匯出」。

### D5：進度重置邏輯與 migration 綁定

migration 完成時、若偵測到 `schemaVersion < 4`、無條件 `setCurrentWeek(1)` / `setCurrentDay(0)`。已是 v4 的使用者不會被重置。

**理由**：把「重置進度」當成 schema 升級的一部分、確保每位舊使用者只重置一次。新使用者（無 localStorage）走預設值、不受影響。

### D6：60 min 超時警示讀 `workoutTimes.duration`、不新增 timer

`App.jsx:65-73` 已 memoize `workoutTimes`、其中 `duration` 由 `currentTime`（每秒更新）即時計算。TrainingView 直接讀 prop、判斷 `> 3600` 顯示橫幅。

**理由**：避免引入第二個 timer / setInterval、與既有 session 時長顯示共用單一資料源。

### D7：CALVES 在 MUSCLE_SESSION_MAP 自動納入

`workouts.js:193-201` 的 `MUSCLE_SESSION_MAP` 是 reduce 計算、只要 WORKOUTS 結構正確就會自動產生 `CALVES: ['A','B','C','D','E']`。不需手寫。

### D8：TMJ 提示放在 superset 配對卡片的 footer

不做 modal、不做全域 toast。在配對卡片底部加一行灰字「💨 下顎放鬆 · 鼻吸口呼」、隨配對卡片一起呈現。

**理由**：使用者要在卡片上做動作、提示出現在同一視野內最有效。Modal 會打斷流程、global toast 與當下動作脫鉤。

## Risks / Trade-offs

- **[Risk] migration 漏掉某個資料欄位、舊使用者出現幽靈動作或錯誤渲染** → Mitigation：Verification 階段強制清空 localStorage 跑一輪、再用備份的 v3 資料跑一輪、雙路驗證
- **[Risk] 配對卡片重構破壞既有「拖曳排序」功能（commit `b0a44d2` / `8f24795`）** → Mitigation：實作前先確認拖曳邊界、superset 配對視為單一拖曳單位（不可拆對拖）
- **[Risk] 5 個 Day Selector 按鈕在 375px 寬擠不下** → Mitigation：改用 grid-cols-5 + 縮小 padding、或允許橫向 scroll、實作後在手機尺寸驗證
- **[Risk] CHEST 從 18 砍到 12、使用者短期內感覺「練得不夠」** → 規格 §14 已附科學依據（劑量反應曲線）、UI 不需處理、若使用者抱怨可指向該段
- **[Trade-off] 進度重置會讓使用者「失去」目前肌力期的累積感** → 已對齊接受、理由為新菜單動作多半無 1RM 基準

## Migration Plan

1. PR 合併前、在 dev 用備份的 v3 localStorage 跑一輪、驗證 history 改名 / 清除 / logs 清除 / 進度重置全部正確
2. 部署到生產（PWA 自動更新）
3. 使用者首次打開升級後 app、useEffect 觸發 migration、schemaVersion 改寫為 4、進度顯示 W1
4. 無需使用者操作

**Rollback**：若 migration 嚴重出錯、release 一個 hotfix 把 schemaVersion 鎖回 3 + 還原 workouts.js。已被 migrate 過的使用者資料無法復原（D4 已對齊）。

## Open Questions

無未決問題。所有 UX 抉擇（superset 呈現、schema 設計、safetyTag 取捨、進度重置、customSets 清除）已在 explore 階段對齊。
