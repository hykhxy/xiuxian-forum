const test = require('node:test');
const assert = require('node:assert');
const {
  getBestBonusRate,
  grantExp,
  shanghaiDateKey,
  prevDateKey,
  monthStartKey,
  calcConsecutiveDays,
  GRADE_CONFIG
} = require('../utils/reward');

test('功法加成：取最高不叠加', () => {
  assert.strictEqual(getBestBonusRate([]), 1);
  assert.strictEqual(getBestBonusRate(null), 1);
  assert.strictEqual(getBestBonusRate([{ expBonusRate: 1.1 }, { expBonusRate: 1.4 }, { expBonusRate: 1.05 }]), 1.4);
  assert.strictEqual(getBestBonusRate([{ expBonusRate: 1.1 }]), 1.1);
});

test('grantExp：应用加成并刷新境界', () => {
  const user = { exp: 9, realmLevel: 1, practicingTechniques: [{ expBonusRate: 1.1 }] };
  const gained = grantExp(user, 10); // floor(10 * 1.1) = 11
  assert.strictEqual(gained, 11);
  assert.strictEqual(user.exp, 20);
  assert.strictEqual(user.realmLevel, 2); // 20 ≥ 10 → 练气二层
});

test('grantExp：无加成时按基础值', () => {
  const user = { exp: 0, realmLevel: 1, practicingTechniques: [] };
  assert.strictEqual(grantExp(user, 5), 5);
});

test('grantExp：加成结果向下取整', () => {
  const user = { exp: 0, realmLevel: 1, practicingTechniques: [{ expBonusRate: 1.05 }] };
  assert.strictEqual(grantExp(user, 3), Math.floor(3 * 1.05)); // 3.15 → 3
});

test('grantExp：法修灵气获取+20% 与功法倍率乘算', () => {
  // 10 × 1.05(功法) × 1.2(法修) = 12.6 → 12
  const user = { exp: 0, realmLevel: 1, profession: 'mage', practicingTechniques: [{ expBonusRate: 1.05 }] };
  assert.strictEqual(grantExp(user, 10), 12);
  // 纯法修无功法：10 × 1.2 = 12
  const mageOnly = { exp: 0, realmLevel: 1, profession: 'mage', practicingTechniques: [] };
  assert.strictEqual(grantExp(mageOnly, 10), 12);
});

test('grantExp：魔修全属性+10% 作用于灵气获取', () => {
  const user = { exp: 0, realmLevel: 1, profession: 'demon', practicingTechniques: [] };
  assert.strictEqual(grantExp(user, 10), 11);
});

test('grantExp：非法修职业无灵气加成', () => {
  const user = { exp: 0, realmLevel: 1, profession: 'sword', practicingTechniques: [] };
  assert.strictEqual(grantExp(user, 10), 10);
});

test('签到日期按东八区计算（Render 服务器为 UTC）', () => {
  // UTC 17日 17:00 = 东八区 18日 01:00
  assert.strictEqual(shanghaiDateKey(new Date('2026-08-17T17:00:00Z')), '2026-08-18');
  // UTC 17日 15:59 = 东八区 17日 23:59
  assert.strictEqual(shanghaiDateKey(new Date('2026-08-17T15:59:00Z')), '2026-08-17');
});

test('prevDateKey 跨月/跨年', () => {
  assert.strictEqual(prevDateKey('2026-09-01'), '2026-08-31');
  assert.strictEqual(prevDateKey('2026-03-01'), '2026-02-28');
  assert.strictEqual(prevDateKey('2027-01-01'), '2026-12-31');
});

test('monthStartKey', () => {
  assert.strictEqual(monthStartKey('2026-08-18'), '2026-08-01');
});

test('连续签到天数', () => {
  assert.strictEqual(calcConsecutiveDays(null, '2026-08-18'), 1);
  assert.strictEqual(calcConsecutiveDays({ date: '2026-08-17', consecutiveDays: 3 }, '2026-08-18'), 4);
  // 昨天没签 → 重新从 1 开始
  assert.strictEqual(calcConsecutiveDays({ date: '2026-08-15', consecutiveDays: 2 }, '2026-08-18'), 1);
  // 第 7 天触发连续奖励判定（7 % 7 === 0）
  assert.strictEqual(calcConsecutiveDays({ date: '2026-08-11', consecutiveDays: 6 }, '2026-08-12'), 7);
});

test('品阶配置完整', () => {
  for (const [grade, cfg] of Object.entries(GRADE_CONFIG)) {
    assert.ok(cfg.price > 0, `${grade} 价格应大于 0`);
    assert.ok(cfg.expBonusRate > 1, `${grade} 加成应大于 1`);
    assert.ok(cfg.requiredRealmLevel >= 1, `${grade} 境界要求应 ≥ 1`);
  }
  // 品阶越高加成越高
  assert.ok(GRADE_CONFIG['仙阶'].expBonusRate > GRADE_CONFIG['黄阶'].expBonusRate);
});
