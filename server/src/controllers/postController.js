const Post = require('../models/Post');
const { CATEGORY_LABELS } = require('../models/Post');
const User = require('../models/User');
const { toPostSummary, toAuthorSummary } = require('../utils/serialize');
const { REWARDS, grantExp } = require('../utils/reward');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 5);
}

// GET /api/posts 列表（游客可看）：板块/关键词/作者/精华/排序/分页
async function list(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

  const filter = { status: 'normal' };
  if (req.query.category && CATEGORY_LABELS[req.query.category]) filter.category = req.query.category;
  if (req.query.isEssence === 'true') filter.isEssence = true;
  if (req.query.author) filter.author = req.query.author;
  const keyword = String(req.query.keyword || '').trim();
  if (keyword) {
    const re = new RegExp(escapeRegex(keyword), 'i');
    filter.$or = [{ title: re }, { content: re }, { tags: re }];
  }

  const sortBy = req.query.sort === 'hot' ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };
  const total = await Post.countDocuments(filter);
  const posts = await Post.find(filter)
    .populate('author', 'username avatar realmLevel')
    .sort({ isTop: -1, ...sortBy })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: { list: posts.map(toPostSummary), page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
  });
}

// GET /api/posts/:id 详情（可选登录：返回 likedByMe / favoritedByMe / 权限标记）
async function detail(req, res) {
  const post = await Post.findById(req.params.id)
    .populate('author', 'username avatar realmLevel bio')
    .lean();
  if (!post || post.status === 'deleted') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  const isOwner = !!req.userId && String(post.author._id) === req.userId;
  const isAdmin = req.user && req.user.role === 'admin';
  if (post.status === 'hidden' && !isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: '该帖已被管理员隐藏' });
  }

  Post.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).exec(); // 异步自增，不阻塞响应

  const author = {
    ...toAuthorSummary(post.author),
    bio: post.author.bio || ''
  };
  res.json({
    success: true,
    data: {
      post: {
        id: post._id,
        title: post.title,
        content: post.content,
        category: post.category,
        tags: post.tags,
        author,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        isTop: post.isTop,
        isEssence: post.isEssence,
        status: post.status,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      },
      likedByMe: !!(req.user && post.likes.some((l) => String(l) === req.userId)),
      favoritedByMe: !!(req.user && req.user.favorites.some((f) => String(f) === String(post._id))),
      isOwner,
      isAdmin: !!isAdmin
    }
  });
}

// POST /api/posts 发帖（修为+10 含功法加成）
async function create(req, res) {
  const { title, content, category, tags } = req.body || {};
  if (!CATEGORY_LABELS[category]) {
    return res.status(400).json({ success: false, message: '请选择板块' });
  }
  if (category === 'announce' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '公告仅管理员可发布' });
  }

  const post = await Post.create({
    title,
    content,
    category,
    tags: normalizeTags(tags),
    author: req.userId
  });

  const expGained = grantExp(req.user, REWARDS.postExp);
  req.user.postCount += 1;
  await req.user.save();

  await post.populate('author', 'username avatar realmLevel');
  res.status(201).json({
    success: true,
    data: { post: { id: post._id, title: post.title, category: post.category, createdAt: post.createdAt }, expGained }
  });
}

// PUT /api/posts/:id 编辑（仅作者本人；内容完整性考虑，管理员亦不可改写他人帖子）
async function update(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post || post.status === 'deleted') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  if (String(post.author) !== req.userId) {
    return res.status(403).json({ success: false, message: '只能编辑自己的帖子' });
  }
  const { title, content, category, tags } = req.body || {};
  if (category !== undefined && !CATEGORY_LABELS[category]) {
    return res.status(400).json({ success: false, message: '板块不合法' });
  }
  if (post.category === 'announce' && category !== undefined && category !== 'announce' && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: '公告帖不可改为普通板块' });
  }
  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;
  if (category !== undefined) post.category = category;
  if (tags !== undefined) post.tags = normalizeTags(tags);
  await post.save();
  res.json({
    success: true,
    data: { post: { id: post._id, title: post.title, category: post.category, updatedAt: post.updatedAt } }
  });
}

// DELETE /api/posts/:id 软删除（作者或管理员）
async function remove(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post || post.status === 'deleted') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  const isOwner = String(post.author) === req.userId;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: '只能删除自己的帖子' });
  }
  post.status = 'deleted';
  post.isTop = false;
  post.isEssence = false;
  await post.save();
  // 冗余计数归还（只在 >0 时递减，防止负数）
  await User.updateOne({ _id: post.author, postCount: { $gt: 0 } }, { $inc: { postCount: -1 } });
  res.json({ success: true, data: { success: true } });
}

// POST /api/posts/:id/like 点赞 toggle
async function toggleLike(req, res) {
  const post = await Post.findById(req.params.id);
  if (!post || post.status !== 'normal') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  const liked = post.likes.some((l) => String(l) === req.userId);
  if (liked) {
    await Post.updateOne({ _id: post._id }, { $pull: { likes: req.userId }, $inc: { likeCount: -1 } });
  } else {
    await Post.updateOne({ _id: post._id }, { $addToSet: { likes: req.userId }, $inc: { likeCount: 1 } });
  }
  res.json({ success: true, data: { liked: !liked, likeCount: Math.max(post.likeCount + (liked ? -1 : 1), 0) } });
}

// POST /api/posts/:id/favorite 收藏 toggle
async function toggleFavorite(req, res) {
  const post = await Post.findById(req.params.id).select('_id status');
  if (!post || post.status === 'deleted') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  const user = req.user;
  const idx = user.favorites.findIndex((f) => String(f) === String(post._id));
  let favorited;
  if (idx >= 0) {
    user.favorites.splice(idx, 1);
    favorited = false;
  } else {
    user.favorites.push(post._id);
    favorited = true;
  }
  await user.save();
  res.json({ success: true, data: { favorited } });
}

module.exports = { list, detail, create, update, remove, toggleLike, toggleFavorite };
