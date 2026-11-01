import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Link } from 'lucide-react';
import { buildWorld, createView, renderFrame, SCENE_H } from './scene.js';
import { prefersReducedMotion } from '../../shared/Presence';

// 健身房模式的像素場景：固定在背景鋪滿整個畫面，訓練頁的內容是蓋在上面、可以往上拉的面板。
// 一個動作一台器材，左右拖曳或按兩側箭頭換站，人物走過去；點畫面（器材或人物）由上層決定開始還是完成這組。
// 鏡頭位置是元件自己的狀態（不用原生橫向捲動），放開時緩動到最近或甩動方向的下一站。

const TAP_SLOP = 8; // 拖超過 8px 就不算點
const FLICK_SPEED = 0.35; // px/ms，甩得比這快就換到下一站
const WALK_STRIDE = 0.55; // 每移動 1 像素走路循環前進多少弧度
// 一頁大約 64 像素寬：390 寬的手機一個像素 6 CSS px，人物大約 200px 高
const PAGE_ART_W = 64;

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/**
 * stations：[{ id, family, familyKey, name, setText, actionLabel, pair, done }]
 * index：選中的站；onSelect(i)：使用者換站；onTap(i)：點畫面
 * character：{ liftIndex, rest: null | { over }, finished }
 * style：容器的大小（上層決定場景露出多高）
 */
const GymScene = ({ stations, index, onSelect, onTap, character, style }) => {
  const frameRef = useRef(null);
  const canvasRef = useRef(null);
  // 畫面大小 → 每個像素幾 CSS px、一頁幾個像素寬、整張圖幾個像素高
  const [size, setSize] = useState({ scale: 0, pageW: 0, artH: 0 });

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return; // jsdom 沒有版面
      const scale = Math.max(3, Math.min(8, Math.floor(w / PAGE_ART_W)));
      const next = { scale, pageW: Math.floor(w / scale), artH: Math.max(SCENE_H, Math.ceil(h / scale)) };
      setSize(prev => (prev.scale === next.scale && prev.pageW === next.pageW && prev.artH === next.artH ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { scale, pageW, artH } = size;

  const familyKey = stations.map(s => s.familyKey).join(',');
  const world = useMemo(
    () => (pageW > 0 ? buildWorld(stations.map(s => ({ family: s.family })), pageW, artH - SCENE_H) : null),
    // 只有器材組合或畫面大小變了才重畫整條背景
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [familyKey, pageW, artH],
  );

  // 鏡頭與動畫狀態放 ref，每一格由 rAF 讀，不經過 React render
  const cam = useRef({ x: 0, from: 0, to: 0, start: 0, dur: 0, lastX: 0, phase: 0, facing: 1, placed: false });
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const live = useRef({});
  live.current = { character, stations };

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

    function tick(now) {
      raf = 0;
      if (document.hidden) return;
      raf = requestAnimationFrame(tick);
      // 面板拉上來把場景整個蓋住時不畫
      if (window.scrollY > frame.clientHeight - 40) return;
      const c = cam.current;
      const { character: ch, stations: sts } = live.current;
      const reduced = prefersReducedMotion();
      if (c.dur > 0) {
        const p = Math.min(1, (now - c.start) / c.dur);
        c.x = c.from + (c.to - c.from) * easeInOut(p);
        if (p >= 1) c.dur = 0;
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
      // 移動中、做動作、冒愛心時每格都畫；靜止的狀態大約 12fps 就夠
      const hearting = ch.doneAt && Date.now() - ch.doneAt < 1600;
      const busy = moving || mode === 'lift' || mode === 'walk' || hearting;
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

  // HUD 和點按都跟著選中的站（放開手指就換成目的地，人物還在走也一樣）
  const hudIndex = Math.max(0, Math.min(stations.length - 1, index));
  const st = stations[hudIndex];
  if (!st) return null;
  const capsule = 'rounded-full bg-black/45 backdrop-blur-md';

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
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          onTap(hudIndex);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        }}
        className="absolute inset-0 z-[1] focus-visible:outline-offset-[-6px]"
      />
      {/* 動作名、組數、第幾站：頂部 bar 下面 */}
      <div
        className="pointer-events-none absolute inset-x-4 z-[2] flex items-start justify-between gap-2"
        style={{ top: 'calc(var(--app-header-h, 56px) + 6px)' }}
      >
        <p className={`flex min-w-0 items-center gap-1.5 py-1.5 pl-3 pr-3.5 text-subhead font-semibold text-label ${capsule}`}>
          {st.pair && <Link size={14} className="shrink-0 text-label-2" aria-hidden="true" />}
          <span className="truncate">{st.name}</span>
          <span className="shrink-0 font-num font-medium tabular-nums text-label-2">{st.setText}</span>
        </p>
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
          className="absolute left-1.5 top-[55%] z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-label transition-transform duration-150 active:scale-90"
        >
          <span className={`flex h-9 w-9 items-center justify-center ${capsule}`}><ChevronLeft size={20} aria-hidden="true" /></span>
        </button>
      )}
      {hudIndex < stations.length - 1 && (
        <button
          type="button"
          aria-label={`下一台：${stations[hudIndex + 1].name}`}
          onClick={() => go(1)}
          className="absolute right-1.5 top-[55%] z-[2] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-label transition-transform duration-150 active:scale-90"
        >
          <span className={`flex h-9 w-9 items-center justify-center ${capsule}`}><ChevronRight size={20} aria-hidden="true" /></span>
        </button>
      )}
      {/* 站點：地板上，面板圓角的上方 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[40px] z-[2] flex justify-center" aria-hidden="true">
        <div className={`flex gap-1.5 px-2.5 py-1.5 ${capsule}`}>
          {stations.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ease-ios ${i === hudIndex ? 'w-4 bg-label' : `w-1.5 ${s.done ? 'bg-done' : 'bg-white/40'}`}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default GymScene;
