const test = require('node:test');
const assert = require('node:assert');
const { REALM_BASE_STATS, realmBase, calcPanel, calculateDamage } = require('../utils/combat');

test('境界基础表：前5境界与用户给定表一致', () => {
  assert.deepStrictEqual(
    REALM_BASE_STATS.slice(0, 5).map((r) => [r.atk, r.def, r.hp, r.qi]),
    [[10, 10, 100, 50], [50, 40, 500, 200], [200, 150, 2000, 800], [800, 600, 8000, 3000], [3000, 2000, 30000, 10000]]
  );
});

test('境界基础表：8 境界以此类推（合体/大乘/渡劫递增）', () => {
  assert.strictEqual(REALM_BASE_STATS.length, 8);
  for (let i = 1; i < 8; i++) {
    assert.ok(REALM_BASE_STATS[i].atk > REALM_BASE_STATS[i - 1].atk);
  }
  assert.strictEqual(realmBase(8).name, '渡劫');
  assert.strictEqual(realmBase(0).level, 1);   // 钳位
  assert.strictEqual(realmBase(99).level, 8);
});

test('面板：境界基础 + Σ功法加成（装备预留0）', () => {
  const user = { realm: 1, profession: null, practicingTechniques: [] };
  const panel = calcPanel(user, [{ atk: 10, def: 5, hp: 50, qi: 20, cultivation: 999 }]);
  assert.deepStrictEqual(panel.total, { atk: 20, def: 15, hp: 150, qi: 70 });
  assert.deepStrictEqual(panel.fromEquipment, { atk: 0, def: 0, hp: 0, qi: 0 });
});

test('面板：职业加成作用于境界基础（剑修炼气→攻×1.2）', () => {
  const plain = calcPanel({ realm: 3, profession: null }, []);
  const sword = calcPanel({ realm: 3, profession: 'sword' }, []);
  assert.strictEqual(sword.base.atk, Math.round(plain.base.atk * 1.2));
  assert.strictEqual(sword.base.def, plain.base.def);
});

test('面板：体修血量+50%（作用于基础）', () => {
  const body = calcPanel({ realm: 1, profession: 'body' }, []);
  assert.strictEqual(body.base.hp, 150);
});

const mk = (realm, atk, def, hp) => ({ realmLevel: realm, total: { atk, def, hp, qi: 100 } });

test('伤害：同境界基础计算 + 最低1点保底', () => {
  // 攻100 守90防 → 100-90=10
  assert.strictEqual(calculateDamage(mk(1, 100, 0, 1000), mk(1, 0, 90, 1000)), 10);
  // 攻10 守999防 → 保底1
  assert.strictEqual(calculateDamage(mk(1, 10, 0, 1000), mk(1, 0, 999, 999999)), 1);
});

test('伤害：低两个境界完全免疫（0）', () => {
  assert.strictEqual(calculateDamage(mk(1, 999999, 0, 1000), mk(3, 0, 0, 999999)), 0);
  assert.strictEqual(calculateDamage(mk(2, 999999, 0, 1000), mk(8, 0, 0, 999999)), 0);
});

test('伤害：低一个境界 ×0.3 且 ≤守方血量5%', () => {
  const def = mk(3, 0, 0, 10000);         // 5% = 500
  const atk = mk(2, 1000, 0, 1000);       // 基础伤 1000-0=1000
  const d = calculateDamage(atk, def);
  assert.strictEqual(d, 300);              // 1000×0.3=300 ≤500
  // 巨额伤害被 5% 血量封顶
  const atk2 = mk(2, 100000, 0, 1000);
  assert.strictEqual(calculateDamage(atk2, def), 500);
});

test('伤害：高一个境界 ×1.3', () => {
  const atk = mk(3, 100, 0, 1000);
  const def = mk(2, 0, 0, 999999);
  assert.strictEqual(calculateDamage(atk, def), Math.round(100 * 1.3));
});

test('伤害：高两个境界 ×2 且无视50%防御', () => {
  const atk = mk(3, 1000, 0, 1000);
  const def = mk(1, 0, 400, 2000);
  // 基础 = 1000-400=600 → ×2=1200 + 400×0.5=200 → 1400
  assert.strictEqual(calculateDamage(atk, def), 1400);
  assert.strictEqual(calculateDamage(mk(8, 100000, 60000, 1000000), mk(1, 0, 10, 100)), Math.round((100000 - 10) * 2 + 5));
});

test('伤害：返回值为整数', () => {
  const d = calculateDamage(mk(1, 103, 33, 500), mk(1, 33, 17, 500));
  assert.ok(Number.isInteger(d));
});
