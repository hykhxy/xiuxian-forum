const test = require('node:test');
const assert = require('node:assert');
const { WAR_POSITIONS, simulateBattle, summarize } = require('../utils/warEngine');

const mk = (realm, atk, def, hp, name = '甲') => ({
  userId: name, username: name, realmLevel: realm, total: { atk, def, hp, qi: 0 }
});

test('同境互殴：伤害=max(1,atk-def)，HP先零者败', () => {
  const A = mk(1, 100, 50, 100, '攻');
  const B = mk(1, 60, 50, 130, '守');
  // 每回合 A 打 B 50，B 打 A 10 → B 3回合倒(150>130)，A 剩 100-20=80
  const r = simulateBattle('宗主', A, B);
  assert.strictEqual(r.winner, 'attacker');
  const last = r.rounds[r.rounds.length - 1];
  assert.strictEqual(last.hpB, 0);
  assert.ok(last.hpA > 0);
});

test('跨两境：攻方完全免疫无法破防 → 超时按 HP 百分比判', () => {
  // A(练气) 打 B(金丹) 伤害恒 0；B 打 A 正常 → A 必倒。反向：A 免疫 B 吗？不，B 高两境打 A ×2。
  // 改测：高境攻低境（B 攻 A 被免疫？不——diff=B-A=+2 → ×2 破防）。真正免疫场景：低两境攻击方
  const low = mk(1, 10, 10, 1000, '低');     // 打不出伤害（diff=-2）
  const high = mk(3, 10, 10, 100, '高');      // 每回合 (10-10)→1 → ×2 +低防50% → 1*2+5=7
  const r = simulateBattle('宗主', low, high);
  // low 免疫打 high=0，high 每回合7 → low 1000血需143回合>60 → 超时，比较百分比：low 1000/1000=100% vs high 递减
  assert.strictEqual(r.timeout, true);
  // high HP 在60回合内扣 60×0=0（low 打 high 是 0）→ high 100%？不对：low 打 high diff=-2 → 免疫0
  // high 打 low 每回合 7 → low 60回合后 1000-420=580 → 58% < high 100% → high 胜
  assert.strictEqual(r.winner, 'defender');
});

test('缺员判负', () => {
  const A = mk(1, 10, 0, 100);
  const r1 = simulateBattle('大长老', A, null);
  assert.strictEqual(r1.winner, 'attacker');
  const r2 = simulateBattle('大长老', null, A);
  assert.strictEqual(r2.winner, 'defender');
  const r3 = simulateBattle('大长老', null, null);
  assert.strictEqual(r3.winner, null);
});

test('汇总：胜场多者赢', () => {
  const s1 = summarize([
    { winner: 'attacker' }, { winner: 'attacker' }, { winner: 'defender' },
    { winner: 'attacker' }, { winner: 'defender' }
  ]);
  assert.deepStrictEqual(s1, { score: { attacker: 3, defender: 2 }, result: 'attacker' });
  const s2 = summarize([{ winner: 'draw' }, { winner: 'draw' }, { winner: 'draw' }, { winner: 'draw' }, { winner: 'draw' }]);
  assert.strictEqual(s2.result, 'draw');
});

test('先手：境界高者先手', () => {
  const A = mk(1, 1000, 0, 100, '低攻');   // 一击千伤
  const B = mk(3, 1000, 0, 100, '高攻');
  const r = simulateBattle('宗主', A, B);
  assert.strictEqual(r.rounds[0].by, '高攻'); // B 先手
});
