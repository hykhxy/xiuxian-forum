const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { REWARDS } = require('../utils/reward');
const { PROFESSIONS, getProfession } = require('../utils/profession');

const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]+$/;

function signToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register —— 用户名 + 密码 + 职业（职业终身不可更改）
async function register(req, res) {
  const { username, password, profession } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请填写用户名和密码' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ success: false, message: '用户名仅支持中文、字母、数字、下划线' });
  }
  if (String(password).length < 6 || String(password).length > 72) {
    return res.status(400).json({ success: false, message: '密码长度需为 6-72 位' });
  }
  if (!getProfession(profession)) {
    return res.status(400).json({
      success: false,
      message: '请选择职业（' + Object.values(PROFESSIONS).map((p) => p.name).join('／') + '），注册后不可更改'
    });
  }

  if (await User.exists({ username })) {
    return res.status(409).json({ success: false, message: '用户名已被占用' });
  }

  // 管理员：与 ADMIN_USERNAME 相同的用户名注册自动成为 admin
  const isAdmin = process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME;

  const user = await User.create({
    username,
    password: await bcrypt.hash(String(password), 10),
    profession,
    role: isAdmin ? 'admin' : 'user',
    spiritStones: REWARDS.registerStones,
    lastLoginAt: new Date()
  });

  res.status(201).json({ success: true, data: { token: signToken(user), user: user.toJSON() } });
}

// POST /api/auth/login —— 用户名 + 密码 → JWT（7 天）
async function login(req, res) {
  const { account, password } = req.body || {};
  if (!account || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }
  const user = await User.findOne({ username: String(account) }).select('+password');
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
  user.lastLoginAt = new Date();
  await user.save();
  res.json({ success: true, data: { token: signToken(user), user: user.toJSON() } });
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ success: true, data: { user: req.user.toJSON() } });
}

module.exports = { register, login, me };
