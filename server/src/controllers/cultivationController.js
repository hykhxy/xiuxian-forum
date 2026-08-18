const { settleIdle, idlePerMinute, breakthroughInfo, attemptBreakthrough } = require('../utils/cultivation');
const { getRealmByLevel, getNextRealm } = require('../utils/realm');

// POST /api/cultivation/idle/start 开始挂机
async function startIdle(req, res) {
  const user = req.user;
  if (user.idleStartedAt) {
    return res.status(400).json({ success: false, message: '已在挂机中，无需重复开始' });
  }
  user.idleStartedAt = new Date();
  await user.save();
  res.json({
    success: true,
    data: {
      idleStartedAt: user.idleStartedAt,
      perMinute: idlePerMinute(user),
      realmName: user.realmName,
      qi: user.qi
    }
  });
}

// POST /api/cultivation/idle/stop 结束挂机并结算
async function stopIdle(req, res) {
  const user = req.user;
  if (!user.idleStartedAt) {
    return res.status(400).json({ success: false, message: '当前未在挂机' });
  }
  const result = settleIdle(user);
  const durationMinutes = result.minutes;
  user.idleStartedAt = null;
  await user.save();
  res.json({
    success: true,
    data: {
      durationMinutes: +durationMinutes.toFixed(2),
      gained: result.gained,
      perMinute: result.perMinute,
      qi: user.qi,
      realmName: user.realmName
    }
  });
}

// GET /api/cultivation/status 修行面板（访问即结算挂机收益 —— 「下次访问时」语义）
async function getStatus(req, res) {
  const user = req.user;
  const settled = settleIdle(user);
  if (settled.gained > 0) await user.save(); // 有入账才落库，避免高频空写

  const realm = getRealmByLevel(user.realm);
  const next = getNextRealm(user.realm);
  const info = breakthroughInfo(user);
  res.json({
    success: true,
    data: {
      realm: { level: realm.level, name: realm.name },
      nextRealm: next ? { level: next.level, name: next.name } : null,
      qi: user.qi,
      idleRatePerMinute: idlePerMinute(user),
      isIdling: !!user.idleStartedAt,
      idleStartedAt: user.idleStartedAt,
      justSettled: settled.gained, // 本次访问自动结算的灵气
      breakthrough: info,          // null = 已至渡劫
      spiritStones: user.spiritStones
    }
  });
}

// POST /api/cultivation/breakthrough 一键突破
async function breakthrough(req, res) {
  const user = req.user;
  settleIdle(user); // 突破前先把挂机产出结算入账
  const result = attemptBreakthrough(user);
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message });
  }
  await user.save();
  const realm = getRealmByLevel(user.realm);
  const nextInfo = breakthroughInfo(user); // 突破后的下一次信息
  res.json({
    success: true,
    data: {
      success: result.success,
      message: result.message,
      realm: { level: realm.level, name: realm.name },
      qi: user.qi,
      lost: result.lost || 0,
      nextBreakthrough: nextInfo
    }
  });
}

module.exports = { startIdle, stopIdle, getStatus, breakthrough };
