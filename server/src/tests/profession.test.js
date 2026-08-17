const test = require('node:test');
const assert = require('node:assert');
const {
  PROFESSIONS,
  PROFESSION_KEYS,
  getProfession,
  getExpGainRate,
  getDerivedStats,
  toProfessionInfo
} = require('../utils/profession');

test('七职业定义齐全', () => {
  assert.deepStrictEqual(
    [...PROFESSION_KEYS].sort(),
    ['blood', 'body', 'demon', 'ghost', 'mage', 'monster', 'sword']
  );
  for (const key of PROFESSION_KEYS) {
    const p = PROFESSIONS[key];
    assert.ok(p.name && p.desc, `${key} 应有名称与描述`);
  }
});

test('getProfession 非法值返回 null', () => {
  assert.strictEqual(getProfession('hacker'), null);
  assert.strictEqual(getProfession(undefined), null);
});

test('剑修：攻击力+20%', () => {
  const s = getDerivedStats('sword');
  assert.strictEqual(s.attack, 120);
  assert.strictEqual(s.maxHp, 1000); // 其他属性不受影响
  assert.strictEqual(s.expGainRate, 1);
});

test('法修：灵气获取+20%', () => {
  assert.strictEqual(getExpGainRate('mage'), 1.2);
  const s = getDerivedStats('mage');
  assert.strictEqual(s.expGainRate, 1.2);
  assert.strictEqual(s.attack, 100);
});

test('鬼修：挂机速度+15%', () => {
  assert.strictEqual(getDerivedStats('ghost').idleSpeed, 115);
});

test('血修：突破成功率+10%（基准0.5→0.6）', () => {
  assert.strictEqual(getDerivedStats('blood').breakthroughRate, 0.6);
});

test('妖修：功法抽取概率+5%（基准0.05→0.10）', () => {
  assert.strictEqual(getDerivedStats('monster').techniqueDrawRate, 0.1);
});

test('魔修：全属性+10% 且突破惩罚翻倍', () => {
  const s = getDerivedStats('demon');
  assert.strictEqual(s.attack, 110);
  assert.strictEqual(s.maxHp, 1100);
  assert.strictEqual(s.idleSpeed, 110);
  assert.strictEqual(s.expGainRate, 1.1); // 灵气获取也属全属性
  assert.strictEqual(s.breakthroughPenaltyMultiplier, 2);
});

test('体修：气血上限+50%', () => {
  assert.strictEqual(getDerivedStats('body').maxHp, 1500);
});

test('无职业（历史用户）：基线属性，无惩罚', () => {
  const s = getDerivedStats(undefined);
  assert.strictEqual(s.attack, 100);
  assert.strictEqual(s.maxHp, 1000);
  assert.strictEqual(s.expGainRate, 1);
  assert.strictEqual(s.breakthroughPenaltyMultiplier, 1);
  assert.strictEqual(getExpGainRate(null), 1);
});

test('toProfessionInfo 序列化（不含 effects 内部结构）', () => {
  const info = toProfessionInfo('mage');
  assert.deepStrictEqual(Object.keys(info).sort(), ['desc', 'key', 'name', 'slogan']);
  assert.strictEqual(toProfessionInfo('nope'), null);
});
