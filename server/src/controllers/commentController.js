const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const { toCommentItem, toAuthorSummary } = require('../utils/serialize');
const { REWARDS, grantQi } = require('../utils/reward');

// GET /api/posts/:id/comments 全量返回（前端组楼中楼树；小规模论坛足够）
async function listComments(req, res) {
  const post = await Post.findById(req.params.id).select('status commentCount');
  if (!post || post.status === 'deleted') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  const comments = await Comment.find({ post: post._id })
    .populate('author', 'username avatar realmLevel')
    .populate('replyToUser', 'username')
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: { list: comments.map(toCommentItem), total: post.commentCount } });
}

// POST /api/posts/:id/comments 评论（灵气+3 含加成；parentCommentId 支持楼中楼）
async function createComment(req, res) {
  const { content, parentCommentId, replyToUserId } = req.body || {};
  const post = await Post.findById(req.params.id);
  if (!post || post.status !== 'normal') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }

  let parent = null;
  let replyTo = null;
  if (parentCommentId) {
    const target = await Comment.findById(parentCommentId);
    if (!target || String(target.post) !== String(post._id)) {
      return res.status(400).json({ success: false, message: '被回复的评论不存在' });
    }
    if (target.status === 'deleted') {
      return res.status(400).json({ success: false, message: '该评论已被删除' });
    }
    if (target.parentComment) {
      // 回复楼中楼：归到其顶级评论下，回复对象改为该楼中楼作者
      parent = await Comment.findById(target.parentComment).select('_id');
      replyTo = target.author;
    } else {
      parent = target;
      if (replyToUserId) {
        replyTo = await User.findById(replyToUserId).select('_id username');
        if (!replyTo) return res.status(400).json({ success: false, message: '被回复的用户不存在' });
      }
    }
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.userId,
    content,
    parentComment: parent ? parent._id : null,
    replyToUser: replyTo ? replyTo._id : null
  });

  post.commentCount += 1;
  await post.save();

  const qiGained = grantQi(req.user, REWARDS.commentQi);
  req.user.commentCount += 1;
  await req.user.save();

  res.status(201).json({
    success: true,
    data: {
      comment: {
        id: comment._id,
        content: comment.content,
        isDeleted: false,
        author: toAuthorSummary(req.user),
        parentComment: comment.parentComment,
        replyToUser: replyTo ? { id: replyTo._id, username: replyTo.username } : null,
        createdAt: comment.createdAt
      },
      qiGained
    }
  });
}

// DELETE /api/comments/:id 软删除（作者或管理员）
async function removeComment(req, res) {
  const comment = await Comment.findById(req.params.id).populate('post', 'status');
  if (!comment) return res.status(404).json({ success: false, message: '评论不存在' });
  const isOwner = String(comment.author) === req.userId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: '只能删除自己的评论' });
  }
  if (comment.status !== 'deleted') {
    comment.status = 'deleted';
    await comment.save();
    await Post.updateOne({ _id: comment.post._id, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
    await User.updateOne({ _id: comment.author, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  }
  res.json({ success: true, data: { success: true } });
}

module.exports = { listComments, createComment, removeComment };
