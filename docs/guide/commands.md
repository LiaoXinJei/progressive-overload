# 常用命令

本專案使用 **Vite + React 18**，所有命令透過 npm scripts 執行。

## npm scripts（`package.json`）

| 指令 | 說明 |
|------|------|
| `npm install` | 安裝依賴 |
| `npm run dev` | 啟動開發伺服器（預設 http://localhost:5173），支援 HMR |
| `npm run build` | 建置生產版本，輸出至 `dist/` |
| `npm run preview` | 在本地預覽 `dist/` 建置結果 |

> 目前**沒有**自動化測試套件（`npm test` 未配置）。新增測試前請先與使用者討論測試框架選型（Vitest 是與 Vite 最相容的首選）。

---

## 開發流程

```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發
npm run dev
# → http://localhost:5173

# 3. 建置生產版本
npm run build

# 4. 本機驗證 PWA / Service Worker（必要！dev 模式不會完整模擬 SW）
npm run preview
```

> **PWA 注意事項**：休息通知與離線快取邏輯（`src/sw.js`）只在 **build 後**才會被 `vite-plugin-pwa` 注入。要驗證通知排程、Service Worker 行為，**必須跑 `npm run build && npm run preview`**，dev server 不會載入完整的 SW。

---

## 手機實機測試

由於本專案以手機為主要使用情境，建議：

1. `npm run dev` 後，讓手機連到開發機同一個區網
2. Vite 預設只綁定 `localhost`，需用 `npm run dev -- --host` 暴露區網位址
3. 用手機瀏覽器開啟 `http://<開發機 IP>:5173`
4. iOS 通知 API 在非 HTTPS 環境受限，必要時用 `npm run preview` 搭配 HTTPS 通道（如 ngrok）驗證

---

## 部署

目前 `dist/` 已 commit 入版控。若改為 CI/CD 自動化，需：

1. 將 `dist/` 加入 `.gitignore`
2. 設定 GitHub Pages / Vercel / Netlify 等服務指向 `dist/`
3. 確認 PWA `start_url` 與部署路徑一致（見 `vite.config.js`）
