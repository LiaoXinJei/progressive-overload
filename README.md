# RP FOCUS PRO — Progressive Overload Tracker

基於 Renaissance Periodization (RP) 原則的漸進式訓練追蹤 PWA，協助使用者在有限的恢復能力下，最大化上肢肌群發展、同時維持下肢功能。

> **平台定位**：以 **手機 App 端**為主要使用情境。UI/UX、互動邏輯、排版與操作流程皆優先考量手機體驗。

---

## 功能特色

- 💪 **非對稱推拉架構**：4 天固定週循環（PUSH A / PULL A / PUSH B / PULL B），無獨立腿日，微量腿訓練分散到推拉日
- 📊 **雙週期化（10 週大週期）**：
  - W1–W4 肌肥大期（MEV → MRV 遞增）
  - W5 減量週
  - W6–W9 肌力期（組數鎖定 MEV、重量遞增）
  - W10 減量週
- 📈 **肌群週容量驅動**：以「肌群週目標組數」為核心，自動分配到 session 與動作
- 🗂️ **動作庫管理**：自訂動作、替換動作、調整組數、拖曳排序
- ⏱️ **休息提醒**：透過 Service Worker 排程通知，背景也能響
- 🥗 **營養追蹤**：TDEE 計算、巨量營養素進度條、Gemini AI 食物照片分析
- 💾 **本地儲存**：完整狀態持久化於 `localStorage`（`rp_focus_pro_data`，`schemaVersion: 3`）
- 📱 **PWA**：可安裝、離線可用

---

## 技術棧

- ⚡️ Vite 6
- ⚛️ React 18
- 🎨 Tailwind CSS 3
- 🎯 Lucide Icons
- 🪄 @hello-pangea/dnd（拖曳排序）
- 🔔 vite-plugin-pwa + 自訂 Service Worker（休息提醒）
- 🤖 Google Gemini API（食物照片辨識）

---

## 開始使用

```bash
npm install          # 安裝依賴
npm run dev          # 本地開發（http://localhost:5173）
npm run build        # 建置生產版本（輸出至 dist/）
npm run preview      # 預覽建置結果
```

詳細指令說明見 [docs/guide/commands.md](docs/guide/commands.md)。

---

## 文件導覽

| 區塊 | 入口 |
|------|------|
| AI 開發指引 / 工作流程 | [CLAUDE.md](CLAUDE.md) |
| 技術指引總覽 | [docs/guide/index.md](docs/guide/index.md) |
| 業務故事索引 | [docs/stories/index.md](docs/stories/index.md) |
| 架構設計（非對稱推拉） | [spec/非對稱推拉架構/PRD.md](spec/非對稱推拉架構/PRD.md) |
| 產品需求（初版） | [spec/initial/PRD.md](spec/initial/PRD.md) |

---

## 訓練哲學

基於 RP 訓練量管理四級指標：

- **MV（Maintenance Volume）**：維持肌肉量的最低訓練量
- **MEV（Minimum Effective Volume）**：開始產生增長的訓練量
- **MAV（Maximum Adaptive Volume）**：最佳增長的訓練量
- **MRV（Maximum Recoverable Volume）**：最大可恢復訓練量

核心策略：上肢追 MAV、下肢鎖 MEV、Week 5/10 強制減量，並以「單動作組數天花板」避免垃圾容量。

---

## 授權

MIT
