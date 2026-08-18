// 头像：本地上传（Multer）+ AI 生成（Pollinations 免费免钥，可经环境变量换通义/DALL-E 兼容端点）
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const User = require('../models/User');

// 头像保存目录：client/avatars（client 即本站静态根，等价于 public/avatars）
const AVATAR_DIR = path.join(__dirname, '..', '..', '..', 'client', 'avatars');

function ensureDir() {
  if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

// 生成安全文件名：永不信任客户端原始文件名
function safeName(prefix, userId, ext) {
  return `${prefix}_${userId}_${Date.now()}.${ext}`;
}

// Multer：JPG/PNG，2MB 上限
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureDir();
      cb(null, AVATAR_DIR);
    },
    filename: (req, file, cb) => {
      const ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
      cb(null, safeName('avatar', req.userId, ext));
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('ONLY_JPG_PNG'));
  }
});

// 删除用户旧头像文件（仅当旧头像指向本站 /avatars/ 且属于自己的命名空间时）
function pruneOldAvatar(user) {
  const old = user.avatar || '';
  const m = old.match(/^\/avatars\/(avatar|preview)_[^/]+$/);
  if (!m) return;
  const full = path.join(AVATAR_DIR, path.basename(old));
  fs.unlink(full, () => {});
}

// POST /api/users/me/avatar/upload （multipart/form-data，字段名 file）
async function uploadAvatar(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: '请选择图片文件' });
  const user = req.user;
  pruneOldAvatar(user);
  user.avatar = `/avatars/${req.file.filename}`;
  await user.save();
  res.json({ success: true, data: { avatar: user.avatar, user: user.toJSON() } });
}

// AI 生成：默认 Pollinations（免 key）；AI_IMAGE_API 可覆盖为通义万相等 {endpoint}?prompt={prompt} 兼容端点
const AI_API_TEMPLATE = process.env.AI_IMAGE_API ||
  'https://image.pollinations.ai/prompt/{prompt}?width=512&height=512&nologo=true';
const STYLE_SUFFIX = '，水墨修仙风，头像，圆形构图，红黑金配色，精细'; // 主题风格后缀

// POST /api/users/me/avatar/ai-generate { prompt }
async function aiGenerate(req, res) {
  const prompt = String((req.body || {}).prompt || '').trim();
  if (!prompt || prompt.length > 200) {
    return res.status(400).json({ success: false, message: '请输入 1-200 字的形象描述' });
  }
  ensureDir();
  const url = AI_API_TEMPLATE.replace('{prompt}', encodeURIComponent(prompt + STYLE_SUFFIX));
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!r.ok) throw new Error(`上游 ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1024) throw new Error('上游返回内容异常');
    const filename = `preview_${req.userId}.png`;
    fs.writeFileSync(path.join(AVATAR_DIR, filename), buf);
    res.json({ success: true, data: { previewUrl: `/avatars/${filename}?v=${Date.now()}` } });
  } catch (e) {
    res.status(502).json({ success: false, message: '仙像绘制失败（生成服务暂不可用），请稍后再试或改用本地上传' });
  }
}

// POST /api/users/me/avatar/ai-confirm（把预览图转正为头像）
async function aiConfirm(req, res) {
  const user = req.user;
  const preview = `preview_${req.userId}.png`;
  const src = path.join(AVATAR_DIR, preview);
  if (!fs.existsSync(src)) {
    return res.status(400).json({ success: false, message: '预览图不存在或已过期，请重新生成' });
  }
  pruneOldAvatar(user);
  const finalName = safeName('avatar', req.userId, 'png');
  fs.renameSync(src, path.join(AVATAR_DIR, finalName));
  user.avatar = `/avatars/${finalName}`;
  await user.save();
  res.json({ success: true, data: { avatar: user.avatar, user: user.toJSON() } });
}

// Multer 错误转统一响应
function multerErrorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '图片不能超过 2MB' });
    }
    if (err.message === 'ONLY_JPG_PNG') {
      return res.status(400).json({ success: false, message: '仅支持 JPG / PNG 格式' });
    }
    return res.status(400).json({ success: false, message: '上传失败，请重试' });
  }
  next();
}

module.exports = { upload, multerErrorHandler, uploadAvatar, aiGenerate, aiConfirm };
