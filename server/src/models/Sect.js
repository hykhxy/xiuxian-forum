const mongoose = require('mongoose');

// 宗门（第17轮）
const sectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '宗门名不能为空'],
      unique: true,
      trim: true,
      minlength: [2, '宗门名至少2个字'],
      maxlength: [12, '宗门名最多12个字']
    },
    founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // 职务映射：{ [userId字符串]: '宗主'|'副宗主'|'大长老'|'亲传弟子'|'外门弟子' }
    roles: {
      type: Map,
      of: { type: String, enum: ['宗主', '副宗主', '大长老', '亲传弟子', '外门弟子'] },
      default: {}
    },
    announcement: {
      content: { type: String, default: '', maxlength: [1000, '公告最多1000字'] },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedAt: Date
    },
    treasury: { type: Number, default: 0, min: 0 },      // 宗门灵石库
    prestige: { type: Number, default: 0, min: 0 },     // 声望
    victoryUntil: { type: Date, default: null },         // 凯旋展示权（战后7天）
    defeatedAt: { type: Date, default: null },           // 战败标签
    status: { type: String, enum: ['normal', 'dissolved'], default: 'normal' }
  },
  { timestamps: true }
);

const MEMBER_LIMIT = 50;

module.exports = mongoose.model('Sect', sectSchema);
module.exports.MEMBER_LIMIT = MEMBER_LIMIT;
