import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { installViewportFix } from './utils/viewportFix'

// iOS 26 鍵盤收起後，貼底的固定層會卡在畫面中間（見 utils/viewportFix.js）
installViewportFix()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
