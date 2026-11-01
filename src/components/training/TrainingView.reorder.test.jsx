// @vitest-environment jsdom
// 執行：npm test
//
// 排序模式（「⋯」→「調整順序」）、已完成的組當目前這組的焦點規則（N1）、刪除自訂動作後的焦點

import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { test, afterEach, vi } from 'vitest';
import assert from 'node:assert/strict';
import TrainingView from './TrainingView.jsx';
import { DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

// 這裡不測拖拉本身，@hello-pangea/dnd 換成直接畫 children 的空殼（同 TrainingView.rest.test.jsx），
// 把手的屬性用 data-drag-handle 標出來；DragDropContext 的 props 存起來，測試裡直接呼叫 onDragStart / onDragEnd
const dnd = vi.hoisted(() => ({ props: null }));
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: (props) => { dnd.props = props; return props.children; },
  Droppable: ({ children }) => children({ innerRef() {}, droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef() {}, draggableProps: {}, dragHandleProps: { 'data-drag-handle': '' } }, { isDragging: false }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MIN = 60 * 1000;
const T0 = new Date(2026, 10, 1, 19, 30).getTime();
const done = (weight, reps, completedAt) => ({ weight, reps: String(reps), done: true, completedAt });
const key = (exId, idx) => `w3-d1-${exId}-s${idx}`;

let root = null;
let container = null;

afterEach(() => {
  // 輸入方式（鍵盤 / 指標）是整個 App 共用的紀錄，測完回到指標
  document.dispatchEvent(new Event('pointerdown'));
  vi.restoreAllMocks();
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  document.documentElement.style.overflow = '';
});

const renderView = ({ logs = {}, customExercises = {}, exerciseOrder = {} } = {}) => {
  const state = {};
  const Harness = () => {
    const [l, setL] = useState(logs);
    const [ce, setCe] = useState(customExercises);
    const [order, setOrder] = useState(exerciseOrder);
    const [week, setWeek] = useState(3);
    const [day, setDay] = useState(1);
    const [now, setNow] = useState(T0);
    state.logs = l;
    state.order = order;
    state.week = week;
    state.tick = () => setNow(t => t + 1000);
    const noop = () => {};
    return (
      <TrainingView
        logs={l} setLogs={setL}
        history={{ pullup: { weight: 0, reps: '9' } }} setHistory={noop}
        currentWeek={week} currentDay={day} setCurrentDay={setDay}
        onSelectWeek={(w) => { setWeek(w); setDay(0); }}
        customExerciseNames={{}} setCustomExerciseNames={noop}
        customExercises={ce} setCustomExercises={setCe}
        customSets={{ 'w3-B-pullup': 4 }} setCustomSets={noop}
        exerciseOrder={order} setExerciseOrder={setOrder}
        exerciseLibrary={DEFAULT_EXERCISE_LIBRARY} exerciseOverrides={{}} setExerciseOverrides={noop}
        weightIncrement={2}
        currentTime={now}
        restTarget={120}
      />
    );
  };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
  return state;
};

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const esc = () => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
const currentKey = () => container.querySelector('[data-set-row][data-current] [data-weight-input]')?.dataset.logKey ?? null;
const optionsOf = (exId) => container.querySelector(`[data-exercise-id="${exId}"] button[aria-label="動作選項"]`);
const enterReorder = (exId = 'pullup') => {
  click(optionsOf(exId));
  click(container.querySelector('[role="dialog"] button[title="調整順序"]'));
};

const twoDone = () => ({
  [key('pullup', 0)]: done(0, 10, T0 - 4 * MIN),
  [key('pullup', 1)]: done(0, 9, T0 - 84 * 1000),
});

// ==================== 排序模式 ====================

test('排序：平常沒有拖曳把手，動作卡照常顯示組列與設定鈕', () => {
  renderView();
  assert.equal(container.querySelectorAll('[data-drag-handle]').length, 0);
  assert.equal(container.querySelectorAll('[aria-label^="拖曳排序"]').length, 0);
  assert.ok(container.querySelector('[data-set-row]'));
  assert.ok(container.querySelector('button[title="設定"]'));
  // 選項 sheet 底部不再有拖曳說明
  click(optionsOf('pullup'));
  assert.doesNotMatch(container.querySelector('[role="dialog"]').textContent, /拖曳/);
});

test('排序：「⋯」→「調整順序」進入排序模式，精簡列右側有把手、標題不是把手；沒有組列可以輸入', () => {
  renderView({ logs: twoDone() });
  enterReorder();
  assert.equal(container.querySelector('[role="dialog"]'), null, '選項 sheet 要關掉');
  assert.equal(container.querySelectorAll('[data-set-row]').length, 0);
  assert.equal(container.querySelectorAll('[data-weight-input]').length, 0);
  assert.equal(container.querySelector('[role="group"][aria-label="訓練日"]'), null, 'D1–D5 收起來');
  assert.equal(container.querySelector('button[title="設定"]'), null);
  const doneBtn = container.querySelector('[data-reorder-done]');
  assert.equal(doneBtn.textContent, '完成');
  // 點擊進來：焦點放在清單上（不在「完成」上畫焦點框）
  assert.equal(document.activeElement, container.querySelector('[data-reorder-list]'));

  const items = [...container.querySelectorAll('[data-reorder-item]')];
  assert.ok(items.length > 0);
  for (const item of items) {
    const handles = item.querySelectorAll('[data-drag-handle]');
    assert.equal(handles.length, 1, '每列只有一個把手');
    assert.match(handles[0].getAttribute('aria-label'), /^拖曳排序：/);
    // 把手裡沒有動作名稱，整列不是把手
    assert.equal(handles[0].textContent, '');
    assert.equal(item.hasAttribute('data-drag-handle'), false);
  }
  // superset 配對收成一列，兩個名稱都在
  const pair = items.find(it => it.dataset.reorderItem.startsWith('pair-rear_fly'));
  assert.match(pair.textContent, /反向飛鳥/);
  assert.match(pair.textContent, /啞鈴二頭彎舉/);
});

test('排序：superset 成員的選項 sheet 也有「調整順序」', () => {
  renderView();
  click(optionsOf('bi_curl'));
  assert.ok(container.querySelector('[role="dialog"] button[title="調整順序"]'));
});

test('排序：按「完成」離開，組列回來，目前這組回到原本那一組，焦點回到進來的「⋯」', () => {
  renderView({ logs: twoDone() });
  assert.equal(currentKey(), key('pullup', 2));
  enterReorder('db_row');
  click(container.querySelector('[data-reorder-done]'));
  assert.equal(container.querySelectorAll('[data-reorder-item]').length, 0);
  assert.ok(container.querySelector('[role="group"][aria-label="訓練日"]'));
  assert.ok(container.querySelector('button[title="設定"]'));
  assert.equal(currentKey(), key('pullup', 2));
  assert.equal(document.activeElement, optionsOf('db_row'));
});

test('排序：Esc 離開排序模式', () => {
  renderView();
  enterReorder();
  assert.ok(container.querySelector('[data-reorder-done]'));
  esc();
  assert.equal(container.querySelector('[data-reorder-done]'), null);
  assert.ok(container.querySelector('[data-set-row]'));
});

// ==================== N1：改過已完成的組之後，按住畫面不會跳回去 ====================

test('N1：改已完成的組、點別處收掉後，之後再按住畫面，目前這組不會跳回那一組', async () => {
  const state = renderView({ logs: twoDone() });
  const input = container.querySelector(`[data-weight-input][data-log-key="${key('pullup', 1)}"]`);
  act(() => input.focus());
  assert.equal(currentKey(), key('pullup', 1));

  // 按下時焦點還在已完成的組：放開前它維持目前這組（按到一半的按鈕不會跑掉）
  act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  act(() => input.blur());
  assert.equal(currentKey(), key('pullup', 1));
  // 放開（click 跑完）之後收掉
  act(() => { document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await act(async () => { await new Promise(r => setTimeout(r, 20)); });
  assert.equal(currentKey(), key('pullup', 2));

  // 之後手指再按住畫面（捲動），App 每秒重畫：不會跳回第 2 組
  act(() => { document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  act(() => state.tick());
  act(() => state.tick());
  assert.equal(currentKey(), key('pullup', 2));
});

// ==================== 刪除自訂動作後的焦點 ====================

const CUSTOM = { B: [{ id: 'custom_1', name: '自訂划船', muscle: 'BACK', type: 'compound', isUpper: true, isCustom: true }] };

test('刪除自訂動作：焦點移到下一個動作的「⋯」', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderView({ customExercises: CUSTOM, exerciseOrder: { B: ['custom_1', 'pullup'] } });
  click(optionsOf('custom_1'));
  click(container.querySelector('button[title="刪除此動作"]'));
  assert.equal(container.querySelector('[data-exercise-id="custom_1"]'), null);
  assert.equal(document.activeElement, optionsOf('pullup'));
});

test('刪除自訂動作：是最後一個動作時，焦點移到「新增動作」', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderView({ customExercises: CUSTOM });
  click(optionsOf('custom_1'));
  click(container.querySelector('button[title="刪除此動作"]'));
  assert.equal(document.activeElement.textContent.trim(), '新增動作');
});

test('刪除自訂動作（不變）：確認框按取消，焦點不亂跳、動作還在', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderView({ customExercises: CUSTOM });
  click(optionsOf('custom_1'));
  click(container.querySelector('button[title="刪除此動作"]'));
  assert.ok(container.querySelector('[data-exercise-id="custom_1"]'));
  assert.notEqual(document.activeElement.textContent.trim(), '新增動作');
});

// ==================== 排序模式：鍵盤進入、Esc、換週、膠囊、離開後焦點 ====================

const press = (key) => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });

test('排序：用鍵盤進來時，焦點在「完成」', () => {
  renderView();
  press('Tab');
  enterReorder();
  assert.equal(document.activeElement, container.querySelector('[data-reorder-done]'));
});

test('排序（R1）：拖曳中、或 Esc 剛取消拖曳，這一下 Esc 不離開排序模式', async () => {
  renderView();
  enterReorder();
  act(() => dnd.props.onDragStart({ draggableId: 's-pullup', source: { index: 0 } }));
  esc();
  assert.ok(container.querySelector('[data-reorder-done]'), '拖曳中的 Esc 是取消拖曳');
  act(() => dnd.props.onDragEnd({ reason: 'CANCEL', draggableId: 's-pullup', source: { index: 0 }, destination: null }));
  esc();
  assert.ok(container.querySelector('[data-reorder-done]'), '取消拖曳的那一下 Esc 不離開');
  await act(async () => { await new Promise(r => setTimeout(r, 350)); });
  esc();
  assert.equal(container.querySelector('[data-reorder-done]'), null, '之後的 Esc 才離開');
});

test('排序：拖過順序再離開，焦點給被移動的動作的「⋯」', () => {
  const state = renderView();
  enterReorder('db_row');
  act(() => dnd.props.onDragStart({ draggableId: 's-pullup', source: { index: 0 } }));
  act(() => dnd.props.onDragEnd({ reason: 'DROP', draggableId: 's-pullup', source: { index: 0 }, destination: { index: 2 } }));
  assert.equal(state.order.B.indexOf('pullup'), 2);
  click(container.querySelector('[data-reorder-done]'));
  assert.equal(document.activeElement, optionsOf('pullup'));
});

test('排序：順序沒變就離開，焦點回到進來的「⋯」', () => {
  renderView();
  enterReorder('db_row');
  act(() => dnd.props.onDragStart({ draggableId: 's-pullup', source: { index: 0 } }));
  act(() => dnd.props.onDragEnd({ reason: 'DROP', draggableId: 's-pullup', source: { index: 0 }, destination: { index: 0 } }));
  click(container.querySelector('[data-reorder-done]'));
  assert.equal(document.activeElement, optionsOf('db_row'));
});

test('排序：拖過去又拖回原位，當作順序沒變，焦點回到進來的「⋯」', () => {
  renderView();
  enterReorder('db_row');
  act(() => dnd.props.onDragStart({ draggableId: 's-pullup', source: { index: 0 } }));
  act(() => dnd.props.onDragEnd({ reason: 'DROP', draggableId: 's-pullup', source: { index: 0 }, destination: { index: 2 } }));
  act(() => dnd.props.onDragStart({ draggableId: 's-pullup', source: { index: 2 } }));
  act(() => dnd.props.onDragEnd({ reason: 'DROP', draggableId: 's-pullup', source: { index: 2 }, destination: { index: 0 } }));
  click(container.querySelector('[data-reorder-done]'));
  assert.equal(document.activeElement, optionsOf('db_row'));
});

test('排序：清單容器是有名稱的 group', () => {
  renderView();
  enterReorder();
  const list = container.querySelector('[data-reorder-list]');
  assert.equal(list.getAttribute('role'), 'group');
  assert.equal(list.getAttribute('aria-label'), '動作順序');
});

test('排序：排序模式中換到別週，直接離開排序模式', () => {
  const state = renderView();
  enterReorder();
  click(container.querySelector('[data-current-week]'));
  click([...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.startsWith('W2')));
  assert.equal(state.week, 2);
  assert.equal(container.querySelector('[data-reorder-done]'), null);
  assert.ok(container.querySelector('[data-set-row]'));
});

test('排序：排序模式中選同一週，不離開', () => {
  renderView();
  enterReorder();
  click(container.querySelector('[data-current-week]'));
  click([...container.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.startsWith('W3')));
  assert.ok(container.querySelector('[data-reorder-done]'));
});

test('排序：排序模式中點休息膠囊，先離開排序模式', () => {
  renderView({ logs: twoDone() });
  enterReorder();
  const pill = container.querySelector('[data-rest-pill]');
  assert.ok(pill);
  click(pill);
  assert.equal(container.querySelector('[data-reorder-done]'), null);
  assert.equal(currentKey(), key('pullup', 2));
});
