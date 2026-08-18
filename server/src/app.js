const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const techniqueRoutes = require('./routes/techniqueRoutes');
const adminRoutes = require('./routes/adminRoutes');
const cultivationRoutes = require('./routes/cultivationRoutes');
const musicRoutes = require('./routes/musicRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Render 等平台使用反向代理，信任一层代理以获取真实 IP（限流依赖）
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '200kb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('tiny'));

// 登录/注册接口限流：每 IP 每 15 分钟 20 次
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: '施法过于频繁，请稍后再试' }
});
app.use('/api/auth', authLimiter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { ok: true } });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/techniques', techniqueRoutes);
app.use('/api/cultivation', cultivationRoutes);
app.use('/api/music', musicRoutes);   // 音乐搜索/直链/封面/歌词 代理（听曲页与全局播放器共用）
app.use('/api/admin', adminRoutes);

// 前端静态托管（单服务部署：Express 同时提供 API 与页面）
// 本地开发直接访问 http://localhost:3000
app.use(express.static(path.join(__dirname, '..', '..', 'client')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: '接口不存在' });
  }
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'index.html'));
});

app.use(errorHandler);

module.exports = app;
