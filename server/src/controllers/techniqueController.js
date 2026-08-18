const Technique = require('../models/Technique');
const { toAuthorSummary } = require('../utils/serialize');
const { GRADE_CONFIG } = require('../utils/reward');
const { getRealmByLevel } = require('../utils/realm');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTechniqueItem(t) {
  return {
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
  };
}

// GET /api/techniques 图鉴列表（游客可看 approved；?mine=1 查看自己的投稿）
async function list(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

  let filter;
  if (req.query.mine === '1' && req.user) {
    filter = { submitter: req.user._id };
    if (req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
  } else {
    filter = { status: 'approved' };
    if (req.query.grade) filter.grade = req.query.grade;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.element) filter.element = req.query.element;
    const keyword = String(req.query.keyword || '').trim();
    if (keyword) {
      const re = new RegExp(escapeRegex(keyword), 'i');
      filter.$or = [{ name: re }, { description: re }];
    }
  }

  const sortBy = req.query.sort === 'hot' ? { practitionerCount: -1, createdAt: -1 } : { createdAt: -1 };
  const total = await Technique.countDocuments(filter);
  const listDocs = await Technique.find(filter)
    .populate('submitter', 'username avatar realmLevel')
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  res.json({
    success: true,
    data: { list: listDocs.map(toTechniqueItem), page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
  });
}

// GET /api/techniques/:id 详情（approved 公开；投稿人/管理员可见未上架的）
async function detail(req, res) {
  const t = await Technique.findById(req.params.id)
    .populate('submitter', 'username avatar realmLevel')
    .lean();
  if (!t) return res.status(404).json({ success: false, message: '功法不存在' });
  const isSubmitter = !!req.userId && String(t.submitter._id) === req.userId;
  const isAdmin = req.user && req.user.role === 'admin';
  if (t.status !== 'approved' && !isSubmitter && !isAdmin) {
    return res.status(404).json({ success: false, message: '功法不存在或未上架' });
  }
  res.json({
    success: true,
    data: {
      technique: toTechniqueItem(t),
      practicedByMe: !!(req.user && req.user.practicingTechniques.some((p) => String(p.technique) === String(t._id)))
    }
  });
}

// POST /api/techniques 投稿（数值按品阶自动生成，审核通过后上架）
async function submit(req, res) {
  const { name, type, grade, element, description, effect, difficulty, coverImage } = req.body || {};
  const cfg = GRADE_CONFIG[grade];
  if (!cfg) return res.status(400).json({ success: false, message: '品阶不合法' });
  if (await Technique.exists({ name: String(name || '').trim() })) {
    return res.status(409).json({ success: false, message: '功法名已存在' });
  }
  const technique = await Technique.create({
    name,
    type,
    grade,
    element,
    description,
    effect,
    expBonusRate: cfg.expBonusRate,
    requiredRealmLevel: cfg.requiredRealmLevel,
    price: cfg.price,
    difficulty: difficulty || 3,
    coverImage: coverImage || '',
    submitter: req.userId,
    status: 'pending'
  });
  res.status(201).json({ success: true, data: { technique: { id: technique._id, name: technique.name, status: technique.status } } });
}

// POST /api/techniques/:id/practice 兑换并修炼功法
async function practice(req, res) {
  const technique = await Technique.findById(req.params.id);
  if (!technique || technique.status !== 'approved') {
    return res.status(404).json({ success: false, message: '功法不存在或未上架' });
  }
  const user = req.user;
  if (user.practicingTechniques.some((p) => String(p.technique) === String(technique._id))) {
    return res.status(400).json({ success: false, message: '你已在修炼此功法' });
  }
  if (user.realm < technique.requiredRealmLevel) {
    return res.status(403).json({
      success: false,
      message: `境界不足，需达到「${getRealmByLevel(technique.requiredRealmLevel).name}」`
    });
  }
  if (user.spiritStones < technique.price) {
    return res.status(400).json({ success: false, message: '灵石不足' });
  }

  user.spiritStones -= technique.price;
  user.practicingTechniques.push({
    technique: technique._id,
    expBonusRate: technique.expBonusRate,
    startedAt: new Date()
  });
  await user.save();
  await Technique.updateOne({ _id: technique._id }, { $inc: { practitionerCount: 1 } });
  res.json({ success: true, data: { user: user.toJSON(), technique: { id: technique._id, name: technique.name } } });
}

module.exports = { list, detail, submit, practice };
