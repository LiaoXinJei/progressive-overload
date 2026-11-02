// 執行：npm test
// 健身房模式的槓片：重量拆成槓片、掛一片、卸一片，照點的順序疊

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { BARBELL, EZ_BAR, SINGLE, platesOf, addPlate, removePlate, stackOf } from './plates.js';
import { FAMILIES } from './stations.js';
import { buildWorld, placeTree } from './scene.js';

test('槓鈴：扣掉空槓、兩邊對分，大的在內', () => {
  assert.deepEqual(platesOf(80, BARBELL), [20, 10]);
  assert.deepEqual(platesOf(102.5, BARBELL), [20, 20, 1.25]);
  assert.deepEqual(platesOf(20, BARBELL), [], '空槓');
  assert.deepEqual(platesOf(15, BARBELL), [], '比空槓輕');
  assert.deepEqual(platesOf('', BARBELL), []);
  // 湊不出來的零頭不畫（81 = 每邊 30.5）
  assert.deepEqual(platesOf(81, BARBELL), [20, 10]);
  assert.deepEqual(platesOf(30, EZ_BAR), [10]);
});

test('其他器材：一片就是一片的重量', () => {
  assert.deepEqual(platesOf(27.5, SINGLE), [20, 5, 2.5]);
  assert.deepEqual(platesOf('12', SINGLE), [10, 1.25], '湊不滿的零頭（0.75）不畫');
});

test('掛一片：槓鈴兩邊各一片；比空槓輕或沒填就從空槓開始', () => {
  assert.equal(addPlate(80, 10, BARBELL), 100);
  assert.equal(addPlate('', 20, BARBELL), 60);
  assert.equal(addPlate(10, 1.25, BARBELL), 22.5);
  assert.equal(addPlate(6.25, 1.25, SINGLE), 7.5);
  assert.equal(addPlate('', 5, SINGLE), 5);
});

test('卸一片：槓鈴兩邊各卸一片，不會變負的', () => {
  assert.equal(removePlate(100, 10, BARBELL), 80);
  assert.equal(removePlate(81, 10, BARBELL), 61);
  assert.equal(removePlate(2, 5, SINGLE), 0);
});

test('照點的順序疊：重量沒在別的地方改過就用點的順序，改過就重新拆', () => {
  const memo = { weight: 100, plates: [20, 10, 10] };
  assert.deepEqual(stackOf(100, BARBELL, memo), [20, 10, 10]);
  assert.deepEqual(stackOf('100', BARBELL, memo), [20, 10, 10], '存成字串也算同一個重量');
  assert.deepEqual(stackOf(90, BARBELL, memo), [20, 10, 5]);
  assert.deepEqual(stackOf(100, BARBELL, null), [20, 20]);
});

test('槓片架：每個動作族都擺得進自己那一頁，不跑到隔壁站', () => {
  for (const pageW of [64, 65, 72, 80]) {
    for (const [key, family] of Object.entries(FAMILIES)) {
      const spot = placeTree(family, pageW);
      // 柱子 2 格寬，槓片左右各伸出約 8 格
      assert.ok(Math.abs(spot.dx) + 10 <= pageW / 2 + 1, `${key} @${pageW}：dx=${spot.dx} 超出這一頁`);
    }
  }
  const world = buildWorld([{ family: FAMILIES.flatPressBarbell }, { family: FAMILIES.pullUp }], 65, 20, 6);
  assert.equal(world.trees.length, 2);
  assert.equal(world.buf.h, 20 + 64 + 6, '舞台上下多出來的牆和地板');
});
