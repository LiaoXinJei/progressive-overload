// 執行：npm test
// 像素繪圖基本元件

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { rgb, createBuffer, capsule, polygon, stamp, blit, rect, getPx } from './pixel.js';

const RED = rgb('#FF0000');
const INK = rgb('#000001');
const count = (buf, c) => buf.px.reduce((n, p) => n + (p === c ? 1 : 0), 0);

test('rgb：存成 ImageData 的位元組順序（R、G、B、A）', () => {
  const buf = createBuffer(1, 1);
  buf.px[0] = rgb('#102030');
  assert.deepEqual([...buf.bytes], [0x10, 0x20, 0x30, 255]);
});

test('capsule：半徑 1.5、中心線在像素中間的水平線段是 3 格粗', () => {
  const buf = createBuffer(20, 10);
  capsule(buf, 5, 5.5, 15, 5.5, 1.5, RED);
  const column = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(y => getPx(buf, 10, y) === RED);
  assert.deepEqual(column, [4, 5, 6]);
});

test('polygon：填滿三角形內部，外面不動', () => {
  const buf = createBuffer(10, 10);
  polygon(buf, [[0, 0], [10, 0], [0, 10]], RED);
  assert.equal(getPx(buf, 1, 1), RED);
  assert.equal(getPx(buf, 9, 9), 0);
});

test('stamp：圖層蓋上去時外圍描一圈邊，裡面維持原色', () => {
  const dst = createBuffer(10, 10);
  const layer = createBuffer(10, 10);
  rect(layer, 4, 4, 2, 2, RED);
  stamp(dst, layer, INK);
  assert.equal(count(dst, RED), 4);
  assert.equal(count(dst, INK), 8); // 2×2 方塊的上下左右各兩格
  assert.equal(getPx(dst, 3, 4), INK);
  assert.equal(getPx(dst, 3, 3), 0); // 斜角不描
});

test('blit：從長圖切一段，超出來源的部分透明', () => {
  const src = createBuffer(6, 2);
  rect(src, 0, 0, 6, 2, RED);
  const dst = createBuffer(4, 2);
  blit(dst, src, 4);
  assert.equal(getPx(dst, 1, 0), RED);
  assert.equal(getPx(dst, 2, 0), 0);
});
