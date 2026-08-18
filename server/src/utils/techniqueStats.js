// 功法层数系统核心（第16轮）：品阶→层数/成长配置、每层加成计算、升级消耗
// 每层加成 = 基础值 × (1 + growthRate)^(level-1)（与用户示例一致：100×1.25²=156）

const GRADE_LEVEL_CONFIG = {
  '黄阶': { maxLevel: 3, growthRate: 0.05, baseStats: { atk: 15, def: 12, hp: 60, qi: 25, cultivation: 600 } },
  '玄阶': { maxLevel: 4, growthRate: 0.08, baseStats: { atk: 40, def: 32, hp: 160, qi: 70, cultivation: 1200 } },
  '地阶': { maxLevel: 5, growthRate: 0.12, baseStats: { atk: 100, def: 80, hp: 400, qi: 150, cultivation: 2500 } },
  '天阶': { maxLevel: 8, growthRate: 0.18, baseStats: { atk: 250, def: 200, hp: 1000, qi: 400, cultivation: 5000 } },
  '仙阶': { maxLevel: 9, growthRate: 0.25, baseStats: { atk: 600, def: 480, hp: 2400, qi: 1000, cultivation: 10000 } }
};

const STAT_KEYS = ['atk', 'def', 'hp', 'qi', 'cultivation'];

// 计算达到第 level 层时的总加成（各项独立指数成长，round 取整）
function calcLevelStats(baseStats, growthRate, level) {
  const out = {};
  for (const k of STAT_KEYS) {
    const base = Number(baseStats[k]) || 0;
    out[k] = Math.round(base * Math.pow(1 + growthRate, level - 1));
  }
  return out;
}

// 层与层之间的增量（升级收益预览）
function statsDiff(a, b) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = (b[k] || 0) - (a[k] || 0);
  return out;
}

// 升到第 targetLevel 层需要消耗的灵气（基础修炼成本 × 目标层）
function levelUpCost(baseStats, targetLevel) {
  return Math.round((Number(baseStats.cultivation) || 0) * targetLevel);
}

// 由品阶生成完整功法数值（seed/投稿用；可传 multiplier 做同品阶浮动 ±20%）
function buildGradeStats(grade, multiplier = 1) {
  const cfg = GRADE_LEVEL_CONFIG[grade];
  if (!cfg) return null;
  const baseStats = {};
  for (const k of STAT_KEYS) {
    baseStats[k] = Math.max(1, Math.round(cfg.baseStats[k] * multiplier));
  }
  return {
    maxLevel: cfg.maxLevel,
    growthRate: cfg.growthRate,
    baseStats
  };
}

// 面板相关四维（cultivation 为升级成本维度，不计入战斗面板）
function combatKeys(stats) {
  return { atk: stats.atk || 0, def: stats.def || 0, hp: stats.hp || 0, qi: stats.qi || 0 };
}

module.exports = {
  GRADE_LEVEL_CONFIG,
  STAT_KEYS,
  calcLevelStats,
  statsDiff,
  levelUpCost,
  buildGradeStats,
  combatKeys
};
