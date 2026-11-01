// CommonJS：Node 22+ 會用 require() 載入 ESM 設定檔，進了 ESM 快取就清不掉，
// 跑著的 dev server 改了色票也不會更新。.cjs 走 require.cache，Tailwind 偵測到變更會重新載入
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 訓練頁色票（iOS 深色系統色）。對比都算過：
      // label-2 在 elevated 上 6.3:1、在 fill 上 5.1:1；label-3 只放在 canvas / card 上（5.2:1 以上）；
      // accent-text 在 elevated 上 4.9:1；skip 在 card 上 5.0:1，放在 elevated 上的紅字改用 skip-text（4.9:1）
      colors: {
        // 層次：底、卡片、浮起層、輸入底、分隔線
        canvas: '#000000',
        card: '#1C1C1E',
        elevated: '#2C2C2E',
        fill: '#3A3A3C',
        // 分段控制選中塊
        thumb: '#48484A',
        // sheet 頂端的拖曳把手
        grabber: '#5A5A5E',
        separator: '#38383A',
        // 文字：主、次、第三層
        label: { DEFAULT: '#FFFFFF', 2: '#AEAEB2', 3: '#8E8E93' },
        // 系統色各司其職：完成綠、選取藍（填色 / 深底文字）、休息琥珀、跳過紅
        done: '#30D158',
        accent: { DEFAULT: '#0A84FF', text: '#409CFF' },
        rest: '#FF9F0A',
        skip: { DEFAULT: '#FF453A', text: '#FF6961' },
        // session 類型：推、拉、腿
        push: '#FF375F',
        pull: '#0A84FF',
        legs: '#FF9F0A',
        // 階段：肌肥大、肌力、減量
        phase: { hypertrophy: '#30D158', strength: '#64D2FF', deload: '#FFD60A' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"PingFang TC"', '"Noto Sans TC"', 'system-ui', 'sans-serif'],
        // 數字（週次、D1–D5、組號、重量、次數、計時、進度），一律搭配 tabular-nums
        num: ['ui-rounded', '"SF Pro Rounded"', '-apple-system', 'system-ui', 'sans-serif'],
      },
      // iOS 字級：大標題 34、卡片標題 20、內文 17、次要 15 / 13、最小 12
      fontSize: {
        'large-title': ['34px', { lineHeight: '41px', letterSpacing: '-0.02em' }],
        title2: ['22px', { lineHeight: '28px' }],
        title3: ['20px', { lineHeight: '25px' }],
        body: ['17px', { lineHeight: '22px' }],
        subhead: ['15px', { lineHeight: '20px' }],
        footnote: ['13px', { lineHeight: '18px' }],
        caption: ['12px', { lineHeight: '16px' }],
      },
      transitionTimingFunction: {
        // iOS sheet / 分段控制的減速曲線
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}
