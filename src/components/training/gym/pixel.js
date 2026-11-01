// 像素緩衝區與繪圖基本元件。純函式、不碰 DOM，Node 裡也能跑（測試直接畫到緩衝區檢查）。
// 一格一個像素，Uint32 存 ABGR（little-endian 的 ImageData 排列），0 是透明。

export const rgb = (hex, alpha = 255) => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
};

export const createBuffer = (w, h) => {
  const bytes = new Uint8ClampedArray(w * h * 4);
  return { w, h, bytes, px: new Uint32Array(bytes.buffer) };
};

export const clear = (buf, c = 0) => buf.px.fill(c);

export const setPx = (buf, x, y, c) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= buf.w || iy >= buf.h) return;
  buf.px[iy * buf.w + ix] = c;
};

export const getPx = (buf, x, y) => {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return 0;
  return buf.px[y * buf.w + x];
};

export const rect = (buf, x, y, w, h, c) => {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(buf.w, Math.round(x + w));
  const y1 = Math.min(buf.h, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    buf.px.fill(c, yy * buf.w + x0, yy * buf.w + Math.max(x0, x1));
  }
};

// 以像素中心判斷落在形狀內的格子。r 用小數控制粗細（1.5 ≈ 3 格寬）
const eachPixelIn = (buf, minX, minY, maxX, maxY, test, c) => {
  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(buf.w - 1, Math.ceil(maxX));
  const y1 = Math.min(buf.h - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (test(x + 0.5, y + 0.5)) buf.px[y * buf.w + x] = c;
    }
  }
};

export const disk = (buf, cx, cy, r, c) => {
  const r2 = r * r;
  eachPixelIn(buf, cx - r, cy - r, cx + r, cy + r, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r2, c);
};

// 粗線段（兩端圓頭），肢體、槓、纜繩都用它
export const capsule = (buf, x1, y1, x2, y2, r, c) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-6;
  const r2 = r * r;
  eachPixelIn(
    buf,
    Math.min(x1, x2) - r, Math.min(y1, y2) - r, Math.max(x1, x2) + r, Math.max(y1, y2) + r,
    (x, y) => {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      return (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2 <= r2;
    },
    c,
  );
};

// 凸或凹多邊形都可以（奇偶規則）
export const polygon = (buf, pts, c) => {
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  eachPixelIn(buf, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }, c);
};

// 1px 直線（Bresenham），纜繩、細槓
export const line = (buf, x1, y1, x2, y2, c) => {
  let x = Math.floor(x1);
  let y = Math.floor(y1);
  const xe = Math.floor(x2);
  const ye = Math.floor(y2);
  const dx = Math.abs(xe - x);
  const dy = -Math.abs(ye - y);
  const sx = x < xe ? 1 : -1;
  const sy = y < ye ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 512; i++) {
    setPx(buf, x, y, c);
    if (x === xe && y === ye) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
};

// 把一層（透明底的暫存緩衝區）蓋到 dst 上，外圍自動描 1px 邊。
// 分層描邊：後面的手腳、身體、前面的手腳各自一層，前面的肢體壓在身體上也有一圈邊分開
export const stamp = (dst, layer, outline, ox = 0, oy = 0) => {
  const { w, h, px } = layer;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (px[i]) continue;
      if (!outline) continue;
      if ((x > 0 && px[i - 1]) || (x < w - 1 && px[i + 1]) || (y > 0 && px[i - w]) || (y < h - 1 && px[i + w])) {
        setPx(dst, x + ox, y + oy, outline);
      }
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = px[y * w + x];
      if (c) setPx(dst, x + ox, y + oy, c);
    }
  }
};

// 從大張緩衝區（整個健身房背景）切一段貼到畫面緩衝區；sx 可以是負的或超出右邊，超出的地方透明
export const blit = (dst, src, sx, sy = 0) => {
  const dx = Math.max(0, -sx);
  const from = Math.max(0, sx);
  const w = Math.min(dst.w - dx, src.w - from);
  for (let y = 0; y < dst.h; y++) {
    dst.px.fill(0, y * dst.w, (y + 1) * dst.w);
    if (w <= 0) continue;
    const row = (y + sy) * src.w + from;
    dst.px.set(src.px.subarray(row, row + w), y * dst.w + dx);
  }
};
