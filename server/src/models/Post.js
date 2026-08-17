const mongoose = require('mongoose');

const CATEGORY_LABELS = {
  ask: '问道',
  insight: '感悟',
  chat: '杂谈',
  technique: '功法',
  announce: '公告'
};

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, '标题不能为空'],
      trim: true,
      minlength: [1, '标题不能为空'],
      maxlength: [50, '标题最多50字']
    },
    content: {
      type: String,
      required: [true, '正文不能为空'],
      minlength: [1, '正文不能为空'],
      maxlength: [10000, '正文最多10000字']
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: { values: Object.keys(CATEGORY_LABELS), message: '板块不合法' },
      required: [true, '请选择板块']
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) =>
          tags.length <= 5 && tags.every((t) => typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= 10),
        message: '标签最多5个，每个1-10字'
      }
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    isTop: { type: Boolean, default: false },
    isEssence: { type: Boolean, default: false },
    status: { type: String, enum: ['normal', 'hidden', 'deleted'], default: 'normal' }
  },
  { timestamps: true }
);

postSchema.index({ category: 1, isTop: -1, createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);
module.exports = Post;
module.exports.CATEGORY_LABELS = CATEGORY_LABELS;
