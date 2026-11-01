// 執行：npm test
// 健身房模式的器材對照表與每個動作族的姿勢：每個動作都有器材、每個狀態都畫得出來、人物不跑出畫面

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { DEFAULT_EXERCISE_LIBRARY, WORKOUTS } from '../../../constants/workouts';
import { FAMILIES, FAMILY_BY_ID, familyKeyOf, stationOf } from './stations.js';
import { buildWorld, createView, renderFrame, SCENE_H } from './scene.js';
import { solvePose, lerpPose } from './rig.js';

const PAGE = 119; // 390 寬手機：358 / 3

test('預設菜單和動作庫的每個動作都對應到存在的動作族', () => {
  const ids = new Set([
    ...DEFAULT_EXERCISE_LIBRARY.map(e => e.id),
    ...Object.values(WORKOUTS).flatMap(w => w.exercises.map(e => e.id)),
  ]);
  for (const id of ids) {
    assert.ok(FAMILY_BY_ID[id], `${id} 沒有對應的動作族`);
    assert.ok(FAMILIES[FAMILY_BY_ID[id]], `${id} → ${FAMILY_BY_ID[id]} 不存在`);
  }
  for (const key of Object.values(FAMILY_BY_ID)) assert.ok(FAMILIES[key], `${key} 不存在`);
});

test('替換過的動作照替換後的動作畫（_libraryId 優先）', () => {
  assert.equal(familyKeyOf({ id: 'bp_flat', _libraryId: 'lib_flat_db_press' }), 'flatPressDb');
  assert.equal(familyKeyOf({ id: 'pullup' }), 'pullUp');
});

test('自訂動作照肌群（和複合 / 隔離）挑動作族，認不得的肌群也有東西畫', () => {
  const custom = (muscle, type = 'isolation') => familyKeyOf({ id: 'custom_1', muscle, type });
  assert.equal(custom('CHEST', 'compound'), 'flatPressDb');
  assert.equal(custom('SIDE_DELT'), 'lateralRaiseDb');
  assert.equal(custom('QUADS', 'compound'), 'legPress');
  assert.equal(custom('QUADS', 'isolation'), 'legExtension');
  assert.equal(custom('HAMS', 'compound'), 'rdl');
  assert.equal(custom('HAMS', 'isolation'), 'seatedLegCurl');
  assert.equal(custom('???'), 'curlDb');
  assert.ok(stationOf({ id: 'custom_2', muscle: 'BACK' }).family);
});

// 人物關節都在畫面裡、而且是有限數字（NaN 會讓整個人物畫不出來）
const assertInside = (s, cx, label) => {
  const pts = [s.hip, s.neck, s.head];
  const limbs = s.view === 'front' ? [s.armL, s.armR, s.legL, s.legR] : [s.armN, s.armF, s.legN, s.legF];
  for (const l of limbs) pts.push(l.mid, l.end);
  for (const [x, y] of pts) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), `${label}：關節不是數字`);
    assert.ok(y >= 0 && y <= SCENE_H, `${label}：y=${y.toFixed(1)} 超出畫面`);
    assert.ok(Math.abs(x - cx) <= PAGE / 2, `${label}：x 離站點中心 ${(x - cx).toFixed(1)}`);
  }
};

const changedPixels = (view, world) => {
  let n = 0;
  for (let y = 0; y < view.h; y++) {
    for (let x = 0; x < view.w; x++) {
      if (view.px[y * view.w + x] !== world.buf.px[y * world.buf.w + x]) n++;
    }
  }
  return n;
};

test('每個動作族：做動作的起點、中間、終點都在畫面裡，畫得出人物', () => {
  for (const [key, family] of Object.entries(FAMILIES)) {
    const cx = Math.round(PAGE / 2);
    for (const t of [0, 0.5, 1]) {
      assertInside(solvePose(lerpPose(family.start, family.end, t), cx), cx, `${key} t=${t}`);
    }
    const world = buildWorld([{ family }], PAGE);
    for (const mode of ['idle', 'lift', 'rest', 'ready', 'cheer', 'walk']) {
      const view = createView(PAGE + 1);
      renderFrame(view, world, { camX: 0, time: 0.5, character: { mode, station: 0, walkPhase: 1, facing: 1 } });
      assert.ok(changedPixels(view, world) > 80, `${key} ${mode}：人物沒畫出來`);
    }
  }
});

test('整條背景：每站一頁寬，鏡頭停在哪一站畫面就切那一段', () => {
  const families = [FAMILIES.flatPressBarbell, FAMILIES.pullUp, FAMILIES.legPress];
  const world = buildWorld(families.map(family => ({ family })), PAGE);
  assert.equal(world.buf.w, PAGE * 3 + 2);
  const view = createView(PAGE + 1);
  // 鏡頭拉過最後一站（拖曳的阻力區）也不會讀出界，超出的地方是透明
  renderFrame(view, world, { camX: PAGE * 2.6, time: 0, character: { mode: 'walk', station: 2, walkPhase: 0, facing: -1 } });
  assert.notEqual(view.px[0], 0);
  assert.equal(view.px[view.w - 1], 0);
});
