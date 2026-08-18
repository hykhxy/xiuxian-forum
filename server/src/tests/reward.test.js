const test = require('node:test');
const assert = require('node:assert');
const {
  REWARDS,
  GRADE_CONFIG,
  getBestBonusRate,
  grantQi,
  shanghaiDateKey,
  prevDateKey,
  monthStartKey,
  calcConsecutiveDays
} = require('../utils/reward');

test('功法加成：取最高不叠加', () => {
  assert.strictEqual(getBestBonusRate([]), 1);
  assert.strictEqual(getBestBonusRate(null), 1);
  assert.strictEqual(getBestBonusRate([{ expBonusRate: 1.1 }, { expBonusRate: 1.4 }, { expBonusRate: 1.05 }]), 1.4);
});

test('grantQi：法修灵气+20% 与功法倍率乘算', () => {
  const user = { qi: 0, profession: 'mage', practicingTechniques: [{ expBonusRate: 1.05 }] };
  assert.strictEqual(grantQi(user, 10), 12); // 10×1.05×1.2=12.6→12
  assert.strictEqual(user.qi, 12);
});

test('grantQi：魔修全属性+10%', () => {
  const user = { qi: 0, profession: 'demon', practicingTechniques: [] };
  assert.strictEqual(grantQi(user, 10), 11);
});

test('grantQi：无加成按基础值；小数向下取整', () => {
  const plain = { qi: 0, profession: 'sword', practicingTechniques: [] };
  assert.strictEqual(grantQi(plain, 10), 10);
  const frac = { qi: 0, profession: 'sword', practicingTechniques: [{ expBonusRate: 1.05 }] };
  assert.strictEqual(grantQi(frac, 3), 3); // 3.15→3
});

test('功法品阶境界要求映射到 8 境界体系', () => {
  assert.strictEqual(GRADE_CONFIG['黄阶'].requiredRealmLevel, 1); // 练气
  assert.strictEqual(GRADE_CONFIG['玄阶'].requiredRealmLevel, 2); // 筑基
  assert.strictEqual(GRADE_CONFIG['地阶'].requiredRealmLevel, 3); // 金丹
  assert.strictEqual(GRADE_CONFIG['天阶'].requiredRealmLevel, 4); // 元婴
  assert.strictEqual(GRADE_CONFIG['仙阶'].requiredRealmLevel, 5); // 化神
});

test('签到日期按东八区计算', () => {
  assert.strictEqual(shanghaiDateKey(new Date('2026-08-17T17:00:00Z')), '2026-08-18');
  assert.strictEqual(shanghaiDateKey(new Date('2026-08-17T15:59:00Z')), '2026-08-17');
});

test('prevDateKey 跨月/跨年', () => {
  assert.strictEqual(prevDateKey('2026-09-01'), '2026-08-31');
  assert.strictEqual(prevDateKey('2027-01-01'), '2026-12-31');
});

test('monthStartKey', () => {
  assert.strictEqual(monthStartKey('2026-08-18'), '2026-08-01');
});

test('连续签到天数', () => {
  assert.strictEqual(calcConsecutiveDays(null, '2026-08-18'), 1);
  assert.strictEqual(calcConsecutiveDays({ date: '2026-08-17', consecutiveDays: 3 }, '2026-08-18'), 4);
  assert.strictEqual(calcConsecutiveDays({ date: '2026-08-15', consecutiveDays: 2 }, '2026-08-18'), 1);
});

test('奖励常量更名后数值不变', () => {
  assert.strictEqual(REWARDS.postQi, 10);
  assert.strictEqual(REWARDS.commentQi, 3);
  assert.strictEqual(REWARDS.checkinQi, 5);
  assert.strictEqual(REWARDS.submitAcceptedQi, 15);
});
