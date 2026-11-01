# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

（手機優先的 PWA，直式、`display: standalone`，主要裝在手機主畫面使用）

## Users

開發者本人和幾個朋友，都是中高階健身者。各自用自己的手機，沒有帳號系統，資料只存在各自裝置的 localStorage。

課表（`src/constants/workouts.js` 的 `WORKOUTS`）是照開發者本人的限制設計的（脊椎友善、無站姿軸向加壓、TMJ 提示）。朋友沿用同一套課表，用「替換動作」「新增動作」「組數 ±」自己調。

## Product Purpose

在有限的恢復能力下，用 Renaissance Periodization 的訓練量管理，讓上肢肌群最大化成長、下肢維持功能。app 幫使用者把「這週每個肌群該做幾組、這個動作今天做幾組幾下」自動算好，使用者只要照著做、把重量次數記下來。

成功的樣子：訓練中記錄不打斷節奏，休息時間抓得準，週量照計畫走，10 週大週期跑完資料都還在。

## Positioning

訓練量由「肌群週目標組數」驅動，自動分配到各 session 和動作（`VOLUME_CONFIG` → `SESSION_WEIGHTS` 最大餘數法 → 均分到動作，單動作上限 4 組）。搭配 10 週雙週期（W1–W4 肌肥大 MEV→MRV、W5 減量、W6–W9 肌力、W10 減量），每週次數區間和 RIR 自動切換。Superset 有輪次狀態與輪間休息計時。一般記錄 app 只記你做了什麼；這個 app 告訴你今天該做什麼。

## Operating Context

使用情境（使用者確認）：

- **組間單手記錄**：做完一組拿起手機，快速輸入或微調重量次數、按 ✓，放回去。這是最高頻的操作。
- **看休息計時 / 等通知**：手機放在旁邊或口袋，靠畫面計時和 Service Worker 通知控制組間、輪間、動作間休息。
- **訓練前看今天課表**：確認今天是 A–E 哪一練、每個動作幾組幾下、哪些是 superset。
- **事後看週量統計**：看各肌群本週組數有沒有達標、缺多少。

營養（TDEE、巨量營養素、Gemini 拍照辨識）偶爾用，是次要功能。

訓練結構：A–E 五練依序輪替、不綁星期（PUSH A / PULL A / PUSH B / PULL B / LEGS），推拉日帶少量腿部和小腿補刀。

## Capabilities and Constraints

- 純前端：React 18 + Vite + Tailwind，無後端。全部狀態在 localStorage `rp_focus_pro_data`，目前 `schemaVersion: 6`。改資料結構必須寫遷移，不能讓舊使用者掉資料。
- PWA：可安裝、離線可用；休息通知走 Service Worker（`src/sw.js`），只有 build 後才完整。
- Gemini API 金鑰由使用者自己填，存在本機。
- 介面語言：台灣繁體中文（`lang: zh-TW`）。訓練術語沿用 RP 用語：MEV / MAV / MRV、RIR、複合 / 隔離、Superset、減量週（Deload）。
- 訓練功能：記錄重量 / 次數、±重量（步進可設定）、✓ 完成 / 取消完成、跳過、點組號帶入上次紀錄、替換動作（動作庫）、新增 / 刪除自訂動作、組數 ±（分週存）、拖曳排序、superset 輪次與休息計時、動作間休息、60 分鐘超時提醒、本週肌群訓練量統計。
- 動作的特殊提示：`noteRIR`（RIR 警示徽章）、`noteText`（灰字提示）。

## Brand Commitments

- 名稱：RP FOCUS PRO（PWA short name：RP LOG）。
- 深色介面是既有慣例（`theme_color` / `background_color: #171717`），健身房使用情境下沒有要求改成淺色。

## Evidence on Hand

沒有使用者見證、數據或宣傳素材。文件在 `docs/stories/`（業務故事）、`spec/`（PRD）、`docs/guide/`（技術指引）。

## Product Principles

1. **記錄不能打斷訓練**：組間那幾秒內要能單手完成記錄，最常用的操作離拇指最近、步驟最少。
2. **計畫自動算好，使用者不用想**：組數、次數區間、RIR 由週期與週量模型決定，畫面直接給答案，不讓使用者自己換算。
3. **資料不能掉**：任何改動都要顧及舊資料相容與誤觸復原（取消完成要能還原歷史）。
4. **訓練優先，營養次要**：導覽和版面權重以訓練為主。
