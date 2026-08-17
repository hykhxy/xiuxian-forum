const { getRealmByLevel } = require('./realm');

// 作者摘要：列表/详情中附带的最小用户信息
function toAuthorSummary(author) {
  if (!author) return null;
  return {
    id: author._id,
    username: author.username,
    avatar: author.avatar,
    realmLevel: author.realmLevel,
    realmName: getRealmByLevel(author.realmLevel).name
  };
}

// 帖子列表项摘要
function toPostSummary(post) {
  return {
    id: post._id,
    title: post.title,
    category: post.category,
    excerpt: String(post.content || '').replace(/\s+/g, ' ').slice(0, 120),
    tags: post.tags,
    author: toAuthorSummary(post.author),
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewCount: post.viewCount,
    isTop: post.isTop,
    isEssence: post.isEssence,
    createdAt: post.createdAt
  };
}

// 评论序列化（软删除的内容不再返回）
function toCommentItem(comment) {
  const deleted = comment.status === 'deleted';
  return {
    id: comment._id,
    content: deleted ? '' : comment.content,
    isDeleted: deleted,
    author: deleted ? null : toAuthorSummary(comment.author),
    parentComment: comment.parentComment,
    replyToUser: comment.replyToUser && !deleted
      ? { id: comment.replyToUser._id || comment.replyToUser, username: comment.replyToUser.username }
      : null,
    createdAt: comment.createdAt
  };
}

module.exports = { toAuthorSummary, toPostSummary, toCommentItem };
