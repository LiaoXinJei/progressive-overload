---
name: RP FOCUS PRO
description: 健身房組間單手操作的漸進式訓練追蹤 PWA，iOS 深色系統色、圓角分層、絲滑動態
colors:
  canvas: "#000000"
  card: "#1C1C1E"
  elevated: "#2C2C2E"
  fill: "#3A3A3C"
  thumb: "#48484A"
  grabber: "#5A5A5E"
  separator: "#38383A"
  label: "#FFFFFF"
  label-2: "#AEAEB2"
  label-3: "#8E8E93"
  done: "#30D158"
  accent: "#0A84FF"
  accent-text: "#409CFF"
  rest: "#FF9F0A"
  skip: "#FF453A"
  skip-text: "#FF6961"
  push: "#FF375F"
  pull: "#0A84FF"
  legs: "#FF9F0A"
  phase-hypertrophy: "#30D158"
  phase-strength: "#64D2FF"
  phase-deload: "#FFD60A"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang TC\", \"Noto Sans TC\", system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: "41px"
    letterSpacing: "-0.02em"
  title2:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", -apple-system, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    fontFeature: "tnum"
  title3:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang TC\", \"Noto Sans TC\", system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "25px"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang TC\", \"Noto Sans TC\", system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "-0.01em"
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang TC\", \"Noto Sans TC\", system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "20px"
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang TC\", \"Noto Sans TC\", system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"PingFang TC\", \"Noto Sans TC\", system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
  numeral:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", -apple-system, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "22px"
    fontFeature: "tnum"
rounded:
  thumb: "10px"
  field: "12px"
  row: "14px"
  current: "16px"
  card: "20px"
  sheet: "28px"
  pill: "30px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  page-x: "16px"
  target: "44px"
components:
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "16px 10px 12px"
  top-bar-capsule:
    backgroundColor: "{colors.card}"
    textColor: "{colors.label}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 12px"
  top-bar-capsule-scrolled:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.label}"
    rounded: "{rounded.full}"
    height: "44px"
  segmented-control:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.row}"
    height: "52px"
    padding: "4px"
  segmented-thumb:
    backgroundColor: "{colors.thumb}"
    textColor: "{colors.label}"
    rounded: "{rounded.thumb}"
  set-row-pending:
    textColor: "{colors.label-3}"
    rounded: "{rounded.row}"
    height: "52px"
  set-row-done:
    textColor: "{colors.done}"
    rounded: "{rounded.row}"
    height: "52px"
  set-row-current:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.current}"
  set-field:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.label}"
    typography: "{typography.numeral}"
    rounded: "{rounded.field}"
    height: "44px"
  set-field-current:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    typography: "{typography.numeral}"
    rounded: "{rounded.field}"
    height: "44px"
  check-button-done:
    backgroundColor: "{colors.done}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.full}"
    size: "44px"
  button-tinted:
    textColor: "{colors.accent-text}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 16px"
  rest-pill:
    textColor: "{colors.label}"
    rounded: "{rounded.pill}"
    height: "60px"
  bottom-sheet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.label}"
    rounded: "{rounded.sheet}"
  sheet-action:
    textColor: "{colors.label}"
    typography: "{typography.body}"
    height: "52px"
    padding: "0 16px"
  sheet-action-destructive:
    textColor: "{colors.skip-text}"
    typography: "{typography.body}"
    height: "52px"
    padding: "0 16px"
  tab-bar-item:
    textColor: "{colors.label-3}"
    typography: "{typography.caption}"
    height: "49px"
  tab-bar-item-active:
    textColor: "{colors.accent-text}"
    typography: "{typography.caption}"
    height: "49px"
---

# Design System: RP FOCUS PRO

## Overview

**Creative North Star: "組間的 iPhone"**

這是一支在健身房組間單手操作的 App，畫面要像 iOS 內建 App 一樣安靜、順、看兩三秒就懂。純黑底上疊三層灰階圓角卡片，深度靠色階和少量柔和陰影；狀態全部交給 Apple 深色系統色，每個顏色只講一件事：綠是做完、藍是選取與目前、琥珀是休息、紅是跳過。招牌是「目前這組」那張浮起來的卡，按 ✓ 後勾勾彈一下、列淡入綠底、浮卡滑到下一組，休息膠囊從底部浮出倒數。

密度中等偏鬆。每個可點的東西至少 44px，數字一律圓體等寬，標題用 iOS 大標題，捲動時收進半透明頂部 bar。動態用 iOS 的減速曲線，短而確定，全部尊重「減少動態效果」。

這個世界取代了原本的 neutral-950 介面，也取代了被退回的「場館看板」過渡版（窄體數字、紙卡、裁判燈，留在 `backup/meet-lights-redesign`）。使用者明確拒絕復古感，也拒絕一片深灰只有一個強調色。

**Key Characteristics:**
- 純黑底，卡片 / 浮起層 / 輸入底三層灰階，大圓角
- 系統色各司其職，語意不混用
- 數字用 ui-rounded + tabular-nums
- 頂部 bar、休息膠囊、tab bar、superset 狀態條是半透明模糊材質
- 目前這組是一層會滑動的浮卡，不是列底色
- 動態用 `cubic-bezier(0.32, 0.72, 0, 1)`，減少動態效果時只留淡入淡出

**範圍：** 目前這套系統只完整落在訓練頁（`TrainingView`）與共用外殼（頂部 bar 樣式、`TabNavigation`、`BottomSheet`、`App.jsx` 的設定 sheet、確認框、toast）。營養、TDEE、食物照片、動作庫管理頁的內容還在用舊的 neutral / emerald / cyan class，**尚未改版，不屬於這套系統**，改版時要往這份文件收斂，不要反過來參考它們。

## Colors

iOS 深色系統色：黑底灰階分層，加上四個語意色和兩組分類色。

### Primary
- **選取藍 Accent** (`accent`)：目前這組浮卡的 1.5px 外框、`::selection` 底色、tinted 按鈕的 20% 底（`accent/20`）。只當填色或框線，不當小字。
- **選取藍文字 Accent Text** (`accent-text`)：深底上的藍字與圖示，包括目前這組組號、「上次 … · 帶入」、sheet 的「完成」、tab bar 選中、caret、focus ring。在 elevated 上 4.9:1。

### Secondary
- **完成綠 Done** (`done`)：已完成的 ✓ 圓鈕（黑勾）、完成組號、已完成列 8% 淡綠底（`done/[0.08]`）、今天進度與動作進度條、superset 完成圓點。
- **休息琥珀 Rest** (`rest`)：只給休息與時間壓力。休息中的分隔線與文字、休息膠囊的數字與進度條、superset 輪間計時、訓練超時提示、RIR 警示徽章（16% 底）。超過目標也維持琥珀。

### Tertiary
- **跳過紅 Skip** (`skip`)：「已跳過」字樣（在 card 上 5.0:1）、superset 跳過圓點。
- **跳過紅文字 Skip Text** (`skip-text`)：放在 elevated 上的紅字，例如 sheet 裡的刪除 / 移除動作、確認框的破壞性按鈕、設定裡的清除資料（4.9:1）。
- **Session 色點** (`push` 粉紅、`pull` 藍、`legs` 琥珀)：只用在 D1–D5 分段控制和本週循環的 6px 圓點，不上進度條、不上卡片。
- **階段色** (`phase-hypertrophy` 綠、`phase-strength` 青、`phase-deload` 黃)：頂部週次膠囊的階段名、大標題旁的 RIR 徽章（16% 同色底）、週次 sheet 的色點。

### Neutral
- **純黑 Canvas** (`canvas`)：頁面底色、`html` / `body`、捲軸軌道。
- **卡片 Card** (`card`)：動作卡、今天進度卡、分段控制底、bottom sheet 面板、頂部 bar 未捲動時的膠囊。
- **浮起層 Elevated** (`elevated`)：目前這組浮卡、待做列的輸入底、sheet 內的群組列表、確認框、toast、捲動後的頂部膠囊。
- **輸入底 Fill** (`fill`)：目前這組的輸入底、進度條軌道、按下（active）回饋、捲軸 thumb、sheet 關閉鈕底。
- **選中塊 Thumb** (`thumb`)：分段控制的選中塊。
- **把手 Grabber** (`grabber`)：sheet 頂端 36×5 拖曳把手。
- **分隔線 Separator** (`separator`)：已結束的休息線、sheet 群組列表的 0.5px 分隔。材質上的 hairline 用 `rgba(255,255,255,0.12)`。
- **文字三層** (`label` / `label-2` / `label-3`)：主文字、次要說明、第三層（欄位標題、待做組號、分母、chevron）。

### 對比規則

| 文字色 | canvas | card | elevated | fill | thumb |
|---|---|---|---|---|---|
| `label-2` | 9.5 | 7.7 | 6.3 | 5.1 | 4.1 |
| `label-3` | 6.4 | 5.2 | **4.3** | **3.5** | **2.8** |
| `accent-text` | 7.4 | 6.0 | 4.9 | **4.0** | **3.2** |
| `accent` | 5.8 | 4.7 | **3.8** | **3.1** | **2.5** |
| `skip` | 6.2 | 5.0 | **4.1** | **3.3** | **2.7** |
| `skip-text` | 7.5 | 6.0 | 4.9 | **4.0** | **3.2** |

粗體是低於 4.5:1 的禁用組合（小字）。`done`、`rest`、`phase-*` 在所有灰階上都過 4.4 以上。

**The 第三層只上黑與卡片 Rule.** `label-3` 只放在 `canvas` 或 `card` 上。放到 elevated、fill、thumb 上的次要字一律改用 `label-2`。

**The 藍分兩支 Rule.** `accent` 是填色和框線，`accent-text` 是字。小字不准用 `accent`，fill 上不准放藍字。

**The 紅只給跳過 Rule.** 紅色只代表「跳過」與破壞性動作。休息超時、訓練超時都用琥珀加文字說明超過多少，不變紅。

**The 琥珀只給休息 Rule.** 琥珀代表休息與時間。腿日色點剛好也是琥珀，但只以 6px 圓點出現在 D1–D5，不擴散到其他元件。

**The 一色一義 Rule.** 進度條一律完成綠，推拉腿色只留在 D1–D5 的圓點。

## Typography

**Body Font:** 系統字（`-apple-system`, `SF Pro Text`），中文 fallback `PingFang TC` → `Noto Sans TC`
**Numeral Font:** `ui-rounded`（`SF Pro Rounded`），fallback 回系統字

**Character:** 跟 iOS 內建 App 同一套字，文字安靜、數字圓潤。全站 `letter-spacing: -0.01em`，大標題 `-0.02em`。

### Hierarchy
- **Large Title**（700, 34/41）：訓練名稱（PULL A），捲過去後收進頂部 bar 變成 17px 小標題。
- **Title 2**（600, 22/28，圓體）：今天進度的完成組數。
- **Title 3**（600, 20/25）：動作名稱；組列裡的重量 / 次數數字（超過 4 個字退一級到 17px）；休息膠囊超過一小時的大字。
- **Body**（17/22）：一般內文、sheet 標題（600）、sheet 動作列、週次 `W3`（700 圓體）、D1–D5 外的計時。
- **Subhead**（15/20）：膠囊標題、上次紀錄、跳過、D1–D5 數字（600 圓體）。
- **Footnote**（13/18）：動作副標、休息線、階段名、RIR 徽章（600）、說明文字。
- **Caption**（12/16）：欄位標題、D1–D5 下的推拉腿、tab bar 標籤（600）。
- 休息膠囊的計時大字是 24/28 圓體 600，唯一不在字級表裡的尺寸。

**The 數字都是圓體等寬 Rule.** 週次、D1–D5、組號、重量、次數、計時、進度、週訓練量全部 `font-num` + `tabular-nums`，計時跳動時寬度不晃。

**The 沒有小標籤 Rule.** 不用全大寫、加字距的眉標。區塊標題就是一般字級的 `label-2` 文字或卡片內標題。

## Layout

單欄手機版面，內容最寬 480px 置中，左右 16px。視覺上以 390×844 為基準，360 和 320 寬都驗過不溢出。

垂直節奏：大標題下 14px 接分段控制，元件之間 12px，動作卡之間 12px 上緣，組列之間 6px，休息線 28px 高夾在組與組之間。卡片內距左右 10px、上 16px、下 12px，標題區再縮 6px 對齊。

組列是四欄格線：組號 36px / 重量 stepper 彈性 / 次數 72px / ✓ 44px，欄距 8px；寬度 ≤374px 時改成 28 / 彈性 / 60 / 44、欄距 6px。欄位標題用同一個格線對齊。

固定層由下往上：tab bar 49px + 安全區；休息膠囊浮在 tab bar 上方 8px，左右 12px，最寬 456px；superset 狀態條黏在頂部 bar 下方 8px。`scroll-padding` 會避開頂部 bar 和底部 133px，sheet 開著時鎖捲動並保留捲軸槽避免左右跳。

自動捲動只在目前這組被休息膠囊蓋住時才動，而且不停在大標題半收合的位置。點休息膠囊會把下一組捲到頂部 bar 和膠囊中間。

## Elevation & Depth

深度主要靠色階：canvas → card → elevated → fill 一層一層變亮。陰影只給真的浮在別的東西上方的元素，一律是純黑、柔和、往下的擴散陰影，沒有硬邊位移陰影。材質層用半透明加模糊，讓下面的內容透出來。

### Shadow Vocabulary
- **選中塊** (`0 3px 8px rgba(0,0,0,0.35), 0 1px 1px rgba(0,0,0,0.2)`)：分段控制選中塊。
- **浮卡** (`0 10px 24px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)`)：目前這組。
- **狀態條** (`0 6px 16px rgba(0,0,0,0.35)`)：superset 黏頂狀態條。
- **膠囊 / toast** (`0 12px 32px rgba(0,0,0,0.5)`)：休息膠囊、頂部 toast。
- **確認框** (`0 20px 48px rgba(0,0,0,0.5)`)：置中確認對話框。
- **拖曳中** (`0 20px 44px rgba(0,0,0,0.6)`)：排序模式被拿起來的列。
- **Sheet** (`0 -10px 40px rgba(0,0,0,0.5)`)：bottom sheet 往上投影。

### Materials
- **Material**：`rgba(22,22,24,0.78)` + `blur(24px) saturate(180%)`。頂部 bar（捲動後）、tab bar。
- **Material Elevated**：`rgba(44,44,46,0.72)` + 同樣模糊。休息膠囊、superset 狀態條。
- **Hairline**：`inset 0 ±0.5px 0 rgba(255,255,255,0.12)`，材質層和內容的交界。

**The 捲到才有材質 Rule.** 頂部 bar 在頁面頂端是透明的，大標題開始被蓋住才換成材質加底部 hairline。

**The 陰影是浮起來的證據 Rule.** 只有浮在別的內容上的東西有陰影（浮卡、選中塊、膠囊、sheet、拖曳中的列）。靜止的卡片沒有陰影。

## Shapes

全部是連續的圓角，沒有直角卡片。圓角跟著尺寸走：分段選中塊 10px、輸入框 12px、組列與分段控制與 sheet 群組列表 14px、目前這組浮卡 16px、卡片與確認框與 toast 20px、sheet 頂部 28px、休息膠囊 30px（60px 高的完整膠囊）。按鈕、頂部膠囊、✓、tab 按下區、徽章都是全圓。

框線很少用：目前這組是 1.5px `accent` outline（往內縮 1.5px），休息膠囊是 0.5px 白 12%（超時換 `rest` 40%），待做的 ✓ 是 1.5px `fill` 圈。分隔線一律 0.5px。

## Components

### Buttons
- **Shape:** 全圓膠囊或 44px 圓鈕。
- **Tinted（主要動作）:** `accent/20` 底、`accent-text` 字，例如排序模式的「完成」、設定裡的主要動作（後者用 12px 圓角、48px 高）。
- **Plain:** 透明底、`accent-text` 或 `label-2` 字，按下時 `elevated` 或 `white/6–8%` 底。例如「⋯」、「復原」、「跳過這組」。
- **Destructive:** `skip-text` 字，放在 elevated 或 card 上。
- **Hover / Focus:** 手機為主，回饋是 `active` 底色，`transition-colors` 150–200ms。焦點走全域 focus ring。

### 頂部 bar
- 三個膠囊：週次（`W3` + 階段名 + chevron）、訓練計時、設定。未捲動時膠囊是 `card` 底，捲動後 bar 換成 Material，膠囊換 `elevated`。
- 大標題完全捲過去時，中間淡入 17px 小標題；窄螢幕先藏階段名。
- 超時：計時圖示和數字變琥珀，下方多一行「超時 N 分」。
- 排序模式時設定鈕換成 tinted「完成」。

### 分段控制（D1–D5）
- `card` 底、14px 圓角、52px 高、4px 內距。選中塊 `thumb` 帶選中塊陰影，換天時 `translateX` 滑過去（300ms iOS 曲線）。
- 每格兩行：圓體 `D1` + 6px session 色點與「推 / 拉 / 腿」。設定 sheet 裡的兩段式切換沿用同一個外型，但底是 `elevated`、選中塊不滑動。

### 今天進度卡
- `card`、20px 圓角。左邊 `label-2`「今天進度」，右邊 22px 完成數 + `label-3` 分母；6px 完成綠進度條（400ms ease-out 長）。下面隔一條 separator 接「本週訓練量」入口列。做完時換成「今天的課表做完了」加總時長。

### 動作卡
- `card`、20px 圓角。標題 20px，副標 footnote（肌群 · 複合 / 隔離 · 次數區間 × 組數）。右上圓體 `完成/總數` 和「⋯」。
- 可選的 RIR 警示：琥珀 16% 底全圓徽章；灰字提示用 `label-3`。
- 4px 完成綠動作進度條，再接 caption 欄位標題，對齊組列格線。

### 組列（四種狀態）
- **待做:** 透明底、14px 圓角、52px 高。組號 `label-3`，重量 stepper 和次數輸入是 `elevated` 底 12px 圓角，✓ 是 1.5px `fill` 圈。沒填次數也沒上次紀錄時 ✓ 不能按。
- **目前這組:** 列本身透明，底下墊著浮卡（見下）。組號 `accent-text`，輸入底換 `fill`，✓ 換 `accent/20` 底藍勾。下面淡入第二排：「上次 X kg × Y · 帶入」（`accent-text`，沒得帶時 `label-2`）和「跳過這組」。
- **完成:** `done/8%` 淡綠底，組號綠色，重量次數變成純文字外觀（點了照樣能改，點了就成為目前這組），✓ 是實心綠底黑勾。按下時播 check-pop。
- **跳過:** 「已跳過」用 `skip` 紅字，右邊 `accent-text`「復原」。組號 `label-2`。

### 目前這組浮卡（招牌）
一層在 `main` 裡絕對定位的 `elevated` 卡，16px 圓角、浮卡陰影、1.5px 藍框。位置用量出來的列位置寫進 `transform`，換組時用 FLIP 從舊列滑到新列（transform / width / height 300ms iOS 曲線）。畫面上永遠只有一張。減少動態效果時不滑，原地 200ms 淡入。

### 休息線
組與組之間一行置中字，兩側 0.5px 線。
- **進行中:** `rest` 600 字「休息中 1:24」，線 `rest/40`。
- **已結束:** `label-3` 字「休息 2:36」，線 `separator`。
- **超過目標:** 線變實 `rest`，後面加「· 超過 1:00」，仍是琥珀。
- 動作之間的版本叫「動作間休息」。

### 休息膠囊
浮在 tab bar 上方的 Material Elevated 膠囊，60px 高、30px 圓角、0.5px 白框、膠囊陰影。左邊 40px 琥珀 20% 圓底計時圖示，中間標題（subhead 600）和「下一組：動作 第 N 組」，右邊 24px 琥珀圓體計時 + `/ 2:00`，底部 3px 琥珀進度條每秒線性長。
- **超時:** 標題改「該做下一組了」，大字顯示 `+超出時間`，圖示換鈴，整顆加 `rest/14%` 底、框改 `rest/40%`，進度條滿格。
- 窄螢幕先拿掉右邊小字，再截動作名；標題和「第 N 組」永遠完整。
- 點了把下一組捲到畫面中間。進場 pill-in（350ms，往上 3px 過衝），退場 pill-out（250ms）。

### Superset
- 一張共用的 `card`，標頭是連結圖示加兩個動作名，兩個動作的組列在同一張卡裡。
- **黏頂狀態條:** 黏在頂部 bar 下方 8px 的 Material Elevated 條，14px 圓角、狀態條陰影。左邊兩排 8px 輪次圓點（綠完成、紅跳過、`label-3` 空心待做），右邊狀態文字：準備開始 R1 / 切換中（琥珀）/ 輪間休息 + 3px 琥珀進度條 / 完成。

### Bottom Sheet
- `card` 面板，頂部 28px 圓角，最高 90dvh，往上投影。頂端 36×5 `grabber` 把手，標題列置中 body 600，右邊 30px `fill` 圓底關閉鈕或 `accent-text` 文字「完成」。
- 內容群組：`elevated` 底、14px 圓角、0.5px `separator` 分隔的列表；動作列 52px 高、20px `accent-text` 圖示（破壞性用 `skip-text`）。
- 行為：遮罩 `black/50` 淡入，面板 400ms iOS 曲線滑入；拖把手區跟手，下拉超過 100px 或速度 > 0.5px/ms 就關，往上拖最多 24px 阻力；退場從放手位置接著滑出。Esc、點遮罩關閉；開啟時焦點進來（`data-autofocus` 優先），Tab 在裡面循環，關閉後還給觸發點；背景捲動用計數鎖。減少動態效果時只淡入淡出。
- 確認框是同一套語言的置中版：`elevated`、20px 圓角、確認框陰影，兩顆 48px 按鈕中間 0.5px 分隔。

### 排序模式
從「⋯」→「調整順序」進入。D1–D5 和今天進度收起，動作收成 64px 高的 `card` 精簡列（16px 圓角），右側才有 44px 把手；拿起時列換 `elevated` 加拖曳中陰影。頂部 bar 的設定鈕換成「完成」。進出時清單淡入（220ms）。支援鍵盤：空白鍵拿起、方向鍵移動、Esc 取消。

### Tab Bar
Material + 頂部 hairline，49px 高加安全區，最寬 480px 兩格。24px 線條圖示加 caption 600 標籤；選中 `accent-text` 且線條加粗到 2.2，未選 `label-3`。

### Toast
頂部浮出的 `elevated` 卡，20px 圓角、膠囊陰影，右邊 `accent-text` 文字按鈕。

### 健身房模式（實驗）

設定打開後訓練頁變成全螢幕像素健身房，是這套 Apple 式介面裡唯一的像素風區塊，規則跟其他元件分開：

- **場景**：固定在背景鋪滿畫面，一個像素 = 畫面寬 ÷ 64 取整（390 寬是 6 CSS px），`image-rendering: pixelated`。傍晚的室內：紫色牆、窗外夕陽與城市剪影、木地板、燈串，深色描邊 `#2B1B2E`，器材用糖果色（珊瑚紅墊、薰衣草紫框架）。人物 Q 版大頭、腮紅、粉紅背心。
- **槓片**：色票照比賽槓片，20 藍 `#3A86FF`、10 綠 `#30C26A`、5 白、2.5 紅 `#FF5A64`、1.25 銀。每站旁邊一座槓片架（自動擺在不擋器材和人物的那一側）；槓鈴側面看是槓片正面，一片一片往外疊、每片右偏一格，同尺寸也數得出幾片。
- **場景上的 HUD**：系統字與圓體數字，不用像素字；黑色 45% + 模糊的膠囊。上面：動作名、提示（照語意色：做組中 `accent-text`、休息 `rest`、做完 `done`）、第幾站；中間：左右箭頭；槓片架那一側：重量和「卸」；地板上：組數圓點（完成 `done`、這組 `accent`）＋ 加一組、次數 − / ＋（改剛剛那組時 1.5px `rest` 外框加「剛剛」）。點槓片時重量旁飄 `+20`（`done`）/ `−20`（`rest`）。
- **面板**：蓋在場景上的 `canvas` 面板，28px 圓角、往上投影，平常收起來只露出 32px 的把手（點把手或往上滑拉上來），拉上來才是整份課表。做組的操作都在場景上，不聚焦輸入框、不跳鍵盤，面板不會自己打開。
- **不顯示休息膠囊**：休息狀態在人物（喝水、超時站起來）和面板提示上。
- **減少動態效果**：不走路、動作停在中間姿勢、沒有流汗 / 愛心 / 星星；`+20` 不位移只淡出。

### 焦點、選取與游標
- Focus ring：2px `accent-text` outline，外推 2px；組列裡的輸入框改往內縮 2px，免得壓到旁邊的按鈕。
- 選取：`accent` 底白字。
- 游標：`accent-text`。
- Placeholder：`label-2`（不是 Tailwind 預設灰）。
- 數字輸入框不顯示上下箭頭。

### 動態語法
- **iOS 曲線** `cubic-bezier(0.32, 0.72, 0, 1)`：sheet 滑入 / 退場 400ms、分段選中塊 300ms、浮卡 FLIP 300ms。
- **彈出曲線** `cubic-bezier(0.22, 1, 0.36, 1)`：check-pop 350ms（0.85 → 1.08 → 1）、pill-in 350ms。過衝由關鍵影格給，曲線本身是減速。
- **退場** `cubic-bezier(0.4, 0, 1, 1)`：pill-out 250ms。
- **狀態色** 150–200ms ease：按下回饋、列淡入綠底、文字色、頂部 bar 換材質。
- **進度條** 400ms ease-out；計時進度條 1000ms linear（每秒一格）。
- **淡入** 200ms（目前這組第二排）、220ms（排序模式切換）、300ms（遮罩）。
- **減少動態效果:** 拿掉所有位移和縮放。check-pop、模式淡入直接取消；sheet 和膠囊改 200ms 淡入淡出；浮卡原地淡入；分段選中塊直接跳；自動捲動改瞬間。

## Do's and Don'ts

### Do:
- **Do** 用色階分層：`canvas` 上放 `card`，`card` 裡浮起的東西用 `elevated`，輸入底用 `fill`。
- **Do** 每個語意色只講一件事：綠完成、藍選取 / 目前、琥珀休息、紅跳過。
- **Do** 所有數字用 `font-num` + `tabular-nums`。
- **Do** 可點目標至少 44px，主要列 52px。
- **Do** 超過目標的休息或訓練時間維持琥珀，用文字寫超過多少。
- **Do** 新的動態一律提供減少動態效果的版本：拿掉位移縮放，只留淡入淡出。
- **Do** 頂部 bar、tab bar、浮在內容上的膠囊和狀態條用半透明模糊材質。
- **Do** 改版營養、設定、動作庫頁面時，往這份文件的色票、字級、圓角收斂。

### Don't:
- **Don't** 把 `label-3` 放在 elevated、fill、thumb 上；改用 `label-2`。
- **Don't** 用 `accent` 當小字顏色，深底藍字一律 `accent-text`。
- **Don't** 把紅色用在跳過與破壞性動作以外的地方，包括休息超時。
- **Don't** 把推拉腿色用在色點以外（進度條、卡片底、文字）。
- **Don't** 在平常模式顯示拖曳把手；排序只走排序模式。
- **Don't** 用列底色表示目前這組；目前這組是那張會滑動的浮卡，畫面上只有一張。
- **Don't** 用硬邊位移陰影或靜止卡片的陰影。
- **Don't** 用全大寫加字距的眉標當區塊標題。
- **Don't** 回到窄體數字、紙卡、裁判燈這類復古場館看板語言。
