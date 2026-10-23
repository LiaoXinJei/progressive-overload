// 執行：npm test（或 node --test src/components/training/TrainingView.test.js）
//
// TrainingView 渲染回歸測試：用 Vite 的 ssrLoadModule 載入元件（處理 JSX 與無副檔名 import），
// 再以 react-dom/server 渲染。不需要瀏覽器或 DOM。

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../../..', import.meta.url));

let server;
let TrainingView;
let DEFAULT_EXERCISE_LIBRARY;

before(async () => {
  server = await createServer({
    configFile: false,
    root,
    plugins: [react()],
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  ({ default: TrainingView } = await server.ssrLoadModule('/src/components/training/TrainingView.jsx'));
  ({ DEFAULT_EXERCISE_LIBRARY } = await server.ssrLoadModule('/src/constants/workouts.js'));
});

after(async () => {
  await server?.close();
});

const noop = () => {};

const baseProps = () => ({
  logs: {}, setLogs: noop,
  history: {}, setHistory: noop,
  mode: 'maintenance',
  currentWeek: 1, currentDay: 0, setCurrentDay: noop,
  showStats: true, setShowStats: noop,
  customExerciseNames: {}, setCustomExerciseNames: noop,
  customExercises: {}, setCustomExercises: noop,
  customSets: {}, setCustomSets: noop,
  exerciseOrder: {}, setExerciseOrder: noop,
  exerciseLibrary: DEFAULT_EXERCISE_LIBRARY,
  exerciseOverrides: {}, setExerciseOverrides: noop,
  weightIncrement: 2,
  currentTime: Date.now(),
});

// 統計面板預設開啟、App 首次 render 就會走到這裡；缺 import 時整個 App 白畫面
test('統計面板開啟時、W1–W10 × D1–D5 都能渲染', () => {
  for (let week = 1; week <= 10; week++) {
    for (let day = 0; day <= 4; day++) {
      const html = renderToString(
        React.createElement(TrainingView, { ...baseProps(), currentWeek: week, currentDay: day }),
      );
      assert.ok(html.includes('本週訓練量'), `W${week} D${day + 1} 缺少統計面板`);
    }
  }
});

test('統計面板顯示肌群目標組數', () => {
  // W1 胸部目標 = VOLUME_CONFIG.CHEST[0] = 10
  const html = renderToString(React.createElement(TrainingView, baseProps()));
  assert.match(html, /胸部<\/span><span class="font-mono">\d+<span class="text-neutral-500"> \/ <!-- -->10<\/span>/);
});
