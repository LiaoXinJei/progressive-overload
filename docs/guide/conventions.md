# 開發慣例

## 語言

- 程式碼識別字（變數 / 函數 / 元件名稱）：**英文**（PascalCase / camelCase）
- 註解、UI 文字、commit 訊息、文件：**正體中文**
- 不要在程式碼中使用簡體字或日韓專用字元

---

## React 元件慣例

### 命名

- **元件**：PascalCase，檔名與元件同名（如 `TrainingView.jsx`）
- **Hook**：`use` 開頭，camelCase（如 `useRestNotification`）
- **工具函數**：camelCase（如 `analyzeFood`、`calculateTDEE`）
- **常數**：UPPER_SNAKE_CASE（如 `VOLUME_CONFIG`、`PHASE_CONFIG`）

### 元件結構建議順序

```jsx
const MyView = ({ propA, propB, ... }) => {
  // 1. useState
  // 2. useEffect / useMemo / useCallback
  // 3. 核心邏輯函數（純函數優先）
  // 4. 事件處理函數（handleXxx）
  // 5. 衍生變數 / JSX 前置計算
  // 6. return ( <JSX /> )
};
```

### 大型元件處理

- 單一元件超過 ~500 行時，先觀察可否抽出**子元件**或**自訂 hook**
- 不要為了拆而拆。`TrainingView.jsx` 本身就很大，因為訓練 UI 高度耦合，**目前接受其長度**
- 若拆分，原則：UI 子區塊 → 子元件；可重用邏輯 → hook

---

## 狀態管理

- **跨頁狀態**一律提升到 `App.jsx`，透過 props 傳遞
- **元件本地 UI 狀態**（如 dropdown 開關、編輯模式）保留在子元件內 `useState`
- 不要在子元件直接讀寫 `localStorage`，**所有持久化由 `App.jsx` 統一處理**
- 新增需持久化的狀態時：
  1. 在 `App.jsx` 加 `useState`
  2. 在「載入 useEffect」加還原邏輯（含遷移）
  3. 在「寫回 useEffect」加入依賴陣列
  4. 評估是否要升 `schemaVersion`

---

## 樣式

完整的設計系統（色票角色、對比規則、字級、圓角、材質、動態、元件狀態）寫在根目錄的 [DESIGN.md](../../DESIGN.md)，token 在 `tailwind.config.cjs`。這裡只列寫程式時最常用到的規則：

- **Tailwind CSS** 是主要樣式來源。`index.css` 只放 Tailwind 進入點、瀏覽器表面（selection、caret、focus ring、scroll-padding）和少數 Tailwind 寫不出來的元件 class（材質、動畫 keyframes）
- **用具名 token，不要散寫 hex 或 `neutral-*`**：底 `canvas`、卡片 `card`、浮起層 `elevated`、輸入底 `fill`、分隔線 `separator`；文字 `label` / `label-2` / `label-3`
- **語意色各司其職**：完成 `done`（綠）、選取與主要動作 `accent`（深底上的藍字用 `accent-text`）、休息計時 `rest`（琥珀）、跳過 `skip`（紅，深底文字用 `skip-text`）。紅色只給跳過，琥珀只給休息
- **推 / 拉 / 腿**用 `push` / `pull` / `legs`，只出現在 D1–D5 的色點；**階段**用 `phase-hypertrophy` / `phase-strength` / `phase-deload`
- **對比**：次要文字至少 4.5:1。`label-3` 只能放在 `canvas` / `card` 上，放在 `elevated` / `fill` 上的次要字和 placeholder 一律用 `label-2`。不要用 opacity 淡化文字
- **數字**用 `font-num` 加 `tabular-nums`
- **動態**只動 transform / opacity / 顏色，曲線用 `ease-ios`，所有位移動畫都要處理 `prefers-reduced-motion`
- **手機優先**：預設樣式針對手機，桌面是單欄置中（max-width 480px），避免亂寫 `md:` / `lg:` 斷點
- **觸控目標**：所有可點元素至少 44×44（視覺可以比較小，用 padding 撐觸控範圍）

---

## 檔案組織

| 類別 | 位置 |
|------|------|
| 跨頁元件 | `src/components/shared/` |
| 功能模組元件 | `src/components/<feature>/` |
| 自訂 Hook | `src/hooks/` |
| 純函數工具 | `src/utils/` |
| 常數 / 配置 | `src/constants/` |
| Service Worker | `src/sw.js`（**根據 vite.config.js 必須在此位置**） |

---

## 資料模型慣例

### Log key 格式

```
w<week>-d<day>-<exerciseId>-s<setIndex>
範例：w1-d0-bp_flat-s0
```

- `week`：1–10
- `day`：0–3
- `exerciseId`：來自 `WORKOUTS` 或 `custom_<timestamp>`
- `setIndex`：從 0 開始

### Log value 結構

```js
{ weight: 100, reps: 10, done: true, completedAt: 1700000000000 }
```

### History 結構（v3）

```js
history[exerciseId] = { weight: 100, reps: 10 }
```

v2 為單純 `number`，已在 `App.jsx` 載入時遷移。

---

## 不要做的事

- ❌ 在子元件呼叫 `localStorage`
- ❌ 在 UI 元件硬寫肌群週容量、組數上限 → 一律從 `constants/workouts.js` 讀取
- ❌ 為了「以後可能用到」加參數 / 抽象層
- ❌ 修改 `schemaVersion` 不寫遷移邏輯
- ❌ 把 Gemini API Key 寫死在程式碼裡（由使用者自備）
- ❌ 在主執行緒用 `setTimeout` 排休息通知（必須走 SW，否則背景失準）

---

## Commit 訊息

格式（沿用既有風格）：

```
<類別>：<簡述>

範例：
功能：動作庫管理、替換動作下拉選單、點組編號帶入上次紀錄
修正：降低拖曳排序時的自動捲動速度
```

常見類別：`功能` / `修正` / `重構` / `文件` / `樣式`。

---

## 測試

單元測試用 **Vitest**（`npm test`），測試檔放在被測模組旁邊，命名 `*.test.js`。`src/utils/` 的 pure function 直接測；需要 DOM 的測試在檔案開頭加 `// @vitest-environment jsdom`（例如 `src/App.reset.test.jsx`）。

其餘功能驗收以下列方式：

1. **訓練流程**：跑 W1 → W4 → W5 → W6 → W10，驗證階段切換、組數分配、減量
2. **PWA / 通知**：`npm run build && npm run preview` → 手機實機 → 完成一組 → 等通知
3. **資料遷移**：將 `localStorage` 改為舊版 schema，重新整理頁面，驗證資料未遺失
