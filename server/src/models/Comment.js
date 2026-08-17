const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: {
      type: String,
      required: [true, '评论内容不能为空'],
      minlength: [1, '评论内容不能为空'],
      maxlength: [500, '评论最多500字']
    },
    parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // null = 一级评论
    replyToUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    likeCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['normal', 'deleted'], default: 'normal' }
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
