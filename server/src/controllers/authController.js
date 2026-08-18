const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const VerifyCode = require('../models/VerifyCode');
const { REWARDS } = require('../utils/reward');
const { PROFESSIONS, getProfession } = require('../utils/profession');
const { settleIdle } = require('../utils/cultivation');

const USERNAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]+$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const CODE_RE = /^\d{6}$/;

function signToken(user) {
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/send-code —— 注册邮箱验证码
// 开发模式（未配置 SMTP_HOST）：验证码直接回显 devCode 并打印日志；接 SMTP 后改为真实发信
async function sendCode(req, res) {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: '邮箱格式不正确' });
  }
  if (await User.exists({ email })) {
    return res.status(409).json({ success: false, message: '该邮箱已注册，请直接登录' });
  }
  // 频控：同邮箱 60 秒内仅可获取一次
  const recent = await VerifyCode.findOne({ email, purpose: 'register' }).sort({ createdAt: -1 });
  if (recent && Date.now() - new Date(recent.createdAt).getTime() < 60 * 1000) {
    return res.status(429).json({ success: false, message: '验证码已发送，请 60 秒后再试' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await VerifyCode.create({
    email,
    code,
    purpose: 'register',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ip: req.ip || ''
  });

  const devMode = !process.env.SMTP_HOST;
  if (!devMode) {
    // TODO: 接入 nodemailer 真实发信（用户提供 SMTP 授权码后启用，届时删除 devCode 回显）
  }
  console.log(`[verify-code] ${email} → ${code}${devMode ? '（开发模式回显）' : ''}`);

  res.json({
    success: true,
    data: {
      sent: true,
      devMode,
      devCode: devMode ? code : undefined,
      expiresInMinutes: 10
    }
  });
}

// POST /api/auth/register —— 邮箱验证码 + 用户名 + 密码 + 职业（职业终身不可更改）
async function register(req, res) {
  const { username, password, profession, email, code } = req.body || {};
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

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalizedEmail)) {
    return res.status(400).json({ success: false, message: '请填写注册邮箱' });
  }
  if (!CODE_RE.test(String(code || ''))) {
    return res.status(400).json({ success: false, message: '请填写 6 位邮箱验证码' });
  }
  if (await User.exists({ email: normalizedEmail })) {
    return res.status(409).json({ success: false, message: '该邮箱已注册' });
  }
  // 验证码校验：取该邮箱最新一条，须未使用、未过期、匹配
  const record = await VerifyCode.findOne({ email: normalizedEmail, purpose: 'register' }).sort({ createdAt: -1 });
  if (!record || record.used || record.expiresAt < new Date() || record.code !== String(code)) {
    return res.status(400).json({ success: false, message: '验证码错误或已过期，请重新获取' });
  }

  if (await User.exists({ username })) {
    return res.status(409).json({ success: false, message: '用户名已被占用' });
  }

  // 管理员：与 ADMIN_USERNAME 相同的用户名注册自动成为 admin
  const isAdmin = process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME;

  const user = await User.create({
    username,
    password: await bcrypt.hash(String(password), 10),
    email: normalizedEmail,
    profession,
    role: isAdmin ? 'admin' : 'user',
    spiritStones: REWARDS.registerStones,
    lastLoginAt: new Date()
  });

  // 验证码一次性作废
  record.used = true;
  await record.save();

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

// GET /api/auth/me（访问即结算挂机灵气 —— 「下次访问时」语义）
async function me(req, res) {
  const settled = settleIdle(req.user);
  if (settled.gained > 0) await req.user.save();
  res.json({ success: true, data: { user: req.user.toJSON(), justSettledQi: settled.gained } });
}

module.exports = { sendCode, register, login, me };
