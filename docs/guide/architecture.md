# 專案架構

## 目錄結構

```
progressive-overload/
├── index.html                    # Vite 入口
├── vite.config.js                # Vite + PWA 設定
├── tailwind.config.js            # Tailwind 設定
├── postcss.config.js
├── public/
│   └── icons/                    # PWA 圖示
├── src/
│   ├── main.jsx                  # React 入口
│   ├── App.jsx                   # 應用入口、狀態總管、localStorage 持久化
│   ├── index.css                 # Tailwind 進入點
│   ├── sw.js                     # Service Worker（休息通知排程 + 預快取）
│   ├── constants/
│   │   ├── workouts.js           # WORKOUTS、VOLUME_CONFIG、PHASE_CONFIG、MUSCLE_SESSION_MAP
│   │   └── nutrition.js          # ACTIVITY_LEVELS、GOALS、DEFAULT_MEAL_NAMES
│   ├── components/
│   │   ├── shared/
│   │   │   └── TabNavigation.jsx
│   │   ├── training/
│   │   │   └── TrainingView.jsx  # 訓練核心 UI + 容量分配演算法
│   │   ├── nutrition/
│   │   │   ├── NutritionView.jsx
│   │   │   ├── TDEECalculator.jsx
│   │   │   ├── MacroProgressBar.jsx
│   │   │   ├── MealEntry.jsx
│   │   │   └── FoodPhotoAnalyzer.jsx  # 用 Gemini 分析食物照片
│   │   └── settings/
│   │       └── ExerciseLibraryManager.jsx  # 動作庫管理
│   ├── hooks/
│   │   └── useRestNotification.js   # 透過 SW 排程休息結束通知
│   └── utils/
│       ├── nutritionCalculations.js
│       └── geminiApi.js             # 呼叫 Google Gemini API
├── docs/
│   ├── guide/                    # 技術說明
│   └── stories/                  # 業務故事
├── spec/                         # 需求 / 設計文件
└── dist/                         # 建置輸出（目前入版控）
```

---

## 狀態管理

採用**單一容器元件**策略，**所有跨頁狀態都集中在 `App.jsx`**，透過 props 傳給 `TrainingView` / `NutritionView` / `ExerciseLibraryManager`。

### App.jsx 持有的狀態

| 類別 | 狀態 |
|------|------|
| 訓練資料 | `logs`、`history`、`mode`（maintenance / bulking） |
| 視圖狀態 | `currentWeek`、`currentDay`、`showStats`、`activeTab` |
| 訓練客製 | `customExerciseNames`、`customExercises`、`customSets`、`exerciseOrder` |
| 動作庫 | `exerciseLibrary`、`exerciseOverrides` |
| 設定 | `weightIncrement`、`restNotificationDelay`、`notifPermission` |
| 營養 | `nutritionProfile`（含 `geminiApiKey`）、`nutritionLogs` |
| UI | `showSettings`、`settingsTab`、`showScrollTop`、`showResetConfirm` |

### 為什麼不引入 Redux / Zustand？

- 狀態雖多但**幾乎只在一層**，prop drilling 只有一層
- 全部資料皆同步存 `localStorage`，沒有遠端同步需求
- 引入狀態管理庫會增加抽象成本，違反「不過度設計」原則

未來若擴張到雲端同步、多裝置一致性，再評估引入 Zustand。

---

## 資料流

```
        ┌──────────────┐
        │  App.jsx     │ ← 唯一的 useState 持有者
        │  (狀態總管)  │
        └──────┬───────┘
               │ props (state + setters)
       ┌───────┼───────────────┬────────────────┐
       ▼       ▼               ▼                ▼
  TrainingView NutritionView ExerciseLibrary  Settings
       │       │
       ▼       ▼
   constants/workouts.js   utils/nutritionCalculations.js
   constants/nutrition.js  utils/geminiApi.js
```

每次任一 state 變化，`App.jsx` 的 `useEffect`（依賴整批 state）會把完整狀態序列化寫回 `localStorage`，key = `rp_focus_pro_data`，`schemaVersion: 3`。

---

## PWA 架構

```
            瀏覽器主執行緒                          Service Worker (sw.js)
   ┌───────────────────────────┐         ┌──────────────────────────────┐
   │ React UI                  │         │ workbox precacheAndRoute      │
   │   ↓ 完成一組訓練          │         │ ─ 離線快取建置產物            │
   │ useRestNotification       │         │                               │
   │   postMessage             │ ──────► │ 'SCHEDULE_NOTIFICATION'       │
   │   {delay, title, body}    │         │   setTimeout → showNotification│
   │                           │         │   vibrate, requireInteraction │
   └───────────────────────────┘         └──────────────────────────────┘
```

- SW 由 `vite-plugin-pwa` 使用 `injectManifest` 策略注入（`src/sw.js`）
- 通知排程**走 SW**，這樣即使分頁切到背景、螢幕鎖屏，計時也能準時觸發
- 開發模式（`npm run dev`）下 SW 行為不完整，要驗證請用 `npm run build && npm run preview`

詳見 [core-modules.md](core-modules.md#休息通知系統)。

---

## 外部依賴

| 系統 | 用途 | 配置位置 |
|------|------|----------|
| Google Gemini API | 食物照片辨識營養資訊 | 使用者於 App 內輸入 API Key（存 `nutritionProfile.geminiApiKey`） |
| Notification API | 休息結束彈窗 | 使用者授權，記於 `Notification.permission` |
| Service Worker | 排程通知、離線快取 | `src/sw.js`、`vite.config.js` 的 `VitePWA` 區段 |
| localStorage | 全狀態持久化 | key = `rp_focus_pro_data` |
