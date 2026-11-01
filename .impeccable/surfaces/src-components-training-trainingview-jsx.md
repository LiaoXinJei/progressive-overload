---
version: 1
slug: "src-components-training-trainingview-jsx"
primary_target: "src/components/training/TrainingView.jsx"
related_targets: []
---

# 訓練頁（TrainingView）

範圍：訓練 tab 的整個畫面（頂部 bar 與大標題、D1–D5、今天進度、動作卡、superset、休息膠囊、各 sheet、底部 tab）。模式：Operate。使用者在健身房組間單手操作，瞄兩三秒就要知道下一組做什麼、休息到哪。營養與設定頁之後沿用同一個世界。

## Direction contract

THESIS：像 macOS / iOS 一樣現代、絲滑的訓練頁。圓角卡片分層，狀態靠 Apple 式系統色表達，每個狀態變化都有順暢的動態。拒絕上一版的復古場館看板（窄體數字、紙卡、裁判燈），也拒絕一片深灰只有一個強調色。

OWN-WORLD：純黑底 #000；卡片 #1C1C1E、浮起層 #2C2C2E、輸入底 #3A3A3C，大圓角（卡 20、列 14–16、按鈕膠囊）。系統色各司其職：完成綠 #30D158、選取藍 #0A84FF（深底文字用 #409CFF）、休息琥珀 #FF9F0A、跳過紅 #FF453A；推粉紅 #FF375F、拉藍、腿琥珀；肌肥大綠、肌力青 #64D2FF、減量黃 #FFD60A。頂部 bar、休息膠囊、tab bar 用半透明模糊材質。系統字（SF Pro），數字用 ui-rounded、等寬數字。

STORY：使用者打開就看到今天練什麼、做到哪；目前這組浮起來，輸入、按 ✓，勾勾彈一下、列變綠、浮卡移到下一組，休息膠囊從底部浮出倒數。

FIRST VIEWPORT（390×844）：頂部膠囊列（W3 · 階段、計時、設定），iOS 大標題「PULL A」與副標、RIR 徽章，D1–D5 分段控制（選中塊滑動、推拉腿色點），今天進度卡（X / Y 組＋綠色進度條、本週訓練量入口），第一張動作卡含欄位標題與目前這組浮卡；休息時膠囊浮在 tab bar 上方。參考草圖 .impeccable/mocks/decision/modern-fluid.html。

FORM：使用者指定方向（現代、Apple 式絲滑），取代先前選的健力試舉卡方向（已存備份分支 backup/meet-lights-redesign）。原 roll：seed:826cc7c69c0d81c0（已被使用者指定覆蓋）。

招牌動作：捲動時大標題收進半透明頂部 bar；分段控制選中塊滑過去；按 ✓ 時勾勾彈簧放大、列淡入綠底、進度條順順長；休息膠囊從底部浮出；sheet 彈簧滑出、可往下拖關閉。全部尊重「減少動態效果」。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 使用者明確偏好

- 喜歡原版的卡片圓角跟層次。
- 討厭上一版「像 80 年代阿公」的復古感，要像 MacBook 那樣絲滑順暢。

## 未決

- 營養、設定、動作庫頁面這輪只換外殼色票與 modal 疊層，完整改版下一輪做。
