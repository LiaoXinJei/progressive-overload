// 動作 → 動作族（器材 + 起點 / 終點姿勢）。
// 每個動作族：
//   start / end：一下的起點與終點姿勢（rig.js 的格式），中間內插
//   equip(L, cx)：固定器材，畫進背景
//   props(L, cx)：沒人在用時的活動部分（槓鈴在架上、配重片放下）
//   hooks(s, t, cx)：做動作時跟著手腳畫的器材，回傳 drawFigure 的 hooks
// 座標見 rig.js：x 是相對站點中心（側面朝右為正），y 是畫面絕對座標。

import { FLOOR, FOOT_Y, STAND_HIP_Y, DIM } from './rig.js';
import {
  EQ, stampEquip, post, beam, slab, flatBench, plateSide, dumbbellSide, dumbbellFront,
  weightStack, cableLine, pulley, rect, disk, capsule, loadedBar,
} from './equipment.js';
import { BARBELL, EZ_BAR, SINGLE } from './plates.js';

const SEAT_TOP = FLOOR - 5; // 一般凳子高度：坐著腳剛好踩地
const SEAT_HIP_Y = SEAT_TOP - 2.4;
const BENCH_Y = FLOOR - 10; // 臥推凳高度
const LYING_HIP_Y = BENCH_Y - 2.6;

const EZ_K = 2.4 / 3.6; // EZ 槓的槓片畫小一點

// 手上拿的東西畫在手的位置（最前面一層）。plates：槓上掛的槓片（只有選中那站有）
const held = (kind) => (s, t, cx, plates) => {
  const hands = s.view === 'front' ? [s.armL.end, s.armR.end] : [s.armN.end];
  return {
    front: (buf) => stampEquip(buf, L => {
      for (const [hx, hy] of hands) {
        if (kind === 'db') (s.view === 'front' ? disk(L, hx, hy, 1.8, EQ.plate) : dumbbellSide(L, hx, hy));
        else if (kind === 'dbFront') dumbbellFront(L, hx, hy);
        else if (kind === 'barbell') loadedBar(L, hx, hy - 0.5, plates);
        else if (kind === 'ez') loadedBar(L, hx, hy, plates, EZ_K);
        else if (kind === 'handle') capsule(L, hx, hy - 1.2, hx, hy + 1.2, 0.7, EQ.metal);
      }
    }),
  };
};

// 纜繩機（側面看）：柱子、滑輪、配重片。pulleyY 是滑輪高度，x 是柱子位置
const cableTower = (L, x, pulleyY, { stack = true } = {}) => {
  post(L, x, 12, FLOOR, 2);
  post(L, x + 7, 12, FLOOR, 2);
  beam(L, x - 1, x + 10, 11, 2);
  beam(L, x - 2, x + 11, FLOOR - 1, 1);
  if (stack) weightStack(L, x + 2, FLOOR - 1, 6, 0, 2, 5);
  pulley(L, x - 1, pulleyY);
};
// 纜繩動態：從滑輪拉到手，配重片跟著抬
const cableHooks = (towerX, pulleyY, lift = 3, grip = 'handle') => (s, t, cx) => {
  const hands = s.view === 'front' ? [s.armR.end] : [s.armN.end];
  return {
    behind: (buf) => stampEquip(buf, L => weightStack(L, cx + towerX + 2, FLOOR - 1, 6, t * lift, 2, 5)),
    mid: (buf) => stampEquip(buf, L => {
      for (const [hx, hy] of hands) cableLine(L, cx + towerX - 1, pulleyY, hx, hy);
    }),
    ...held(grip)(s),
  };
};
const towerProps = (towerX, pulleyY, restHand) => (L, cx) => {
  cableLine(L, cx + towerX - 1, pulleyY, cx + restHand[0], restHand[1]);
  capsule(L, cx + restHand[0], restHand[1], cx + restHand[0], restHand[1] + 2, 0.7, EQ.metal);
};

// ==================== 推 ====================

const lyingBase = {
  view: 'side', facing: 1, hip: [4, LYING_HIP_Y], torso: -90,
  legN: { ik: [11, FOOT_Y], bend: -1 }, legF: { ik: [9, FOOT_Y], bend: -1 },
};

// 平躺推：槓鈴 / 啞鈴 / 史密斯
const flatPress = (implement = 'barbell') => ({
  start: { ...lyingBase, armN: { ik: [-1.5, LYING_HIP_Y - 3.8], bend: 1 } },
  end: { ...lyingBase, armN: { ik: [-2.5, LYING_HIP_Y - 9.4], bend: 1 } },
  equip(L, cx) {
    flatBench(L, cx - 15, cx + 7, BENCH_Y);
    if (implement === 'barbell') {
      post(L, cx - 19, BENCH_Y - 14, FLOOR, 2);
      beam(L, cx - 22, cx - 14, FLOOR - 1, 1);
      rect(L, cx - 17, BENCH_Y - 13, 2, 1, EQ.metal);
    }
    if (implement === 'smith') {
      post(L, cx - 6, 8, FLOOR, 2);
      post(L, cx + 1, 8, FLOOR, 2);
      beam(L, cx - 8, cx + 4, 7, 2);
    }
  },
  load: implement === 'db' ? SINGLE : BARBELL,
  bar: { barbell: [-15.5, BENCH_Y - 14.5], smith: [-2, BENCH_Y - 16] }[implement],
  props(L, cx, plates) {
    if (implement === 'barbell') loadedBar(L, cx - 15.5, BENCH_Y - 14.5, plates);
    if (implement === 'smith') loadedBar(L, cx - 2, BENCH_Y - 16, plates);
    if (implement === 'db') { dumbbellSide(L, cx + 9, FLOOR - 2.3); dumbbellSide(L, cx + 13, FLOOR - 2.3); }
  },
  hooks: held(implement === 'db' ? 'db' : 'barbell'),
});

// 仰臥三頭伸展：上臂朝上略往頭的方向固定，前臂彎到額頭再伸直
const skullCrusher = () => ({
  start: { ...lyingBase, armN: [-168, -95] },
  end: { ...lyingBase, armN: [-168, -170] },
  equip(L, cx) { flatBench(L, cx - 15, cx + 7, BENCH_Y); },
  load: EZ_BAR,
  bar: [11, FLOOR - 2.4],
  props(L, cx, plates) { loadedBar(L, cx + 11, FLOOR - 2.4, plates, EZ_K); },
  hooks: held('ez'),
});

// 上斜推：椅背 45°
const INC_HIP = [2, SEAT_HIP_Y - 1.5];
const inclineBase = {
  view: 'side', facing: 1, hip: INC_HIP, torso: -138, tilt: 20,
  legN: { ik: [10, FOOT_Y], bend: -1 }, legF: { ik: [8.5, FOOT_Y], bend: -1 },
};
const inclineBench = (L, cx) => {
  slab(L, cx - 2, SEAT_TOP - 1, cx + 6, SEAT_TOP - 1, 1.4);
  slab(L, cx - 1, SEAT_TOP - 2.5, cx - 12, SEAT_TOP - 14, 1.7);
  post(L, cx + 1, SEAT_TOP, FLOOR, 2);
  capsule(L, cx - 9, SEAT_TOP - 10, cx - 9, FLOOR - 1, 0.9, EQ.frame);
  beam(L, cx - 12, cx + 6, FLOOR - 1, 1);
};
const inclinePress = (implement = 'db') => ({
  start: { ...inclineBase, armN: { ik: [-1.5, INC_HIP[1] - 8.5], bend: 1 } },
  end: { ...inclineBase, armN: { ik: [-2.5, INC_HIP[1] - 15.5], bend: 1 } },
  equip(L, cx) {
    inclineBench(L, cx);
    if (implement === 'barbell') { post(L, cx - 15, 22, FLOOR, 2); rect(L, cx - 13, 24, 2, 1, EQ.metal); }
    if (implement === 'smith') { post(L, cx - 7, 8, FLOOR, 2); post(L, cx, 8, FLOOR, 2); beam(L, cx - 9, cx + 3, 7, 2); }
  },
  load: implement === 'db' ? SINGLE : BARBELL,
  bar: { barbell: [-11.5, 22], smith: [-3.5, 20] }[implement],
  props(L, cx, plates) {
    if (implement === 'db') { dumbbellSide(L, cx + 11, FLOOR - 2.3); dumbbellSide(L, cx + 15, FLOOR - 2.3); }
    if (implement === 'barbell') loadedBar(L, cx - 11.5, 22, plates);
    if (implement === 'smith') loadedBar(L, cx - 3.5, 20, plates);
  },
  hooks: held(implement === 'db' ? 'db' : 'barbell'),
});

// 坐姿機械胸推：靠背直立、把手往前推（incline 版往前上推）
const MSEAT_HIP = [-1, SEAT_HIP_Y];
const seatedBase = {
  view: 'side', facing: 1, hip: MSEAT_HIP, torso: 178,
  legN: [88, 2], legF: [86, 0],
};
const machineFrame = (L, cx) => {
  slab(L, cx - 4, SEAT_TOP - 1, cx + 3, SEAT_TOP - 1, 1.4);
  slab(L, cx - 5, SEAT_TOP - 3, cx - 5, SEAT_TOP - 17, 1.6);
  post(L, cx - 9, 14, FLOOR, 2);
  post(L, cx - 1, SEAT_TOP, FLOOR, 2);
  beam(L, cx - 9, cx + 9, 14, 2);
  beam(L, cx - 13, cx + 5, FLOOR - 1, 1);
  weightStack(L, cx - 16, FLOOR - 1, 6, 0, 2, 5);
  post(L, cx - 17, 18, FLOOR, 1);
};
const machineChest = (incline = false) => ({
  start: { ...seatedBase, armN: { ik: [2.5, incline ? 37 : 39.5], bend: -1 } },
  end: { ...seatedBase, armN: { ik: [9.5, incline ? 33 : 39], bend: -1 } },
  equip: machineFrame,
  props(L, cx) { capsule(L, cx + 3, 38, cx + 3, 41, 0.8, EQ.metal); },
  hooks: (s, t, cx) => ({
    behind: (buf) => stampEquip(buf, L => weightStack(L, cx - 16, FLOOR - 1, 6, t * 3, 2, 5)),
    mid: (buf) => stampEquip(buf, L => capsule(L, cx + 8, 15, s.armN.end[0], s.armN.end[1], 0.7, EQ.metalDark)),
    ...held('handle')(s),
  }),
});

// 雙槓撐體：手撐在槓上，身體上下
const DIP_Y = 33;
const dipPose = (drop, lean) => ({
  view: 'side', facing: 1,
  hip: [-2 - drop * 0.3, DIP_Y - DIM.upperArm - DIM.foreArm + DIM.torso - 1.3 + drop],
  torso: 180 - lean,
  armN: { ik: [1, DIP_Y + 0.5], bend: -1 },
  legN: [-12, -75], legF: [-6, -70],
});
const dips = (weighted = false) => ({
  start: dipPose(0, 6),
  end: dipPose(5.5, 18),
  equip(L, cx) {
    post(L, cx + 3, DIP_Y + 1, FLOOR, 2);
    beam(L, cx - 4, cx + 6, DIP_Y, 2, EQ.metal, EQ.metalLight);
    beam(L, cx - 1, cx + 9, FLOOR - 1, 1);
    capsule(L, cx + 4, DIP_Y + 8, cx + 10, DIP_Y + 2, 0.8, EQ.frame);
  },
  hooks: weighted
    ? (s) => ({
      mid: (buf) => stampEquip(buf, L => {
        capsule(L, s.hip[0], s.hip[1], s.hip[0] + 1, s.hip[1] + 6, 0.5, EQ.metalDark);
        plateSide(L, s.hip[0] + 1, s.hip[1] + 8, 2.6);
      }),
    })
    : undefined,
});

// 坐姿肩推（正面）：啞鈴 / 機械 / 史密斯
const SEATED_FRONT = (hands, bend = 1) => ({
  view: 'front', hip: [0, SEAT_HIP_Y],
  armR: { ik: [hands[0], hands[1]], bend }, armL: { ik: [-hands[0], hands[1]], bend },
  legR: { ik: [4.5, FOOT_Y], bend: 1 }, legL: { ik: [-4.5, FOOT_Y], bend: 1 },
});
const frontSeat = (L, cx, back = true) => {
  if (back) {
    rect(L, cx - 5, SEAT_HIP_Y - 15, 10, 15, EQ.pad);
    rect(L, cx - 5, SEAT_HIP_Y - 15, 10, 1, EQ.padLight);
  }
  rect(L, cx - 7, SEAT_TOP - 1, 14, 3, EQ.pad);
  rect(L, cx - 7, SEAT_TOP - 1, 14, 1, EQ.padLight);
  post(L, cx - 1, SEAT_TOP + 2, FLOOR, 2);
  beam(L, cx - 6, cx + 6, FLOOR - 1, 1);
};
const shoulderPress = (implement = 'db') => ({
  start: SEATED_FRONT([7.5, SEAT_HIP_Y - 13]),
  end: SEATED_FRONT([3.8, SEAT_HIP_Y - 24.5]),
  equip(L, cx) {
    frontSeat(L, cx);
    if (implement === 'machine' || implement === 'smith') {
      post(L, cx - 14, 8, FLOOR, 2); post(L, cx + 12, 8, FLOOR, 2); beam(L, cx - 15, cx + 15, 7, 2);
    }
  },
  load: implement === 'smith' ? BARBELL : SINGLE,
  props(L, cx) {
    if (implement === 'db') { dumbbellFront(L, cx - 10, FLOOR - 1.5); dumbbellFront(L, cx + 10, FLOOR - 1.5); }
    if (implement === 'smith') beam(L, cx - 13, cx + 13, 24, 1, EQ.metal, EQ.metalLight);
  },
  hooks: (s, t, cx) => {
    if (implement === 'db') return held('dbFront')(s);
    const [lx, ly] = s.armL.end;
    const [rx, ry] = s.armR.end;
    return {
      front: (buf) => stampEquip(buf, L => {
        if (implement === 'smith') beam(L, cx - 13, cx + 13, Math.round((ly + ry) / 2) - 0.5, 1, EQ.metal, EQ.metalLight);
        capsule(L, lx, ly - 1.2, lx, ly + 1.2, 0.8, EQ.metal);
        capsule(L, rx, ry - 1.2, rx, ry + 1.2, 0.8, EQ.metal);
      }),
    };
  },
});

// 側平舉（正面）：雙手 / 單手扶柱側傾 / 單手繩索 / 機械
const lateralRaise = (kind = 'db') => {
  const stand = (r, l) => ({
    view: 'front', hip: [kind === 'lean' ? 1 : 0, STAND_HIP_Y], torso: kind === 'lean' ? 172 : 180,
    armR: r, armL: l,
    legR: { ik: [2.6, FOOT_Y], bend: 1 }, legL: { ik: [-2.6, FOOT_Y], bend: 1 },
  });
  if (kind === 'machine') {
    const seated = (a) => ({ ...SEATED_FRONT([0, 0]), armR: [a, a + 50], armL: [-a, -a - 50] });
    return {
      start: seated(12), end: seated(84),
      equip(L, cx) {
        frontSeat(L, cx);
        post(L, cx - 15, 14, FLOOR, 2); post(L, cx + 13, 14, FLOOR, 2); beam(L, cx - 16, cx + 16, 13, 2);
      },
      hooks: (s) => ({
        front: (buf) => stampEquip(buf, L => {
          capsule(L, s.armR.mid[0], s.armR.mid[1] - 1, s.armR.mid[0], s.armR.mid[1] + 1, 1.3, EQ.pad);
          capsule(L, s.armL.mid[0], s.armL.mid[1] - 1, s.armL.mid[0], s.armL.mid[1] + 1, 1.3, EQ.pad);
        }),
      }),
    };
  }
  if (kind === 'lean') {
    const hold = { ik: [-9, 30], bend: -1 };
    return {
      start: stand([12, 8], hold), end: stand([88, 92], hold),
      equip(L, cx) { post(L, cx - 11, 12, FLOOR, 2); beam(L, cx - 14, cx - 7, FLOOR - 1, 1); },
      props(L, cx) { dumbbellFront(L, cx + 10, FLOOR - 1.5, true); },
      hooks: (s) => ({ front: (buf) => stampEquip(buf, L => disk(L, s.armR.end[0], s.armR.end[1], 1.8, EQ.plate)) }),
    };
  }
  if (kind === 'cable') {
    return {
      start: stand([-25, -30], [-12, -8]), end: stand([86, 92], [-12, -8]),
      equip(L, cx) { cableTower(L, cx - 22, FLOOR - 4); },
      props: towerProps(-22, FLOOR - 4, [-12, FLOOR - 6]),
      hooks: cableHooks(-22, FLOOR - 4, 4),
    };
  }
  return {
    start: stand([12, 8], [-12, -8]), end: stand([88, 92], [-88, -92]),
    props(L, cx) { dumbbellFront(L, cx - 11, FLOOR - 1.5, true); dumbbellFront(L, cx + 11, FLOOR - 1.5, true); },
    hooks: held('db'),
  };
};

// 站姿面對纜繩機（側面）：三頭下壓、跨體伸展、直臂下拉、面拉、繩索彎舉
const TOWER_X = 9;
const standFacing = (extra) => ({
  view: 'side', facing: 1, hip: [-3, STAND_HIP_Y], torso: 175,
  legN: { ik: [-1.5, FOOT_Y], bend: -1 }, legF: { ik: [-4.5, FOOT_Y], bend: -1 },
  ...extra,
});
const cableStation = ({ start, end, pulleyY, restHand, grip = 'handle', lift = 3 }) => ({
  start: standFacing(start), end: standFacing(end),
  equip(L, cx) { cableTower(L, cx + TOWER_X, pulleyY); },
  props: towerProps(TOWER_X, pulleyY, restHand),
  hooks: cableHooks(TOWER_X, pulleyY, lift, grip),
});
const pushdown = () => cableStation({
  start: { armN: [6, 150] }, end: { armN: [6, 8] }, pulleyY: 15, restHand: [7, 30],
});
const crossBodyExt = () => cableStation({
  start: { armN: [70, 165] }, end: { armN: [80, 80] }, pulleyY: 15, restHand: [7, 30],
});
const straightArm = () => cableStation({
  start: { torso: 165, armN: [140, 140] }, end: { torso: 165, armN: [8, 8] }, pulleyY: 15, restHand: [7, 30],
});
const facePull = () => cableStation({
  start: { armN: { ik: [8, 29], bend: -1 } }, end: { armN: { ik: [1.5, 27.5], bend: -1 } }, pulleyY: 29, restHand: [7, 31],
});
const cableCurl = () => cableStation({
  start: { armN: [4, 10] }, end: { armN: [4, 150] }, pulleyY: FLOOR - 4, restHand: [6, FLOOR - 7],
});

// ==================== 拉 ====================

// 引體向上（正面）
const BAR_Y = 14;
const hang = (hipY) => ({
  view: 'front', hip: [0, hipY],
  armR: { ik: [5.5, BAR_Y + 1.5], bend: 1 }, armL: { ik: [-5.5, BAR_Y + 1.5], bend: 1 },
  legR: [5, -8], legL: [-5, 8],
});
const pullUp = () => ({
  start: hang(32.2),
  end: hang(24.6),
  equip(L, cx) {
    post(L, cx - 16, BAR_Y - 2, FLOOR, 2);
    post(L, cx + 14, BAR_Y - 2, FLOOR, 2);
    beam(L, cx - 17, cx + 17, BAR_Y, 2);
    beam(L, cx - 19, cx - 12, FLOOR - 1, 1);
    beam(L, cx + 12, cx + 19, FLOOR - 1, 1);
  },
});

// 高位下拉（正面）：坐著，槓從頭上拉到上胸
const pulldown = (wide = false) => {
  const w = wide ? 9.5 : 5.5;
  const seated = (handY, spread) => ({
    ...SEATED_FRONT([0, 0]),
    armR: { ik: [spread, handY], bend: 1 }, armL: { ik: [-spread, handY], bend: 1 },
  });
  const bar = (L, x0, y, half) => beam(L, x0 - half - 2, x0 + half + 2, y - 0.5, 1, EQ.metal, EQ.metalLight);
  return {
    start: seated(SEAT_HIP_Y - 23, w),
    end: seated(SEAT_HIP_Y - 11, w + 2),
    equip(L, cx) {
      frontSeat(L, cx, false);
      post(L, cx - 15, 6, FLOOR, 2); post(L, cx + 13, 6, FLOOR, 2); beam(L, cx - 16, cx + 16, 5, 2);
      pulley(L, cx, 8);
      rect(L, cx - 7, SEAT_TOP - 7, 14, 2, EQ.pad);
    },
    props(L, cx) { cableLine(L, cx, 8, cx, 20); bar(L, cx, 20, w); },
    hooks: (s) => {
      const y = (s.armL.end[1] + s.armR.end[1]) / 2;
      const mid = (s.armL.end[0] + s.armR.end[0]) / 2;
      return {
        behind: (buf) => stampEquip(buf, L => cableLine(L, mid, 8, mid, y)),
        front: (buf) => stampEquip(buf, L => bar(L, mid, y, (s.armR.end[0] - s.armL.end[0]) / 2)),
      };
    },
  };
};

// 坐姿划船（側面）：坐在地上的長凳，腳踩前面的踏板，把手從前面拉到肚子
const cableRow = (machine = false) => {
  const hipY = FLOOR - 7.5;
  const base = (torso) => ({
    view: 'side', facing: 1, hip: [-6, hipY], torso,
    legN: { ik: [5, FLOOR - 9], bend: 1 }, legF: { ik: [4, FLOOR - 9], bend: 1 },
  });
  const pulleyY = FLOOR - 9;
  return {
    start: { ...base(160), armN: { ik: [7, hipY - 4.5], bend: -1 } },
    end: { ...base(184), armN: { ik: [-1, hipY - 3], bend: -1 } },
    equip(L, cx) {
      slab(L, cx - 14, FLOOR - 5, cx + 2, FLOOR - 5, 1.4);
      post(L, cx - 12, FLOOR - 4, FLOOR, 2);
      slab(L, cx + 6, FLOOR - 13, cx + 6, FLOOR - 5, 1.3, EQ.metal, EQ.metalLight);
      if (machine) slab(L, cx + 1, hipY - 12, cx + 1, hipY - 4, 1.6);
      cableTower(L, cx + 12, pulleyY);
    },
    props: towerProps(12, pulleyY, [9, pulleyY + 1]),
    hooks: cableHooks(12, pulleyY, 4),
  };
};

// 胸靠划船（側面）：趴在斜板上，手從垂直往下拉到肋骨。fly = 胸靠反向飛鳥（手往後上甩）
const chestRow = (implement = 'db') => {
  const base = {
    view: 'side', facing: 1, hip: [-4, 43], torso: 128, tilt: -25,
    legN: { ik: [-9, FOOT_Y], bend: 1 }, legF: { ik: [-11, FOOT_Y], bend: 1 },
  };
  const fly = implement === 'fly';
  return {
    start: { ...base, armN: fly ? [4, 4] : { ik: [3.5, 47.5], bend: 1 } },
    end: { ...base, armN: fly ? [-70, -70] : { ik: [-0.5, 40], bend: 1 } },
    equip(L, cx) {
      slab(L, cx - 1, 46, cx + 6, 38, 1.6);
      capsule(L, cx + 1, 46, cx - 3, FLOOR - 1, 0.9, EQ.frame);
      capsule(L, cx + 4, 42, cx + 6, FLOOR - 1, 0.9, EQ.frame);
      beam(L, cx - 8, cx + 9, FLOOR - 1, 1);
    },
    // T 槓只有一頭掛槓片：點一片加一片的重量，但槓片畫得出來
    bar: implement === 'tbar' ? [4, FLOOR - 4] : undefined,
    props(L, cx, plates) {
      if (implement === 'tbar') loadedBar(L, cx + 4, FLOOR - 4, plates);
      else { dumbbellSide(L, cx + 9, FLOOR - 2.3); dumbbellSide(L, cx + 13, FLOOR - 2.3); }
    },
    hooks: held(implement === 'tbar' ? 'barbell' : 'db'),
  };
};

// 單臂啞鈴划船（側面）：一手一膝撐在凳子上
const oneArmRow = () => {
  const base = {
    view: 'side', facing: 1, hip: [-6, 39.5], torso: 102,
    legN: { ik: [-4, FOOT_Y], bend: -1 },
    legF: { ik: [-12, BENCH_Y - 1.2], bend: 1, foot: -90 },
    armF: { ik: [5, BENCH_Y - 1], bend: -1 },
  };
  return {
    start: { ...base, armN: { ik: [2.5, 48.5], bend: 1 } },
    end: { ...base, armN: { ik: [-1, 41], bend: 1 } },
    equip(L, cx) { flatBench(L, cx - 14, cx + 8, BENCH_Y); },
    props(L, cx) { dumbbellSide(L, cx + 11, FLOOR - 2.3); },
    hooks: held('db'),
  };
};

// 反向飛鳥（背面）：手從身前收攏甩到兩側平舉。machine = 坐姿反向飛鳥機
const rearFly = (kind = 'db') => {
  const seated = kind === 'machine';
  const pose = (a, b) => ({
    ...(seated ? SEATED_FRONT([0, 0]) : {
      view: 'front', hip: [0, STAND_HIP_Y],
      legR: { ik: [2.6, FOOT_Y], bend: 1 }, legL: { ik: [-2.6, FOOT_Y], bend: 1 },
    }),
    back: true, armR: [a, b], armL: [-a, -b],
  });
  return {
    start: pose(32, 40), end: pose(86, 90),
    equip(L, cx) {
      if (seated) { frontSeat(L, cx, false); post(L, cx - 1, 20, SEAT_TOP, 2); rect(L, cx - 3, 26, 6, 10, EQ.pad); }
      if (kind === 'cable') { cableTower(L, cx - 24, 26, { stack: false }); cableTower(L, cx + 17, 26, { stack: false }); }
    },
    props(L, cx) {
      if (kind === 'db') { dumbbellFront(L, cx - 11, FLOOR - 1.5, true); dumbbellFront(L, cx + 11, FLOOR - 1.5, true); }
    },
    hooks: (s, t, cx) => ({
      ...(kind === 'db' ? held('db')(s) : held('handle')(s)),
      ...(kind === 'cable' ? {
        behind: (buf) => stampEquip(buf, L => {
          cableLine(L, cx - 25, 26, s.armL.end[0], s.armL.end[1]);
          cableLine(L, cx + 16, 26, s.armR.end[0], s.armR.end[1]);
        }),
      } : {}),
    }),
  };
};

// 站姿彎舉（側面）：上臂固定，前臂往上捲
const curlBase = { ...standFacing({ hip: [-1, STAND_HIP_Y], torso: 179 }), legN: { ik: [0.5, FOOT_Y], bend: -1 }, legF: { ik: [-2.5, FOOT_Y], bend: -1 } };
const curl = (implement = 'db') => ({
  start: { ...curlBase, armN: [4, 10] },
  end: { ...curlBase, armN: [2, 152] },
  equip(L, cx) {
    if (implement === 'ez') return;
    // 啞鈴架
    beam(L, cx - 22, cx - 10, FLOOR - 9, 1);
    post(L, cx - 21, FLOOR - 9, FLOOR, 1);
    post(L, cx - 11, FLOOR - 9, FLOOR, 1);
    dumbbellSide(L, cx - 19, FLOOR - 11);
    dumbbellSide(L, cx - 14, FLOOR - 11);
  },
  load: implement === 'ez' ? EZ_BAR : SINGLE,
  bar: implement === 'ez' ? [10, FLOOR - 2.4] : undefined,
  props(L, cx, plates) {
    if (implement === 'ez') loadedBar(L, cx + 10, FLOOR - 2.4, plates, EZ_K);
    else { dumbbellSide(L, cx + 9, FLOOR - 2.3); dumbbellSide(L, cx + 13, FLOOR - 2.3); }
  },
  hooks: held(implement === 'ez' ? 'ez' : 'db'),
});

// 牧師椅彎舉：上臂靠在斜墊上
const preacher = () => {
  const base = { view: 'side', facing: 1, hip: [-4, SEAT_HIP_Y - 2], torso: 172, legN: [80, 4], legF: [78, 2] };
  return {
    start: { ...base, armN: [48, 62] },
    end: { ...base, armN: [48, 168] },
    equip(L, cx) {
      slab(L, cx - 7, SEAT_TOP - 3, cx - 1, SEAT_TOP - 3, 1.4);
      post(L, cx - 5, SEAT_TOP - 2, FLOOR, 2);
      slab(L, cx - 1, 36, cx + 5, 41.5, 1.6);
      capsule(L, cx + 4, 41, cx + 3, FLOOR - 1, 0.9, EQ.frame);
      beam(L, cx - 9, cx + 7, FLOOR - 1, 1);
    },
    load: EZ_BAR,
    bar: [6.5, 40],
    props(L, cx, plates) { loadedBar(L, cx + 6.5, 40, plates, EZ_K); },
    hooks: held('ez'),
  };
};

// 上斜啞鈴彎舉：坐上斜椅、手垂在身後往上捲
const inclineCurl = () => ({
  start: { ...inclineBase, armN: [-6, -2] },
  end: { ...inclineBase, armN: [-6, 140] },
  equip: inclineBench,
  props(L, cx) { dumbbellSide(L, cx + 11, FLOOR - 2.3); dumbbellSide(L, cx + 15, FLOOR - 2.3); },
  hooks: held('db'),
});

// 集中彎舉：坐著前傾，手肘靠在大腿內側
const concentrationCurl = () => {
  const base = { view: 'side', facing: 1, hip: [-4, SEAT_HIP_Y], torso: 150, legN: [86, 4], legF: [80, 0] };
  return {
    start: { ...base, armN: [12, 8] },
    end: { ...base, armN: [12, 160] },
    equip(L, cx) { flatBench(L, cx - 12, cx + 1, SEAT_TOP); },
    props(L, cx) { dumbbellSide(L, cx + 10, FLOOR - 2.3); },
    hooks: held('db'),
  };
};

// 坐姿過頭三頭伸展：上臂朝上，前臂從腦後伸直。cable 版繩索從身後低滑輪拉上來
const overheadExt = (cable = false) => {
  const base = { ...seatedBase, hip: [0, SEAT_HIP_Y], torso: 180 };
  return {
    start: { ...base, armN: [176, -25] },
    end: { ...base, armN: [176, 176] },
    equip(L, cx) {
      slab(L, cx - 4, SEAT_TOP - 1, cx + 4, SEAT_TOP - 1, 1.4);
      slab(L, cx - 4, SEAT_TOP - 3, cx - 4, SEAT_TOP - 16, 1.6);
      post(L, cx - 1, SEAT_TOP, FLOOR, 2);
      beam(L, cx - 6, cx + 5, FLOOR - 1, 1);
      if (cable) cableTower(L, cx - 20, FLOOR - 4);
    },
    props(L, cx) {
      if (cable) towerProps(-20, FLOOR - 4, [-9, FLOOR - 6])(L, cx);
      else dumbbellSide(L, cx + 9, FLOOR - 2.3);
    },
    hooks: cable ? cableHooks(-20, FLOOR - 4, 3) : held('db'),
  };
};

// ==================== 腿 ====================

// 45° 腿推：坐在斜椅，踏板沿 45° 滑軌推出去。calf = 腿推提踵（只動腳踝）
const LP_HIP = [-7, FLOOR - 9];
const LP_DIR = [Math.SQRT1_2, -Math.SQRT1_2];
const lpFeet = (d) => [LP_HIP[0] + LP_DIR[0] * d, LP_HIP[1] + LP_DIR[1] * d];
const sled = (L, cx, d) => {
  const [fx, fy] = lpFeet(d + 1.6);
  const x = cx + fx;
  slab(L, x - 4.2, fy - 4.2, x + 3.8, fy + 3.8, 1.2, EQ.metal, EQ.metalLight);
  plateSide(L, x + 3.2, fy - 3.4, 4);
};
const legPress = (calf = false) => {
  const near = calf ? 11.1 : 7.6;
  const far = 11.4;
  const seat = {
    view: 'side', facing: 1, hip: LP_HIP, torso: -136, tilt: 25,
    armN: { ik: [-6, FLOOR - 8.5], bend: 1 },
  };
  const legs = (d, foot) => ({
    legN: { ik: lpFeet(d), bend: -1, foot },
    legF: { ik: lpFeet(d - 0.6), bend: -1, foot },
  });
  return {
    start: { ...seat, ...legs(near, calf ? -150 : -135) },
    end: { ...seat, ...legs(far, calf ? -110 : -135) },
    equip(L, cx) {
      beam(L, cx - 20, cx + 20, FLOOR - 2, 2);
      slab(L, cx - 5, FLOOR - 6, cx - 15, FLOOR - 16.5, 1.8);
      slab(L, cx - 9, FLOOR - 5.5, cx - 3, FLOOR - 5.5, 1.6);
      post(L, cx - 8, FLOOR - 5, FLOOR - 2, 2);
      slab(L, cx + 1, FLOOR - 1, cx + 20, FLOOR - 20, 0.9, EQ.metalDark, EQ.metal);
      post(L, cx + 18, FLOOR - 20, FLOOR - 2, 2);
    },
    props(L, cx) { sled(L, cx, near); },
    hooks: (s, t, cx) => ({ behind: (buf) => stampEquip(buf, L => sled(L, cx, near + (far - near) * t)) }),
  };
};

// 深蹲類（側面）：belt = 腰帶深蹲機，pendulum = 鐘擺深蹲，sissy = 西西深蹲
const squat = (kind = 'belt') => {
  const feet = { legN: { ik: [1.5, FOOT_Y], bend: -1 }, legF: { ik: [-1, FOOT_Y], bend: -1 } };
  const top = { view: 'side', facing: 1, hip: [-1, STAND_HIP_Y], torso: 176, ...feet };
  const bottom = kind === 'sissy'
    ? { view: 'side', facing: 1, hip: [-1.5, FOOT_Y - 6.5], torso: 196, ...feet }
    : { view: 'side', facing: 1, hip: [-5.5, FOOT_Y - 7], torso: 160, ...feet };
  const arms = kind === 'sissy' ? { armN: { ik: [8, 34], bend: -1 } } : kind === 'pendulum' ? { armN: [150, 205] } : { armN: [60, 70] };
  return {
    start: { ...bottom, ...arms }, end: { ...top, ...arms },
    equip(L, cx) {
      rect(L, cx - 6, FLOOR - 1, 12, 1, EQ.frameLight);
      if (kind === 'belt') { post(L, cx + 10, 30, FLOOR, 2); beam(L, cx + 6, cx + 14, 36, 2); }
      if (kind === 'pendulum') { post(L, cx - 13, 14, FLOOR, 2); beam(L, cx - 13, cx + 2, 14, 2); }
      if (kind === 'sissy') { post(L, cx + 9, 30, FLOOR, 2); beam(L, cx + 6, cx + 12, FLOOR - 1, 1); }
    },
    hooks: kind === 'belt'
      ? (s, t, cx) => ({ behind: (buf) => stampEquip(buf, L => capsule(L, s.hip[0], s.hip[1], cx + 7, 37, 0.5, EQ.metalDark)) })
      : kind === 'pendulum'
        ? (s, t, cx) => ({
          behind: (buf) => stampEquip(buf, L => {
            slab(L, s.hip[0] - 3, s.hip[1] + 1, s.neck[0] - 3, s.neck[1], 1.4);
            capsule(L, cx - 12, 15, s.neck[0] - 3, s.neck[1], 0.8, EQ.frame);
          }),
        })
        : undefined,
  };
};

// 保加利亞分腿蹲：後腳放凳子上，手提啞鈴。stepUp = 登階
const splitSquat = (stepUp = false) => {
  const pose = (hip) => ({
    view: 'side', facing: 1, hip, torso: 176,
    legN: stepUp ? { ik: [5, FLOOR - 7.4], bend: -1 } : { ik: [4, FOOT_Y], bend: -1 },
    legF: stepUp ? { ik: [-2, FOOT_Y], bend: -1 } : { ik: [-10, BENCH_Y - 1.4], bend: -1, foot: -100 },
    armN: [2, 2],
  });
  return {
    start: pose(stepUp ? [-0.5, STAND_HIP_Y + 2] : [-2.5, 45.5]),
    end: pose(stepUp ? [3.5, FLOOR - 7.4 - 11.8] : [-1.5, 40]),
    equip(L, cx) {
      if (stepUp) { rect(L, cx + 1, FLOOR - 6, 10, 6, EQ.frame); rect(L, cx + 1, FLOOR - 6, 10, 1, EQ.frameLight); }
      else flatBench(L, cx - 18, cx - 6, BENCH_Y);
    },
    props(L, cx) { dumbbellSide(L, cx + 11, FLOOR - 2.3); dumbbellSide(L, cx + 15, FLOOR - 2.3); },
    hooks: held('db'),
  };
};

// 髖鉸鏈（側面）：RDL、繩索 pull-through、機械 hip hinge
const hinge = (kind = 'db') => {
  const feet = { legN: { ik: [0.5, FOOT_Y], bend: -1 }, legF: { ik: [-1.5, FOOT_Y], bend: -1 } };
  const pose = (hip, torso) => ({ view: 'side', facing: 1, hip, torso, ...feet, armN: [0, 0] });
  return {
    start: pose([-4.5, STAND_HIP_Y + 0.8], 100),
    end: pose([-1, STAND_HIP_Y], 178),
    equip(L, cx) {
      if (kind === 'pullthrough') cableTower(L, cx - 21, FLOOR - 4);
      if (kind === 'machine') { slab(L, cx + 3, 37, cx + 3, 44, 1.6); post(L, cx + 6, 30, FLOOR, 2); beam(L, cx - 4, cx + 10, FLOOR - 1, 1); }
    },
    props(L, cx) {
      if (kind === 'db') { dumbbellSide(L, cx + 9, FLOOR - 2.3); dumbbellSide(L, cx + 13, FLOOR - 2.3); }
      if (kind === 'pullthrough') towerProps(-21, FLOOR - 4, [-10, FLOOR - 6])(L, cx);
    },
    hooks: kind === 'pullthrough' ? cableHooks(-21, FLOOR - 4, 4) : kind === 'db' ? held('db') : undefined,
  };
};

// 背伸展類：45° 背伸展、GHR / 北歐腿彎舉、反向背伸展
const backExt = () => {
  const legs = { legN: { ik: [-8, 49.5], bend: 1, foot: 45 }, legF: { ik: [-8.5, 49.5], bend: 1, foot: 45 } };
  const hip = [0, 40.5];
  return {
    start: { view: 'side', facing: 1, hip, torso: 20, armRel: true, armN: [40, 90], ...legs },
    end: { view: 'side', facing: 1, hip, torso: 132, armRel: true, armN: [40, 90], ...legs },
    equip(L, cx) {
      slab(L, cx + 0.5, 43.5, cx + 4.5, 39.5, 1.5);
      slab(L, cx - 10, 52, cx - 6, 52, 1, EQ.metal, EQ.metalLight);
      capsule(L, cx - 9, FLOOR - 1, cx + 3, 43, 1, EQ.frame);
      beam(L, cx - 12, cx + 6, FLOOR - 1, 1);
    },
  };
};
const nordic = () => {
  const knee = [0, FLOOR - 3.5];
  const pose = (thighAngle, torso) => {
    const r = (thighAngle * Math.PI) / 180;
    return {
      view: 'side', facing: 1,
      hip: [knee[0] - Math.sin(r) * DIM.thigh, knee[1] - Math.cos(r) * DIM.thigh],
      torso, armRel: true, armN: [40, 100],
      legN: [thighAngle, -90, -90], legF: [thighAngle, -90, -90],
    };
  };
  return {
    start: pose(120, 120), end: pose(180, 180),
    equip(L, cx) {
      rect(L, cx - 3, FLOOR - 3, 6, 3, EQ.pad);
      rect(L, cx - 3, FLOOR - 3, 6, 1, EQ.padLight);
      capsule(L, cx - 8, FLOOR - 4, cx - 8, FLOOR - 1, 0.9, EQ.frame);
      beam(L, cx - 10, cx + 4, FLOOR - 1, 1);
    },
  };
};
const reverseHyper = () => {
  const base = { view: 'side', facing: 1, hip: [-2, 37], torso: 95, armN: { ik: [7, 42], bend: 1 } };
  return {
    start: { ...base, legN: [-4, -2], legF: [2, 2] },
    end: { ...base, legN: [-86, -88], legF: [-82, -84] },
    equip(L, cx) {
      rect(L, cx - 2, 39, 12, 3, EQ.pad);
      rect(L, cx - 2, 39, 12, 1, EQ.padLight);
      post(L, cx + 6, 42, FLOOR, 2);
      beam(L, cx + 1, cx + 11, FLOOR - 1, 1);
    },
  };
};

// 腿伸直：坐在機器上，小腿從垂直踢到水平
const MACH_HIP_Y = FLOOR - 13;
const legExtension = () => {
  const base = { view: 'side', facing: 1, hip: [-2, MACH_HIP_Y], torso: 176, armN: { ik: [0, MACH_HIP_Y + 1.5], bend: -1 } };
  return {
    start: { ...base, legN: [88, 6], legF: [86, 4] },
    end: { ...base, legN: [88, 84], legF: [86, 82] },
    equip(L, cx) {
      slab(L, cx - 5, MACH_HIP_Y + 2.6, cx + 3, MACH_HIP_Y + 2.6, 1.4);
      slab(L, cx - 6, MACH_HIP_Y + 1, cx - 6, MACH_HIP_Y - 11, 1.6);
      post(L, cx - 2, MACH_HIP_Y + 4, FLOOR, 2);
      beam(L, cx - 9, cx + 8, FLOOR - 1, 1);
      weightStack(L, cx - 15, FLOOR - 1, 6, 0, 2, 5);
    },
    props(L, cx) {
      capsule(L, cx + 4, MACH_HIP_Y + 5, cx + 5, FLOOR - 4, 0.6, EQ.metalDark);
      disk(L, cx + 5, FLOOR - 4, 1.5, EQ.pad);
    },
    hooks: (s, t, cx) => ({
      behind: (buf) => stampEquip(buf, L => weightStack(L, cx - 15, FLOOR - 1, 6, t * 3, 2, 5)),
      front: (buf) => stampEquip(buf, L => {
        const [ax, ay] = s.legN.end;
        capsule(L, s.legN.mid[0], s.legN.mid[1], ax, ay, 0.5, EQ.metalDark);
        disk(L, ax + 0.5, ay - 0.5, 1.5, EQ.pad);
      }),
    }),
  };
};

// 坐姿腿彎舉：腿伸直放在滾筒上，往下勾到座椅下
const seatedLegCurl = () => {
  const base = { view: 'side', facing: 1, hip: [-3, MACH_HIP_Y], torso: 170, armN: { ik: [1, MACH_HIP_Y - 1], bend: -1 } };
  return {
    start: { ...base, legN: [92, 92], legF: [90, 90] },
    end: { ...base, legN: [92, -8], legF: [90, -10] },
    equip(L, cx) {
      slab(L, cx - 6, MACH_HIP_Y + 2.6, cx + 2, MACH_HIP_Y + 2.6, 1.4);
      slab(L, cx - 7, MACH_HIP_Y + 1, cx - 9, MACH_HIP_Y - 11, 1.6);
      post(L, cx - 3, MACH_HIP_Y + 4, FLOOR, 2);
      beam(L, cx - 10, cx + 10, FLOOR - 1, 1);
      weightStack(L, cx - 17, FLOOR - 1, 6, 0, 2, 5);
    },
    props(L, cx) { disk(L, cx + 14, MACH_HIP_Y + 2, 1.5, EQ.pad); },
    hooks: (s, t, cx) => ({
      behind: (buf) => stampEquip(buf, L => weightStack(L, cx - 17, FLOOR - 1, 6, t * 3, 2, 5)),
      front: (buf) => stampEquip(buf, L => {
        const [ax, ay] = s.legN.end;
        disk(L, ax + 0.8, ay + 1.4, 1.5, EQ.pad);
        rect(L, s.legN.mid[0] - 3, s.legN.mid[1] - 4.2, 5, 2, EQ.pad);
      }),
    }),
  };
};

// 俯臥腿彎舉：趴在凳上，小腿往上勾
const lyingLegCurl = () => {
  const base = { view: 'side', facing: 1, hip: [-2, BENCH_Y - 2.6], torso: 86, tilt: -20, armN: { ik: [9, BENCH_Y + 1], bend: 1 } };
  return {
    start: { ...base, legN: [-90, -92], legF: [-90, -90] },
    end: { ...base, legN: [-90, -172], legF: [-90, -170] },
    equip(L, cx) { flatBench(L, cx - 14, cx + 11, BENCH_Y); weightStack(L, cx - 24, FLOOR - 1, 6, 0, 2, 5); },
    props(L, cx) { disk(L, cx - 15, BENCH_Y - 1, 1.5, EQ.pad); },
    hooks: (s, t, cx) => ({
      behind: (buf) => stampEquip(buf, L => weightStack(L, cx - 24, FLOOR - 1, 6, t * 3, 2, 5)),
      front: (buf) => stampEquip(buf, L => { const [ax, ay] = s.legN.end; disk(L, ax - 0.8, ay - 0.8, 1.5, EQ.pad); }),
    }),
  };
};

// 站姿提踵：踩在踏台邊緣，腳跟上下。smith / db 換手上的東西，machine 有肩墊
const BLOCK_TOP = FLOOR - 3;
const standingCalf = (kind = 'machine') => {
  const pose = (ankleY, foot) => ({
    view: 'side', facing: 1, hip: [-0.5, ankleY - DIM.thigh - DIM.shin + 0.2], torso: 179,
    legN: { ik: [0, ankleY], bend: -1, foot }, legF: { ik: [-1, ankleY], bend: -1, foot },
    armN: kind === 'db' ? [2, 2] : { ik: [-1, ankleY - 22.5], bend: -1 },
  });
  return {
    start: pose(BLOCK_TOP - 0.2, 70), end: pose(BLOCK_TOP - 2.2, 125),
    load: kind === 'smith' ? BARBELL : SINGLE,
    equip(L, cx) {
      rect(L, cx - 2, BLOCK_TOP, 8, 3, EQ.frame);
      rect(L, cx - 2, BLOCK_TOP, 8, 1, EQ.frameLight);
      if (kind === 'machine') { post(L, cx - 9, 18, FLOOR, 2); beam(L, cx - 11, cx - 5, FLOOR - 1, 1); }
      if (kind === 'smith') { post(L, cx - 6, 8, FLOOR, 2); post(L, cx + 4, 8, FLOOR, 2); beam(L, cx - 8, cx + 7, 7, 2); }
    },
    hooks: (s, t, cx) => ({
      front: (buf) => stampEquip(buf, L => {
        const [sx, sy] = s.shoulder;
        if (kind === 'machine') { capsule(L, cx - 8, 19, sx - 1, sy - 2.5, 0.8, EQ.frame); rect(L, sx - 3, sy - 3.5, 6, 2, EQ.pad); }
        if (kind === 'smith') plateSide(L, sx - 0.5, sy - 2.5, 3.2);
        if (kind === 'db') dumbbellSide(L, s.armN.end[0], s.armN.end[1]);
      }),
    }),
  };
};

// 坐姿提踵：膝上壓墊，腳跟上下
const seatedCalf = () => {
  const pose = (ankleY, foot) => ({
    view: 'side', facing: 1, hip: [-4, SEAT_HIP_Y - 3], torso: 178,
    legN: { ik: [3, ankleY], bend: -1, foot }, legF: { ik: [2.5, ankleY], bend: -1, foot },
    armN: { ik: [1, SEAT_HIP_Y - 5], bend: -1 },
  });
  return {
    start: pose(BLOCK_TOP - 0.4, 70), end: pose(BLOCK_TOP - 2.2, 125),
    equip(L, cx) {
      rect(L, cx + 1, BLOCK_TOP, 6, 3, EQ.frame);
      rect(L, cx + 1, BLOCK_TOP, 6, 1, EQ.frameLight);
      slab(L, cx - 8, SEAT_TOP - 3, cx - 1, SEAT_TOP - 3, 1.4);
      post(L, cx - 5, SEAT_TOP - 2, FLOOR, 2);
      post(L, cx + 9, 30, FLOOR, 2);
      beam(L, cx - 9, cx + 11, FLOOR - 1, 1);
    },
    hooks: (s, t, cx) => ({
      front: (buf) => stampEquip(buf, L => {
        const [kx, ky] = s.legN.mid;
        rect(L, kx - 3, ky - 4, 6, 2, EQ.pad);
        capsule(L, kx + 2, ky - 3, cx + 9, 31, 0.7, EQ.frame);
      }),
    }),
  };
};

// ==================== 對照表 ====================

export const FAMILIES = {
  flatPressBarbell: flatPress('barbell'),
  flatPressDb: flatPress('db'),
  flatPressSmith: flatPress('smith'),
  skullCrusher: skullCrusher(),
  inclinePressDb: inclinePress('db'),
  inclinePressBarbell: inclinePress('barbell'),
  inclinePressSmith: inclinePress('smith'),
  machineChest: machineChest(false),
  machineChestIncline: machineChest(true),
  dips: dips(false),
  dipsWeighted: dips(true),
  shoulderPressDb: shoulderPress('db'),
  shoulderPressMachine: shoulderPress('machine'),
  shoulderPressSmith: shoulderPress('smith'),
  lateralRaiseDb: lateralRaise('db'),
  lateralRaiseLean: lateralRaise('lean'),
  lateralRaiseCable: lateralRaise('cable'),
  lateralRaiseMachine: lateralRaise('machine'),
  pushdown: pushdown(),
  crossBodyExt: crossBodyExt(),
  overheadExtDb: overheadExt(false),
  overheadExtCable: overheadExt(true),
  pullUp: pullUp(),
  pulldownNarrow: pulldown(false),
  pulldownWide: pulldown(true),
  straightArm: straightArm(),
  facePull: facePull(),
  cableRow: cableRow(false),
  machineRow: cableRow(true),
  chestRowDb: chestRow('db'),
  chestRowTbar: chestRow('tbar'),
  chestRearFly: chestRow('fly'),
  oneArmRow: oneArmRow(),
  rearFlyDb: rearFly('db'),
  rearFlyCable: rearFly('cable'),
  rearFlyMachine: rearFly('machine'),
  curlDb: curl('db'),
  curlEz: curl('ez'),
  cableCurl: cableCurl(),
  preacher: preacher(),
  inclineCurl: inclineCurl(),
  concentrationCurl: concentrationCurl(),
  legPress: legPress(false),
  legPressCalf: legPress(true),
  beltSquat: squat('belt'),
  pendulumSquat: squat('pendulum'),
  sissySquat: squat('sissy'),
  splitSquat: splitSquat(false),
  stepUp: splitSquat(true),
  rdl: hinge('db'),
  pullThrough: hinge('pullthrough'),
  hipHingeMachine: hinge('machine'),
  backExt: backExt(),
  nordic: nordic(),
  reverseHyper: reverseHyper(),
  legExtension: legExtension(),
  seatedLegCurl: seatedLegCurl(),
  lyingLegCurl: lyingLegCurl(),
  standingCalf: standingCalf('machine'),
  standingCalfSmith: standingCalf('smith'),
  standingCalfDb: standingCalf('db'),
  seatedCalf: seatedCalf(),
};

// 預設菜單與動作庫的每個 id 都要在這裡（測試會擋）
export const FAMILY_BY_ID = {
  bp_flat: 'flatPressBarbell',
  bp_incline_db: 'inclinePressDb',
  lateral_raise: 'lateralRaiseDb',
  lateral_raise_lean: 'lateralRaiseLean',
  tri_pushdown: 'pushdown',
  tri_cross_body: 'crossBodyExt',
  leg_ext: 'legExtension',
  calf_standing_a: 'standingCalf',
  pullup: 'pullUp',
  db_row: 'oneArmRow',
  seated_row: 'cableRow',
  rear_fly: 'rearFlyDb',
  rear_delt_cable: 'rearFlyCable',
  bi_curl: 'curlDb',
  bi_preacher: 'preacher',
  seated_leg_curl_b: 'seatedLegCurl',
  calf_seated_b: 'seatedCalf',
  db_press_seated: 'shoulderPressDb',
  machine_press: 'shoulderPressMachine',
  tri_dips: 'dips',
  lateral_raise_cable: 'lateralRaiseCable',
  lateral_raise_machine: 'lateralRaiseMachine',
  tri_overhead_seated: 'overheadExtDb',
  lib_skullcrusher: 'skullCrusher',
  single_leg_press: 'legPress',
  calf_standing_c: 'standingCalf',
  chest_supported_row: 'chestRowDb',
  pulldown_narrow: 'pulldownNarrow',
  straight_arm_pd: 'straightArm',
  face_pull: 'facePull',
  rear_delt_machine: 'rearFlyMachine',
  bi_hammer: 'curlDb',
  bi_cable: 'cableCurl',
  lying_leg_curl_d: 'lyingLegCurl',
  calf_seated_d: 'seatedCalf',
  leg_press: 'legPress',
  bulgarian_split_db: 'splitSquat',
  rdl_db: 'rdl',
  back_ext_45: 'backExt',
  calf_standing_heavy: 'standingCalf',
  calf_press_legpress: 'legPressCalf',
  lib_flat_db_press: 'flatPressDb',
  lib_machine_press_flat: 'machineChest',
  lib_machine_press_incline: 'machineChestIncline',
  lib_smith_incline: 'inclinePressSmith',
  lib_smith_flat: 'flatPressSmith',
  lib_weighted_dips: 'dipsWeighted',
  lib_incline_bb_press: 'inclinePressBarbell',
  lib_pulldown_wide: 'pulldownWide',
  lib_t_bar_row_chest: 'chestRowTbar',
  lib_machine_row: 'machineRow',
  lib_arnold_press_seated: 'shoulderPressDb',
  lib_smith_seated_press: 'shoulderPressSmith',
  lib_lateral_raise_machine_alt: 'lateralRaiseMachine',
  lib_rear_delt_db_chest: 'chestRearFly',
  lib_close_grip_bp: 'flatPressBarbell',
  lib_tri_rope_overhead_seated: 'overheadExtCable',
  lib_bi_concentration: 'concentrationCurl',
  lib_bi_ez_curl: 'curlEz',
  lib_bi_incline_db: 'inclineCurl',
  lib_belt_squat: 'beltSquat',
  lib_pendulum_squat_noload: 'pendulumSquat',
  lib_sissy_squat: 'sissySquat',
  lib_step_up_db: 'stepUp',
  lib_leg_ext_alt: 'legExtension',
  lib_nordic_curl: 'nordic',
  lib_cable_pullthrough: 'pullThrough',
  lib_reverse_hyper: 'reverseHyper',
  lib_machine_hip_hinge: 'hipHingeMachine',
  lib_glute_ham_raise: 'nordic',
  lib_calf_donkey: 'standingCalf',
  lib_calf_single_leg_db: 'standingCalfDb',
  lib_calf_smith_standing: 'standingCalfSmith',
  lib_calf_seated_alt: 'seatedCalf',
};

// 自訂動作：照肌群（和複合 / 隔離）挑最接近的動作族
const FALLBACK_BY_MUSCLE = {
  CHEST: 'flatPressDb',
  BACK: 'cableRow',
  SHOULDERS: 'shoulderPressDb',
  SIDE_DELT: 'lateralRaiseDb',
  REAR_DELT: 'rearFlyCable',
  TRICEPS: 'pushdown',
  BICEPS: 'curlDb',
  CALVES: 'standingCalf',
};

export const familyKeyOf = (exercise) => {
  const id = exercise?._libraryId ?? exercise?.id;
  if (FAMILY_BY_ID[id]) return FAMILY_BY_ID[id];
  const { muscle, type } = exercise ?? {};
  if (muscle === 'QUADS') return type === 'compound' ? 'legPress' : 'legExtension';
  if (muscle === 'HAMS') return type === 'compound' ? 'rdl' : 'seatedLegCurl';
  return FALLBACK_BY_MUSCLE[muscle] ?? 'curlDb';
};

export const stationOf = (exercise) => {
  const key = familyKeyOf(exercise);
  return { key, family: FAMILIES[key] };
};
