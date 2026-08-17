const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { REWARDS } = require('../utils/reward');

const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]+$/;

function signToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
async function register(req, res) {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: '请填写道号、邮箱和密码' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ success: false, message: '道号仅支持中文、字母、数字、下划线' });
  }
  if (String(password).length < 6 || String(password).length > 72) {
    return res.status(400).json({ success: false, message: '密码长度需为 6-72 位' });
  }
  if (!/^\S+@\S+\.\S+$/.test(String(email))) {
    return res.status(400).json({ success: false, message: '邮箱格式不正确' });
  }

  if (await User.exists({ username })) {
    return res.status(409).json({ success: false, message: '道号已被占用' });
  }
  if (await User.exists({ email: String(email).toLowerCase() })) {
    return res.status(409).json({ success: false, message: '邮箱已被注册' });
  }

  // 管理员：与 ADMIN_EMAIL 相同的邮箱注册自动成为 admin
  const isAdmin =
    process.env.ADMIN_EMAIL &&
    String(email).toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase();

  const user = await User.create({
    username,
    email: String(email).toLowerCase(),
    password: await bcrypt.hash(String(password), 10),
    role: isAdmin ? 'admin' : 'user',
    spiritStones: REWARDS.registerStones,
    lastLoginAt: new Date()
  });

  res.status(201).json({ success: true, data: { token: signToken(user), user: user.toJSON() } });
}

// POST /api/auth/login
async function login(req, res) {
  const { account, password } = req.body || {};
  if (!account || !password) {
    return res.status(400).json({ success: false, message: '请输入账号和密码' });
  }
  const user = await User.findOne({
    $or: [{ username: String(account) }, { email: String(account).toLowerCase() }]
  }).select('+password');
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    return res.status(401).json({ success: false, message: '道号/邮箱或密码错误' });
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
