const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'，按东八区计算
    consecutiveDays: { type: Number, default: 1, min: 1 },
    qiGained: { type: Number, default: 0 },
    stonesGained: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// 唯一索引：同一用户同一天只能签到一次（原子防重）
checkInSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CheckIn', checkInSchema);
