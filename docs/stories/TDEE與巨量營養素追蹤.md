# TDEE 與巨量營養素追蹤

> **狀態**：已完成（持續維運）

---

## 為什麼需要這個功能？

訓練量管理只是一半，營養才是另一半。使用者需要知道自己每日的熱量缺口 / 盈餘、蛋白質是否達標，才能對應自己的目標（減脂 / 維持 / 增肌）。本模組提供 TDEE 計算與每日巨量營養素進度追蹤。

---

## 使用者可以做什麼？

- 輸入個人資料（性別、年齡、身高、體重、活動量、目標）
- 系統計算 BMR（Mifflin-St Jeor）、TDEE、目標熱量、目標蛋白質
- 每日記錄飲食（手動輸入或拍照辨識）
- 看見熱量 / 蛋白質 / 碳水 / 脂肪的當日進度條
- 切換日期回顧過去紀錄

### 目標策略

| 目標 | 熱量調整 | 蛋白質/kg |
|------|---------|-----------|
| 減脂（cut） | −500 kcal | 2.2 g |
| 維持（maintain） | 0 | 1.8 g |
| 增肌（bulk） | +300 kcal | 1.6 g |

---

## 相關實作

| 項目 | 位置 |
|------|------|
| 主視圖 | `src/components/nutrition/NutritionView.jsx` |
| TDEE 計算 UI | `src/components/nutrition/TDEECalculator.jsx` |
| 進度條 | `src/components/nutrition/MacroProgressBar.jsx` |
| 飲食輸入 | `src/components/nutrition/MealEntry.jsx` |
| 計算工具 | `src/utils/nutritionCalculations.js` |
| 常數 | `src/constants/nutrition.js` |

### 資料結構

| 欄位 | 用途 |
|------|------|
| `nutritionProfile` | 個人資料 + Gemini API Key |
| `nutritionLogs` | 以日期為 key 的飲食紀錄 |

---

## 備註

- 活動量倍率沿用業界常用 5 階：1.2 / 1.375 / 1.55 / 1.725 / 1.9
- 公式採 Mifflin-St Jeor（比 Harris-Benedict 更貼近現代研究）
- 蛋白質目標以體重 kg × 倍數計算，碳水與脂肪比例採固定配比
