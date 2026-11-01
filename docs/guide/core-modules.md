# 核心功能模組

> 本檔逐一說明專案中的「橫切核心模組」。每個段落都包含：實作位置、職責、與其他模組的交互。

---

## 訓練模組（TrainingView）

- **位置**：`src/components/training/TrainingView.jsx`
- **常數來源**：`src/constants/workouts.js`
- **職責**：
  - 顯示當日訓練菜單（依 `currentWeek` 決定階段、`currentDay` 決定 PUSH/PULL）
  - 依肌群週容量分配每動作組數
  - 接收使用者輸入（重量、次數）；每組 ✓ 按鈕（`completeSet`）才標記完成、寫 history，輸入不會自動完成
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
- `noteRIR` — RIR 限制徽章（例如 `lying_leg_curl_d` 的 `'2-3'`，保護隔天 LEGS 日），寫在 `WORKOUTS` 的格子上，替換動作也留著
- `noteText` — 動作底下的灰字提示，**不寫在 `WORKOUTS`**，統一放 `EXERCISE_NOTES`（id → 備註）。`buildSessionPlan` 照實際顯示的動作 id 查：替換成動作庫的動作就顯示那個動作的備註。不存進 localStorage，改備註不用 migration

### 容量分配演算法

1. 查肌群週目標（`VOLUME_CONFIG[muscle][weekIndex]`）
2. 照 `SESSION_WEIGHTS[muscle]` 的比例分到包含該肌群的 sessions（`MUSCLE_SESSION_MAP` 預計算），用最大餘數法（`splitByWeights`）取整數，總和等於週目標；餘數一樣給排前面的 session，沒列權重的肌群平均分。權重取規格 W4 各 session 的組數，週總量以 `VOLUME_CONFIG` 為準
3. 再均分到該 session 內的動作（**最後一個動作拿餘數**）
4. 受 `MAX_SETS_PER_EXERCISE`（預設 4）封頂，避免單動作組數爆炸
5. 每個動作至少 1 組。減量週目標低，均分後可能變 0 組（例如 W5 LEGS 日），所以這幾個肌群的減量週實際總組數會略高於目標

### Superset 配對休息計時（pair rest timer）

- **常數**：`SUPERSET_PAIRS[sessionKey]` 列出該 session 的 antagonist 配對（含 primary / secondary / rest 秒數）
- **Helper**：`src/utils/pairRoundState.js`
  - `getPairRoundState(pair, aSets, bSets, week, day, logs)` — 純 derived、從 `logs` 推 round 狀態
  - `getExercisesEndTimestamp([{ exerciseId, sets }], week, day, logs)` — 這些動作每組都完成或跳過才算結束，回傳完成組裡最晚的 `completedAt`；還有組沒 settled、或每組都跳過 → `null`。單動作的「前一 group 結束時間」用它（最後一組跳過也照算）
  - `getPairEndTimestamp(...)` — 同上套在配對的兩個動作：核心輪 + tail 組每組都 settled 才回傳，取完成組最晚的 `completedAt`；還有一輪或 tail 組沒做 → `null`
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
  - 進入 pair（pair `idle` 且前一 group 結束）→ sticky bar 上方一行「{上一動作 / 上一配對}完成 m:ss 前 · 進入 superset」；前一 group 還有組沒做完（例如上一組配對 R2 還沒做）就不顯示
  - 離開 pair（pair → 後一獨立動作）→ 後動作 inter-exercise rest 起算點 = `getPairEndTimestamp(...)`，有 tail 組時從 tail 組結束起算
- **pair 內 inline rest**：核心輪的休息由 sticky bar 呈現，set 列不渲染「休息時間 / 休息中」；只有最後一個核心組 → 第一個 tail 組（從核心輪結束起算，那組自己跳過也照樣顯示）和 tail 組之間回到單動作的 inline 休息
- **組間休息遇到跳過的組**：往後找第一個沒跳過的組，休息時間 / 休息中照樣顯示；restContext 同規則，還有組沒做就是 `in-set`
- **時間顯示**：休息 / 經過時間 clamp 到 0，按 ✓ 的時間比畫面上的 `currentTime` 晚時顯示 0:00，不會出現 -1:-1
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
- **模型**：`gemini-3.6-flash`（`gemini-2.0-flash` 已於 2026-06-01 停用）
- **端點**：`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`
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
  App.jsx 用 getLatestDoneSession(logs) 找最近一筆完成組所在的週 / 天
    ↓
  App.jsx 計算那一天的 restContext（型別 + delay + anchorTs + notifyKey）
    ↓
  useRestNotification 依 restContext.notifyKey 變動 → cancel 舊通知
    ↓
  visibilitychange 進入背景 → 依 restContext.type 決定排程或跳過
    ↓
  SW: setTimeout (delay) → showNotification(title, { vibrate, requireInteraction })
  ```

- **綁哪一天**：restContext 綁最近一筆完成組（`completedAt` 最晚）所在的週 / 天（`getLatestDoneSession`），不綁畫面上的 `currentWeek` / `currentDay`。休息中切去看別天、別週，背景通知照樣排程；最近一筆是以前的課表時起算點早就過了，hook 不會排程。沒有任何完成組時才用畫面上的週 / 天（結果是 `idle`）
- **權限**：`requestNotificationPermission()`（在設定面板手動觸發）；沒有 `Notification` 物件的瀏覽器（iOS Safari 沒加到主畫面）`schedule` 直接跳過
- **restContext 五種型別**（`src/utils/pairRoundState.js#getRestContext`）：

  | type | 觸發條件 | delay | 排程 |
  |------|----------|-------|------|
  | `idle` | 當日無 done、或所有工作 settled | — | ✘ |
  | `in-set` | 單動作下一個沒跳過的組還沒做（中間組跳過時往後找） | 全域 `restNotificationDelay` | ✓ |
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
- **`schemaVersion`**：`7`
- **入口**：`src/App.jsx` 的 `useEffect`（載入、寫回、聽 `storage` 事件），遷移邏輯在 `migrateSavedData()`。寫回前跟 storage 現值比對、一樣就不寫；讀檔失敗把原始字串另存 `rp_focus_pro_data_corrupt_<timestamp>` 再照空資料啟動；`setItem` 失敗提示一次
- **遷移**：v2 → v3 把 `history[id]` 從 `number` 升級為 `{ weight, reps }` 物件；v3 → v4 腿部訓練計劃 v3 FINAL（動作移除 / 改名、進度重置）；v4 → v5 動作庫與替換設定對齊 v3 FINAL；v5 → v6 組數覆寫改成分週（有 log 的週轉成分週 key，其他清掉），並拿掉 C 日替換成 `lib_skullcrusher` 的設定（避免跟內建那格重複）；v6 → v7 動作庫改名與 type 修正（名稱還是歷代預設名才換），並用分週組數覆寫補回 v6 換預設組數後被藏起來、但有 log 的組
- **規則**：任何結構變更**必須加遷移邏輯**，不可破壞舊使用者資料
