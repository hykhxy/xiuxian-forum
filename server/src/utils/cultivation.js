// 挂机与突破核心逻辑（纯函数，便于单测注入 now / roll）
const { REALMS, getRealmByLevel, getNextRealm } = require('./realm');
const { getIdleRate, getDerivedStats, BASE_STATS } = require('./profession');
const { getBestBonusRate } = require('./reward');

// 每分钟灵气产出 = 境界速率 × 职业挂机倍率 × 功法最高倍率（round 消除 100×1.15 之类浮点尾差）
function idlePerMinute(user) {
  const realm = getRealmByLevel(user.realm);
  return Math.round(realm.rate * getIdleRate(user.profession) * getBestBonusRate(user.practicingTechniques));
}

// 结算挂机：把 [idleStartedAt, now] 期间产出的整数灵气入账，
// 并把 idleStartedAt 前移「已结算部分」，零头秒数继续累计（不丢失进度）
function settleIdle(user, now = new Date()) {
  if (!user.idleStartedAt) return { minutes: 0, gained: 0, perMinute: idlePerMinute(user) };
  const startedAt = new Date(user.idleStartedAt);
  const perMinute = idlePerMinute(user);
  const elapsedMin = Math.max((now - startedAt) / 60000, 0);
  const gained = Math.floor(elapsedMin * perMinute);
  if (gained > 0) {
    user.qi = (user.qi || 0) + gained;
    const consumedMin = gained / perMinute;
    user.idleStartedAt = new Date(startedAt.getTime() + consumedMin * 60000);
  }
  return { minutes: +elapsedMin.toFixed(4), gained, perMinute };
}

// 下一次突破的信息（消耗/成功率/失败惩罚），渡劫无下一步返回 null
function breakthroughInfo(user) {
  const realm = getRealmByLevel(user.realm);
  const next = getNextRealm(user.realm);
  if (!next) return null;
  const stats = getDerivedStats(user.profession);
  const bloodBonus = stats.breakthroughRate - BASE_STATS.breakthroughBaseRate; // 血修 +0.1
  return {
    fromRealm: realm.name,
    toRealm: next.name,
    cost: realm.cost,
    // 成功率 = 境界基准 + 血修加成（血修练气→筑基可达 100%）
    successRate: +(realm.successRate + bloodBonus).toFixed(2),
    // 失败损失 = 消耗 × 0.5 × 惩罚倍率（魔修 ×2 → 全损）
    failLoss: Math.floor(realm.cost * 0.5 * stats.breakthroughPenaltyMultiplier)
  };
}

// 一键突破（roll 可注入以便测试）：先由调用方结算挂机
function attemptBreakthrough(user, roll = Math.random()) {
  const info = breakthroughInfo(user);
  if (!info) {
    return { ok: false, status: 400, message: '已至渡劫境界，无法再突破' };
  }
  if ((user.qi || 0) < info.cost) {
    return { ok: false, status: 400, message: `灵气不足，突破「${info.toRealm}」需 ${info.cost} 灵气（当前 ${user.qi || 0}）` };
  }
  if (roll < info.successRate) {
    user.qi -= info.cost;
    user.realm += 1;
    return {
      ok: true,
      success: true,
      message: `突破成功！迈入「${info.toRealm}」之境`,
      realm: user.realm,
      realmName: getRealmByLevel(user.realm).name,
      cost: info.cost,
      remainQi: user.qi,
      info
    };
  }
  user.qi -= info.failLoss;
  return {
    ok: true,
    success: false,
    message: `突破失败，损失 ${info.failLoss} 灵气`,
    realm: user.realm,
    realmName: getRealmByLevel(user.realm).name,
    lost: info.failLoss,
    remainQi: user.qi,
    info
  };
}

module.exports = { idlePerMinute, settleIdle, breakthroughInfo, attemptBreakthrough };
