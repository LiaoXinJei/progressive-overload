# CLAUDE.md

本檔提供 Claude Code（claude.ai/code）在此倉庫工作時的指引。

---

## 專案概述

**RP FOCUS PRO** 是基於 Renaissance Periodization (RP) 原則的漸進式訓練追蹤 PWA。核心目標是透過科學化的訓練量管理，在有限的恢復能力下最大化上肢肌群發展，同時維持下肢功能。

**平台定位**：以 **手機 App 端**為主要使用情境。UI/UX、互動邏輯、排版與操作流程皆優先考量手機體驗。

---

## 首要原則

1. **一律使用正體中文溝通**
2. **不要過度設計** — 先解決當前問題，未來需求未來再說，但可以提出來討論是否在現行階段處理
3. **一切需求皆需可測試與討論** — 無法驗證的設計不是好設計
4. **手機優先** — 任何 UI 改動先在手機尺寸驗證

---

## 核心訓練邏輯

### 非對稱推拉架構（4-Day Fixed Cycle）

固定 4 天週循環，無獨立腿日，微量腿部訓練分散到推拉日：

- Day 0: PUSH A（水平推力 + 微量腿前）
- Day 1: PULL A（垂直拉力 + 微量腿後）
- Day 2: PUSH B（垂直推力，純上半身）
- Day 3: PULL B（水平拉力，純上半身）

### 雙週期制（Dual Periodization）

10 週為一個大週期：

- **W1–W4 肌肥大期**：肌群週容量從 MEV 遞增至 MRV，複合動作 8–12 下，隔離動作 10–15 下
- **W5 減量週**：所有肌群降至 MEV 的 50%
- **W6–W9 肌力期**：總組數固定於 MEV，重量遞增，複合動作 3–6 下，隔離動作 8–10 下
- **W10 減量週**：同 W5

### 肌群週容量模型（Volume-Driven Model）

訓練量以**肌群週目標組數**為核心，自動分配到各 session 和動作：

```
CHEST:     [12, 14, 16, 18]  // W1(MEV) → W4(MRV)
BACK:      [12, 14, 16, 18]
SIDE_DELT: [8, 10, 12, 14]
REAR_DELT: [8, 9, 10, 12]    // 非線性
TRICEPS:   [8, 9, 10, 12]    // 非線性
BICEPS:    [8, 9, 10, 12]    // 非線性
QUADS:     [4, 4, 4, 4]      // 固定（純維持）
HAMS:      [4, 4, 4, 4]      // 固定（純維持）
```

分配演算法：
1. 查找肌群週目標 → 2. 均分到包含該肌群的 sessions → 3. 再均分到各動作（第一個動作拿餘數）

---

## 技術說明

本檔僅紀錄 **AI 行為原則與開發流程指引**。技術細節（架構、命令、模組、慣例、配置等）統一收錄在：

- **[docs/guide/index.md](docs/guide/index.md)** — 技術指引總覽（必讀入口）

具體章節速查：

| 主題 | 文件 |
|------|------|
| 建置 / 測試 / 發佈命令 | [docs/guide/commands.md](docs/guide/commands.md) |
| 模組劃分、資料流、PWA 架構 | [docs/guide/architecture.md](docs/guide/architecture.md) |
| 訓練、營養、通知、Gemini、PWA | [docs/guide/core-modules.md](docs/guide/core-modules.md) |
| React 元件結構、命名、狀態管理、樣式 | [docs/guide/conventions.md](docs/guide/conventions.md) |
| Vite、PWA、localStorage、API 金鑰 | [docs/guide/configuration.md](docs/guide/configuration.md) |

**動工前若涉及上述主題，務必先翻閱對應文件，再開始實作。**

---

## 文件撰寫

- 使用者說「整理邏輯」時，預設為撰寫說明文件，而非修改程式碼
- 「現有功能」文件放 `docs/`
- 「新需求」文件放 `spec/`
- 技術說明放 `docs/guide/`，並更新 `docs/guide/index.md`
- 業務故事放 `docs/stories/`，並更新 `docs/stories/index.md`

---

## Git 工作流程

- **主分支**：`main`
- **功能分支**：`feature/<description>`
- **修復分支**：`hotfix/<description>`
- **commit 訊息**：一律使用**正體中文**
- 合併順序：feature → main

---

## 需求處理流程

**重要：收到新需求時，不要立即開始實作。必須先完成需求確認流程。**

### 步驟 1：理解需求

1. 仔細閱讀並消化需求內容
2. 用自己的話重述需求，確認理解正確
3. 識別需求中不明確或可能有多種解讀的地方

### 步驟 2：提出問題

1. 列出所有疑問與需要釐清的細節
2. 提出可能的實作方案（如有多選）
3. 詢問使用者偏好與優先順序

### 步驟 3：確認後執行

- [ ] 使用者確認理解正確
- [ ] 所有關鍵問題已解答
- [ ] 實作方向已獲同意

### 步驟 4：開發完成後檢查

完成並通過驗證後，主動詢問：

1. **業務故事**：是否需要更新 `docs/stories/index.md`、新增 / 修改個別 story？
2. **技術文件**：是否需要更新 `docs/guide/` 對應章節？
3. **AI 指引**：是否有經驗值得寫入 `CLAUDE.md` 避免下次再犯？

---

## 業務故事維護

收到新需求或功能時：

1. **釐清需求目的**：先問「這個功能是為了什麼？解決什麼問題？」
2. **更新故事文件**：將目的記錄到 `docs/stories/index.md`
3. **對應實作**：開發完成後，更新故事的「相關實作」表

| 文件 | 說明 |
|------|------|
| [docs/stories/index.md](docs/stories/index.md) | 專案背景、功能模組與實作對應 |
| [docs/stories/_template.md](docs/stories/_template.md) | 新增故事的標準格式 |

---

## 溝通與設計原則

### 討論階段

- 先釐清需求，確認理解一致
- 提出可行方案，分析優缺點
- 不確定的地方提問，不要假設

### 設計原則

- **簡單優先**：能用簡單方式解決就不要複雜化
- **可擴展但不過早抽象**：預留擴展點，但不為不存在的需求設計
- **手機優先**：UI 改動先驗證手機體驗
- **狀態集中**：跨元件共享的狀態統一在 `App.jsx` 管理，透過 props 傳遞

---

## 資料持久化與相容性

> **⚠️ 重要：只要改到 `localStorage` 中存放結構（`rp_focus_pro_data`），必須評估相容性。**

- 目前 `schemaVersion: 3`
- 變更結構時，必須在載入流程（`App.jsx` 的 `useEffect` 還原段）加入遷移邏輯，避免舊使用者資料遺失
- 範例：v2 → v3 將 `history` 從 `number` 升級為 `{ weight, reps }` 物件

---

## 修改指南速查

| 想改的東西 | 改哪裡 |
|------------|--------|
| 肌群週容量 | `src/constants/workouts.js` 的 `VOLUME_CONFIG` |
| 訓練菜單 | 同上的 `WORKOUTS`（`MUSCLE_SESSION_MAP` 會自動重算） |
| 週期配置（次數區間） | 同上的 `PHASE_CONFIG` |
| 單動作組數上限 | 同上的 `MAX_SETS_PER_EXERCISE` |
| Superset 配對 | 同上的 `SUPERSET_PAIRS`（key 為 session ID、value 為配對清單） |
| Session 配色（push / pull / legs） | 同上的 `SESSION_TYPE_THEME` |
| 動作 RIR 警示徽章 | 在 `WORKOUTS` 動作物件加 `noteRIR: '2-3'` 字串 |
| 動作底下灰字提示 | 在 `WORKOUTS` 動作物件加 `noteText: '...'` 字串 |
| 移除 / 改名動作 | `App.jsx` 的 v3→v4 migration block（`REMOVED_IDS` / `RENAMED_IDS`）+ bump `schemaVersion` |
| 訓練核心 UI | `src/components/training/TrainingView.jsx` |
| 營養追蹤 | `src/components/nutrition/NutritionView.jsx` |
| 動作庫管理 | `src/components/settings/ExerciseLibraryManager.jsx` |
| 休息通知 | `src/hooks/useRestNotification.js` + `src/sw.js` |
| PWA 設定 | `vite.config.js` 的 `VitePWA` 區段 |

UI 樣式：Tailwind CSS，深色主題（neutral-950）。肌肥大期綠色系，肌力期青色系。
