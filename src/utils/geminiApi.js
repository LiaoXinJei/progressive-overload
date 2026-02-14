/**
 * 使用 Google Gemini 分析食物照片
 * @param {string} apiKey - Gemini API Key
 * @param {string} imageBase64 - Base64 編碼的圖片數據
 * @param {string} mimeType - 圖片 MIME 類型 (e.g. "image/jpeg")
 * @returns {Promise<Array>} 食物項目列表
 */
export const analyzeFood = async (apiKey, imageBase64, mimeType) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            text: `分析這張食物照片，辨識所有食物項目並估算營養資訊。

請以 JSON 格式回傳，格式如下：
{
  "items": [
    {
      "name": "食物名稱（繁體中文）",
      "portion": "份量描述",
      "calories": 數字,
      "protein": 數字（克）,
      "carbs": 數字（克）,
      "fat": 數字（克）
    }
  ]
}

注意：
- 使用繁體中文
- 熱量單位為大卡（kcal）
- 營養素單位為克（g）
- 盡可能精確估算份量和營養
- 只回傳 JSON，不要包含其他文字或 markdown 標記`
          },
          {
            inlineData: {
              mimeType,
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 400) {
      throw new Error('無效的 API Key 或請求格式錯誤');
    }
    if (response.status === 429) {
      throw new Error('API 請求過於頻繁，請稍後再試');
    }
    throw new Error(error.error?.message || `API 錯誤 (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('無法辨識照片中的食物');
  }

  // 解析 JSON（移除可能的 markdown 標記）
  const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('無法辨識照片中的食物');
  }

  return parsed.items.map(item => ({
    id: `i_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: item.name || '未知食物',
    calories: Math.round(item.calories || 0),
    protein: Math.round(item.protein || 0),
    carbs: Math.round(item.carbs || 0),
    fat: Math.round(item.fat || 0),
  }));
};

/**
 * 客戶端圖片壓縮
 * @param {File} file - 圖片檔案
 * @param {number} maxSize - 最大寬高（預設 1024px）
 * @param {number} quality - JPEG 品質（預設 0.8）
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
export const compressImage = (file, maxSize = 1024, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsDataURL(file);
  });
};
