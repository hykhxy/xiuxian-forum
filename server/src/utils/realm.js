// 境界体系（第3轮）：8 大境界，突破制（不再由累计经验推导）
// rate        挂机灵气获取速度（灵气/分钟）
// cost        突破到下一境界所需灵气（渡劫为终点，无 cost）
// successRate 突破基准成功率（随境界降低；血修另有 +0.1 加成，见 utils/cultivation.js）
const REALMS = [
  { level: 1, name: '练气', rate: 100,   cost: 1000,   successRate: 0.9 },
  { level: 2, name: '筑基', rate: 200,   cost: 2000,   successRate: 0.8 },
  { level: 3, name: '金丹', rate: 400,   cost: 4000,   successRate: 0.7 },
  { level: 4, name: '元婴', rate: 800,   cost: 8000,   successRate: 0.6 },
  { level: 5, name: '化神', rate: 1600,  cost: 16000,  successRate: 0.5 },
  { level: 6, name: '合体', rate: 3200,  cost: 32000,  successRate: 0.4 },
  { level: 7, name: '大乘', rate: 6400,  cost: 64000,  successRate: 0.3 },
  { level: 8, name: '渡劫', rate: 12800, cost: null,   successRate: null }
];

const MAX_LEVEL = REALMS[REALMS.length - 1].level;

function getRealmByLevel(level) {
  const clamped = Math.min(Math.max(Number(level) || 1, 1), MAX_LEVEL);
  return REALMS.find((r) => r.level === clamped) || REALMS[0];
}

function getNextRealm(level) {
  if (!level || level >= MAX_LEVEL) return null;
  return getRealmByLevel(level + 1);
}

module.exports = { REALMS, MAX_LEVEL, getRealmByLevel, getNextRealm };
