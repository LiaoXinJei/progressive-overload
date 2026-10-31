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
      // 訓練頁色票（場館 / 試舉卡 / 裁判燈）。對比都算過：
      // fg-3 在 surface-hi 上 4.6:1、paper-ink-2 在 paper 上 6.1:1、ipf-bright 在 surface-hi 上 6.4:1
      colors: {
        // 場館黑：底、第二層
        hall: { DEFAULT: '#0E0E10', 2: '#151518' },
        // 表面、表面亮
        surface: { DEFAULT: '#1B1B1F', hi: '#232328' },
        // 分隔線
        line: '#303036',
        // 深底上的文字：主、次、第三層
        fg: { DEFAULT: '#F4F2EE', 2: '#B9B6AF', 3: '#8E8B85' },
        // 試舉卡紙：只給「目前這組」
        paper: { DEFAULT: '#F1EDE4', ink: '#16140F', 'ink-2': '#5C574D', line: '#8C8578' },
        // 裁判白 / 紅：只表達組狀態（燈、完成鈕）；red-text 是深底上當文字用的亮紅
        judge: { white: '#FFFFFF', red: '#E0262A', 'red-text': '#FF6B6B' },
        // 看板琥珀：只給計時
        clock: '#FFB000',
        // IPF 藍：選取與主要動作的填色；bright 是深底上的文字 / focus ring
        ipf: { DEFAULT: '#1D4E9E', bright: '#7FA6EB' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang TC"', '"Noto Sans TC"', '"Microsoft JhengHei"', 'sans-serif'],
        // 數字（週次、D1–D5、組號、重量、次數、計時、進度）
        num: ['"Barlow Condensed"', '-apple-system', 'BlinkMacSystemFont', '"PingFang TC"', 'sans-serif'],
      },
      // 字級階梯：12 / 14 / 16 / 20（Tailwind 內建 xs / sm / base / xl）+ 28 / 44
      fontSize: {
        28: ['28px', { lineHeight: '1.1' }],
        44: ['44px', { lineHeight: '1' }],
      },
    },
  },
  plugins: [],
}
