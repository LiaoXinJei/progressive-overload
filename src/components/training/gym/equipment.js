// 器材的像素元件。全部畫進一個暫存圖層，畫完用 stampEquip 自動描邊蓋到目標上。
// 座標跟人物一樣：x 是畫面絕對座標（呼叫端自己加站點中心），y 是畫面絕對座標。

import { createBuffer, clear, rect, disk, capsule, polygon, line, stamp, rgb } from './pixel.js';

export const EQ = {
  outline: rgb('#2B1B2E'),
  metal: rgb('#C3C8E0'),
  metalLight: rgb('#FFFFFF'),
  metalDark: rgb('#8A90B4'),
  frame: rgb('#5B60A0'),
  frameLight: rgb('#7F86CC'),
  pad: rgb('#FF7A7A'),
  padLight: rgb('#FFA8A0'),
  plate: rgb('#3A86FF'),
  plateRim: rgb('#7DB0FF'),
  plateHub: rgb('#FFFFFF'),
  cable: rgb('#E6E8F5'),
  stack: rgb('#8A8FC0'),
  stackLight: rgb('#A9AEDC'),
  bottle: rgb('#5FE0D0'),
  bottleCap: rgb('#FFFFFF'),
};

let eqLayer = null;
export const equipLayer = (w, h) => {
  if (!eqLayer || eqLayer.w !== w || eqLayer.h !== h) eqLayer = createBuffer(w, h);
  clear(eqLayer);
  return eqLayer;
};

// 畫一組器材：draw(L) 畫進暫存層，再描邊蓋上去
export const stampEquip = (buf, draw) => {
  const L = equipLayer(buf.w, buf.h);
  draw(L);
  stamp(buf, L, EQ.outline);
};

// 直立的柱子（左邊一排亮面）
export const post = (L, x, yTop, yBottom, w = 2, c = EQ.frame, hi = EQ.frameLight) => {
  rect(L, x, yTop, w, yBottom - yTop, c);
  rect(L, x, yTop, 1, yBottom - yTop, hi);
};

// 橫桿
export const beam = (L, x1, x2, y, h = 2, c = EQ.frame, hi = EQ.frameLight) => {
  rect(L, Math.min(x1, x2), y, Math.abs(x2 - x1), h, c);
  rect(L, Math.min(x1, x2), y, Math.abs(x2 - x1), 1, hi);
};

// 斜的墊子 / 框架：兩點連成的粗條，上緣一排亮面
export const slab = (L, x1, y1, x2, y2, r, c = EQ.pad, hi = EQ.padLight) => {
  capsule(L, x1, y1, x2, y2, r, c);
  capsule(L, x1, y1 - r * 0.6, x2, y2 - r * 0.6, Math.max(0.6, r * 0.35), hi);
};

// 平板凳：墊子 + 兩支腳
export const flatBench = (L, x0, x1, topY) => {
  rect(L, x0, topY, x1 - x0, 3, EQ.pad);
  rect(L, x0, topY, x1 - x0, 1, EQ.padLight);
  const floorY = 54;
  post(L, x0 + 2, topY + 3, floorY, 2, EQ.frame, EQ.frameLight);
  post(L, x1 - 4, topY + 3, floorY, 2, EQ.frame, EQ.frameLight);
  beam(L, x0 + 1, x0 + 6, floorY - 1, 1);
  beam(L, x1 - 6, x1 - 1, floorY - 1, 1);
};

// 側面看槓鈴：看到槓片的正面（圓），槓心一點亮
export const plateSide = (L, cx, cy, r = 4.5) => {
  disk(L, cx, cy, r, EQ.plate);
  disk(L, cx, cy, r - 1, EQ.plateRim);
  disk(L, cx, cy, r - 1.8, EQ.plate);
  disk(L, cx, cy, 1, EQ.plateHub);
};

// 側面看啞鈴：小圓頭
export const dumbbellSide = (L, cx, cy) => {
  disk(L, cx, cy, 2.3, EQ.plate);
  disk(L, cx, cy, 1.2, EQ.plateRim);
  disk(L, cx, cy, 0.6, EQ.plateHub);
};

// 正面看啞鈴：橫的握把 + 兩端方頭
export const dumbbellFront = (L, cx, cy, vertical = false) => {
  if (vertical) {
    rect(L, cx - 0.5, cy - 2, 1, 4, EQ.metal);
    rect(L, cx - 1.5, cy - 3.5, 3, 2, EQ.plate);
    rect(L, cx - 1.5, cy + 1.5, 3, 2, EQ.plate);
    return;
  }
  rect(L, cx - 2, cy - 0.5, 4, 1, EQ.metal);
  rect(L, cx - 3.5, cy - 1.5, 2, 3, EQ.plate);
  rect(L, cx + 1.5, cy - 1.5, 2, 3, EQ.plate);
};

// 配重片：n 片，上面 lifted 片被拉起 lift 格
export const weightStack = (L, x, yBottom, n = 6, lift = 0, lifted = 2, w = 6) => {
  for (let i = 0; i < n; i++) {
    const y = yBottom - (i + 1) * 2 - (i >= n - lifted ? Math.round(lift) : 0);
    rect(L, x, y, w, 2, i % 2 ? EQ.stack : EQ.stackLight);
  }
  // 導桿
  line(L, x + 1, yBottom - n * 2 - 8, x + 1, yBottom, EQ.metalDark);
  line(L, x + w - 2, yBottom - n * 2 - 8, x + w - 2, yBottom, EQ.metalDark);
};

// 纜繩
export const cableLine = (L, x1, y1, x2, y2) => line(L, x1, y1, x2, y2, EQ.cable);

// 滑輪
export const pulley = (L, x, y) => {
  disk(L, x, y, 1.8, EQ.metalDark);
  disk(L, x, y, 0.8, EQ.metalLight);
};

// 水壺（休息時拿在手上）
export const bottle = (L, x, y, angle = 0) => {
  const dx = Math.sin(angle) * 2.5;
  const dy = -Math.cos(angle) * 2.5;
  capsule(L, x - dx, y - dy, x + dx, y + dy, 1.3, EQ.bottle);
  disk(L, x + dx * 1.3, y + dy * 1.3, 0.8, EQ.bottleCap);
};

export { polygon, capsule, disk, rect, line };
