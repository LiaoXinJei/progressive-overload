# AI 食物照片辨識

> **狀態**：已完成（持續維運）

---

## 為什麼需要這個功能？

手動查詢每樣食物的熱量 / 蛋白質 / 碳水 / 脂肪太繁瑣，使用者容易放棄記錄。透過拍照 + AI 辨識，把記錄門檻降到「按下快門 → 確認 → 儲存」三步。

---

## 使用者可以做什麼？

- 在設定面板輸入自己的 **Google Gemini API Key**（從 Google AI Studio 取得）
- 拍照或上傳食物照片
- 系統呼叫 Gemini 2.0 Flash 辨識照片中的每樣食物
- 回傳結構化結果：名稱、份量、熱量、蛋白質、碳水、脂肪
- 確認後直接寫入當日飲食紀錄

---

## 相關實作

| 項目 | 位置 |
|------|------|
| 拍照 / 上傳 UI | `src/components/nutrition/FoodPhotoAnalyzer.jsx` |
| Gemini API 呼叫 | `src/utils/geminiApi.js` |
| API Key 儲存 | `nutritionProfile.geminiApiKey`（在 localStorage） |
| 設定 UI | `src/App.jsx` 設定面板 |

### 模型 & 端點

- 模型：`gemini-2.0-flash`
- 端點：`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`

### Prompt 結構

要求 Gemini 回傳：

```json
{
  "items": [
    { "name": "雞胸肉", "portion": "150g", "calories": 248, "protein": 46, "carbs": 0, "fat": 5 }
  ]
}
```

繁體中文輸出、克為單位、不附 markdown。

---

## 備註

- **API Key 完全由使用者自備**，存在使用者瀏覽器，不傳給任何第三方伺服器
- **不要**在程式碼裡寫死 API Key
- 若辨識結果不準，使用者仍可手動修改後再儲存
- 未來若改用其他模型，記得更新 `geminiApi.js` 的端點與 prompt 結構
