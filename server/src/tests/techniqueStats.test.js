const test = require('node:test');
const assert = require('node:assert');
const {
  GRADE_LEVEL_CONFIG,
  calcLevelStats,
  statsDiff,
  levelUpCost,
  buildGradeStats,
  combatKeys
} = require('../utils/techniqueStats');

test('品阶→最大层数映射（仙9/天8/地5/玄4/黄3）', () => {
  assert.strictEqual(GRADE_LEVEL_CONFIG['仙阶'].maxLevel, 9);
  assert.strictEqual(GRADE_LEVEL_CONFIG['天阶'].maxLevel, 8);
  assert.strictEqual(GRADE_LEVEL_CONFIG['地阶'].maxLevel, 5);
  assert.strictEqual(GRADE_LEVEL_CONFIG['玄阶'].maxLevel, 4);
  assert.strictEqual(GRADE_LEVEL_CONFIG['黄阶'].maxLevel, 3);
});

test('成长系数（仙0.25/天0.18/地0.12/玄0.08/黄0.05）', () => {
  assert.strictEqual(GRADE_LEVEL_CONFIG['仙阶'].growthRate, 0.25);
  assert.strictEqual(GRADE_LEVEL_CONFIG['天阶'].growthRate, 0.18);
  assert.strictEqual(GRADE_LEVEL_CONFIG['地阶'].growthRate, 0.12);
  assert.strictEqual(GRADE_LEVEL_CONFIG['玄阶'].growthRate, 0.08);
  assert.strictEqual(GRADE_LEVEL_CONFIG['黄阶'].growthRate, 0.05);
});

test('成长公式：基础100 系数0.25 第3层 → 156（用户示例）', () => {
  const s = calcLevelStats({ atk: 100, def: 80, hp: 500, qi: 200, cultivation: 2000 }, 0.25, 3);
  assert.strictEqual(s.atk, 156);           // 100×1.25²=156.25→156
  assert.strictEqual(s.cultivation, 3125);  // 2000×1.5625=3125
});

test('第1层等于基础值；层数越高单调递增', () => {
  const base = { atk: 15, def: 12, hp: 60, qi: 25, cultivation: 600 };
  const l1 = calcLevelStats(base, 0.05, 1);
  assert.strictEqual(l1.atk, 15);
  const l3 = calcLevelStats(base, 0.05, 3);
  assert.ok(l3.atk > l1.atk);
  assert.ok(l3.hp >= Math.round(60 * 1.05 * 1.05));
});

test('仙阶指数成长显著（满层 9 层）', () => {
  const cfg = GRADE_LEVEL_CONFIG['仙阶'];
  const l9 = calcLevelStats(cfg.baseStats, cfg.growthRate, 9);
  const l1 = calcLevelStats(cfg.baseStats, cfg.growthRate, 1);
  assert.ok(l9.atk > l1.atk * 4.5, `9层(${l9.atk}) 应远超1层(${l1.atk})`);
});

test('statsDiff 增量计算', () => {
  const d = statsDiff({ atk: 100, def: 80, hp: 500, qi: 200, cultivation: 2000 },
                      { atk: 125, def: 100, hp: 625, qi: 250, cultivation: 2500 });
  assert.deepStrictEqual(d, { atk: 25, def: 20, hp: 125, qi: 50, cultivation: 500 });
});

test('升层消耗 = cultivation × 目标层', () => {
  assert.strictEqual(levelUpCost({ cultivation: 1000 }, 1), 1000);
  assert.strictEqual(levelUpCost({ cultivation: 1000 }, 3), 3000);
});

test('buildGradeStats：各品阶完整数值 + 浮动', () => {
  const std = buildGradeStats('地阶');
  assert.strictEqual(std.maxLevel, 5);
  assert.strictEqual(std.growthRate, 0.12);
  assert.ok(std.baseStats.atk > 0);
  const boosted = buildGradeStats('地阶', 1.2);
  assert.strictEqual(boosted.baseStats.atk, Math.round(std.baseStats.atk * 1.2));
  assert.strictEqual(buildGradeStats('神阶'), null);
});

test('combatKeys 剔除 cultivation', () => {
  const c = combatKeys({ atk: 1, def: 2, hp: 3, qi: 4, cultivation: 999 });
  assert.deepStrictEqual(c, { atk: 1, def: 2, hp: 3, qi: 4 });
});
