const test = require('node:test');
const assert = require('node:assert');
const { REALMS, MAX_LEVEL, getRealmByLevel, getNextRealm } = require('../utils/realm');

test('八大境界齐全有序', () => {
  assert.deepStrictEqual(REALMS.map((r) => r.name), ['练气', '筑基', '金丹', '元婴', '化神', '合体', '大乘', '渡劫']);
  assert.strictEqual(MAX_LEVEL, 8);
});

test('挂机灵气速度按规格且逐级翻倍', () => {
  const rates = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
  REALMS.forEach((r, i) => assert.strictEqual(r.rate, rates[i], `${r.name} 速度应为 ${rates[i]}`));
  for (let i = 1; i < REALMS.length; i++) {
    assert.strictEqual(REALMS[i].rate, REALMS[i - 1].rate * 2, `${REALMS[i].name} 速度应翻倍`);
  }
});

test('突破消耗随境界上升', () => {
  for (let i = 1; i < REALMS.length - 1; i++) {
    assert.ok(REALMS[i].cost > REALMS[i - 1].cost, `${REALMS[i].name} 消耗应高于上一境界`);
  }
  assert.strictEqual(REALMS[7].cost, null); // 渡劫为终点
});

test('基准成功率随境界降低', () => {
  for (let i = 1; i < REALMS.length - 1; i++) {
    assert.ok(REALMS[i].successRate < REALMS[i - 1].successRate);
  }
  assert.strictEqual(REALMS[0].successRate, 0.9); // 练气→筑基 90%
  assert.strictEqual(REALMS[6].successRate, 0.3); // 大乘→渡劫 30%
  assert.strictEqual(REALMS[7].successRate, null);
});

test('getRealmByLevel 钳位', () => {
  assert.strictEqual(getRealmByLevel(1).name, '练气');
  assert.strictEqual(getRealmByLevel(5).name, '化神');
  assert.strictEqual(getRealmByLevel(0).name, '练气');  // 非法值回退
  assert.strictEqual(getRealmByLevel(99).name, '渡劫');
  assert.strictEqual(getRealmByLevel(undefined).name, '练气');
});

test('getNextRealm', () => {
  assert.strictEqual(getNextRealm(1).name, '筑基');
  assert.strictEqual(getNextRealm(7).name, '渡劫');
  assert.strictEqual(getNextRealm(8), null); // 渡劫无下一境
  assert.strictEqual(getNextRealm(MAX_LEVEL), null);
});
