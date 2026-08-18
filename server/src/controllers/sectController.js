// 宗门（第17轮）：创建/列表/详情/加入退出/任命/公告/解散/宣战
const Sect = require('../models/Sect');
const War = require('../models/War');
const User = require('../models/User');
const { POSITIONS, JOIN_DEFAULT, can, resolveAppointment } = require('../utils/sectRoles');
const { WAR_POSITIONS } = require('../utils/warEngine');
const { calcPanel } = require('../utils/combat');

const CREATE_COST = 100;   // 创建消耗灵石（新用户注册礼金等额，全数入宗库）

function sectCard(s, user) {
  const leaderId = [...s.roles.entries()].find(([, r]) => r === '宗主')?.[0];
  return {
    id: s._id,
    name: s.name,
    memberCount: s.members.length,
    prestige: s.prestige,
    treasury: s.treasury,
    leaderName: (s.populated('members') && s.members.find((m) => String(m._id) === leaderId)?.username) || leaderId || '佚名',
    victory: !!(s.victoryUntil && s.victoryUntil > new Date()),
    defeated: !!(s.defeatedAt && Date.now() - new Date(s.defeatedAt) < 7 * 86400 * 1000),
    isMember: !!(user && s.members.some((m) => String(m) === String(user._id))),
    createdAt: s.createdAt
  };
}

// POST /api/sects { name }
async function create(req, res) {
  const user = req.user;
  const name = String((req.body || {}).name || '').trim();
  if (name.length < 2 || name.length > 12) {
    return res.status(400).json({ success: false, message: '宗门名需 2-12 字' });
  }
  if (user.spiritStones < CREATE_COST) {
    return res.status(400).json({ success: false, message: `创建宗门需 ${CREATE_COST} 灵石（当前 ${user.spiritStones}）` });
  }
  const existingSect = await Sect.findOne({ members: user._id, status: 'normal' });
  if (existingSect) {
    return res.status(409).json({ success: false, message: `你已身在「${existingSect.name}」，不可再立宗门` });
  }
  if (await Sect.exists({ name })) {
    return res.status(409).json({ success: false, message: '宗门名已被占用' });
  }

  user.spiritStones -= CREATE_COST;
  await user.save();

  const sect = await Sect.create({
    name,
    founder: user._id,
    members: [user._id],
    roles: new Map([[String(user._id), '宗主']]),
    treasury: CREATE_COST,
    announcement: { content: `${name} 立派开山，广纳天下英才。`, updatedBy: user._id, updatedAt: new Date() }
  });
  res.status(201).json({ success: true, data: { sect: sectCard(sect, user) } });
}

// GET /api/sects
async function list(req, res) {
  const sects = await Sect.find({ status: 'normal' }).populate('members', 'username').sort({ prestige: -1, createdAt: -1 });
  res.json({ success: true, data: { list: sects.map((s) => sectCard(s, req.user)), createCost: CREATE_COST } });
}

// GET /api/sects/:id （可选登录：成员可见完整信息）
async function detail(req, res) {
  const s = await Sect.findById(req.params.id).populate('members', 'username avatar realm realmName profession');
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  const memberInfo = s.members.map((m) => ({
    id: m._id,
    username: m.username,
    avatar: m.avatar,
    realmName: m.realmName,
    role: s.roles.get(String(m._id)) || JOIN_DEFAULT
  })).sort((a, b) => POSITIONS.indexOf(a.role) - POSITIONS.indexOf(b.role));

  const me = req.user;
  const myRole = me ? (s.roles.get(String(me._id)) || null) : null;
  res.json({
    success: true,
    data: {
      sect: {
        ...sectCard(s, me),
        announcement: s.announcement,
        members: memberInfo,
        myRole,
        perms: {
          appoint: can('appoint', myRole),
          announce: can('announce', myRole),
          declareWar: can('declareWar', myRole),
          dissolve: can('dissolve', myRole)
        }
      }
    }
  });
}

// POST /api/sects/:id/join
async function join(req, res) {
  const s = await Sect.findById(req.params.id);
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  const user = req.user;
  if (s.members.some((m) => String(m) === String(user._id))) {
    return res.status(400).json({ success: false, message: '你已是本门弟子' });
  }
  const other = await Sect.findOne({ members: user._id, status: 'normal' });
  if (other) return res.status(409).json({ success: false, message: `你已身在「${other.name}」，需先退出` });
  if (s.members.length >= 50) return res.status(400).json({ success: false, message: '宗门弟子已满（50）' });

  s.members.push(user._id);
  s.roles.set(String(user._id), JOIN_DEFAULT);
  await s.save();
  res.json({ success: true, data: { role: JOIN_DEFAULT, memberCount: s.members.length } });
}

// POST /api/sects/:id/leave
async function leave(req, res) {
  const s = await Sect.findById(req.params.id);
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  const uid = String(req.user._id);
  if (!s.members.some((m) => String(m) === uid)) return res.status(400).json({ success: false, message: '你不在本门' });
  if (s.roles.get(uid) === '宗主') {
    return res.status(400).json({ success: false, message: '宗主不可直接退门，请先转让宗主或解散宗门' });
  }
  s.members = s.members.filter((m) => String(m) !== uid);
  s.roles.delete(uid);
  await s.save();
  res.json({ success: true, data: { success: true } });
}

// PUT /api/sects/:id/roles { userId, role }
async function setRole(req, res) {
  const s = await Sect.findById(req.params.id);
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  const myRole = s.roles.get(String(req.user._id));
  if (!can('appoint', myRole)) return res.status(403).json({ success: false, message: '仅宗主可任命/罢免' });

  const { userId, role } = req.body || {};
  if (!POSITIONS.includes(role)) return res.status(400).json({ success: false, message: '职务不合法' });
  if (!s.members.some((m) => String(m) === String(userId))) {
    return res.status(400).json({ success: false, message: '该修士不在本门' });
  }
  if (String(userId) === String(req.user._id) && role !== '宗主') {
    return res.status(400).json({ success: false, message: '不可罢免自己（转让宗主除外）' });
  }

  resolveAppointment(s.roles, userId, role);
  s.roles.set(String(userId), role);
  await s.save();
  res.json({ success: true, data: { role } });
}

// PUT /api/sects/:id/announcement { content }
async function setAnnouncement(req, res) {
  const s = await Sect.findById(req.params.id);
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  const myRole = s.roles.get(String(req.user._id));
  if (!can('announce', myRole)) {
    return res.status(403).json({ success: false, message: '仅宗主/副宗主/大长老可发布公告' });
  }
  const content = String((req.body || {}).content || '').trim().slice(0, 1000);
  if (!content) return res.status(400).json({ success: false, message: '公告内容不能为空' });
  s.announcement = { content, updatedBy: req.user._id, updatedAt: new Date() };
  await s.save();
  res.json({ success: true, data: { announcement: s.announcement } });
}

// POST /api/sects/:id/dissolve
async function dissolve(req, res) {
  const s = await Sect.findById(req.params.id);
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  if (!can('dissolve', s.roles.get(String(req.user._id)))) {
    return res.status(403).json({ success: false, message: '仅宗主可解散宗门' });
  }
  s.status = 'dissolved';
  await s.save();
  res.json({ success: true, data: { success: true } });
}

// ---------- 宣战编队 ----------
// 按职务桶自动编队：每职务取面板攻最高者；缺员该位置留空（判负）
async function buildTeam(sect) {
  const buckets = new Map(WAR_POSITIONS.map((p) => [p, []]));
  for (const m of sect.members) {
    const role = sect.roles.get(String(m)) || JOIN_DEFAULT;
    if (!buckets.has(role)) buckets.set(role, []);
    buckets.get(role).push(m);
  }
  const team = [];
  for (const pos of WAR_POSITIONS) {
    const ids = buckets.get(pos) || [];
    if (!ids.length) { team.push({ position: pos, user: null }); continue; }
    const users = await User.find({ _id: { $in: ids } });
    let best = null, bestAtk = -1;
    for (const u of users) {
      const panel = calcPanel(u, (u.practicingTechniques || []).map((p) => p.currentStats || {}));
      if (panel.total.atk > bestAtk) { bestAtk = panel.total.atk; best = { u, panel }; }
    }
    team.push({
      position: pos,
      user: best.u._id,
      username: best.u.username,
      realmLevel: best.u.realm,
      total: best.panel.total
    });
  }
  return team;
}

// POST /api/sects/:id/declare-war { targetId, warType }
async function declareWar(req, res) {
  const s = await Sect.findById(req.params.id);
  if (!s || s.status === 'dissolved') return res.status(404).json({ success: false, message: '宗门不存在或已解散' });
  if (!can('declareWar', s.roles.get(String(req.user._id)))) {
    return res.status(403).json({ success: false, message: '仅宗主/副宗主可宣战' });
  }
  const { targetId, warType } = req.body || {};
  if (!['武斗', '文斗'].includes(warType)) return res.status(400).json({ success: false, message: '战斗类型须为 武斗/文斗' });
  const target = await Sect.findById(targetId);
  if (!target || target.status === 'dissolved') return res.status(404).json({ success: false, message: '目标宗门不存在或已解散' });
  if (String(target._id) === String(s._id)) return res.status(400).json({ success: false, message: '不可向自己宣战' });

  const active = await War.findOne({
    status: { $ne: '已结束' },
    $or: [
      { attackerSect: s._id }, { defenderSect: s._id },
      { attackerSect: target._id }, { defenderSect: target._id }
    ]
  });
  if (active) return res.status(409).json({ success: false, message: '两宗之间已有进行中的战争' });

  const [attackerTeam, defenderTeam] = await Promise.all([buildTeam(s), buildTeam(target)]);
  const war = await War.create({
    attackerSect: s._id,
    defenderSect: target._id,
    warType,
    status: warType === '文斗' ? '进行中' : '准备中',  // 文斗即刻进入问答
    attackerTeam,
    defenderTeam,
    rounds: warType === '文斗' ? Array.from({ length: 5 }, () => ({})) : []
  });
  res.status(201).json({ success: true, data: { warId: war._id, warType, status: war.status } });
}

module.exports = { create, list, detail, join, leave, setRole, setAnnouncement, dissolve, declareWar };
