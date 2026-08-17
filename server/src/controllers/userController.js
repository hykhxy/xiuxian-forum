const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const CheckIn = require('../models/CheckIn');
const { toPostSummary } = require('../utils/serialize');
const {
  REWARDS,
  grantExp,
  shanghaiDateKey,
  monthStartKey,
  calcConsecutiveDays
} = require('../utils/reward');

// GET /api/users/:id （可选登录：本人可见灵石/邮箱等私有字段）
async function getPublicProfile(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  const obj = user.toJSON();
  const isSelf = !!req.userId && req.userId === String(user._id);
  res.json({
    success: true,
    data: {
      user: {
        id: obj._id,
        username: obj.username,
        avatar: obj.avatar,
        bio: obj.bio,
        role: obj.role,
        exp: obj.exp,
        realmLevel: obj.realmLevel,
        realmName: obj.realmName,
        postCount: obj.postCount,
        commentCount: obj.commentCount,
        createdAt: obj.createdAt,
        practicingTechniques: isSelf ? obj.practicingTechniques : undefined,
        spiritStones: isSelf ? obj.spiritStones : undefined,
        email: isSelf ? obj.email : undefined
      },
      isSelf
    }
  });
}

// PUT /api/users/me
async function updateMe(req, res) {
  const user = req.user;
  const { bio, avatar } = req.body || {};
  if (bio !== undefined) user.bio = String(bio).slice(0, 200);
  if (avatar !== undefined) user.avatar = String(avatar).slice(0, 500);
  await user.save();
  res.json({ success: true, data: { user: user.toJSON() } });
}

// PUT /api/users/me/password
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: '请输入旧密码和新密码' });
  }
  if (String(newPassword).length < 6 || String(newPassword).length > 72) {
    return res.status(400).json({ success: false, message: '新密码长度需为 6-72 位' });
  }
  const user = await User.findById(req.userId).select('+password');
  if (!(await bcrypt.compare(String(oldPassword), user.password))) {
    return res.status(400).json({ success: false, message: '旧密码不正确' });
  }
  user.password = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  res.json({ success: true, data: { success: true } });
}

// POST /api/users/me/checkin 每日签到
async function checkin(req, res) {
  const user = req.user;
  const todayKey = shanghaiDateKey();

  const last = await CheckIn.findOne({ user: user._id, date: { $lt: todayKey } }).sort({ date: -1 });
  const consecutiveDays = calcConsecutiveDays(last, todayKey);
  const hitStreak = consecutiveDays % REWARDS.streakEvery === 0;
  const baseExp = REWARDS.checkinExp + (hitStreak ? REWARDS.streakBonusExp : 0);
  const stonesGained = REWARDS.checkinStones + (hitStreak ? REWARDS.streakBonusStones : 0);

  const expGained = grantExp(user, baseExp);
  user.spiritStones += stonesGained;

  try {
    // 唯一索引原子防重：并发重复签到时此处抛 11000
    await CheckIn.create({ user: user._id, date: todayKey, consecutiveDays, expGained, stonesGained });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: '今日已签到' });
    throw e;
  }
  await user.save();
  res.json({
    success: true,
    data: { expGained, stonesGained, consecutiveDays, hitStreak, user: user.toJSON() }
  });
}

// GET /api/users/me/checkin 签到日历与状态
async function checkinStatus(req, res) {
  const todayKey = shanghaiDateKey();
  const todayRecord = await CheckIn.findOne({ user: req.userId, date: todayKey });
  const lastBeforeToday = await CheckIn.findOne({ user: req.userId, date: { $lt: todayKey } }).sort({ date: -1 });
  const month = await CheckIn.find({ user: req.userId, date: { $gte: monthStartKey(todayKey) } }).select('date -_id');
  res.json({
    success: true,
    data: {
      todayCheckedIn: !!todayRecord,
      consecutiveDays: todayRecord
        ? todayRecord.consecutiveDays
        : calcConsecutiveDays(lastBeforeToday, todayKey),
      monthDates: month.map((m) => m.date)
    }
  });
}

// GET /api/users/me/favorites 我的收藏
async function myFavorites(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
  const filter = { _id: { $in: req.user.favorites }, status: 'normal' };
  const total = await Post.countDocuments(filter);
  const posts = await Post.find(filter)
    .populate('author', 'username avatar realmLevel')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({
    success: true,
    data: { list: posts.map(toPostSummary), page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
  });
}

module.exports = { getPublicProfile, updateMe, changePassword, checkin, checkinStatus, myFavorites };
