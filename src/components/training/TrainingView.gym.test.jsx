// @vitest-environment jsdom
// 執行：npm test
//
// 健身房模式（設定裡的實驗開關）：像素場景一個動作一站，點中間開始這組、再點一下完成。
// 一次只畫選中那站的動作卡。canvas 在 jsdom 沒有 2D context，這裡只測互動與資料。

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, beforeEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 0; // PUSH A：平板槓鈴臥推 3 組 → 上斜啞鈴臥推 → superset …
const key = (exId, idx) => `w${WEEK}-d${DAY}-${exId}-s${idx}`;
const T0 = new Date(2026, 10, 1, 19, 0, 0).getTime();

let root = null;
let container = null;
let now = T0;

beforeEach(() => {
  now = T0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  // jsdom 沒有 canvas，getContext 會印 Not implemented；場景拿不到 context 就不畫
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({ logs = {}, history = {}, currentTime = T0 } = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [h, setH] = useState(history);
    const [ce, setCe] = useState({});
    const [cs, setCs] = useState({});
    const [time, setTime] = useState(currentTime);
    state.logs = l;
    state.history = h;
    state.customExercises = ce;
    state.customSets = cs;
    state.setTime = setTime;
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={h} setHistory={setH}
        currentWeek={WEEK} currentDay={DAY} setCurrentDay={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={ce} setCustomExercises={setCe}
        customSets={cs} setCustomSets={setCs}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY}
        exerciseOverrides={{}} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={time}
        restTarget={90}
        gymMode
      />
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return state;
};

const click = (el) => act(() => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const typeInto = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const action = () => container.querySelector('[data-gym-action]');
const hint = () => container.querySelector('#gym-hint').textContent;
const shownExercises = () => [...container.querySelectorAll('[data-exercise-id]')].map(el => el.dataset.exerciseId);
const rows = () => [...container.querySelectorAll('[data-set-row]')];
const restPill = () => container.querySelector('[data-rest-pill]');
const done = (weight, reps, completedAt) => ({ weight, reps, done: true, completedAt });
const BENCH = { bp_flat: { weight: 80, reps: '8' } };

test('開啟後只畫選中那站的動作卡；前一個動作做完，動作間休息線照常顯示', () => {
  renderView({
    logs: {
      [key('bp_flat', 0)]: done(80, '8', T0 - 9 * 60000),
      [key('bp_flat', 1)]: done(80, '8', T0 - 6 * 60000),
      [key('bp_flat', 2)]: done(80, '8', T0 - 60000),
    },
    history: BENCH,
  });
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  assert.ok(container.querySelector('[data-gym-scene]'));
  const labels = [...container.querySelectorAll('[data-rest-label]')].map(el => el.textContent);
  assert.ok(labels.some(t => t.startsWith('動作間休息')), labels.join(' / '));
});

test('點中間開始這組：浮卡移到這組、按鈕改念完成；1 秒內再點不算，之後再點才完成並開始休息', () => {
  const state = renderView({ history: BENCH });
  assert.equal(action().getAttribute('aria-label'), '開始 平板槓鈴臥推 第 1 組');
  click(action());
  assert.equal(action().getAttribute('aria-label'), '完成 平板槓鈴臥推 第 1 組');
  assert.ok(rows()[0].hasAttribute('data-current'));
  assert.match(hint(), /做完再點一下/);

  now += 500;
  click(action());
  assert.notEqual(state.logs[key('bp_flat', 0)]?.done, true, '連點不算完成');

  now += 1500;
  click(action());
  const log = state.logs[key('bp_flat', 0)];
  assert.equal(log.done, true);
  assert.equal(log.completedAt, now);
  assert.deepEqual([log.weight, log.reps], [80, '8']);
  assert.equal(action().getAttribute('aria-label'), '開始 平板槓鈴臥推 第 2 組');
  assert.ok(rows()[1].hasAttribute('data-current'), '浮卡換到下一組');
  assert.match(hint(), /^休息中 /, '開始休息');
});

const repsValue = () => container.querySelector('[data-gym-reps-value]').textContent;
const repsGroup = () => container.querySelector('[data-gym-controls] [role="group"]');

test('沒填次數也沒有上次紀錄：場景上顯示這週次數區間的下限，完成就記這個數，不跳鍵盤', () => {
  const state = renderView();
  assert.equal(repsValue(), '8下', 'W1 複合動作 8–12 下');
  click(action());
  now += 2000;
  click(action());
  const log = state.logs[key('bp_flat', 0)];
  assert.equal(log.done, true);
  assert.deepEqual([log.weight, log.reps], [0, '8']);
  assert.ok(!['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName), '沒有輸入框拿到焦點');
});

test('健身房模式不顯示休息膠囊：休息狀態在面板提示上，開始做下一組時換成做完再點一下', () => {
  renderView({ logs: { [key('bp_flat', 0)]: done(80, '8', T0 - 30000) }, history: BENCH });
  assert.equal(restPill(), null);
  assert.equal(hint(), '休息中 0:30 / 1:30');
  click(action());
  assert.equal(hint(), '做完再點一下');
  now += 2000;
  click(action());
  assert.equal(restPill(), null);
  assert.match(hint(), /^休息中 /);
});

const plate = (kg) => container.querySelector(`[data-plate="${kg}"]`);
const unload = () => container.querySelector('[data-gym-unload]');
const weightText = () => container.querySelector('[data-gym-weight] p').textContent;
const pips = () => [...container.querySelectorAll('[data-gym-pip]')].map(el => el.dataset.gymPip);

test('槓片架：槓鈴點 10 公斤 = 兩邊各一片（+20），卸下的是最外面那片', () => {
  const state = renderView({ history: BENCH });
  assert.equal(weightText(), '80kg');
  assert.equal(unload().textContent, '卸 10', '80 = 空槓 20 + 每邊 20、10');
  click(plate(10));
  assert.equal(state.logs[key('bp_flat', 0)].weight, 100);
  assert.equal(unload().textContent, '卸 10', '照點的順序疊：最外面是剛掛的 10');
  click(plate(2.5));
  assert.equal(state.logs[key('bp_flat', 0)].weight, 105);
  click(unload());
  assert.equal(state.logs[key('bp_flat', 0)].weight, 100);
  // 槓鈴上的槓片也可以點：卸下最外面那片
  click(container.querySelector('[data-gym-bar]'));
  assert.equal(state.logs[key('bp_flat', 0)].weight, 80);
  assert.equal(weightText(), '80kg');
});

test('槓片架：沒填重量也沒上次紀錄的槓鈴從空槓開始掛；空槓不能再卸', () => {
  const state = renderView();
  assert.equal(weightText(), '—kg');
  assert.equal(unload(), null);
  click(plate(20));
  assert.equal(state.logs[key('bp_flat', 0)].weight, 60);
  click(unload());
  assert.equal(state.logs[key('bp_flat', 0)].weight, 20);
  assert.equal(unload(), null, '剩空槓');
});

test('槓片架：啞鈴動作點一片只加一片的重量', () => {
  const state = renderView();
  click(container.querySelector('button[aria-label^="下一台"]'));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  click(plate(5));
  click(plate(1.25));
  assert.equal(state.logs[key('bp_incline_db', 0)].weight, 6.25);
  assert.equal(unload().textContent, '卸 1.25');
});

test('次數：+ / − 改這組；做完一組後改的是剛剛那組，開始下一組才換成新的一組', () => {
  const state = renderView({ history: BENCH });
  assert.equal(repsValue(), '8下', '上次紀錄');
  click(container.querySelector('button[aria-label="第 1 組次數加一"]'));
  assert.equal(state.logs[key('bp_flat', 0)].reps, '9');
  click(action());
  now += 2000;
  click(action());
  assert.equal(state.logs[key('bp_flat', 0)].done, true);
  assert.equal(state.logs[key('bp_flat', 0)].reps, '9');
  // 休息中：次數鈕是剛剛那組
  assert.match(repsGroup().getAttribute('aria-label'), /^剛剛第 1 組/);
  click(container.querySelector('button[aria-label="第 1 組次數減一"]'));
  assert.equal(state.logs[key('bp_flat', 0)].reps, '8');
  assert.deepEqual(state.history.bp_flat, { weight: 80, reps: '8' }, '改完成過的組，上次紀錄跟著改');
  // 開始下一組：換成第 2 組
  now += 60000;
  click(action());
  assert.match(repsGroup().getAttribute('aria-label'), /^第 2 組/);
});

test('組數：顯示每組的狀態，＋ 加一組', () => {
  const state = renderView({ logs: { [key('bp_flat', 0)]: done(80, '8', T0 - 60000) }, history: BENCH });
  assert.deepEqual(pips(), ['done', 'current', 'pending']);
  click(container.querySelector('button[aria-label="加一組"]'));
  assert.deepEqual(Object.values(state.customSets), [4]);
  assert.deepEqual(pips(), ['done', 'current', 'pending', 'pending']);
});

test('這站做完了：下排顯示下一台，點了換過去', () => {
  renderView({
    logs: {
      [key('bp_flat', 0)]: done(80, '8', T0 - 9 * 60000),
      [key('bp_flat', 1)]: done(80, '8', T0 - 6 * 60000),
      [key('bp_flat', 2)]: done(80, '8', T0 - 3 * 60000),
    },
    history: BENCH,
  });
  click(container.querySelector('button[aria-label^="上一台"]'));
  assert.deepEqual(shownExercises(), ['bp_flat']);
  assert.equal(hint(), '這個動作做完了');
  assert.equal(container.querySelector('[data-gym-weight]'), null, '沒有下一組就不能掛槓片');
  click([...container.querySelectorAll('[data-gym-controls] button')].find(b => b.textContent.startsWith('下一台')));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
});

test('做完一個動作的最後一組，自動換到下一個動作', () => {
  renderView({
    logs: {
      [key('bp_flat', 0)]: done(80, '8', T0 - 6 * 60000),
      [key('bp_flat', 1)]: done(80, '8', T0 - 3 * 60000),
    },
    history: BENCH,
  });
  assert.deepEqual(shownExercises(), ['bp_flat']);
  click(action());
  now += 2000;
  click(action());
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  assert.equal(action().getAttribute('aria-label'), '開始 上斜啞鈴臥推 第 1 組');
});

test('手動換到別站後，時間往前走不會被拉回目前這組', () => {
  const state = renderView({ history: BENCH });
  click(container.querySelector('button[aria-label^="下一台"]'));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  act(() => state.setTime(T0 + 5000));
  act(() => state.setTime(T0 + 10000));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  // 在這站點開始：目前這組換成這站的第一組
  click(action());
  assert.ok(rows()[0].hasAttribute('data-current'));
  assert.equal(action().getAttribute('aria-label'), '完成 上斜啞鈴臥推 第 1 組');
});

test('完成後再取消完成，人物不會又開始做那一組', () => {
  const state = renderView({ history: BENCH });
  click(action());
  now += 2000;
  click(action());
  assert.equal(state.logs[key('bp_flat', 0)].done, true);
  click(rows()[0].querySelector('[data-complete-btn]'));
  assert.equal(state.logs[key('bp_flat', 0)].done, false);
  assert.equal(action().getAttribute('aria-label'), '開始 平板槓鈴臥推 第 1 組');
});

test('新增自訂動作後選到它那一站', () => {
  const state = renderView();
  click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === '新增動作'));
  typeInto(container.querySelector('input[placeholder="例如：槓鈴深蹲"]'), '地雷管推舉');
  click([...container.querySelectorAll('.fixed button')].find(b => b.textContent === '新增'));
  const id = state.customExercises.A?.[0]?.id;
  assert.ok(id);
  assert.deepEqual(shownExercises(), [id]);
});

test('最後一組的次數欄按 Enter：換到下一站，焦點到它第一組的重量欄', () => {
  renderView({ history: BENCH });
  const repsInput = rows()[2].querySelector('[data-reps-input]');
  act(() => repsInput.focus());
  act(() => repsInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  assert.deepEqual(shownExercises(), ['bp_incline_db']);
  assert.equal(document.activeElement.dataset.logKey, key('bp_incline_db', 0));
});
