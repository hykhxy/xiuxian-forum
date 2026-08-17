const test = require('node:test');
const assert = require('node:assert');
const { calcRealmLevel, getRealmByLevel, getNextRealm, MAX_LEVEL } = require('../utils/realm');

test('修为 0 → 练气一层', () => {
  assert.strictEqual(calcRealmLevel(0), 1);
});

test('边界：差 1 点修为不突破', () => {
  assert.strictEqual(calcRealmLevel(9), 1);
  assert.strictEqual(calcRealmLevel(10), 2);
  assert.strictEqual(calcRealmLevel(799), 9);
  assert.strictEqual(calcRealmLevel(800), 10);
});

test('高境界换算', () => {
  assert.strictEqual(calcRealmLevel(520), 9);   // 练气九层
  assert.strictEqual(calcRealmLevel(49999), 17); // 渡劫期
  assert.strictEqual(calcRealmLevel(50000), 18); // 仙人
  assert.strictEqual(calcRealmLevel(999999), 18);
});

test('getRealmByLevel 钳位处理', () => {
  assert.strictEqual(getRealmByLevel(10).name, '筑基期');
  assert.strictEqual(getRealmByLevel(0).name, '练气一层'); // 非法值回退到 1 级
  assert.strictEqual(getRealmByLevel(99).name, '仙人');
});

test('getNextRealm', () => {
  assert.strictEqual(getNextRealm(9).name, '筑基期');
  assert.strictEqual(getNextRealm(1).name, '练气二层');
  assert.strictEqual(getNextRealm(MAX_LEVEL), null); // 仙人已无更高境界
});
