const test = require('node:test');
const assert = require('node:assert');
const {
  DRAW_COST,
  BASE_RATES,
  DECOMPOSE_STONES,
  getDrawBonus,
  gradeRates,
  pickGrade,
  pickOne,
  fallbackGrades
} = require('../utils/draw');

test('基准概率规格：天1% 地5% 玄20% 黄74%，合计为 1', () => {
  const total = BASE_RATES.reduce((s, r) => s + r.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.deepStrictEqual(
    BASE_RATES.map((r) => r.grade),
    ['天阶', '地阶', '玄阶', '黄阶']
  );
  assert.strictEqual(BASE_RATES[0].weight, 0.01);
  assert.strictEqual(BASE_RATES[1].weight, 0.05);
  assert.strictEqual(BASE_RATES[2].weight, 0.20);
  assert.strictEqual(BASE_RATES[3].weight, 0.74);
});

test('pickGrade 分区边界（注入 roll，留浮点余量）', () => {
  assert.strictEqual(pickGrade(0, null), '天阶');         // roll < 0.01
  assert.strictEqual(pickGrade(0.0099, null), '天阶');
  assert.strictEqual(pickGrade(0.01, null), '地阶');      // 0.01 ≤ roll < 0.06
  assert.strictEqual(pickGrade(0.0599, null), '地阶');
  assert.strictEqual(pickGrade(0.0601, null), '玄阶');    // 0.06 ≤ roll < 0.26（0.06 恰在浮点边界上，取 0.0601）
  assert.strictEqual(pickGrade(0.2599, null), '玄阶');
  assert.strictEqual(pickGrade(0.26, null), '黄阶');      // 0.26 ≤ roll < 1
  assert.strictEqual(pickGrade(0.999, null), '黄阶');
});

test('妖修：天阶+5%（自黄阶扣，地玄不变）', () => {
  assert.strictEqual(getDrawBonus('monster'), 0.05);
  assert.strictEqual(getDrawBonus('mage'), 0);
  const r = gradeRates('monster');
  assert.strictEqual(r[0].grade, '天阶');
  assert.ok(Math.abs(r[0].weight - 0.06) < 1e-9);   // 1%+5%
  assert.strictEqual(r[1].weight, 0.05);
  assert.strictEqual(r[2].weight, 0.20);
  assert.ok(Math.abs(r[3].weight - 0.69) < 1e-9);   // 74%-5%
  const total = r.reduce((s, x) => s + x.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, '概率合计仍为 1');
  // 妖修边界：roll=0.059 时命中天阶（普修为地阶）；0.0601 起进入地阶（避开浮点边界 0.06）
  assert.strictEqual(pickGrade(0.059, 'monster'), '天阶');
  assert.strictEqual(pickGrade(0.059, null), '地阶');
  assert.strictEqual(pickGrade(0.0601, 'monster'), '地阶');
});

test('非妖修职业无抽卡加成', () => {
  ['sword', 'mage', 'ghost', 'blood', 'demon', 'body', null, undefined].forEach((p) => {
    const r = gradeRates(p);
    assert.ok(Math.abs(r[0].weight - 0.01) < 1e-9, `${p} 天阶应为 1%`);
  });
});

test('pickOne：空数组返回 null / 单元素必中', () => {
  assert.strictEqual(pickOne([]), null);
  assert.strictEqual(pickOne(null), null);
  const only = { id: 1 };
  assert.strictEqual(pickOne([only]), only);
});

test('fallbackGrades 降级顺序', () => {
  assert.deepStrictEqual(fallbackGrades('天阶'), ['天阶', '地阶', '玄阶', '黄阶']);
  assert.deepStrictEqual(fallbackGrades('地阶'), ['地阶', '玄阶', '黄阶']);
  assert.deepStrictEqual(fallbackGrades('玄阶'), ['玄阶', '黄阶']);
  assert.deepStrictEqual(fallbackGrades('黄阶'), ['黄阶']);
  assert.deepStrictEqual(fallbackGrades('仙阶'), ['黄阶']); // 非卡池品阶兜底
});

test('分解返还表与消耗常量（期望值为净亏，无套利）', () => {
  assert.strictEqual(DRAW_COST, 100);
  assert.strictEqual(DECOMPOSE_STONES['黄阶'], 20);
  assert.strictEqual(DECOMPOSE_STONES['玄阶'], 50);
  assert.strictEqual(DECOMPOSE_STONES['地阶'], 120);
  assert.strictEqual(DECOMPOSE_STONES['天阶'], 300);
  // 全重复场景的期望返还 ≈33.8 灵气/次，远低于成本 100（抽卡长期净亏，不可刷灵石）
  const prices = { '黄阶': 50, '玄阶': 120, '地阶': 300, '天阶': 800 };
  const weights = { '黄阶': 0.74, '玄阶': 0.20, '地阶': 0.05, '天阶': 0.01 };
  let expectedRefund = 0;
  for (const [g, refund] of Object.entries(DECOMPOSE_STONES)) {
    assert.ok(refund < prices[g], `${g} 分解 ${refund} 应低于兑换价 ${prices[g]}`);
    expectedRefund += refund * weights[g];
  }
  assert.ok(expectedRefund < DRAW_COST, `全重复期望返还 ${expectedRefund.toFixed(1)} 应低于成本 ${DRAW_COST}`);
});

test('统计性验证：100 万次抽样频率收敛于概率（±0.5%）', () => {
  const counts = { '天阶': 0, '地阶': 0, '玄阶': 0, '黄阶': 0 };
  const N = 1000000;
  for (let i = 0; i < N; i++) counts[pickGrade(Math.random(), null)]++;
  const expect = { '天阶': 0.01, '地阶': 0.05, '玄阶': 0.20, '黄阶': 0.74 };
  for (const [g, p] of Object.entries(expect)) {
    const freq = counts[g] / N;
    assert.ok(Math.abs(freq - p) < 0.005, `${g} 频率 ${freq.toFixed(4)} 偏离 ${p}`);
  }
});
