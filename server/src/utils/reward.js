const { calcRealmLevel } = require('./realm');
const { getExpGainRate } = require('./profession');

// 经济与奖励规则
const REWARDS = {
  registerStones: 100,      // 注册赠送灵石
  postExp: 10,              // 发帖修为
  commentExp: 3,            // 评论修为
  checkinExp: 5,            // 每日签到修为
  checkinStones: 2,         // 每日签到灵石
  streakEvery: 7,           // 连续签到奖励周期（天）
  streakBonusExp: 20,       // 连续奖励：额外修为
  streakBonusStones: 10,    // 连续奖励：额外灵石
  submitAcceptedExp: 15,    // 功法投稿被采纳：修为
  submitAcceptedStones: 20  // 功法投稿被采纳：灵石
};

// 品阶 → 功法数值（由品阶自动生成，投稿人不可自定）
const GRADE_CONFIG = {
  '黄阶': { expBonusRate: 1.05, price: 50, requiredRealmLevel: 1 },
  '玄阶': { expBonusRate: 1.10, price: 120, requiredRealmLevel: 4 },
  '地阶': { expBonusRate: 1.15, price: 300, requiredRealmLevel: 7 },
  '天阶': { expBonusRate: 1.25, price: 800, requiredRealmLevel: 10 },
  '仙阶': { expBonusRate: 1.40, price: 2000, requiredRealmLevel: 13 }
};

// 已修炼功法中的最高修为加成倍率（取最高不叠加，防膨胀）
function getBestBonusRate(practicing = []) {
  if (!Array.isArray(practicing) || practicing.length === 0) return 1;
  return practicing.reduce((max, t) => {
    const rate = Number(t && t.expBonusRate) || 1;
    return rate > max ? rate : max;
  }, 1);
}

// 给用户发放修为：功法最高倍率 × 职业灵气加成（法修+20%/魔修+10%），向下取整，
// 同时刷新境界等级；返回实际获得值
function grantExp(user, baseExp) {
  const rate = getBestBonusRate(user.practicingTechniques) * getExpGainRate(user.profession);
  const gained = Math.floor(baseExp * rate);
  user.exp = (user.exp || 0) + gained;
  user.realmLevel = calcRealmLevel(user.exp);
  return gained;
}

// 签到日期统一按东八区（Asia/Shanghai）计算，避免 Render 的 UTC 服务器错位 8 小时
function shanghaiDateKey(date = new Date()) {
  const t = new Date(date.getTime() + 8 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

function prevDateKey(dateKey) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 本月第一天（东八区），用于签到日历
function monthStartKey(dateKey) {
  return dateKey.slice(0, 7) + '-01';
}

// 今日连续签到天数：昨天有记录则在昨天基础上 +1，否则重新从 1 开始
function calcConsecutiveDays(lastRecord, todayKey) {
  if (lastRecord && lastRecord.date === prevDateKey(todayKey)) {
    return (lastRecord.consecutiveDays || 0) + 1;
  }
  return 1;
}

module.exports = {
  REWARDS,
  GRADE_CONFIG,
  getBestBonusRate,
  grantExp,
  shanghaiDateKey,
  prevDateKey,
  monthStartKey,
  calcConsecutiveDays
};
