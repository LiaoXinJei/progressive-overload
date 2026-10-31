import React from 'react'
import ReactDOM from 'react-dom/client'
// 數字用的窄體字，自帶字檔（PWA 離線也能用），只載 latin 的 500 / 600 / 700
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
