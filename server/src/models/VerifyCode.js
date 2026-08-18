const mongoose = require('mongoose');

// 邮箱验证码（第14轮：注册邮箱验证；开发模式回显，SMTP 后补）
const verifyCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    code: { type: String, required: true },            // 6 位数字
    purpose: { type: String, default: 'register' },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },          // 10 分钟有效
    ip: { type: String, default: '' }
  },
  { timestamps: true }
);

verifyCodeSchema.index({ email: 1, purpose: 1, createdAt: -1 });
// TTL：过期文档由 MongoDB 自动清理
verifyCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VerifyCode', verifyCodeSchema);
