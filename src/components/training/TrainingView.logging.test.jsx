// @vitest-environment jsdom
// 執行：npm test
//
// 組數紀錄（✓ 完成、輸入次數、歷史、替換動作、動作間休息）的回歸測試，對應 BUG-03 / 04 / 11 / 16 / 19 / 20。

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';
import { buildSessionPlan } from '../../utils/sessionPlan';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WEEK = 1;
const DAY = 1; // PULL A：引體向上 → 單臂啞鈴划船，兩個都是 single
const key = (exId, idx) => `w${WEEK}-d${DAY}-${exId}-s${idx}`;
const MIN = 60 * 1000;

let root = null;
let container = null;

afterEach(() => {
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

const renderView = ({
  logs = {}, history = {}, exerciseOverrides = {}, customExercises = {}, customSets = {},
  week = WEEK, day = DAY, currentTime = Date.now(),
} = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [h, setH] = useState(history);
    const [ov, setOv] = useState(exerciseOverrides);
    const [ce, setCe] = useState(customExercises);
    const [cs, setCs] = useState(customSets);
    state.logs = l;
    state.history = h;
    state.exerciseOverrides = ov;
    state.customExercises = ce;
    state.customSets = cs;
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={h} setHistory={setH}
        mode="maintenance" currentWeek={week} currentDay={day} setCurrentDay={noop}
        showStats={false} setShowStats={noop}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={ce} setCustomExercises={setCe}
        customSets={cs} setCustomSets={setCs}
        exerciseOrder={{}} setExerciseOrder={noop}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY}
        exerciseOverrides={ov} setExerciseOverrides={setOv}
        weightIncrement={2}
        currentTime={currentTime}
      />
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return state;
};

const typeInto = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const click = (el) => act(() => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

// 第 n 個組數列（整頁順序，引體向上的組數排最前面）
const row = (n) => {
  const el = container.querySelectorAll('[data-set-row]')[n];
  return {
    weight: el.querySelector('[data-weight-input]'),
    reps: el.querySelector('[data-reps-input]'),
    plus: el.querySelector('button[title="+2kg"]'),
    complete: el.querySelector('[data-complete-btn]'),
    setNo: el.querySelector('button'),
  };
};

const done = (weight, reps, completedAt) => ({ weight, reps, done: true, completedAt });

// ==================== ✓ 完成按鈕（BUG-03 / 04 / 19） ====================

// 回傳文字，不回傳 DOM 節點
const leafText = (prefix) => [...container.querySelectorAll('div')]
  .find(d => d.children.length === 0 && d.textContent.startsWith(prefix))?.textContent ?? null;

test('✓：輸入重量和次數不會自動完成，不寫歷史、不開始休息', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  assert.notEqual(state.logs[key('pullup', 0)].done, true);
  assert.equal(state.logs[key('pullup', 0)].completedAt, undefined);
  assert.deepEqual(state.history, {});
  assert.equal(leafText('休息中'), null);
});

test('✓：按下才完成，寫歷史並開始休息計時', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(typeof log.completedAt, 'number');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '10' });
  assert.equal(row(0).complete.getAttribute('aria-pressed'), 'true');
  assert.match(leafText('休息中') ?? '', /^休息中: /);
});

test('✓：再按一次取消完成，休息計時消失、數字保留', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, false);
  assert.equal(log.completedAt, undefined);
  assert.equal(log.weight, '60');
  assert.equal(log.reps, '10');
  assert.equal(row(0).complete.title, '完成此組');
  assert.equal(leafText('休息中'), null);
});

test('✓：帶入上次紀錄（點組號）後按 ✓ 一下就完成', () => {
  const state = renderView({ history: { pullup: { weight: 20, reps: '8' } } });
  click(row(0).setNo);
  assert.notEqual(state.logs[key('pullup', 0)].done, true);
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(log.weight, 20);
  assert.equal(log.reps, '8');
});

test('組號：已完成的組點組號不會用歷史蓋掉這組的紀錄', () => {
  const t0 = Date.now();
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', t0 - 3 * MIN), [key('pullup', 1)]: done(62, '8', t0) },
    history: { pullup: { weight: 62, reps: '8' } },
  });
  assert.equal(row(0).setNo.disabled, true);
  click(row(0).setNo);
  assert.equal(state.logs[key('pullup', 0)].weight, 60);
  assert.equal(state.logs[key('pullup', 0)].reps, '10');
});

test('✓：什麼都沒填、有上次紀錄時直接按 ✓，用上次的重量與次數（placeholder）完成', () => {
  const state = renderView({ history: { pullup: { weight: 20, reps: '8' } } });
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(log.weight, 20);
  assert.equal(log.reps, '8');
});

test('✓（BUG-04）：重量空白、沒有歷史時按 ✓，當 0 kg 自體重完成並寫進歷史', () => {
  const state = renderView();
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  const log = state.logs[key('pullup', 0)];
  assert.equal(log.done, true);
  assert.equal(log.weight, 0);
  assert.equal(row(0).weight.value, '0');
  assert.deepEqual(state.history.pullup, { weight: 0, reps: '8' });
});

test('✓：沒填次數、也沒有上次次數時不能按', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  assert.equal(row(0).complete.disabled, true);
  click(row(0).complete);
  assert.notEqual(state.logs[key('pullup', 0)].done, true);
  assert.deepEqual(state.history, {});
});

test('✓：跳過的組不顯示 ✓，取消跳過後恢復', () => {
  renderView({ logs: { [key('pullup', 0)]: { skipped: true } } });
  assert.equal(row(0).complete, null);
  click(container.querySelector('[data-set-row] button[title="取消跳過"]'));
  assert.notEqual(row(0).complete, null);
});

test('✓：打錯重量完成後取消再跳過，歷史回到完成前的值，下一組不會沿用打錯的數字', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '8' } } });
  typeInto(row(0).weight, '600');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  assert.deepEqual(state.history.pullup, { weight: 600, reps: '8' });
  click(row(0).complete);
  click(container.querySelector('[data-set-row] button[title="跳過此組"]'));
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '8' });
  assert.equal(row(1).weight.placeholder, '60');
  click(row(1).complete);
  assert.equal(state.logs[key('pullup', 1)].weight, 60);
});

test('✓：完成後又改過數字再取消，歷史回到完成前；原本沒有歷史就拿掉', () => {
  const state = renderView();
  typeInto(row(0).weight, '600');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  typeInto(row(0).weight, '700');
  assert.deepEqual(state.history.pullup, { weight: 700, reps: '8' });
  click(row(0).complete);
  assert.equal(state.history.pullup, undefined);
});

test('✓：已完成的組直接按跳過，歷史也回到完成前的值', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '8' } } });
  typeInto(row(0).weight, '600');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  click(container.querySelector('[data-set-row] button[title="跳過此組"]'));
  assert.equal(state.logs[key('pullup', 0)].skipped, true);
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '8' });
});

test('✓：後面的組還是完成的，取消前面的組不動歷史', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '8' } } });
  typeInto(row(0).weight, '62');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  typeInto(row(1).weight, '64');
  typeInto(row(1).reps, '8');
  click(row(1).complete);
  click(row(0).complete);
  assert.deepEqual(state.history.pullup, { weight: 64, reps: '8' });
});

// ==================== BUG-03：次數只記到第一位數 ====================

test('BUG-03：輸入兩位數次數再按 ✓，歷史與下一組 placeholder 要是完整的 12', () => {
  const state = renderView();
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '1');
  typeInto(row(0).reps, '12');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].reps, '12');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '12' });
  assert.equal(row(1).reps.placeholder, '12');
});

test('BUG-03：完成時間記在按 ✓ 的時候，不是打字的時候；之後改次數不會重設', () => {
  const t0 = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(t0);
  const state = renderView({ currentTime: t0 });
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '12');
  assert.equal(state.logs[key('pullup', 0)].completedAt, undefined);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 40 * 1000);
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0 + 40 * 1000);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 90 * 1000);
  typeInto(row(0).reps, '11');
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0 + 40 * 1000);
});

test('重新完成：取消再按 ✓，完成時間沿用第一次完成的時間', () => {
  const t0 = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(t0);
  const state = renderView({ currentTime: t0 });
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 5 * MIN);
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].completedAt, undefined);
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].done, true);
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0);
});

test('重新完成：完成後 60 秒內取消當成誤按，之後真的做完再按 ✓ 用當下時間', () => {
  const t0 = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(t0);
  const state = renderView({ currentTime: t0 });
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 10 * 1000);
  click(row(0).complete);
  assert.equal('firstCompletedAt' in state.logs[key('pullup', 0)], false);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 3 * MIN);
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0 + 3 * MIN);
});

test('重新完成：隔幾分鐘回頭取消、改次數再按 ✓（事後修正），沿用原本的完成時間', () => {
  const t0 = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(t0);
  const state = renderView({ currentTime: t0 });
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 4 * MIN);
  click(row(0).complete);
  typeInto(row(0).reps, '9');
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 5 * MIN);
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].reps, '9');
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0);
});

test('重新完成：已完成的組按跳過、取消跳過再按 ✓，也沿用第一次完成的時間', () => {
  const t0 = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(t0);
  const state = renderView({ currentTime: t0 });
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  vi.spyOn(Date, 'now').mockReturnValue(t0 + 5 * MIN);
  click(container.querySelector('[data-set-row] button[title="跳過此組"]'));
  click(container.querySelector('[data-set-row] button[title="取消跳過"]'));
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].completedAt, t0);
});

// ==================== BUG-11：完成後再改，歷史沒跟著改 ====================

test('BUG-11：完成後改重量（輸入框），歷史重量跟著更新', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  typeInto(row(0).weight, '62.5');
  assert.equal(state.logs[key('pullup', 0)].weight, '62.5');
  assert.deepEqual(state.history.pullup, { weight: 62.5, reps: '10' });
});

test('BUG-11：完成後按「+」，歷史重量跟著更新', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  click(row(0).plus);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '10' });
});

test('BUG-11：完成後改次數，歷史次數跟著更新', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  typeInto(row(0).reps, '8');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '8' });
});

test('BUG-11：完成後清空次數或重量，歷史保留原值、不會被寫成空白', () => {
  const state = renderView({
    logs: { [key('pullup', 0)]: done(60, '10', Date.now()) },
    history: { pullup: { weight: 60, reps: '10' } },
  });
  typeInto(row(0).reps, '');
  typeInto(row(0).weight, '');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '10' });
});

test('BUG-11：改前面已完成的組時，後面還有完成的組，歷史保留後面那組', () => {
  const state = renderView({
    logs: {
      [key('pullup', 0)]: done(60, '10', Date.now() - 3 * MIN),
      [key('pullup', 1)]: done(62, '8', Date.now()),
    },
    history: { pullup: { weight: 62, reps: '8' } },
  });
  typeInto(row(0).reps, '12');
  typeInto(row(0).weight, '64');
  assert.equal(state.logs[key('pullup', 0)].reps, '12');
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '8' });
});

test('BUG-11：後面的組已完成、回頭補記前面的組，歷史保留後面那組', () => {
  const state = renderView({
    logs: { [key('pullup', 1)]: done(62, '8', Date.now()) },
    history: { pullup: { weight: 62, reps: '8' } },
  });
  typeInto(row(0).weight, '60');
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].done, true);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '8' });
});

test('BUG-11（不變）：還沒完成的組改重量，不寫歷史', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '10' } } });
  typeInto(row(0).weight, '70');
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '10' });
});

// ==================== BUG-16：替換動作沿用原動作歷史 ====================

const REPLACED = { exerciseOverrides: { 'B-pullup': 'lib_pulldown_wide' } };

test('BUG-16：替換成別的動作後，不顯示原動作的歷史', () => {
  renderView({ ...REPLACED, history: { pullup: { weight: 100, reps: '8' } } });
  assert.equal(row(0).weight.placeholder, '—');
  assert.equal(row(0).reps.placeholder, '—');
});

test('BUG-16：替換後的動作按 ✓，不會套原動作重量、也不會覆蓋原動作歷史', () => {
  const state = renderView({ ...REPLACED, history: { pullup: { weight: 100, reps: '8' } } });
  typeInto(row(0).reps, '10');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].weight, 0);
  click(row(0).complete); // 取消，重新記
  typeInto(row(0).weight, '45');
  typeInto(row(0).reps, '12');
  click(row(0).complete);
  assert.deepEqual(state.history.pullup, { weight: 100, reps: '8' });
  assert.deepEqual(state.history.lib_pulldown_wide, { weight: 45, reps: '12' });
});

test('BUG-16：替換後的動作用自己的歷史當 placeholder', () => {
  renderView({
    ...REPLACED,
    history: { pullup: { weight: 100, reps: '8' }, lib_pulldown_wide: { weight: 50, reps: '12' } },
  });
  assert.equal(row(0).weight.placeholder, '50');
  assert.equal(row(0).reps.placeholder, '12');
});

// ==================== BUG-20：第一組跳過，動作間休息一直跳 ====================

const pullupSets = buildSessionPlan(WEEK, 'B', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY })
  .find(e => e.exercise.id === 'pullup').sets;

// 引體向上全部完成，最後一組在 t0
const pullupDone = (t0) => Object.fromEntries([...Array(pullupSets)].map((_, i) =>
  [key('pullup', i), done(0, '8', t0 - (pullupSets - 1 - i) * 3 * MIN)]));

// 回傳文字與是否跳動，不回傳 DOM 節點（斷言失敗時 vitest 序列化節點會讓 worker 掛掉）
const interRest = () => {
  const el = [...container.querySelectorAll('div')]
    .find(d => d.children.length === 0 && d.textContent.startsWith('動作間休息'));
  return el ? { text: el.textContent, pulsing: el.className.includes('animate-pulse') } : null;
};

test('BUG-20：划船第一組跳過、第二組已完成 → 動作間休息停在第二組完成時間、不再跳動', () => {
  const now = Date.now();
  const t0 = now - 60 * MIN;
  renderView({
    logs: {
      ...pullupDone(t0),
      [key('db_row', 0)]: { skipped: true },
      [key('db_row', 1)]: done(30, '10', t0 + 2 * MIN),
    },
    currentTime: now,
  });
  assert.deepEqual(interRest(), { text: '動作間休息: 2:00', pulsing: false });
});

test('BUG-20：划船第一組跳過、後面都還沒做 → 還在休息，照現在時間跳動', () => {
  const now = Date.now();
  const t0 = now - 5 * MIN;
  renderView({
    logs: { ...pullupDone(t0), [key('db_row', 0)]: { skipped: true } },
    currentTime: now,
  });
  assert.deepEqual(interRest(), { text: '動作間休息: 5:00', pulsing: true });
});

test('BUG-20：划船每組都跳過 → 不顯示動作間休息', () => {
  const now = Date.now();
  const rowSets = buildSessionPlan(WEEK, 'B', { exerciseLibrary: DEFAULT_EXERCISE_LIBRARY })
    .find(e => e.exercise.id === 'db_row').sets;
  const skipped = Object.fromEntries([...Array(rowSets)].map((_, i) => [key('db_row', i), { skipped: true }]));
  renderView({ logs: { ...pullupDone(now - 60 * MIN), ...skipped }, currentTime: now });
  assert.equal(interRest(), null);
});

// ==================== 刪除自訂動作 ====================

const CUSTOM = { B: [{ id: 'custom_1', name: '自訂划船', muscle: 'BACK', type: 'compound', isUpper: true, isCustom: true }] };
const CUSTOM_OVERRIDES = { 'B-custom_1': 'lib_pulldown_wide', 'B-db_row': 'lib_pulldown_wide' };

test('刪除自訂動作：先跳確認，按取消就不刪', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const state = renderView({ customExercises: CUSTOM, exerciseOverrides: CUSTOM_OVERRIDES });
  click(container.querySelector('button[title="刪除此動作"]'));
  assert.equal(confirm.mock.calls.length, 1);
  assert.deepEqual(state.customExercises, CUSTOM);
  assert.deepEqual(state.exerciseOverrides, CUSTOM_OVERRIDES);
});

test('刪除自訂動作：確認後刪掉，也清掉這個動作的替換設定', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const state = renderView({ customExercises: CUSTOM, exerciseOverrides: CUSTOM_OVERRIDES });
  click(container.querySelector('button[title="刪除此動作"]'));
  assert.deepEqual(state.customExercises, { B: [] });
  assert.deepEqual(state.exerciseOverrides, { 'B-db_row': 'lib_pulldown_wide' });
});

// ==================== 新增自訂動作 ====================

const openAddExercise = () => {
  click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === '新增動作'));
  return container.querySelector('input[placeholder="例如：槓鈴深蹲"]');
};
const keydownEnter = (el, init = {}, keyCode) => act(() => {
  const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...init });
  if (keyCode !== undefined) Object.defineProperty(ev, 'keyCode', { value: keyCode });
  el.dispatchEvent(ev);
});

test('新增動作：名稱欄注音選字中按 Enter 不送出，選完字再按才新增', () => {
  const state = renderView();
  const input = openAddExercise();
  typeInto(input, '坐姿ㄊㄧˊ');
  keydownEnter(input, { isComposing: true });
  assert.deepEqual(state.customExercises, {});
  keydownEnter(input, {}, 229); // Safari 選字時 isComposing 可能是 false，keyCode 是 229
  assert.deepEqual(state.customExercises, {});
  typeInto(input, '坐姿提踵');
  keydownEnter(input);
  assert.equal(state.customExercises.B?.length, 1);
  assert.equal(state.customExercises.B[0].name, '坐姿提踵');
});

test('新增動作：小腿動作算下肢，圓點不會變成上肢藍色', () => {
  const state = renderView();
  const input = openAddExercise();
  typeInto(input, '單腿提踵');
  const select = container.querySelector('.fixed select');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'CALVES');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  click([...container.querySelectorAll('.fixed button')].find(b => b.textContent === '新增'));
  assert.equal(state.customExercises.B?.[0]?.muscle, 'CALVES');
  assert.equal(state.customExercises.B[0].isUpper, false);
});

// ==================== 次數欄 Enter 跳到下一組 ====================

const pressEnter = (el) => act(() => {
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
});
const exRows = (name) => [...[...container.querySelectorAll('h3')].find(h => h.textContent === name)
  .closest('.p-6').querySelectorAll('[data-set-row]')];
const weightOf = (rowEl) => rowEl.querySelector('[data-weight-input]');
const repsOf = (rowEl) => rowEl.querySelector('[data-reps-input]');

test('Enter（不變）：單動作次數欄按 Enter 跳到同動作下一組的重量欄', () => {
  renderView();
  const r = exRows('引體向上');
  pressEnter(repsOf(r[0]));
  assert.equal(document.activeElement === weightOf(r[1]), true);
});

test('Enter：superset 照輪次跳，A1 → B1 → A2 → B2 → 下一組配對的 A1', () => {
  renderView(); // W1 PULL A 第一組配對：反向飛鳥 2 組 / 啞鈴二頭彎舉 2 組
  const a = exRows('反向飛鳥');
  const b = exRows('啞鈴二頭彎舉');
  const next = exRows('繩索反向飛鳥');
  pressEnter(repsOf(a[0]));
  assert.equal(document.activeElement === weightOf(b[0]), true, 'A1 → B1');
  pressEnter(repsOf(b[0]));
  assert.equal(document.activeElement === weightOf(a[1]), true, 'B1 → A2');
  pressEnter(repsOf(a[1]));
  assert.equal(document.activeElement === weightOf(b[1]), true, 'A2 → B2');
  pressEnter(repsOf(b[1]));
  assert.equal(document.activeElement === weightOf(next[0]), true, 'B2 → 下一組配對');
});

test('Enter：superset 的 tail 組接在核心輪後面，tail 做完跳到配對後面的動作', () => {
  // W4 PUSH A 第二組配對：單臂側傾側平舉 4 組、跨體三頭 3 組，側平舉 s3 是 tail
  renderView({ week: 4, day: 0 });
  const a = exRows('單臂側傾側平舉');
  const b = exRows('跨體三頭伸展');
  pressEnter(repsOf(b[2]));
  assert.equal(document.activeElement === weightOf(a[3]), true, 'B3 → A4（tail）');
  pressEnter(repsOf(a[3]));
  assert.equal(document.activeElement === weightOf(exRows('機械腿伸直')[0]), true, 'A4 → 腿伸直');
});

test('Enter：superset 下一個輪到的組跳過了，跳到再下一個', () => {
  renderView({ logs: { [key('bi_curl', 0)]: { skipped: true } } });
  pressEnter(repsOf(exRows('反向飛鳥')[0]));
  assert.equal(document.activeElement === weightOf(exRows('反向飛鳥')[1]), true);
});

// ==================== 歷史 = 最新那筆完成的組（回頭改舊週不蓋掉） ====================

const WEEK_MS = 7 * 24 * 60 * MIN;
// W1、W2 的引體向上都做完：W1 60x10、W2 62x10
const twoWeeksDone = (t0) => {
  const logs = {};
  for (let i = 0; i < pullupSets; i++) {
    logs[`w1-d1-pullup-s${i}`] = done(60, '10', t0 + i * MIN);
    logs[`w2-d1-pullup-s${i}`] = done(62, '10', t0 + WEEK_MS + i * MIN);
  }
  return logs;
};

test('歷史：W2 做到 62，回 W1 改最後一組次數，歷史維持 W2 的 62x10', () => {
  const t0 = Date.now() - 2 * WEEK_MS;
  const state = renderView({ logs: twoWeeksDone(t0), history: { pullup: { weight: 62, reps: '10' } } });
  typeInto(row(pullupSets - 1).reps, '9');
  assert.equal(state.logs[key('pullup', pullupSets - 1)].reps, '9');
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '10' });
});

test('歷史：W2 做完，回 W1 取消最後一組，歷史維持 W2，不還原成 W1 之前的值', () => {
  const t0 = Date.now() - 2 * WEEK_MS;
  const logs = twoWeeksDone(t0);
  logs[key('pullup', pullupSets - 1)].historyBefore = { weight: 55, reps: '10' };
  const state = renderView({ logs, history: { pullup: { weight: 62, reps: '10' } } });
  click(row(pullupSets - 1).complete);
  assert.equal(state.logs[key('pullup', pullupSets - 1)].done, false);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '10' });
});

test('歷史：W2 做完，回 W1 補記漏掉的組，歷史維持 W2', () => {
  const t0 = Date.now() - 2 * WEEK_MS;
  const logs = twoWeeksDone(t0);
  delete logs[key('pullup', pullupSets - 1)];
  const state = renderView({ logs, history: { pullup: { weight: 62, reps: '10' } } });
  typeInto(row(pullupSets - 1).weight, '58');
  typeInto(row(pullupSets - 1).reps, '7');
  click(row(pullupSets - 1).complete);
  assert.equal(state.logs[key('pullup', pullupSets - 1)].done, true);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '10' });
});

test('歷史：W2 改最新那組的次數，歷史跟著改', () => {
  const t0 = Date.now() - 2 * WEEK_MS;
  const state = renderView({ week: 2, logs: twoWeeksDone(t0), history: { pullup: { weight: 62, reps: '10' } } });
  typeInto(row(pullupSets - 1).reps, '11');
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '11' });
});

test('歷史：W2 取消最新那組，歷史退回次新的完成組', () => {
  const t0 = Date.now() - 2 * WEEK_MS;
  const logs = twoWeeksDone(t0);
  logs[`w2-d1-pullup-s${pullupSets - 2}`] = done(62, '9', t0 + WEEK_MS);
  const state = renderView({ week: 2, logs, history: { pullup: { weight: 62, reps: '10' } } });
  click(row(pullupSets - 1).complete);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '9' });
});

test('歷史（R7）：s0 打錯 600 完成 → s1 62 完成 → 改 s0 成 58 → 跳過 s1，歷史是 s0 的 58，不是打錯的 600', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '8' } } });
  typeInto(row(0).weight, '600');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  typeInto(row(1).weight, '62');
  typeInto(row(1).reps, '8');
  click(row(1).complete);
  typeInto(row(0).weight, '58');
  click(container.querySelectorAll('[data-set-row]')[1].querySelector('button[title="跳過此組"]'));
  assert.equal(state.logs[key('pullup', 0)].weight, '58');
  assert.deepEqual(state.history.pullup, { weight: 58, reps: '8' });
});

test('歷史：先取消前面打錯的組、再取消後面的組，歷史回到兩組都做之前的值', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '8' } } });
  typeInto(row(0).weight, '600');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  typeInto(row(1).weight, '62');
  typeInto(row(1).reps, '8');
  click(row(1).complete);
  click(row(0).complete);
  assert.deepEqual(state.history.pullup, { weight: 62, reps: '8' });
  click(row(1).complete);
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '8' });
});

test('歷史：完成後才替換動作，再取消完成，還原的是原動作的歷史，不寫進新動作', () => {
  const state = renderView({ history: { pullup: { weight: 60, reps: '8' } } });
  typeInto(row(0).weight, '600');
  typeInto(row(0).reps, '8');
  click(row(0).complete);
  assert.equal(state.logs[key('pullup', 0)].historyKey, 'pullup');
  click(container.querySelector('button[title="替換動作"]'));
  click([...container.querySelectorAll('button')].find(b => b.textContent.includes('寬握高位下拉')));
  assert.equal(state.exerciseOverrides['B-pullup'], 'lib_pulldown_wide');
  click(row(0).complete);
  assert.deepEqual(state.history.pullup, { weight: 60, reps: '8' });
  assert.equal('lib_pulldown_wide' in state.history, false);
});

test('歷史：舊紀錄沒存 historyKey，用現在的替換設定推（替換後的動作）', () => {
  const t0 = Date.now() - 2 * WEEK_MS;
  const state = renderView({
    ...REPLACED,
    logs: { [key('pullup', 0)]: done(45, '12', t0) },
    history: { pullup: { weight: 100, reps: '8' }, lib_pulldown_wide: { weight: 45, reps: '12' } },
  });
  typeInto(row(0).weight, '47');
  assert.deepEqual(state.history.lib_pulldown_wide, { weight: 47, reps: '12' });
  assert.deepEqual(state.history.pullup, { weight: 100, reps: '8' });
});
