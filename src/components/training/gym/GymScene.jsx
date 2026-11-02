import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Link, Minus, Plus } from 'lucide-react';
import { buildWorld, createView, renderFrame, stationCenter, SCENE_H } from './scene.js';
import { FLOOR } from './rig.js';
import { TREE_SLOTS, MAX_DRAWN_PLATES, plateStep } from './equipment.js';
import { prefersReducedMotion } from '../../shared/Presence';

// 健身房模式的像素場景：固定在背景鋪滿整個畫面，訓練頁的內容是蓋在上面、平常收起來的面板。
// 一個動作一台器材，左右拖曳或按兩側箭頭換站，人物走過去；點畫面（器材或人物）由上層決定開始還是完成這組。
// 這組的重量、次數、組數都在場景上改：點槓片架加重、點槓鈴或「卸」卸一片，下排改次數和加一組，不跳鍵盤。
// 鏡頭位置是元件自己的狀態（不用原生橫向捲動），放開時緩動到最近或甩動方向的下一站。

const TAP_SLOP = 8; // 拖超過 8px 就不算點
const FLICK_SPEED = 0.35; // px/ms，甩得比這快就換到下一站
const WALK_STRIDE = 0.55; // 每移動 1 像素走路循環前進多少弧度
// 一頁大約 64 像素寬：390 寬的手機一個像素 6 CSS px，人物大約 200px 高
const PAGE_ART_W = 64;
// 下排控制項（44px）上下各留一點：地板線至少要在面板上緣再往上這麼高
const CONTROLS_ROOM = 60;
// 重量膠囊底緣的高度（舞台座標）：站著的人物頭頂大約在 22
const CHIP_Y = 19;

const HINT_TONE = { rest: 'text-rest', done: 'text-done', accent: 'text-accent-text', default: 'text-label-2' };
const PIP_TONE = { done: 'bg-done', current: 'bg-accent', skipped: 'bg-white/15', pending: 'bg-white/35' };

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const kgText = (kg) => String(Math.round(kg * 100) / 100);

/**
 * stations：[{ id, family, familyKey, name, actionLabel, pair }]
 * index：選中的站；onSelect(i)：使用者換站；onTap(i)：點畫面
 * character：{ liftIndex, rest: null | { over }, finished, doneAt }
 * style：容器的大小；bottomInset：面板收起來時露出的高度（下排控制項放在它上面）
 * hud：選中那站的控制項
 *   { hint, hintTone, lifting,
 *     weight: null | { text, plates, unloadKg, setNo },
 *     reps: null | { value, explicit, recent, setNo },
 *     sets: { label, pips: ['done' | 'current' | 'pending' | 'skipped'], canAdd },
 *     next: null | { name } }
 * onPlate(kg) / onUnload() / onReps(delta) / onAddSet() / onNext()
 */
const GymScene = ({
  stations, index, onSelect, onTap, character, style, bottomInset = 0,
  hud, onPlate, onUnload, onReps, onAddSet, onNext,
}) => {
  const frameRef = useRef(null);
  const canvasRef = useRef(null);
  const anchorsRef = useRef(null);
  // 畫面大小 → 每個像素幾 CSS px、一頁幾個像素寬、整張圖幾個像素高、舞台下面多幾排地板
  const [size, setSize] = useState({ scale: 0, pageW: 0, artH: 0, bottomRows: 0 });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return; // jsdom 沒有版面
      const scale = Math.max(3, Math.min(8, Math.floor(w / PAGE_ART_W)));
      const bottomRows = Math.max(0, Math.ceil((bottomInset + CONTROLS_ROOM) / scale) - (SCENE_H - FLOOR));
      const artH = Math.max(SCENE_H + bottomRows, Math.ceil(h / scale));
      const next = { scale, pageW: Math.floor(w / scale), artH, bottomRows };
      setSize(prev => (prev.scale === next.scale && prev.pageW === next.pageW && prev.artH === next.artH && prev.bottomRows === next.bottomRows ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [bottomInset]);
  const { scale, pageW, artH, bottomRows } = size;

  const familyKey = stations.map(s => s.familyKey).join(',');
  const world = useMemo(
    () => (pageW > 0 ? buildWorld(stations.map(s => ({ family: s.family })), pageW, artH - SCENE_H - bottomRows, bottomRows) : null),
    // 只有器材組合或畫面大小變了才重畫整條背景
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [familyKey, pageW, artH, bottomRows],
  );

  // HUD 和點按都跟著選中的站（放開手指就換成目的地，人物還在走也一樣）
  const hudIndex = Math.max(0, Math.min(stations.length - 1, index));

  // 鏡頭與動畫狀態放 ref，每一格由 rAF 讀，不經過 React render
  const cam = useRef({ x: 0, from: 0, to: 0, start: 0, dur: 0, lastX: 0, phase: 0, facing: 1, placed: false });
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const live = useRef({});
  live.current = { character, stations, hudIndex, plates: hud?.weight?.plates };

  const target = (i) => i * pageW;
  const animateTo = (i) => {
    const c = cam.current;
    const to = target(i);
    if (prefersReducedMotion() || !c.placed) {
      Object.assign(c, { x: to, from: to, to, dur: 0, placed: true });
      return;
    }
    const dist = Math.abs(to - c.x) / Math.max(1, pageW);
    Object.assign(c, { from: c.x, to, start: performance.now(), dur: Math.min(1400, 380 + dist * 420) });
  };

  // 上層換了選中的站（自動跟著目前這組、換天）就走過去
  useEffect(() => {
    if (!world) return;
    const c = cam.current;
    if (drag.current?.moved) return;
    if (Math.abs(c.to - target(index)) > 0.01 || !c.placed) animateTo(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, world]);
  // 畫面大小變了：一頁的寬度跟著變，直接定位到選中的站
  useEffect(() => {
    if (!pageW) return;
    const to = target(index);
    Object.assign(cam.current, { x: to, from: to, to, lastX: to, dur: 0, placed: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageW]);

  // ==================== 每一格 ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!world || !canvas) return undefined;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return undefined;
    const view = createView(pageW + 2, world.buf.h);
    const image = ctx.createImageData(view.w, view.h);
    let raf = 0;
    let lastDraw = 0;
    let lastPlates = null;
    let lastOffset = null;

    function tick(now) {
      raf = 0;
      if (document.hidden) return;
      raf = requestAnimationFrame(tick);
      // 面板拉上來把場景整個蓋住時不畫
      if (window.scrollY > frame.clientHeight - 40) return;
      const c = cam.current;
      const { character: ch, stations: sts, hudIndex: hi, plates } = live.current;
      const reduced = prefersReducedMotion();
      if (c.dur > 0) {
        const p = Math.min(1, (now - c.start) / c.dur);
        c.x = c.from + (c.to - c.from) * easeInOut(p);
        if (p >= 1) c.dur = 0;
      }
      // 槓片按鈕、重量跟著選中那站在畫面上的位置走（鏡頭還在走就跟著滑進來）
      const offset = Math.round((target(hi) - c.x) * scale * 10) / 10;
      if (offset !== lastOffset && anchorsRef.current) {
        anchorsRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
        lastOffset = offset;
      }
      const dx = c.x - c.lastX;
      c.lastX = c.x;
      const moving = Math.abs(dx) > 0.01 || drag.current?.moved;
      if (Math.abs(dx) > 0.01) {
        c.phase += Math.abs(dx) * WALK_STRIDE;
        c.facing = dx > 0 ? 1 : -1;
      }
      const nearest = Math.max(0, Math.min(sts.length - 1, Math.round(c.x / pageW)));
      const atStation = !moving && Math.abs(c.x - nearest * pageW) < 0.5;
      let mode = 'walk';
      if (atStation || reduced) {
        if (ch.liftIndex === nearest) mode = 'lift';
        else if (ch.finished) mode = 'cheer';
        else if (ch.rest) mode = ch.rest.over ? 'ready' : 'rest';
        else mode = 'idle';
      }
      // 移動中、做動作、冒愛心、剛換槓片時每格都畫；靜止的狀態大約 12fps 就夠
      const hearting = ch.doneAt && Date.now() - ch.doneAt < 1600;
      const platesChanged = plates !== lastPlates;
      lastPlates = plates;
      const busy = moving || mode === 'lift' || mode === 'walk' || hearting || platesChanged;
      if (!busy && now - lastDraw < 80) return;
      lastDraw = now;
      renderFrame(view, world, {
        camX: c.x,
        time: now / 1000,
        character: {
          mode, station: nearest, walkPhase: c.phase, facing: c.facing, reduced,
          // 完成一組後 1.6 秒內頭上冒愛心
          heart: ch.doneAt ? (Date.now() - ch.doneAt) / 1600 : null,
        },
        plates: plates ? { index: hi, list: plates } : null,
        pad: 1,
      });
      image.data.set(view.bytes);
      ctx.putImageData(image, 0, 0);
      canvas.style.transform = `translate3d(${-(c.x - Math.floor(c.x)) * scale}px, 0, 0)`;
    }
    const restart = () => { if (!document.hidden && !raf) raf = requestAnimationFrame(tick); };
    document.addEventListener('visibilitychange', restart);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', restart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  // ==================== 拖曳 ====================
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const c = cam.current;
    c.dur = 0; // 正在走的話停在原地讓使用者接手
    suppressClick.current = false;
    drag.current = { id: e.pointerId, x0: e.clientX, cam0: c.x, moved: false, samples: [{ x: e.clientX, t: e.timeStamp }] };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !scale) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < TAP_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    const max = (stations.length - 1) * pageW;
    let x = d.cam0 - dx / scale;
    // 頭尾拉過頭有阻力
    if (x < 0) x /= 3;
    if (x > max) x = max + (x - max) / 3;
    cam.current.x = x;
    d.samples.push({ x: e.clientX, t: e.timeStamp });
    if (d.samples.length > 5) d.samples.shift();
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    suppressClick.current = true;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const v = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    const startIdx = Math.round(d.cam0 / pageW);
    let next = Math.round(cam.current.x / pageW);
    if (Math.abs(v) > FLICK_SPEED && next === startIdx) next = startIdx + (v < 0 ? 1 : -1);
    next = Math.max(0, Math.min(stations.length - 1, next));
    const c = cam.current;
    Object.assign(c, { from: c.x, to: target(next), start: performance.now(), dur: prefersReducedMotion() ? 0 : 420 });
    if (c.dur === 0) c.x = c.to;
    if (next !== index) onSelect(next);
  };

  const go = (delta) => {
    const next = Math.max(0, Math.min(stations.length - 1, index + delta));
    if (next !== index) onSelect(next);
  };
  // 拖曳換站放開時不算點（拖曳是從按鈕上開始的也一樣）
  const tapped = (fn) => () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    fn();
  };
  // 下排和重量膠囊不拿來拖曳換站：連按 + / − 時手指稍微滑一下也不會換站
  const keepPointer = (e) => e.stopPropagation();

  // 點槓片：重量旁邊飄一個「+20」
  const [floats, setFloats] = useState([]);
  const floatId = useRef(0);
  const showFloat = (text) => {
    const id = ++floatId.current;
    setFloats(list => [...list.slice(-2), { id, text }]);
    setTimeout(() => setFloats(list => list.filter(f => f.id !== id)), 750);
  };

  const st = stations[hudIndex];
  if (!st) return null;
  const capsule = 'rounded-full bg-black/45 backdrop-blur-md';
  const weight = hud?.weight ?? null;
  const reps = hud?.reps ?? null;
  const sets = hud?.sets ?? null;
  const rule = st.family.load ?? { bar: 0, sides: 1 };

  // 像素座標 → 畫面位置（以選中那站停好時為準，鏡頭在走的時候整層由 rAF 平移）
  const geo = world && scale ? { rel: stationCenter(hudIndex, pageW) - hudIndex * pageW - pageW / 2 } : null;
  const at = (dx, y) => (geo
    ? { left: `calc(50% + ${(geo.rel + dx) * scale}px)`, bottom: (SCENE_H + bottomRows - y) * scale }
    : undefined);
  const tree = world?.trees?.[hudIndex];
  const treeDx = tree ? tree.x + 1 - stationCenter(hudIndex, pageW) : null;
  const bar = st.family.bar;
  const barPlates = weight?.plates?.length ?? 0;
  // 槓上那疊槓片的中心（EZ 槓的槓片畫小一點、間距也小）
  const barStep = plateStep(rule.bar === 10 ? 2.4 / 3.6 : 1);
  const barCenter = bar ? [bar[0] + (Math.max(0, Math.min(MAX_DRAWN_PLATES, barPlates) - 1) * barStep) / 2, bar[1]] : null;
  // 重量膠囊：放在槓片架那一側、貼齊畫面邊緣，高度在人物頭頂上面（不壓到人物和做動作的手）
  const chipAt = geo && tree
    ? { [tree.flip ? 'left' : 'right']: 12, bottom: (SCENE_H + bottomRows - CHIP_Y) * scale }
    : undefined;
  const plateTap = (kg) => tapped(() => {
    showFloat(`+${kgText(kg * rule.sides)}`);
    onPlate?.(kg);
  });
  const unloadTap = tapped(() => {
    if (!weight?.unloadKg) return;
    showFloat(`−${kgText(weight.unloadKg * rule.sides)}`);
    onUnload?.();
  });
  const sideNote = rule.sides === 2 ? '，兩邊各一片' : '';

  return (
    <section
      ref={frameRef}
      aria-label="健身房"
      data-gym-scene
      className="fixed inset-x-0 top-0 z-0 mx-auto max-w-[480px] touch-pan-y select-none overflow-hidden bg-canvas"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { drag.current = null; }}
    >
      <canvas
        ref={canvasRef}
        width={pageW + 2}
        height={artH || SCENE_H}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 will-change-transform [image-rendering:pixelated]"
        style={{ width: (pageW + 2) * scale, height: (artH || SCENE_H) * scale, marginLeft: -(pageW * scale) / 2 - scale }}
      />
      {/* 點畫面 = 開始 / 完成這組（文字由上層依狀態給） */}
      <button
        type="button"
        data-gym-action
        aria-label={st.actionLabel}
        aria-describedby="gym-hint"
        onClick={tapped(() => onTap(hudIndex))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        }}
        className="absolute inset-0 z-[1] focus-visible:outline-offset-[-6px]"
      />

      {/* ==================== 跟著器材的按鈕：槓片架、槓鈴、重量 ==================== */}
      <div ref={anchorsRef} className="pointer-events-none absolute inset-0 z-[2] will-change-transform">
        {weight && TREE_SLOTS.map(slot => (
          <button
            key={slot.kg}
            type="button"
            data-plate={slot.kg}
            aria-label={`掛上 ${kgText(slot.kg)} 公斤槓片${sideNote}`}
            onClick={plateTap(slot.kg)}
            className="pointer-events-auto absolute h-10 w-10 -translate-x-1/2 translate-y-1/2 rounded-full transition-[transform,background-color] duration-150 active:scale-90 active:bg-white/20"
            style={treeDx != null ? at(treeDx + (tree.flip ? -slot.dx : slot.dx), FLOOR + slot.dy) : undefined}
          />
        ))}
        {weight && bar && !hud.lifting && weight.unloadKg != null && (
          <button
            type="button"
            data-gym-bar
            aria-label={`卸下 ${kgText(weight.unloadKg)} 公斤槓片${sideNote}`}
            onClick={unloadTap}
            className="pointer-events-auto absolute h-11 w-11 -translate-x-1/2 translate-y-1/2 rounded-full transition-transform duration-150 active:scale-90"
            style={barCenter ? at(barCenter[0], barCenter[1]) : undefined}
          />
        )}
        {weight && (
          <div
            data-gym-weight
            className="pointer-events-auto absolute flex items-center gap-1"
            style={chipAt}
            onPointerDown={keepPointer}
          >
            <div className={`flex items-center py-1 pl-3 ${weight.unloadKg != null ? 'pr-1.5' : 'pr-3'} ${capsule}`}>
              <p className="flex items-baseline" aria-label={`第 ${weight.setNo} 組重量 ${weight.text || '未填'} 公斤`}>
                <span className={`font-num text-title3 font-bold tabular-nums ${weight.text ? 'text-label' : 'text-label-3'}`}>{weight.text || '—'}</span>
                <span className="ml-0.5 text-footnote font-semibold text-label-2">kg</span>
              </p>
              {weight.unloadKg != null && (
                <button
                  type="button"
                  data-gym-unload
                  aria-label={`卸下 ${kgText(weight.unloadKg)} 公斤槓片${sideNote}`}
                  onClick={unloadTap}
                  className="relative ml-2 flex h-7 items-center rounded-full bg-white/[0.12] px-2.5 text-footnote font-semibold text-label transition-colors duration-150 after:absolute after:-inset-2 after:content-[''] active:bg-white/25"
                >
                  卸 <span className="ml-0.5 font-num tabular-nums">{kgText(weight.unloadKg)}</span>
                </button>
              )}
            </div>
            {floats.map(f => (
              <span
                key={f.id}
                aria-hidden="true"
                className={`plate-float pointer-events-none absolute -top-5 right-0 font-num text-body font-bold tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${f.text.startsWith('+') ? 'text-done' : 'text-rest'}`}
              >
                {f.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ==================== 動作名、提示、第幾站：頂部 bar 下面 ==================== */}
      <div
        className="pointer-events-none absolute inset-x-4 z-[3] flex items-start justify-between gap-2"
        style={{ top: 'calc(var(--app-header-h, 56px) + 6px)' }}
      >
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <p className={`flex max-w-full items-center gap-1.5 py-1.5 pl-3 pr-3.5 text-subhead font-semibold text-label ${capsule}`}>
            {st.pair && <Link size={14} className="shrink-0 text-label-2" aria-hidden="true" />}
            <span className="truncate">{st.name}</span>
          </p>
          <p id="gym-hint" className={`max-w-full truncate px-3 py-1.5 text-footnote font-semibold ${HINT_TONE[hud?.hintTone] ?? HINT_TONE.default} ${capsule}`}>
            {hud?.hint}
          </p>
        </div>
        <p className={`shrink-0 px-3 py-1.5 font-num text-subhead font-semibold tabular-nums text-label-2 ${capsule}`}>
          {hudIndex + 1} / {stations.length}
        </p>
      </div>

      {/* 左右換站 */}
      {hudIndex > 0 && (
        <button
          type="button"
          aria-label={`上一台：${stations[hudIndex - 1].name}`}
          onClick={() => go(-1)}
          className="absolute left-1.5 top-[40%] z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-label transition-transform duration-150 active:scale-90"
        >
          <span className={`flex h-9 w-9 items-center justify-center ${capsule}`}><ChevronLeft size={20} aria-hidden="true" /></span>
        </button>
      )}
      {hudIndex < stations.length - 1 && (
        <button
          type="button"
          aria-label={`下一台：${stations[hudIndex + 1].name}`}
          onClick={() => go(1)}
          className="absolute right-1.5 top-[40%] z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-label transition-transform duration-150 active:scale-90"
        >
          <span className={`flex h-9 w-9 items-center justify-center ${capsule}`}><ChevronRight size={20} aria-hidden="true" /></span>
        </button>
      )}

      {/* ==================== 下排：組數、次數（地板上，面板上緣的上面） ==================== */}
      <div
        data-gym-controls
        className="absolute inset-x-3 z-[3] flex items-center justify-between gap-2"
        style={{ bottom: bottomInset + 8 }}
        onPointerDown={keepPointer}
      >
        {/* 這站做完了：左邊換成下一台 */}
        {hud?.next ? (
          <button
            type="button"
            onClick={onNext}
            className={`flex h-11 min-w-0 items-center gap-1 pl-3.5 pr-2.5 text-subhead font-semibold text-label transition-transform duration-150 active:scale-[0.97] ${capsule}`}
          >
            <span className="truncate">下一台：{hud.next.name}</span>
            <ChevronRight size={18} className="shrink-0 text-label-2" aria-hidden="true" />
          </button>
        ) : (
          sets && (
            <div className={`flex h-11 min-w-0 items-center gap-2 pl-3.5 ${sets.canAdd ? 'pr-1.5' : 'pr-3.5'} ${capsule}`}>
              <span className="shrink-0 text-subhead font-semibold text-label">{sets.label}</span>
              <span className="flex min-w-0 gap-1" aria-hidden="true">
                {sets.pips.map((p, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={i} data-gym-pip={p} className={`h-2 w-2 shrink-0 rounded-full ${PIP_TONE[p] ?? PIP_TONE.pending}`} />
                ))}
              </span>
              {sets.canAdd && (
                <button
                  type="button"
                  aria-label="加一組"
                  onClick={onAddSet}
                  className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.12] text-label transition-colors duration-150 after:absolute after:-inset-1.5 after:content-[''] active:bg-white/25"
                >
                  <Plus size={17} aria-hidden="true" />
                </button>
              )}
            </div>
          )
        )}
        {reps && (
          <div
            role="group"
            aria-label={`${reps.recent ? '剛剛' : ''}第 ${reps.setNo} 組次數`}
            className={`flex h-11 shrink-0 items-center ${reps.recent ? 'pl-3 ring-[1.5px] ring-inset ring-rest' : ''} ${capsule}`}
          >
            {reps.recent && <span className="text-caption font-semibold text-label-2">剛剛</span>}
            <button
              type="button"
              data-gym-reps="-1"
              aria-label={`第 ${reps.setNo} 組次數減一`}
              disabled={reps.value <= 1}
              onClick={() => onReps?.(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-label transition-colors duration-150 active:bg-white/[0.12] disabled:text-label-3"
            >
              <Minus size={18} aria-hidden="true" />
            </button>
            <span data-gym-reps-value aria-live="polite" className="min-w-[3.25rem] text-center">
              <span className={`font-num text-title3 font-bold tabular-nums ${reps.explicit ? 'text-label' : 'text-label-2'}`}>{reps.value}</span>
              <span className="ml-0.5 text-footnote font-semibold text-label-2">下</span>
            </span>
            <button
              type="button"
              data-gym-reps="1"
              aria-label={`第 ${reps.setNo} 組次數加一`}
              onClick={() => onReps?.(1)}
              className="flex h-11 w-11 items-center justify-center rounded-full text-label transition-colors duration-150 active:bg-white/[0.12]"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default GymScene;
