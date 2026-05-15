# 配置與注意事項

## 設定檔總覽

| 檔案 | 用途 |
|------|------|
| `package.json` | 依賴與 npm scripts |
| `vite.config.js` | Vite + PWA 設定 |
| `tailwind.config.js` | Tailwind 掃描範圍與 theme |
| `postcss.config.js` | PostCSS plugin（autoprefixer） |
| `index.html` | Vite 入口 HTML |
| `.gitignore` | 版控忽略 |

---

## Vite 設定（`vite.config.js`）

### Plugin

- `@vitejs/plugin-react` — JSX、Fast Refresh
- `vite-plugin-pwa` — PWA + Service Worker 注入

### PWA 重點

```js
VitePWA({
  registerType: 'autoUpdate',      // 自動拉新版
  strategies: 'injectManifest',    // 用自己的 sw.js
  srcDir: 'src',
  filename: 'sw.js',               // 對應 src/sw.js
  manifest: { ... },               // App 圖示、theme color、display
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
  },
})
```

- 改 PWA 圖示：放到 `public/icons/`，並更新 `manifest.icons`
- 改 App 名稱 / 顏色：改 `manifest.name` / `theme_color` / `background_color`
- 改快取範圍：調 `injectManifest.globPatterns`

> 改完 PWA 設定後，必須 `npm run build` 才能在 `dist/` 看到新的 SW 與 manifest。

---

## localStorage Schema

| 欄位 | 用途 |
|------|------|
| `schemaVersion` | 目前為 `3`。**任何結構變更必須升版號並加遷移邏輯** |
| `logs` | 訓練紀錄，key 格式：`w<week>-d<day>-<exerciseId>-s<setIndex>` |
| `history` | 各動作最近一次的 `{ weight, reps }` |
| `mode` | `'maintenance' \| 'bulking'` |
| `viewState` | `{ currentWeek, currentDay, showStats }` |
| `customExerciseNames` | 使用者改名 |
| `customExercises` | 使用者新增的動作 |
| `customSets` | 各動作組數覆寫 |
| `exerciseOrder` | 拖曳後的順序 |
| `exerciseLibrary` | 完整動作庫（含自訂） |
| `exerciseOverrides` | session 內動作替換 |
| `weightIncrement` | 重量微調幅度（預設 2） |
| `restNotificationDelay` | 休息通知秒數（預設 90） |
| `activeTab` | 當前頁籤 |
| `nutritionProfile` | 個人資料 + Gemini API Key |
| `nutritionLogs` | 飲食紀錄 |

讀寫位置：`src/App.jsx`（兩個 `useEffect`）。Storage key：`rp_focus_pro_data`。

---

## 敏感資料

- **Gemini API Key** 完全由使用者自備，存於使用者瀏覽器 `localStorage.rp_focus_pro_data.nutritionProfile.geminiApiKey`
- **不要**把任何 API Key、後端網址寫死在原始碼
- **不要**新增需要伺服器端金鑰的功能（目前架構是純前端 + 使用者自備金鑰）

若未來引入後端，需重新評估金鑰流向與儲存方式。

---

## Tailwind 設定

- 掃描範圍：`./index.html`、`./src/**/*.{js,jsx,ts,tsx}`
- 主題：使用 Tailwind 預設 + 深色 neutral 系
- 不要任意自訂 theme color，先用 Tailwind 內建語義色（emerald / cyan / amber / blue / orange）

---

## Service Worker 注意事項

- `src/sw.js` 內容只在 **build 後**才會被 workbox 處理
- `precacheAndRoute(self.__WB_MANIFEST)` 的 manifest 由 `vite-plugin-pwa` 在 build 時注入
- 修改 SW 後**一定要清除瀏覽器舊 SW** 才能驗證新行為（Chrome DevTools → Application → Service Workers → Unregister）
- 通知排程使用 `setTimeout` + `event.waitUntil` 保活，最長壽命受瀏覽器限制（手機鎖屏久了可能會被殺）

---

## 通知權限

- 預設為 `'default'`，需使用者主動授權才會跳通知
- 授權入口：設定面板的「啟用休息通知」按鈕
- `Notification.permission` 三態：`'default'` / `'granted'` / `'denied'`
- 在不支援的環境（iOS Safari 部分版本）回傳 `'unsupported'`

---

## 開發 vs 生產差異

| 項目 | dev (`npm run dev`) | prod (`npm run preview` / 部署) |
|------|---------------------|--------------------------------|
| Service Worker | 不完整，通知行為不可信 | 完整啟用 |
| 預快取 | 無 | 有 |
| HMR | 有 | 無 |
| 通知測試 | 受限 | 可靠 |

**驗證 PWA 與通知一律用 `build + preview`。**

---

## 效能考量

- `App.jsx` 寫回 localStorage 的 `useEffect` 依賴整批 state，任何變動都會觸發整份序列化寫入。資料量不大（單一使用者、文字為主）目前可接受；若日後資料膨脹，再評估 debounce 或 selective 寫入
- 拖曳排序的自動捲動速度已調慢（commit `8f24795`），改 `@hello-pangea/dnd` 設定時請保留此調整
- Gemini 食物分析屬於使用者主動觸發，無背景輪詢成本
