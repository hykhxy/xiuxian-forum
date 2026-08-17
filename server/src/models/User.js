const mongoose = require('mongoose');
const { getRealmByLevel } = require('../utils/realm');
const { PROFESSION_KEYS } = require('../utils/profession');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, '用户名不能为空'],
      unique: true,
      trim: true,
      minlength: [2, '用户名至少2个字符'],
      maxlength: [16, '用户名最多16个字符']
    },
    password: { type: String, required: true, select: false },
    // 职业：注册时必选，此后无任何修改入口（终身制）
    profession: {
      type: String,
      enum: { values: PROFESSION_KEYS, message: '职业不合法' }
    },
    avatar: { type: String, default: '', maxlength: [500, '头像链接过长'] },
    bio: { type: String, default: '', maxlength: [200, '签名最多200字'] },
    exp: { type: Number, default: 0, min: 0 },
    realmLevel: { type: Number, default: 1, min: 1 },
    spiritStones: { type: Number, default: 100, min: 0 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    practicingTechniques: [
      {
        technique: { type: mongoose.Schema.Types.ObjectId, ref: 'Technique', required: true },
        expBonusRate: { type: Number, default: 1 },
        startedAt: { type: Date, default: Date.now }
      }
    ],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    postCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    lastLoginAt: Date
  },
  { timestamps: true }
);

userSchema.virtual('realmName').get(function () {
  return getRealmByLevel(this.realmLevel).name;
});

userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
