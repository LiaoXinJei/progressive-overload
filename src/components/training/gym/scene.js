// 健身房場景：整條背景（牆、窗、地板、燈、固定器材）先畫成一張長圖，
// 每一格只切出鏡頭看到的那段，再畫器材的活動部分和人物。
// 器材與人物的座標都在下面 64 像素高的「舞台帶」裡（FLOOR = 54）；
// top 是舞台上方多出來的牆面高度（全螢幕時畫面比較高，多出來的地方放窗戶、燈串）。

import { createBuffer, rect, setPx, blit, disk, rgb } from './pixel.js';
import { FLOOR, drawFigure, solvePose, idlePose, restPose, readyPose, cheerPose, walkPose, lerpPose, repProgress } from './rig.js';
import { stampEquip, bottle } from './equipment.js';

export const SCENE_H = 64;

const BG = {
  wall: [rgb('#2E2350'), rgb('#33285A'), rgb('#392D63'), rgb('#3F326C')],
  trim: rgb('#2B1B2E'),
  base: rgb('#5B3E6E'),
  baseTop: rgb('#7A5690'),
  floor: rgb('#C98552'),
  floorDark: rgb('#B07043'),
  floorSeam: rgb('#9A5E37'),
  floorEdge: rgb('#E3A26C'),
  frame: rgb('#2B1B2E'),
  sky: [rgb('#2A2A6E'), rgb('#4A3B8C'), rgb('#8A4E9E'), rgb('#E07A8F'), rgb('#FFB27A')],
  star: rgb('#FFF4C2'),
  city: rgb('#24204A'),
  cityLight: rgb('#FFD27A'),
  lampShade: rgb('#2B1B2E'),
  bulb: rgb('#FFE8A8'),
  wire: rgb('#2B1B2E'),
  lights: [rgb('#FFD27A'), rgb('#FF8FA3'), rgb('#7FE0D6'), rgb('#B7A6FF')],
  pot: rgb('#E07A5F'),
  potDark: rgb('#B85C46'),
  leaf: rgb('#5ACB8A'),
  leafDark: rgb('#3E9E6A'),
};

// 共用記憶體的子緩衝區：舞台帶畫在 top 之下
const band = (buf, top) => ({ w: buf.w, h: buf.h - top, px: buf.px.subarray(top * buf.w) });

const lighten = (buf, x, y, amount) => {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
  const i = y * buf.w + x;
  const c = buf.px[i];
  const k = 1 + amount;
  const r = Math.min(255, (c & 255) * k + 10 * amount);
  const g = Math.min(255, ((c >> 8) & 255) * k + 6 * amount);
  const b = Math.min(255, ((c >> 16) & 255) * k);
  buf.px[i] = ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
};

const drawRoom = (buf, floorY) => {
  // 牆：由上往下四段漸亮，交界棋盤格混色
  const bands = BG.wall.length;
  const bandH = floorY / bands;
  for (let y = 0; y < floorY; y++) {
    const b = Math.min(bands - 1, Math.floor(y / bandH));
    const inBand = y - b * bandH;
    for (let x = 0; x < buf.w; x++) {
      const dither = b < bands - 1 && inBand > bandH - 3 && (x + y) % 2 === 0;
      buf.px[y * buf.w + x] = BG.wall[dither ? b + 1 : b];
    }
  }
  rect(buf, 0, floorY - 4, buf.w, 4, BG.base);
  rect(buf, 0, floorY - 4, buf.w, 1, BG.baseTop);
  // 木地板：長條木紋，一排深一排淺
  rect(buf, 0, floorY, buf.w, buf.h - floorY, BG.floor);
  rect(buf, 0, floorY, buf.w, 1, BG.floorEdge);
  for (let y = floorY + 3; y < buf.h; y += 3) {
    rect(buf, 0, y, buf.w, 1, BG.floorSeam);
    const offset = ((y - floorY) / 3) % 2 ? 7 : 0;
    for (let x = offset; x < buf.w; x += 14) rect(buf, x, y - 2, 1, 2, BG.floorSeam);
  }
  for (let y = floorY + 1; y < buf.h; y += 6) rect(buf, 0, y, buf.w, 1, BG.floorDark);
};

// 每站背後一扇窗：傍晚天空、星星、城市剪影
const drawWindow = (buf, cx, pageW, floorY, top) => {
  const half = Math.min(24, Math.floor(pageW / 2) - 9);
  const y0 = Math.max(4, top + 4);
  const y1 = floorY - 14;
  if (y1 - y0 < 12) return;
  rect(buf, cx - half - 2, y0 - 2, half * 2 + 4, y1 - y0 + 4, BG.frame);
  const h = y1 - y0;
  for (let y = 0; y < h; y++) {
    const k = Math.min(BG.sky.length - 1, Math.floor((y / h) * BG.sky.length));
    const dither = (y / h) * BG.sky.length - k > 0.75 && k < BG.sky.length - 1;
    for (let x = -half; x < half; x++) {
      setPx(buf, cx + x, y0 + y, dither && (x + y) % 2 ? BG.sky[k + 1] : BG.sky[k]);
    }
  }
  // 星星（每站位置不同）
  for (let i = 0; i < 5; i++) {
    const sx = cx - half + 3 + ((cx * 7 + i * 13) % (half * 2 - 6));
    const sy = y0 + 2 + ((cx * 3 + i * 5) % Math.max(3, Math.floor(h / 3)));
    setPx(buf, sx, sy, BG.star);
  }
  // 城市剪影
  for (let x = -half; x < half; x++) {
    const bh = 3 + ((x * 37 + cx * 11) % 17 + 17) % 8;
    for (let y = y1 - bh; y < y1; y++) setPx(buf, cx + x, y, BG.city);
    if ((x + cx) % 3 === 0 && bh > 5) setPx(buf, cx + x, y1 - bh + 2, BG.cityLight);
  }
  // 窗格
  rect(buf, cx - 1, y0, 2, h, BG.frame);
  rect(buf, cx - half, y0 + Math.floor(h / 2), half * 2, 1, BG.frame);
  rect(buf, cx - half - 3, y1 + 2, half * 2 + 6, 2, BG.baseTop);
};

// 站和站中間放一盆植物
const drawPlant = (buf, x, floorY) => {
  rect(buf, x - 3, floorY - 6, 7, 6, BG.pot);
  rect(buf, x - 3, floorY - 6, 7, 1, BG.potDark);
  for (const [dx, dy, r] of [[-2, -9, 2.2], [2, -10, 2.4], [0, -13, 2.4], [-3, -12, 1.6], [3, -14, 1.5]]) {
    disk(buf, x + dx, floorY + dy, r, BG.leaf);
  }
  setPx(buf, x - 1, floorY - 11, BG.leafDark);
  setPx(buf, x + 2, floorY - 9, BG.leafDark);
  setPx(buf, x + 1, floorY - 13, BG.leafDark);
};

// 天花板一串彩色小燈
const drawStringLights = (buf, top) => {
  const y0 = Math.max(1, Math.floor(top * 0.35));
  for (let x = 0; x < buf.w; x++) {
    const sag = Math.sin((x / 30) * Math.PI) ** 2 * 3;
    setPx(buf, x, y0 + sag, BG.wire);
    if (x % 6 === 3) {
      const c = BG.lights[Math.floor(x / 6) % BG.lights.length];
      setPx(buf, x, y0 + sag + 1, c);
      setPx(buf, x, y0 + sag + 2, c);
    }
  }
};

// 頂燈 + 往下的光錐 + 地上的光暈
const drawLamp = (buf, cx, floorY, top) => {
  const y0 = top;
  rect(buf, cx, 0, 1, y0 + 1, BG.wire);
  rect(buf, cx - 4, y0 + 1, 9, 2, BG.lampShade);
  rect(buf, cx - 2, y0 + 3, 5, 1, BG.bulb);
  for (let y = y0 + 4; y < floorY; y++) {
    const half = 3 + (y - y0 - 4) * 0.42;
    const strength = 0.14 * (1 - (y - y0) / ((floorY - y0) * 1.6));
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const edge = Math.abs(x + 0.5 - cx) > half - 2;
      if (edge && (x + y) % 2) continue;
      lighten(buf, x, y, strength);
    }
  }
  for (let y = floorY; y < buf.h; y++) {
    for (let x = cx - 30; x <= cx + 30; x++) {
      const nx = (x + 0.5 - cx) / 30;
      const ny = (y + 0.5 - floorY) / 8;
      const d = nx * nx + ny * ny;
      if (d > 1) continue;
      if (d > 0.7 && (x + y) % 2) continue;
      lighten(buf, x, y, 0.22 * (1 - d * 0.6));
    }
  }
};

export const stationCenter = (i, pageW) => Math.round((i + 0.5) * pageW);

// 整條背景：一站一頁寬。top：舞台上方多出來的牆高（像素）
export const buildWorld = (stations, pageW, top = 0) => {
  const w = Math.max(1, Math.ceil(stations.length * pageW) + 2);
  const buf = createBuffer(w, top + SCENE_H);
  const floorY = top + FLOOR;
  drawRoom(buf, floorY);
  if (top >= 10) drawStringLights(buf, top);
  stations.forEach((st, i) => drawWindow(buf, stationCenter(i, pageW), pageW, floorY, top));
  stations.forEach((st, i) => {
    if (i > 0) drawPlant(buf, Math.round(i * pageW), floorY);
  });
  stations.forEach((st, i) => drawLamp(buf, stationCenter(i, pageW), floorY, Math.max(0, top - 6)));
  const stage = band(buf, top);
  stations.forEach((st, i) => {
    const cx = stationCenter(i, pageW);
    if (st.family.equip) stampEquip(stage, L => st.family.equip(L, cx));
  });
  return { buf, pageW, stations, top };
};

// 人物這一格的姿勢。character.mode：walk / idle / lift / rest / ready / cheer
const poseFor = (character, family, time) => {
  switch (character.mode) {
    case 'walk': return walkPose(character.walkPhase, character.facing);
    case 'lift': {
      const t = character.reduced ? 0.5 : repProgress(time);
      return { pose: lerpPose(family.start, family.end, t), t };
    }
    case 'rest': return restPose(character.reduced ? 0 : time);
    case 'ready': return readyPose(character.reduced ? 0 : time);
    case 'cheer': return cheerPose(character.reduced ? 0 : time);
    default: return idlePose(character.reduced ? 0 : time);
  }
};

// 畫一格：camX 是鏡頭左緣的世界座標（可以有小數，整數部分在這裡切，小數由 CSS 位移補）
export const renderFrame = (view, world, { camX, character, time }) => {
  const camXi = Math.floor(camX);
  blit(view, world.buf, camXi);
  const stage = band(view, world.top ?? 0);
  const { stations, pageW } = world;
  const charX = camX + pageW / 2;
  // 看得到的站，器材閒置時的部分（槓鈴在架上、配重片放下）
  stations.forEach((st, i) => {
    const cx = stationCenter(i, pageW) - camXi;
    if (cx < -pageW || cx > view.w + pageW) return;
    const inUse = character.mode === 'lift' && character.station === i;
    if (!inUse && st.family.props) stampEquip(stage, L => st.family.props(L, cx));
  });
  const station = stations[character.station];
  const x = Math.round(charX) - camXi;
  const result = poseFor(character, station?.family, time);
  const pose = result.pose ?? result;
  const s = solvePose(pose, x);
  let hooks = {};
  if (character.mode === 'lift' && station?.family.hooks) {
    hooks = station.family.hooks(s, result.t, x);
  } else if (pose.bottle !== undefined) {
    // 水壺：平常直立拿在腰前，喝的時候瓶口轉向嘴巴、瓶底抬高
    const [hx, hy] = s.armN.end;
    const tip = pose.bottle;
    hooks = { front: (buf) => stampEquip(buf, L => bottle(L, hx + 0.5 + tip * 1.2, hy - 1.2 + tip * 0.6, -tip * 2.1)) };
  }
  drawFigure(stage, s, undefined, hooks);
  return view;
};

export const createView = (w, h = SCENE_H) => createBuffer(w, h);
