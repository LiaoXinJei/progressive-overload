// 像素人物骨架：側面與正面兩種視角。
// 姿勢只描述「髖在哪、軀幹角度、手腳往哪」，關節位置由正向運動學算；
// 手腳也可以給目標點（{ ik: [dx, y], bend }），用兩段 IK 解出手肘 / 膝蓋，手腳才能釘在槓、踏板上。
// 角度單位是度：0 朝下、90 朝前（側面是人物面向的方向，正面是畫面右邊）、180 朝上。
// 座標：x 是相對站點中心的位移，y 是畫面絕對座標（地板 FLOOR）。

import { createBuffer, clear, capsule, disk, polygon, stamp, rgb } from './pixel.js';

export const FLOOR = 54;

export const DIM = {
  torso: 9,
  neck: 0.3,
  headR: 5.2, // Q 版大頭
  upperArm: 5,
  foreArm: 4.6,
  thigh: 6,
  shin: 6,
  foot: 2.8,
  shoulderHalf: 3.6, // 正面肩寬一半
  hipHalf: 2.1,
};

export const PALETTE = {
  outline: rgb('#2B1B2E'),
  skin: rgb('#FFD9B8'),
  skinShade: rgb('#F0AE8C'),
  hair: rgb('#5B3A29'),
  hairLight: rgb('#7A5139'),
  eye: rgb('#2B1B2E'),
  eyeLight: rgb('#FFFFFF'),
  blush: rgb('#FF8FA3'),
  shirt: rgb('#FF6F91'),
  shirtShade: rgb('#E0567A'),
  shorts: rgb('#3E4A86'),
  shortsShade: rgb('#323C6E'),
  shoe: rgb('#FFFFFF'),
  shoeShade: rgb('#D6D3E8'),
};

const RAD = Math.PI / 180;
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

// ==================== 內插 ====================

export const lerpPose = (a, b, t) => {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => lerpPose(v, b[i], t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const k of Object.keys(a)) out[k] = k in b ? lerpPose(a[k], b[k], t) : a[k];
    return out;
  }
  return a;
};

// 兩段 IK：從 root 伸到 target，回傳中間關節。bend 決定關節往哪一側彎
const solveIK = (root, target, l1, l2, bend) => {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const dist = Math.hypot(dx, dy) || 1e-6;
  const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const a = Math.acos(cosA) * bend;
  const ux = dx / dist;
  const uy = dy / dist;
  const mid = [root[0] + (ux * Math.cos(a) - uy * Math.sin(a)) * l1, root[1] + (ux * Math.sin(a) + uy * Math.cos(a)) * l1];
  // 伸不到時手停在伸直的位置，不會被拉長
  const end = dist > l1 + l2 - 0.01 ? [root[0] + ux * (l1 + l2 - 0.01), root[1] + uy * (l1 + l2 - 0.01)] : target;
  return [mid, end];
};

// 一段肢體：角度 [上段, 下段, 末端?] 或 { ik: [dx, y], bend }
const solveLimb = (root, spec, l1, l2, dir, toPoint, flip) => {
  if (Array.isArray(spec)) {
    const mid = add(root, dir(spec[0]), l1);
    const end = add(mid, dir(spec[1]), l2);
    return { mid, end, tipAngle: spec[2] };
  }
  const [mid, end] = solveIK(root, toPoint(spec.ik), l1, l2, (spec.bend ?? 1) * flip);
  return { mid, end, tipAngle: spec.foot };
};

// ==================== 側面 ====================

export const solveSide = (pose, cx) => {
  const f = pose.facing ?? 1;
  const dir = (a) => [Math.sin(a * RAD) * f, Math.cos(a * RAD)];
  const toPoint = ([dx, y]) => [cx + dx * f, y];
  const hip = toPoint(pose.hip);
  const torso = pose.torso ?? 180;
  const up = dir(torso);
  const neck = add(hip, up, DIM.torso);
  const shoulder = add(hip, up, DIM.torso - 1.3);
  const headUp = dir(torso + (pose.tilt ?? 0));
  const head = add(neck, headUp, DIM.neck + DIM.headR - 0.6);
  const forward = dir(torso + (pose.tilt ?? 0) - 90);
  // 後側肩、髖往背後挪一點，前後兩隻手腳才分得出來
  const back = dir(torso - 90).map(v => -v);
  const shoulderN = add(shoulder, back, 0.6);
  const shoulderF = add(shoulder, back, 1.4);
  const hipF = add(hip, back, 0.8);

  // armRel：手的角度相對軀幹（背伸展、北歐腿彎舉這類整個身體在轉的動作，手才會跟著身體）
  const rel = (spec) => (pose.armRel && Array.isArray(spec) ? spec.map(a => a + torso - 180) : spec);
  const arm = (root, spec) => solveLimb(root, rel(spec), DIM.upperArm, DIM.foreArm, dir, toPoint, f);
  const leg = (root, spec) => {
    const l = solveLimb(root, spec, DIM.thigh, DIM.shin, dir, toPoint, f);
    const shinAngle = Math.atan2((l.end[0] - l.mid[0]) * f, l.end[1] - l.mid[1]) / RAD;
    const toe = add(l.end, dir(l.tipAngle ?? shinAngle + 90), DIM.foot);
    return { ...l, toe };
  };

  return {
    view: 'side', f, hip, neck, shoulder, head, up: headUp, forward,
    armN: arm(shoulderN, pose.armN ?? pose.arm),
    armF: arm(shoulderF, pose.armF ?? pose.armN ?? pose.arm),
    legN: leg(hip, pose.legN ?? pose.leg),
    legF: leg(hipF, pose.legF ?? pose.legN ?? pose.leg),
    hipF,
    shoulderN,
    shoulderF,
  };
};

// ==================== 正面 ====================

export const solveFront = (pose, cx) => {
  const dir = (a) => [Math.sin(a * RAD), Math.cos(a * RAD)];
  const toPoint = ([dx, y]) => [cx + dx, y];
  const hip = toPoint(pose.hip);
  const torso = pose.torso ?? 180;
  const up = dir(torso);
  const right = [-up[1], up[0]];
  const neck = add(hip, up, DIM.torso);
  const shoulderMid = add(hip, up, DIM.torso - 1.4);
  const head = add(neck, dir(torso + (pose.tilt ?? 0)), DIM.neck + DIM.headR - 0.6);
  const shoulderR = add(shoulderMid, right, DIM.shoulderHalf);
  const shoulderL = add(shoulderMid, right, -DIM.shoulderHalf);
  const hipR = add(hip, right, DIM.hipHalf);
  const hipL = add(hip, right, -DIM.hipHalf);
  const arm = (root, spec, side) => solveLimb(root, spec, DIM.upperArm, DIM.foreArm, dir, toPoint, side);
  // bend 1 一律是往外彎：手肘往外、膝蓋往外
  const leg = (root, spec, side) => solveLimb(root, spec, DIM.thigh, DIM.shin, dir, toPoint, -side);
  return {
    view: 'front', back: Boolean(pose.back), hip, neck, head, up, right,
    shoulderR, shoulderL, hipR, hipL,
    armR: arm(shoulderR, pose.armR, 1),
    armL: arm(shoulderL, pose.armL, -1),
    legR: leg(hipR, pose.legR, 1),
    legL: leg(hipL, pose.legL, -1),
  };
};

export const solvePose = (pose, cx) => (pose.view === 'front' ? solveFront(pose, cx) : solveSide(pose, cx));

// ==================== 畫 ====================

// 暫存圖層：每一層畫完自動描邊再蓋上去
let layer = null;
const getLayer = (w, h) => {
  if (!layer || layer.w !== w || layer.h !== h) layer = createBuffer(w, h);
  clear(layer);
  return layer;
};

const put = (buf, x, y, c) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix >= 0 && iy >= 0 && ix < buf.w && iy < buf.h) buf.px[iy * buf.w + ix] = c;
};

// Q 版頭：圓臉、瀏海、頭頂一撮呆毛、大眼睛（白色反光）、腮紅
const drawHead = (buf, s, pal, { front = false, back = false } = {}) => {
  const [cx, cy] = s.head;
  const r = DIM.headR;
  const up = s.up;
  const right = front || back ? s.right : s.forward;
  disk(buf, cx, cy, r, pal.skin);
  const x0 = Math.floor(cx - r - 1);
  const y0 = Math.floor(cy - r - 1);
  for (let y = y0; y <= cy + r + 1; y++) {
    for (let x = x0; x <= cx + r + 1; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      if (px * px + py * py > r * r) continue;
      const along = px * up[0] + py * up[1];
      const side = px * right[0] + py * right[1];
      let hair;
      if (back) hair = along > -3.2;
      else if (front) hair = along > 1.6 - Math.abs(side) * 0.15 || (Math.abs(side) > 3.8 && along > -1.5);
      else hair = along > 1.8 || (side < -1.2 && along > -2.6);
      if (hair) put(buf, x, y, along > 3.6 && side > 0 ? pal.hairLight : pal.hair);
    }
  }
  // 呆毛
  const tip = [cx + up[0] * (r + 0.6) + right[0] * 0.8, cy + up[1] * (r + 0.6) + right[1] * 0.8];
  put(buf, tip[0], tip[1], pal.hair);
  put(buf, tip[0] + up[0] + right[0], tip[1] + up[1] + right[1], pal.hair);
  if (back) return;
  const at = (k, d) => [cx + right[0] * k - up[0] * d, cy + right[1] * k - up[1] * d];
  // 眼睛 1×2 黑點
  const eye = (k) => {
    const [ex, ey] = at(k, 0.4);
    put(buf, ex, ey, pal.eye);
    put(buf, ex, ey + 1, pal.eye);
  };
  if (front) {
    eye(-2);
    eye(2);
    const [b1x, b1y] = at(-3.4, 2.2);
    const [b2x, b2y] = at(3.4, 2.2);
    put(buf, b1x, b1y, pal.blush);
    put(buf, b2x, b2y, pal.blush);
    const [mx, my] = at(0, 3);
    put(buf, mx, my, pal.eye);
    return;
  }
  eye(2.3);
  const [bx, by] = at(1.6, 2.4);
  put(buf, bx, by, pal.blush);
  const [mx, my] = at(3.4, 3);
  put(buf, mx, my, pal.eye);
};

const drawArm = (buf, root, a, skin) => {
  capsule(buf, root[0], root[1], a.mid[0], a.mid[1], 1.7, skin);
  capsule(buf, a.mid[0], a.mid[1], a.end[0], a.end[1], 1.5, skin);
  disk(buf, a.end[0], a.end[1], 1.8, skin);
};

const drawLegSide = (buf, root, l, skin, shorts, shoe) => {
  capsule(buf, root[0], root[1], l.mid[0], l.mid[1], 2.1, skin);
  capsule(buf, l.mid[0], l.mid[1], l.end[0], l.end[1], 1.8, skin);
  const sx = root[0] + (l.mid[0] - root[0]) * 0.6;
  const sy = root[1] + (l.mid[1] - root[1]) * 0.6;
  capsule(buf, root[0], root[1], sx, sy, 2.4, shorts);
  capsule(buf, l.end[0], l.end[1], l.toe[0], l.toe[1], 1.7, shoe);
};

const drawLegFront = (buf, root, l, skin, shorts, shoe, side) => {
  capsule(buf, root[0], root[1], l.mid[0], l.mid[1], 2.1, skin);
  capsule(buf, l.mid[0], l.mid[1], l.end[0], l.end[1], 1.8, skin);
  const sx = root[0] + (l.mid[0] - root[0]) * 0.4;
  const sy = root[1] + (l.mid[1] - root[1]) * 0.4;
  capsule(buf, root[0], root[1], sx, sy, 2.1, shorts);
  capsule(buf, l.end[0], l.end[1], l.end[0] + side * 1.2, l.end[1] + 0.4, 1.7, shoe);
};

// hooks：器材要插在人物哪一層之間畫。behind 在最後面、mid 在身體前面但前側手腳後面、front 在最前面
export const drawFigure = (buf, s, pal = PALETTE, hooks = {}) => {
  hooks.behind?.(buf);
  const L = getLayer(buf.w, buf.h);
  if (s.view === 'side') {
    // 後側手腳
    drawLegSide(L, s.hipF, s.legF, pal.skinShade, pal.shortsShade, pal.shoeShade);
    drawArm(L, s.shoulderF, s.armF, pal.skinShade);
    stamp(buf, L, pal.outline);
    // 身體與頭
    clear(L);
    capsule(L, s.hip[0], s.hip[1], s.neck[0], s.neck[1], 3.4, pal.shirt);
    const waist = add(s.hip, [s.neck[0] - s.hip[0], s.neck[1] - s.hip[1]], 0.22);
    capsule(L, s.hip[0], s.hip[1], waist[0], waist[1], 3.1, pal.shorts);
    drawHead(L, s, pal);
    stamp(buf, L, pal.outline);
    hooks.mid?.(buf);
    // 前側手腳
    clear(L);
    drawLegSide(L, s.hip, s.legN, pal.skin, pal.shorts, pal.shoe);
    stamp(buf, L, pal.outline);
    clear(L);
    drawArm(L, s.shoulderN, s.armN, pal.skin);
    stamp(buf, L, pal.outline);
    hooks.front?.(buf);
    return;
  }
  // 正面：腿 → 身體與頭 → 手
  drawLegFront(L, s.hipL, s.legL, pal.skin, pal.shorts, pal.shoe, -1);
  drawLegFront(L, s.hipR, s.legR, pal.skin, pal.shorts, pal.shoe, 1);
  stamp(buf, L, pal.outline);
  clear(L);
  const waistL = add(s.hipL, s.right, -0.4);
  const waistR = add(s.hipR, s.right, 0.4);
  const neckL = add(s.shoulderL, s.up, 0.6);
  const neckR = add(s.shoulderR, s.up, 0.6);
  polygon(L, [neckL, neckR, waistR, waistL], pal.shirt);
  polygon(L, [add(waistL, s.up, 1.6), add(waistR, s.up, 1.6), add(waistR, s.up, -0.6), add(waistL, s.up, -0.6)], pal.shorts);
  // 背心肩帶旁露出的肩膀
  disk(L, s.shoulderR[0], s.shoulderR[1], 1.5, pal.skin);
  disk(L, s.shoulderL[0], s.shoulderL[1], 1.5, pal.skin);
  capsule(L, s.neck[0], s.neck[1], s.neck[0] - s.up[0] * 1.2, s.neck[1] - s.up[1] * 1.2, 1.2, pal.skin);
  drawHead(L, s, pal, { front: !s.back, back: s.back });
  stamp(buf, L, pal.outline);
  hooks.mid?.(buf);
  clear(L);
  drawArm(L, s.shoulderL, s.armL, pal.skin);
  drawArm(L, s.shoulderR, s.armR, pal.skin);
  stamp(buf, L, pal.outline);
  hooks.front?.(buf);
};

// ==================== 共用姿勢 ====================

// 站姿：腳底踩在地板線上（鞋子半徑 1.4，腳踝離地 1.2）
export const FOOT_Y = FLOOR - 1.4;
export const STAND_HIP_Y = FOOT_Y - DIM.thigh - DIM.shin + 0.3;
const standLegs = { legR: { ik: [2.4, FOOT_Y], bend: 1 }, legL: { ik: [-2.4, FOOT_Y], bend: 1 } };

// 正面站著（待命）：手自然垂在兩側，呼吸時肩膀起伏 1px
export const idlePose = (time) => {
  const breath = (Math.sin(time * 2.2) + 1) / 2;
  return {
    view: 'front',
    hip: [0, STAND_HIP_Y],
    torso: 180,
    armR: [14 + breath * 2, 6],
    armL: [-14 - breath * 2, -6],
    ...standLegs,
  };
};

// 休息：側身拿水壺，每 6 秒喝一口
export const restPose = (time) => {
  const cycle = (time % 6) / 6;
  const sip = cycle < 0.4 ? Math.sin((cycle / 0.4) * Math.PI) : 0;
  const neckY = STAND_HIP_Y - DIM.torso;
  return {
    view: 'side',
    facing: 1,
    hip: [-1, STAND_HIP_Y],
    torso: 180 - sip * 3,
    tilt: -sip * 22,
    // 手從腰前拿到嘴邊
    armN: { ik: [2.5 + sip * 0.5, STAND_HIP_Y + 0.5 - sip * (STAND_HIP_Y + 0.5 - neckY + 2.4)], bend: -1 },
    armF: [-6, 4],
    legN: { ik: [1.5, FOOT_Y], bend: -1 },
    legF: { ik: [-2, FOOT_Y], bend: -1 },
    bottle: sip,
  };
};

// 休息超過目標：正面站好、雙手握拳準備
export const readyPose = (time) => {
  const bounce = Math.max(0, Math.sin(time * 6)) * 0.8;
  return {
    view: 'front',
    hip: [0, STAND_HIP_Y - bounce],
    torso: 180,
    armR: [35, 150],
    armL: [-35, -150],
    legR: { ik: [3, FOOT_Y], bend: 1 },
    legL: { ik: [-3, FOOT_Y], bend: 1 },
  };
};

// 做完：雙手舉高
export const cheerPose = (time) => {
  const bounce = Math.max(0, Math.sin(time * 5)) * 1.5;
  return {
    view: 'front',
    hip: [0, STAND_HIP_Y - bounce],
    torso: 180,
    armR: [150, 165],
    armL: [-150, -165],
    legR: { ik: [3, FOOT_Y - bounce], bend: 1 },
    legL: { ik: [-3, FOOT_Y - bounce], bend: 1 },
  };
};

// 走路：phase 跟著移動距離前進，腳步才不會打滑
export const walkPose = (phase, facing) => {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const leg = (k) => {
    const swing = 26 * s * k;
    const lift = Math.max(0, c * k) * 28;
    return [swing, swing - 6 - lift];
  };
  return {
    view: 'side',
    facing,
    hip: [0, STAND_HIP_Y - 0.3 - Math.abs(c) * 0.7],
    torso: 177,
    armN: [-24 * s, -24 * s + 28],
    armF: [24 * s, 24 * s + 28],
    legN: leg(1),
    legF: leg(-1),
  };
};

// 一下的節奏：向心 0.9s → 停 0.3s → 離心 1.0s → 停 0.2s，回傳 0（起點）到 1（終點）
export const REP_SECONDS = 2.4;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
export const repProgress = (time) => {
  const t = time % REP_SECONDS;
  if (t < 0.9) return ease(t / 0.9);
  if (t < 1.2) return 1;
  if (t < 2.2) return 1 - ease((t - 1.2) / 1.0);
  return 0;
};
