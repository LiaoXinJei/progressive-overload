# 核心功能模組

> 本檔逐一說明專案中的「橫切核心模組」。每個段落都包含：實作位置、職責、與其他模組的交互。

---

## 訓練模組（TrainingView）

- **位置**：`src/components/training/TrainingView.jsx`
- **常數來源**：`src/constants/workouts.js`
- **職責**：
  - 顯示當日訓練菜單（依 `currentWeek` 決定階段、`currentDay` 決定 PUSH/PULL）
  - 依肌群週容量分配每動作組數
  - 接收使用者輸入（重量、次數、完成標記）
  - 拖曳排序（`@hello-pangea/dnd`）
  - 替換動作、新增動作、調整組數

### 核心函數

| 函數 | 用途 |
|------|------|
| `getWorkoutForDay(week, dayIndex)` | 回傳 `'A' \| 'B' \| 'C' \| 'D'` |
| `getPhase(week)` | 回傳 `'hypertrophy' \| 'strength' \| 'deload'` |
| `getWeeklyMuscleVolume(muscle, week)` | 查 `VOLUME_CONFIG` 取得該肌群當週目標組數 |
| `getSessionPlan(week, workoutKey)` | 把週容量分配到 session 內各動作，回傳 `[{ exercise, sets }]` |
| `getRepRange(exerciseType, week)` | 依階段 + 動作類型回傳建議次數區間 |

### Exercise 資料結構

```js
{ id: 'bp_flat', name: '平板槓鈴臥推', muscle: 'CHEST', type: 'compound', isUpper: true }
```

- `type: 'compound' | 'isolation'` — 決定該階段的建議次數範圍
- `isUpper` — UI 圓點顏色（上肢藍 / 下肢橙）
- 不再有 `baseSets` — 組數完全由 `VOLUME_CONFIG` + 分配演算法決定

### 容量分配演算法

1. 查肌群週目標（`VOLUME_CONFIG[muscle][weekIndex]`）
2. 均分到包含該肌群的 sessions（在 `MUSCLE_SESSION_MAP` 預計算）
3. 再均分到該 session 內的動作（**第一個動作拿餘數**）
4. 受 `MAX_SETS_PER_EXERCISE`（預設 4）封頂，避免單動作組數爆炸

### Superset 配對休息計時（pair rest timer）

- **常數**：`SUPERSET_PAIRS[sessionKey]` 列出該 session 的 antagonist 配對（含 primary / secondary / rest 秒數）
- **Helper**：`src/utils/pairRoundState.js`
  - `getPairRoundState(pair, aSets, bSets, week, day, logs)` — 純 derived、從 `logs` 推 round 狀態
  - `getPairEndTimestamp(...)` — 取 `max(lastRound.A.completedAt, lastRound.B.completedAt)`、僅納入 done 組
- **狀態機**（給定一個 pair）：
  - `idle`：尚未有任何 round 開始
  - `mid-round`：某 round 兩組「恰好一邊 settled」→ amber「⏱ 切換中」
  - `between-rounds`：某 round 已 complete、下一 round 尚未開始 → emerald / rose「輪間休息: m:ss / 目標 m:ss」（超目標轉 rose）
  - `done`：所有 core round 皆 complete
- **UI**：`<PairStickyBar>` 黏在 pair 卡片內部頂端（`position: sticky; top: 0`）、bar 左側顯示 A、B 兩列 round dots（done 實心、pending 空心、skipped 斜線）
- **設計取捨**（純 derived、不動 schema）
  - logs 已記 done / skipped / completedAt、足以推出 round 狀態、不需新增欄位
  - core round 數 = `min(aSets, bSets)`、超出組數視為 single tail、回退單動作組間休息語意
- **邊界訊息**
  - 進入 pair（pair `idle` 且前一 group 完成）→ sticky bar 上方一行「{上一動作 / 上一配對}完成 m:ss 前 · 進入 superset」
  - 離開 pair（pair → 後一獨立動作）→ 後動作 inter-exercise rest 起算點 = `getPairEndTimestamp(...)`
- **pair 內隱藏 inline rest**：pair 成員的 set 列不渲染「休息時間 / 休息中」、所有休息訊息統一由 sticky bar 呈現
- **規格**：`openspec/specs/superset-execution/` 與 `openspec/specs/workout-execution-ui/`

---

## 動作庫管理（ExerciseLibraryManager）

- **位置**：`src/components/settings/ExerciseLibraryManager.jsx`
- **職責**：
  - 維護 `exerciseLibrary`（使用者可新增 / 編輯 / 刪除動作項目）
  - 維護 `exerciseOverrides`（針對某 session 替換掉預設動作）
  - 自訂動作以 `custom_<timestamp>` 為 id
- **資料來源**：
  - `DEFAULT_EXERCISE_LIBRARY`：從 `WORKOUTS` 攤平後去重，作為預設庫
  - 使用者新增的項目疊加在上面，存於 `localStorage` 的 `exerciseLibrary`

---

## 營養模組（NutritionView）

- **位置**：`src/components/nutrition/`
- **子元件**：
  - `TDEECalculator.jsx` — 體重 / 身高 / 年齡 / 活動量 → BMR、TDEE、目標熱量、目標蛋白質
  - `MacroProgressBar.jsx` — 顯示當日熱量 / 蛋白質 / 碳水 / 脂肪進度
  - `MealEntry.jsx` — 單筆飲食輸入
  - `FoodPhotoAnalyzer.jsx` — 拍照 / 上傳 → Gemini AI 分析
- **常數來源**：`src/constants/nutrition.js`（`ACTIVITY_LEVELS`、`GOALS`、`DEFAULT_MEAL_NAMES`）
- **計算工具**：`src/utils/nutritionCalculations.js`
- **資料儲存**：
  - `nutritionProfile`：個人資料 + Gemini API Key（**敏感資料，存在使用者裝置 localStorage**）
  - `nutritionLogs`：以日期為 key 的飲食紀錄

---

## Gemini AI 食物辨識

- **位置**：`src/utils/geminiApi.js`
- **模型**：`gemini-2.0-flash`
- **端點**：`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- **流程**：
  1. 使用者上傳食物照片
  2. 轉成 Base64
  3. POST 給 Gemini，附帶要求回傳 JSON 結構的中文 prompt
  4. 解析 `{ items: [{ name, portion, calories, protein, carbs, fat }, ...] }`
- **API Key 處理**：
  - 由使用者自備（Google AI Studio 取得）
  - 存於 `nutritionProfile.geminiApiKey`，**只在使用者瀏覽器 localStorage**，不傳給任何其他伺服器
  - UI 上用 `type="password"` 遮蔽

---

## 休息通知系統

- **Hook**：`src/hooks/useRestNotification.js`
- **Service Worker**：`src/sw.js`
- **流程**：

  ```
  使用者完成一組
    ↓
  App.jsx 計算 restContext（型別 + delay + anchorTs + notifyKey）
    ↓
  useRestNotification 依 restContext.notifyKey 變動 → cancel 舊通知
    ↓
  visibilitychange 進入背景 → 依 restContext.type 決定排程或跳過
    ↓
  SW: setTimeout (delay) → showNotification(title, { vibrate, requireInteraction })
  ```

- **權限**：`requestNotificationPermission()`（在設定面板手動觸發）
- **restContext 五種型別**（`src/utils/pairRoundState.js#getRestContext`）：

  | type | 觸發條件 | delay | 排程 |
  |------|----------|-------|------|
  | `idle` | 當日無 done、或所有工作 settled | — | ✘ |
  | `in-set` | 單動作下一組未 settled | 全域 `restNotificationDelay` | ✓ |
  | `in-pair-mid-round` | pair round 內單邊 settled | — | ✘ |
  | `in-pair-between-rounds` | pair round 完成、下一輪未開始 | `SUPERSET_PAIRS[*].rest`（75 / 90） | ✓ |
  | `between-exercises` | 動作末組完成、後續仍有工作 | 全域 `restNotificationDelay` | ✓ |

- **`restNotificationDelay` 設定**：使用者於設定頁可調的全域值（預設 90 秒、選項 60/90/120/150/180）。**僅作用於 `in-set` 與 `between-exercises`**；Superset 配對的輪間休息採配對自身的 `rest` 值（取自 `SUPERSET_PAIRS`）。
- **`notifyKey`**：形如 `${workoutKey}:${day}:${type}:${anchorTs}`、變更時 hook 會 cancel 舊通知再依新 context 決定是否排程。
- **Android 注意**：必須帶 `vibrate` 參數才會跳 heads-up 通知（見近期 commit `09339f0`）
- **iOS 限制**：Web Push 需要 HTTPS + 已安裝為 PWA；本地測試請用 `localhost` 或 HTTPS 通道

---

## PWA

- **配置位置**：`vite.config.js` 的 `VitePWA` 區段
- **策略**：`injectManifest`（自己寫 SW，不用預設的 generateSW）
- **manifest**：
  - `name`: `RP FOCUS PRO`
  - `short_name`: `RP LOG`
  - `display`: `standalone`
  - `orientation`: `portrait`
  - `theme_color`: `#171717`（neutral-900）
- **預快取**：`globPatterns: ['**/*.{js,css,html,ico,png,svg}']`
- **更新**：`registerType: 'autoUpdate'`（背景自動拉新版本）

---

## 資料持久化

- **儲存**：`localStorage`
- **Key**：`rp_focus_pro_data`
- **`schemaVersion`**：`3`
- **入口**：`src/App.jsx` 的兩個 `useEffect`（載入 + 寫回）
- **遷移**：v2 → v3 把 `history[id]` 從 `number` 升級為 `{ weight, reps }` 物件
- **規則**：任何結構變更**必須加遷移邏輯**，不可破壞舊使用者資料
