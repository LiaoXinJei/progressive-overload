# PWA 安裝與離線

> **狀態**：已完成（持續維運）

---

## 為什麼需要這個功能？

健身房常常訊號不穩，使用者開 App 不能因為網路而卡住。同時，把 App 加到主畫面後體驗應該接近原生 App（全螢幕、無瀏覽器網址列、有自己的圖示）。PWA 是純前端架構下最低成本的解法。

---

## 使用者可以做什麼？

- 在手機瀏覽器把 App **加到主畫面**（iOS：分享 → 加入主畫面；Android：選單 → 安裝應用程式）
- 安裝後以 standalone 模式啟動（直立、無網址列）
- 離線狀態下也能載入 App、繼續記錄訓練（資料下次連網不會自動上傳，因為**沒有後端**）
- 新版本上線時，背景自動更新（`registerType: 'autoUpdate'`）

---

## 相關實作

| 項目 | 位置 |
|------|------|
| PWA 設定 | `vite.config.js` 的 `VitePWA` 區段 |
| Service Worker | `src/sw.js` |
| Manifest | `vite.config.js` 內 `manifest` 物件 |
| 圖示 | `public/icons/icon-192.png`、`icon-512.png` |

### Manifest 重點

| 欄位 | 值 |
|------|-----|
| `name` | `RP FOCUS PRO` |
| `short_name` | `RP LOG` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` | `#171717` |
| `background_color` | `#171717` |
| `lang` | `zh-TW` |

### 快取策略

- 策略：`injectManifest`（自己寫 SW，搭配 workbox-precaching）
- 預快取範圍：`['**/*.{js,css,html,ico,png,svg}']`
- 更新模式：`autoUpdate`（新版部署後背景自動拉取）

---

## 備註

- 改 manifest / 圖示後必須 `npm run build` 才能在 `dist/` 看到新內容
- Service Worker 在 dev 模式不完整，要驗證 PWA 行為請用 `npm run build && npm run preview`
- 改 SW 後若舊版仍在跑，請在 DevTools → Application → Service Workers → Unregister 後重新整理
- 離線下無法呼叫 Gemini API（食物辨識）；訓練紀錄完全離線可用
