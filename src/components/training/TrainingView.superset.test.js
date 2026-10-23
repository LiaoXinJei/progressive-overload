// 執行：npm test
//
// 用 react-dom/server 把 TrainingView 渲染成 HTML 檢查結構。
// SSR 沒有版面計算，sticky 是否真的黏住只能檢查「祖先沒有捲動容器」這類結構條件。

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TrainingView from './TrainingView.jsx';
import { buildSessionPlan, getWorkoutForDay } from '../../utils/sessionPlan';
import { SUPERSET_PAIRS, DEFAULT_EXERCISE_LIBRARY } from '../../constants/workouts';

// ==================== 迷你 HTML 樹（只處理 React SSR 的輸出） ====================

const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const parseHtml = (html) => {
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      cur = cur.parent ?? cur;
    } else if (m[2]) {
      const attrs = {};
      for (const a of m[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? '';
      const node = { tag: m[2].toLowerCase(), attrs, children: [], parent: cur };
      cur.children.push(node);
      if (!m[4] && !VOID_TAGS.has(node.tag)) cur = node;
    } else if (m[5]) {
      cur.children.push({ tag: '#text', text: m[5], parent: cur });
    }
  }
  return root;
};

const findAll = (node, pred, out = []) => {
  if (node.tag !== '#text' && pred(node)) out.push(node);
  for (const c of node.children ?? []) findAll(c, pred, out);
  return out;
};

const textOf = (node) =>
  node.tag === '#text' ? node.text : (node.children ?? []).map(textOf).join('');

const classOf = (node) => node.attrs?.class ?? '';

// ==================== 測試資料 ====================

const W = 4;
const T0 = 1_700_000_000_000;

// 在預設課表找一個 A/B 組數不同的 pair（有 tail 組），避免寫死組數分配
const findUnequalPair = () => {
  for (let week = 1; week <= 10; week++) {
    for (let day = 0; day < 5; day++) {
      const workoutKey = getWorkoutForDay(week, day);
      const plan = buildSessionPlan(week, workoutKey, {
        customExercises: {}, customSets: {}, exerciseOrder: {},
        exerciseOverrides: {}, exerciseLibrary: DEFAULT_EXERCISE_LIBRARY,
      });
      const pairs = SUPERSET_PAIRS[workoutKey] || [];
      for (const p of pairs) {
        // C 的兩組 pair 共用 secondary（BUG-02），畫面上只成一組，避開
        if (pairs.some(o => o !== p && (o.secondary === p.secondary || o.primary === p.primary))) continue;
        const a = plan.find(e => e.exercise.id === p.primary);
        const b = plan.find(e => e.exercise.id === p.secondary);
        if (!a || !b || a.sets === b.sets || Math.min(a.sets, b.sets) === 0) continue;
        const long = a.sets > b.sets ? a : b;
        return { week, day, pair: p, aSets: a.sets, bSets: b.sets, longName: long.exercise.name };
      }
    }
  }
  return null;
};

const renderDay = ({ week, day, logs, currentTime }) => {
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(TrainingView, {
    logs, setLogs: noop,
    history: {}, setHistory: noop,
    mode: 'maintenance', currentWeek: week, currentDay: day, setCurrentDay: noop,
    showStats: false, setShowStats: noop,
    customExerciseNames: {}, setCustomExerciseNames: noop,
    customExercises: {}, setCustomExercises: noop,
    customSets: {}, setCustomSets: noop,
    exerciseOrder: {}, setExerciseOrder: noop,
    exerciseLibrary: DEFAULT_EXERCISE_LIBRARY,
    exerciseOverrides: {}, setExerciseOverrides: noop,
    weightIncrement: 2,
    currentTime,
  }));
  return parseHtml(html);
};

const pairCard = (tree, pair) => {
  const [card] = findAll(tree, n => n.attrs['data-rfd-draggable-id'] === `pair-${pair.primary}-${pair.secondary}`);
  assert.ok(card, `找不到 pair 卡片 ${pair.primary}+${pair.secondary}`);
  return card;
};

const stickyBarOf = (card) => {
  const [bar] = findAll(card, n => /\bsticky\b/.test(classOf(n)));
  assert.ok(bar, 'pair 卡片內找不到 sticky bar');
  return bar;
};

// 某動作某組的 set 列後面那段 inline 休息文字（React.Fragment 攤平成兄弟節點）
const restTextAfterSet = (card, exerciseName, setIdx) => {
  const headers = findAll(card, n => n.tag === 'h3' && textOf(n) === exerciseName);
  assert.equal(headers.length, 1, `pair 卡片內找不到動作 ${exerciseName}`);
  let section = headers[0];
  while (section && !findAll(section, n => 'data-set-row' in n.attrs).length) section = section.parent;
  const rows = findAll(section, n => 'data-set-row' in n.attrs);
  const row = rows[setIdx];
  const siblings = row.parent.children;
  const next = siblings[siblings.indexOf(row) + 1];
  return next && !('data-set-row' in next.attrs) ? textOf(next) : '';
};

const k = (week, day, id, i) => `w${week}-d${day}-${id}-s${i}`;

// ==================== BUG-17：sticky bar ====================

test('BUG-17: pair sticky bar 的祖先沒有 overflow hidden/auto/scroll（否則 sticky 被困在不捲動的卡片裡）', () => {
  const tree = renderDay({ week: 1, day: 0, logs: {}, currentTime: T0 });
  const pair = SUPERSET_PAIRS.A[0];
  const bar = stickyBarOf(pairCard(tree, pair));
  const offenders = [];
  for (let n = bar.parent; n && n.tag !== '#root'; n = n.parent) {
    const cls = classOf(n);
    const style = n.attrs.style ?? '';
    if (/\boverflow(-[xy])?-(hidden|auto|scroll)\b/.test(cls) || /overflow(-[xy])?:\s*(hidden|auto|scroll)/.test(style)) {
      offenders.push(`<${n.tag} class="${cls}">`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('BUG-17: sticky bar 的 top 讓出 App 的 sticky header 高度，不是 top: 0', () => {
  const tree = renderDay({ week: 1, day: 0, logs: {}, currentTime: T0 });
  const bar = stickyBarOf(pairCard(tree, SUPERSET_PAIRS.A[0]));
  assert.doesNotMatch(classOf(bar), /\btop-0\b/);
  assert.match(bar.attrs.style ?? '', /top:\s*var\(--app-header-h/);
});

// ==================== BUG-18：pair tail 組 ====================

test('BUG-18: 核心輪做完、tail 組未做 → bar 不顯示「完成」、tail 前顯示休息中', (t) => {
  const found = findUnequalPair();
  if (!found) return t.skip('預設課表沒有組數不等的 pair');
  const { week, day, pair, aSets, bSets, longName } = found;
  const core = Math.min(aSets, bSets);
  const longId = aSets > bSets ? pair.primary : pair.secondary;

  const logs = {};
  let ts = T0;
  for (let i = 0; i < core; i++) {
    logs[k(week, day, pair.primary, i)] = { done: true, completedAt: (ts += 40_000) };
    logs[k(week, day, pair.secondary, i)] = { done: true, completedAt: (ts += 40_000) };
  }
  const coreEnd = ts;

  const tree = renderDay({ week, day, logs, currentTime: coreEnd + 30_000 });
  const card = pairCard(tree, pair);
  const barText = textOf(stickyBarOf(card));
  assert.doesNotMatch(barText, /完成 · \d+ 輪/, `bar: ${barText}`);
  assert.match(barText, /尾組 0\/\d+/, `bar: ${barText}`);

  // 長的那一方最後一個核心組底下要有休息計時，從核心輪結束（兩邊較晚者）起算
  const restText = restTextAfterSet(card, longName, core - 1);
  assert.match(restText, /休息中: 0:30/, `rest: "${restText}"`);
});

test('BUG-18: 核心輪還在 mid-round 時，tail 前不顯示休息（bar 顯示切換中）', (t) => {
  const found = findUnequalPair();
  if (!found) return t.skip('預設課表沒有組數不等的 pair');
  const { week, day, pair, aSets, bSets, longName } = found;
  const core = Math.min(aSets, bSets);
  const longId = aSets > bSets ? pair.primary : pair.secondary;
  const shortId = longId === pair.primary ? pair.secondary : pair.primary;

  const logs = {};
  let ts = T0;
  for (let i = 0; i < core; i++) {
    logs[k(week, day, longId, i)] = { done: true, completedAt: (ts += 40_000) };
    if (i < core - 1) logs[k(week, day, shortId, i)] = { done: true, completedAt: (ts += 40_000) };
  }

  const tree = renderDay({ week, day, logs, currentTime: ts + 10_000 });
  const card = pairCard(tree, pair);
  assert.match(textOf(stickyBarOf(card)), /切換中/);
  assert.equal(restTextAfterSet(card, longName, core - 1), '');
});

test('BUG-18: tail 組全部做完 → bar 顯示完成、tail 間休息顯示實際耗時', (t) => {
  const found = findUnequalPair();
  if (!found) return t.skip('預設課表沒有組數不等的 pair');
  const { week, day, pair, aSets, bSets, longName } = found;
  const core = Math.min(aSets, bSets);
  const longSets = Math.max(aSets, bSets);
  const longId = aSets > bSets ? pair.primary : pair.secondary;

  const logs = {};
  let ts = T0;
  for (let i = 0; i < core; i++) {
    logs[k(week, day, pair.primary, i)] = { done: true, completedAt: (ts += 40_000) };
    logs[k(week, day, pair.secondary, i)] = { done: true, completedAt: (ts += 40_000) };
  }
  for (let i = core; i < longSets; i++) {
    logs[k(week, day, longId, i)] = { done: true, completedAt: (ts += 90_000) };
  }

  const tree = renderDay({ week, day, logs, currentTime: ts + 5_000 });
  const card = pairCard(tree, pair);
  assert.match(textOf(stickyBarOf(card)), /✓ 完成 · \d+ 輪/);
  assert.match(restTextAfterSet(card, longName, core - 1), /休息時間: 1:30/);
});
