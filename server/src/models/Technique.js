const mongoose = require('mongoose');

const techniqueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, '功法名不能为空'],
      unique: true,
      trim: true,
      minlength: [2, '功法名至少2个字'],
      maxlength: [20, '功法名最多20个字']
    },
    type: {
      type: String,
      enum: { values: ['心法', '剑法', '刀法', '身法', '丹道', '器道', '阵法', '符道', '杂学'], message: '功法类型不合法' },
      required: [true, '请选择功法类型']
    },
    grade: {
      type: String,
      enum: { values: ['黄阶', '玄阶', '地阶', '天阶', '仙阶'], message: '品阶不合法' },
      required: [true, '请选择品阶']
    },
    element: {
      type: String,
      enum: { values: ['金', '木', '水', '火', '土', '雷', '冰', '风', '无'], message: '属性不合法' },
      required: [true, '请选择属性']
    },
    description: {
      type: String,
      required: [true, '功法描述不能为空'],
      minlength: [1, '功法描述不能为空'],
      maxlength: [2000, '功法描述最多2000字']
    },
    effect: {
      type: String,
      required: [true, '修炼效果不能为空'],
      minlength: [1, '修炼效果不能为空'],
      maxlength: [200, '修炼效果最多200字']
    },
    expBonusRate: { type: Number, default: 1.05 }, // 修为获取倍率（品阶决定）
    difficulty: { type: Number, min: 1, max: 5, default: 3 },
    requiredRealmLevel: { type: Number, default: 1, min: 1 },
    price: { type: Number, min: 1, required: [true, '价格缺失'] },
    // 第16轮：层数系统（品阶决定，seed/投稿时生成）
    maxLevel: { type: Number, default: 3, min: 1, max: 9 },            // 黄3/玄4/地5/天8/仙9
    growthRate: { type: Number, default: 0.05, min: 0, max: 1 },       // 每层成长系数
    baseStats: {                                                          // 第1层基础加成
      atk: { type: Number, default: 0 },
      def: { type: Number, default: 0 },
      hp: { type: Number, default: 0 },
      qi: { type: Number, default: 0 },
      cultivation: { type: Number, default: 0 }   // 升层消耗基准（灵气）
    },
    coverImage: { type: String, default: '', maxlength: [500, '封面链接过长'] },
    submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    rejectReason: { type: String, default: '' },
    practitionerCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

techniqueSchema.index({ status: 1, grade: 1 });
techniqueSchema.index({ status: 1, type: 1 });
techniqueSchema.index({ status: 1, element: 1 });

module.exports = mongoose.model('Technique', techniqueSchema);
