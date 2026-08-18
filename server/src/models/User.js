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
    // 注册邮箱（第14轮：验证码注册；老用户无此字段不受影响，sparse 唯一索引）
    email: {
      type: String,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => !v || /^\S+@\S+\.\S+$/.test(v),
        message: '邮箱格式不正确'
      }
    },
    // 职业：注册时必选，此后无任何修改入口（终身制）
    profession: {
      type: String,
      enum: { values: PROFESSION_KEYS, message: '职业不合法' }
    },
    avatar: { type: String, default: '', maxlength: [500, '头像链接过长'] },
    bio: { type: String, default: '', maxlength: [200, '签名最多200字'] },
    qi: { type: Number, default: 0, min: 0 },        // 灵气（挂机与活跃产出，突破消耗）
    realm: { type: Number, default: 1, min: 1, max: 8 }, // 境界等级 1-8（突破制）
    spiritStones: { type: Number, default: 100, min: 0 },
    idleStartedAt: { type: Date, default: null },    // 挂机开始时间；null=未挂机
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    practicingTechniques: [
      {
        technique: { type: mongoose.Schema.Types.ObjectId, ref: 'Technique', required: true },
        expBonusRate: { type: Number, default: 1 },
        startedAt: { type: Date, default: Date.now }
      }
    ],
    // 功法背包：抽卡/兑换获得，equip 后进 practicingTechniques 生效
    ownedTechniques: [
      {
        technique: { type: mongoose.Schema.Types.ObjectId, ref: 'Technique', required: true },
        obtainedAt: { type: Date, default: Date.now },
        source: { type: String, enum: ['draw', 'practice'], default: 'draw' }
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
  return getRealmByLevel(this.realm).name;
});

// email 稀疏唯一索引：老用户字段缺失不受影响，新注册邮箱不可重复
userSchema.index({ email: 1 }, { unique: true, sparse: true });

userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
