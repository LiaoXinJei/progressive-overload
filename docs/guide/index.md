# 技術指引總覽

本資料夾收錄 **RP FOCUS PRO** 的技術說明文件。AI 行為原則、需求處理流程等指引請見專案根目錄的 [CLAUDE.md](../../CLAUDE.md)。

## 業務故事

在深入技術實作前，建議先閱讀業務故事以了解系統功能與設計目的：

- [業務故事總覽](../stories/index.md)

---

## 技術文件目錄

| 文件 | 說明 |
|------|------|
| [常用命令](commands.md) | npm scripts、開發 / 建置 / 預覽 |
| [專案架構](architecture.md) | 模組劃分、資料流、狀態管理、PWA 架構 |
| [核心功能模組](core-modules.md) | 訓練、營養、動作庫、休息通知、Gemini AI、PWA |
| [開發慣例](conventions.md) | React 元件結構、命名、狀態管理、樣式、檔案組織 |
| [配置與注意事項](configuration.md) | Vite、PWA manifest、localStorage schema、Gemini API Key、Tailwind |

---

## 設計與規格

- [非對稱推拉架構 PRD](../../spec/非對稱推拉架構/PRD.md) — 訓練菜單設計依據
- [初版 PRD](../../spec/initial/PRD.md) — 容量控制、單動作天花板、資料結構

---

## 取得協助

- 業務故事：[../stories/](../stories/)
- AI 開發指引：[../../CLAUDE.md](../../CLAUDE.md)
