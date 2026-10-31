---
version: 1
slug: "src-components-training-trainingview-jsx"
primary_target: "src/components/training/TrainingView.jsx"
related_targets: []
---

# 訓練頁（TrainingView）

範圍：訓練 tab 的整個畫面（含平台看板、D1–D5、動作清單、superset、週量、替換 / 新增動作 sheet）。模式：Operate。使用者在健身房組間單手操作，瞄兩三秒就要知道下一組做什麼、休息到哪。營養與設定頁之後沿用同一個世界。

## Direction contract

THESIS：每一組都是一次試舉。上台前看卡、下台亮燈。拒絕「深灰卡片清單 + 一個螢光綠主色」的健身 app 預設排法，以及現在三層 sticky header 吃掉 40% 畫面的結構。

OWN-WORLD：場館黑底 #0E0E10；試舉卡紙 #F1EDE4 只給「下一組」；裁判白 #FFFFFF / 裁判紅 #E0262A 只表達組狀態；看板琥珀 #FFB000 只給計時；IPF 藍 #1D4E9E 給選取與主要動作。數字用條件式窄體（Barlow Condensed，自帶字檔），其餘用系統字。

STORY：使用者一眼看到下一組的目標與上次紀錄，單手輸入、按 ✓，三盞燈亮起，休息倒數接手。

FIRST VIEWPORT（390×844）：頂部約 110px 的平台看板（週次與階段、session 計時、下一組 / 休息倒數大字），下面 48px 的 D1–D5 分段控制，再下面是動作清單，第一個動作與它的試舉卡在第一屏內；底部 tab 列留 safe area。

FORM：自己的候選清單第 1 名（健力試舉卡與裁判燈），使用者在決策頁選的 IMPECCABLE’S PICK。seed:826cc7c69c0d81c0

招牌動作：每個組列左側三盞裁判燈。完成時三盞白燈依序亮起（共 200ms 內），跳過亮紅燈，待做是暗燈。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 未決

- 營養、設定、動作庫頁面這輪只換外殼色票與 modal 疊層，完整改版下一輪做。
