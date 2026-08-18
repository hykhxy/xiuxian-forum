// 功法抽卡引擎（纯函数，roll 可注入便于单测）
// 概率规格：天阶 1% / 地阶 5% / 玄阶 20% / 黄阶 74%
// 妖修「功法抽取概率+5%」：天阶 +5%（自黄阶扣除）；仙阶不进卡池（投稿制稀有获取）
const { PROFESSIONS } = require('./profession');

// 抽卡消耗（灵石/次）
const DRAW_COST = 100;

// 基准概率（合计 1）
const BASE_RATES = [
  { grade: '天阶', weight: 0.01 },
  { grade: '地阶', weight: 0.05 },
  { grade: '玄阶', weight: 0.20 },
  { grade: '黄阶', weight: 0.74 }
];

// 重复功法自动分解返还（灵石）——约为兑换价的 2~4 成
const DECOMPOSE_STONES = { '黄阶': 20, '玄阶': 50, '地阶': 120, '天阶': 300 };

// 妖修加成幅度（effects.techniqueDrawBonusRate = 0.05）
function getDrawBonus(professionKey) {
  const p = PROFESSIONS[professionKey];
  return p ? (p.effects.techniqueDrawBonusRate || 0) : 0;
}

// 品阶概率表：妖修天阶 +bonus，自黄阶扣减
function gradeRates(professionKey) {
  const bonus = getDrawBonus(professionKey);
  const tian = Math.min(BASE_RATES[0].weight + bonus, 0.5); // 上限 50% 防膨胀
  return [
    { grade: '天阶', weight: tian },
    { grade: '地阶', weight: BASE_RATES[1].weight },
    { grade: '玄阶', weight: BASE_RATES[2].weight },
    { grade: '黄阶', weight: Math.max(1 - tian - 0.05 - 0.20, 0) }
  ];
}

// roll ∈ [0,1) → 命中品阶
function pickGrade(roll, professionKey) {
  const rates = gradeRates(professionKey);
  let acc = 0;
  for (const r of rates) {
    acc += r.weight;
    if (roll < acc) return r.grade;
  }
  return rates[rates.length - 1].grade; // 浮点兜底
}

// 从候选数组均匀随机取一（Math.random 可注入场景由调用方传 list 已筛好）
function pickOne(list) {
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

// 空池降级顺序：天→地→玄→黄
const GRADE_FALLBACK = ['天阶', '地阶', '玄阶', '黄阶'];

function fallbackGrades(grade) {
  const idx = GRADE_FALLBACK.indexOf(grade);
  return idx < 0 ? ['黄阶'] : GRADE_FALLBACK.slice(idx);
}

module.exports = {
  DRAW_COST,
  BASE_RATES,
  DECOMPOSE_STONES,
  getDrawBonus,
  gradeRates,
  pickGrade,
  pickOne,
  fallbackGrades
};
