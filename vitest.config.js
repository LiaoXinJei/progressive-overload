import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 測試專用設定：不載入 VitePWA，元件測試在檔頭用 `@vitest-environment jsdom` 切換環境
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
