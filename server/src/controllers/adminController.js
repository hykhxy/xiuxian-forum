const Technique = require('../models/Technique');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const { toAuthorSummary } = require('../utils/serialize');
const { REWARDS, grantExp } = require('../utils/reward');

// GET /api/admin/techniques 审核（默认待审核）
async function listTechniques(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status)
    ? req.query.status
    : 'pending';
  const filter = { status };
  const total = await Technique.countDocuments(filter);
  const list = await Technique.find(filter)
    .populate('submitter', 'username avatar realmLevel')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({
    success: true,
    data: {
      list: list.map((t) => ({
        id: t._id,
        name: t.name,
        type: t.type,
        grade: t.grade,
        element: t.element,
        description: t.description,
        effect: t.effect,
        expBonusRate: t.expBonusRate,
        difficulty: t.difficulty,
        requiredRealmLevel: t.requiredRealmLevel,
        price: t.price,
        coverImage: t.coverImage,
        submitter: toAuthorSummary(t.submitter),
        status: t.status,
        rejectReason: t.rejectReason,
        practitionerCount: t.practitionerCount,
        createdAt: t.createdAt
      })),
      page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  });
}

// PUT /api/admin/techniques/:id/review 审核（approve 发放投稿奖励）
async function reviewTechnique(req, res) {
  const { action, rejectReason } = req.body || {};
  const technique = await Technique.findById(req.params.id);
  if (!technique) return res.status(404).json({ success: false, message: '功法不存在' });

  if (action === 'approve') {
    if (technique.status === 'approved') {
      return res.status(400).json({ success: false, message: '该功法已上架' });
    }
    technique.status = 'approved';
    technique.rejectReason = '';
    await technique.save();
    // 投稿奖励（审核通过时一次性发放）
    const submitter = await User.findById(technique.submitter);
    if (submitter) {
      grantExp(submitter, REWARDS.submitAcceptedExp);
      submitter.spiritStones += REWARDS.submitAcceptedStones;
      await submitter.save();
    }
  } else if (action === 'reject') {
    if (technique.status !== 'pending') {
      return res.status(400).json({ success: false, message: '只能驳回待审核的功法' });
    }
    const reason = String(rejectReason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: '请填写驳回原因' });
    technique.status = 'rejected';
    technique.rejectReason = reason.slice(0, 200);
    await technique.save();
  } else {
    return res.status(400).json({ success: false, message: 'action 只能为 approve / reject' });
  }

  res.json({
    success: true,
    data: { technique: { id: technique._id, name: technique.name, status: technique.status } }
  });
}

// PUT /api/admin/posts/:id/status 置顶 / 加精 / 隐藏 / 恢复
async function setPostStatus(req, res) {
  const { isTop, isEssence, status } = req.body || {};
  const post = await Post.findById(req.params.id);
  if (!post || post.status === 'deleted') {
    return res.status(404).json({ success: false, message: '帖子不存在或已删除' });
  }
  if (isTop !== undefined) post.isTop = !!isTop;
  if (isEssence !== undefined) post.isEssence = !!isEssence;
  if (status !== undefined) {
    if (!['normal', 'hidden'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status 只能为 normal / hidden' });
    }
    post.status = status;
  }
  await post.save();
  res.json({
    success: true,
    data: { post: { id: post._id, isTop: post.isTop, isEssence: post.isEssence, status: post.status } }
  });
}

// GET /api/admin/stats 概览统计
async function stats(req, res) {
  const [userCount, postCount, commentCount, pendingCount] = await Promise.all([
    User.countDocuments(),
    Post.countDocuments({ status: { $ne: 'deleted' } }),
    Comment.countDocuments({ status: 'normal' }),
    Technique.countDocuments({ status: 'pending' })
  ]);
  res.json({ success: true, data: { userCount, postCount, commentCount, pendingCount } });
}

module.exports = { listTechniques, reviewTechnique, setPostStatus, stats };
