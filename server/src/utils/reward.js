const { getExpGainRate } = require('./profession');

// 经济与奖励规则
const REWARDS = {
  registerStones: 100,      // 注册赠送灵石
  postQi: 10,               // 发帖灵气
  commentQi: 3,             // 评论灵气
  checkinQi: 5,             // 每日签到灵气
  checkinStones: 2,         // 每日签到灵石
  streakEvery: 7,           // 连续签到奖励周期（天）
  streakBonusQi: 20,        // 连续奖励：额外灵气
  streakBonusStones: 10,    // 连续奖励：额外灵石
  submitAcceptedQi: 15,     // 功法投稿被采纳：灵气
  submitAcceptedStones: 20  // 功法投稿被采纳：灵石
};

// 品阶 → 功法数值（由品阶自动生成，投稿人不可自定）
// requiredRealmLevel 对应 8 境界：黄阶练气可修，仙阶需化神
const GRADE_CONFIG = {
  '黄阶': { expBonusRate: 1.05, price: 50, requiredRealmLevel: 1 },
  '玄阶': { expBonusRate: 1.10, price: 120, requiredRealmLevel: 2 },
  '地阶': { expBonusRate: 1.15, price: 300, requiredRealmLevel: 3 },
  '天阶': { expBonusRate: 1.25, price: 800, requiredRealmLevel: 4 },
  '仙阶': { expBonusRate: 1.40, price: 2000, requiredRealmLevel: 5 }
};

// 已修炼功法中的最高灵气加成倍率（取最高不叠加，防膨胀）
function getBestBonusRate(practicing = []) {
  if (!Array.isArray(practicing) || practicing.length === 0) return 1;
  return practicing.reduce((max, t) => {
    const rate = Number(t && t.expBonusRate) || 1;
    return rate > max ? rate : max;
  }, 1);
}

// 给用户发放灵气：功法最高倍率 × 职业灵气倍率（法修+20%/魔修+10%），向下取整；返回实际获得值
function grantQi(user, baseQi) {
  const rate = getBestBonusRate(user.practicingTechniques) * getExpGainRate(user.profession);
  const gained = Math.floor(baseQi * rate);
  user.qi = (user.qi || 0) + gained;
  return gained;
}

// 签到日期统一按东八区（Asia/Shanghai）计算，避免服务器 UTC 错位 8 小时
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
  grantQi,
  shanghaiDateKey,
  prevDateKey,
  monthStartKey,
  calcConsecutiveDays
};
