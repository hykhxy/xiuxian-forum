const test = require('node:test');
const assert = require('node:assert');
const {
  idlePerMinute,
  settleIdle,
  breakthroughInfo,
  attemptBreakthrough
} = require('../utils/cultivation');

const MIN = 60 * 1000;

function mkUser(overrides = {}) {
  return Object.assign(
    { qi: 0, realm: 1, profession: null, practicingTechniques: [], idleStartedAt: null },
    overrides
  );
}

// ---------- 挂机产出速率 ----------
test('idlePerMinute：基础=境界速率（练气100/分）', () => {
  assert.strictEqual(idlePerMinute(mkUser()), 100);
});

test('idlePerMinute：每境界翻倍', () => {
  assert.strictEqual(idlePerMinute(mkUser({ realm: 2 })), 200);
  assert.strictEqual(idlePerMinute(mkUser({ realm: 5 })), 1600);
  assert.strictEqual(idlePerMinute(mkUser({ realm: 8 })), 12800);
});

test('idlePerMinute：法修×1.2、鬼修×1.15、功法最高倍率', () => {
  assert.strictEqual(idlePerMinute(mkUser({ profession: 'mage' })), 120);
  assert.strictEqual(idlePerMinute(mkUser({ profession: 'ghost' })), 115);
  assert.strictEqual(
    idlePerMinute(mkUser({ profession: 'mage', practicingTechniques: [{ expBonusRate: 1.05 }] })),
    126 // 100×1.2×1.05
  );
});

test('idlePerMinute：魔修全属性只计一次（110，非121）', () => {
  assert.strictEqual(idlePerMinute(mkUser({ profession: 'demon' })), 110);
});

// ---------- 挂机结算 ----------
test('settleIdle：未挂机返回 0 且不动 qi', () => {
  const u = mkUser({ qi: 42 });
  const r = settleIdle(u);
  assert.strictEqual(r.gained, 0);
  assert.strictEqual(u.qi, 42);
  assert.strictEqual(u.idleStartedAt, null);
});

test('settleIdle：时长×速度入账（2.5分钟×100=250）', () => {
  const now = new Date('2026-08-18T10:00:00Z');
  const u = mkUser({ idleStartedAt: new Date(now - 2.5 * MIN) });
  const r = settleIdle(u, now);
  assert.strictEqual(r.gained, 250);
  assert.strictEqual(u.qi, 250);
});

test('settleIdle：小数向下取整且零头保留继续累计', () => {
  const now = new Date('2026-08-18T10:00:00Z');
  // 0.021 分钟 × 100/分 = 2.1 → 结算 2，剩 0.001 分钟（60ms）
  const u = mkUser({ idleStartedAt: new Date(now.getTime() - 0.021 * MIN) });
  const r = settleIdle(u, now);
  assert.strictEqual(r.gained, 2);
  // idleStartedAt 前移 0.02 分钟，剩 ~60ms 零头
  const remainMs = now - new Date(u.idleStartedAt);
  assert.ok(Math.abs(remainMs - 60) < 2, `零头应约60ms，实际 ${remainMs}`);
});

test('settleIdle：分段结算不丢总量', () => {
  const start = new Date('2026-08-18T10:00:00Z');
  const u = mkUser({ idleStartedAt: start });
  settleIdle(u, new Date(start.getTime() + 1 * MIN)); // +100
  settleIdle(u, new Date(start.getTime() + 2 * MIN)); // +100
  const r = settleIdle(u, new Date(start.getTime() + 3.02 * MIN)); // +102
  assert.strictEqual(u.qi, 302);
  assert.strictEqual(r.gained, 102);
});

// ---------- 突破信息 ----------
test('breakthroughInfo：练气→筑基 1000灵气/90%', () => {
  const info = breakthroughInfo(mkUser());
  assert.strictEqual(info.fromRealm, '练气');
  assert.strictEqual(info.toRealm, '筑基');
  assert.strictEqual(info.cost, 1000);
  assert.strictEqual(info.successRate, 0.9);
  assert.strictEqual(info.failLoss, 500); // 常人失败损一半
});

test('breakthroughInfo：血修成功率+10%', () => {
  assert.strictEqual(breakthroughInfo(mkUser({ profession: 'blood' })).successRate, 1); // 0.9+0.1
  // 大乘 0.3+0.1=0.4
  assert.strictEqual(breakthroughInfo(mkUser({ profession: 'blood', realm: 7 })).successRate, 0.4);
});

test('breakthroughInfo：魔修失败惩罚翻倍（failLoss=全额）', () => {
  const info = breakthroughInfo(mkUser({ profession: 'demon' }));
  assert.strictEqual(info.failLoss, 1000); // 1000×0.5×2
});

test('breakthroughInfo：渡劫无下一步返回 null', () => {
  assert.strictEqual(breakthroughInfo(mkUser({ realm: 8 })), null);
});

// ---------- 一键突破 ----------
test('突破：渡劫境界返回 400', () => {
  const r = attemptBreakthrough(mkUser({ realm: 8, qi: 999999 }));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.ok(/渡劫/.test(r.message));
});

test('突破：灵气不足返回 400 且不扣费', () => {
  const u = mkUser({ qi: 999 });
  const r = attemptBreakthrough(u);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 400);
  assert.ok(/灵气不足/.test(r.message));
  assert.strictEqual(u.qi, 999);
});

test('突破成功：扣全额、realm+1', () => {
  const u = mkUser({ qi: 1000 });
  const r = attemptBreakthrough(u, 0.05); // roll < 0.9 成功
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.success, true);
  assert.strictEqual(u.realm, 2);
  assert.strictEqual(u.qi, 0);
  assert.ok(/筑基/.test(r.message));
});

test('突破失败：常人损失一半', () => {
  const u = mkUser({ qi: 1000 });
  const r = attemptBreakthrough(u, 0.95); // roll ≥ 0.9 失败
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.success, false);
  assert.strictEqual(u.realm, 1);
  assert.strictEqual(u.qi, 500); // 损失 500
  assert.strictEqual(r.lost, 500);
});

test('突破失败：魔修惩罚翻倍（全损）', () => {
  const u = mkUser({ profession: 'demon', qi: 1000 });
  const r = attemptBreakthrough(u, 0.95);
  assert.strictEqual(r.success, false);
  assert.strictEqual(u.qi, 0); // 1000×0.5×2 全损
  assert.strictEqual(r.lost, 1000);
});

test('突破成功率边界：roll 恰等于成功率算成功（roll < rate）', () => {
  const u = mkUser({ qi: 1000 });
  const r = attemptBreakthrough(u, 0.9); // 0.9 < 0.9 为假 → 失败
  assert.strictEqual(r.success, false);
});
