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

- **Tailwind CSS** 唯一樣式來源，不寫獨立 CSS（除 `index.css` 的 Tailwind 進入點）
- **深色主題基底**：`neutral-950` / `neutral-900`
- **語義色**：
  - 肌肥大期（hypertrophy）：`emerald-*`（綠色系）
  - 肌力期（strength）：`cyan-*`（青色系）
  - 減量週（deload）：`amber-*`
  - 上肢：`blue-*`；下肢：`orange-*`
  - 警示 / 重要：`red-*` / `rose-*`
- **手機優先**：預設樣式針對手機，避免亂寫 `md:` / `lg:` 斷點
- **觸控目標**：按鈕最小高度 `py-3` 以上，確保拇指可點

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

目前**無自動化測試**。功能驗收以下列方式：

1. **訓練流程**：跑 W1 → W4 → W5 → W6 → W10，驗證階段切換、組數分配、減量
2. **PWA / 通知**：`npm run build && npm run preview` → 手機實機 → 完成一組 → 等通知
3. **資料遷移**：將 `localStorage` 改為舊版 schema，重新整理頁面，驗證資料未遺失

新增測試前請先與使用者討論框架選型。
