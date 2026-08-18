const Technique = require('../models/Technique');
const User = require('../models/User');
const { toAuthorSummary } = require('../utils/serialize');
const { GRADE_CONFIG } = require('../utils/reward');
const { getRealmByLevel } = require('../utils/realm');
const {
  DRAW_COST,
  DECOMPOSE_STONES,
  pickGrade,
  pickOne,
  fallbackGrades
} = require('../utils/draw');
const { calcLevelStats, statsDiff, levelUpCost, buildGradeStats } = require('../utils/techniqueStats');

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
    maxLevel: t.maxLevel,
    growthRate: t.growthRate,
    baseStats: t.baseStats,
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
  const practiced = req.user && req.user.practicingTechniques.find((p) => String(p.technique) === String(t._id));
  let myEntry = null;
  if (practiced && t.maxLevel) {
    const level = practiced.currentLevel || 1;
    const cur = practiced.currentStats || calcLevelStats(t.baseStats, t.growthRate, level);
    myEntry = {
      level,
      maxLevel: t.maxLevel,
      stats: cur,
      nextPreview: level < t.maxLevel
        ? {
            level: level + 1,
            cost: levelUpCost(t.baseStats, level + 1),
            gained: statsDiff(cur, calcLevelStats(t.baseStats, t.growthRate, level + 1))
          }
        : null
    };
  }
  res.json({
    success: true,
    data: {
      technique: toTechniqueItem(t),
      practicedByMe: !!practiced,
      myEntry,
      myQi: req.user ? req.user.qi : undefined
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
  // 品阶自动生成层数数值（与种子一致；投稿人不可自定）
  const gs = buildGradeStats(grade);
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
    maxLevel: gs.maxLevel,
    growthRate: gs.growthRate,
    baseStats: gs.baseStats,
    coverImage: coverImage || '',
    submitter: req.userId,
    status: 'pending'
  });
  res.status(201).json({ success: true, data: { technique: { id: technique._id, name: technique.name, status: technique.status } } });
}

// POST /api/techniques/draw 抽卡：消耗 100 灵石随机抽取功法
// 概率：天1% / 地5% / 玄20% / 黄74%（妖修天阶+5%）；重复自动分解为灵石
async function draw(req, res) {
  const user = req.user;
  if (user.spiritStones < DRAW_COST) {
    return res.status(400).json({ success: false, message: `灵石不足，抽取需 ${DRAW_COST} 灵石（当前 ${user.spiritStones}）` });
  }

  const grade = pickGrade(Math.random(), user.profession);
  // 目标品阶空池时按 天→地→玄→黄 降级
  let candidates = [];
  let finalGrade = grade;
  for (const g of fallbackGrades(grade)) {
    const pool = await Technique.find({ status: 'approved', grade: g }).select('_id name grade type element effect expBonusRate price requiredRealmLevel').lean();
    if (pool.length) { candidates = pool; finalGrade = g; break; }
  }
  if (!candidates.length) {
    return res.status(503).json({ success: false, message: '卡池暂无可用功法，请稍后再试' });
  }

  const tech = pickOne(candidates);
  const techId = String(tech._id);
  const alreadyOwned = user.ownedTechniques.some((o) => String(o.technique) === techId);

  user.spiritStones -= DRAW_COST;
  let decomposed = false;
  let refund = 0;
  if (alreadyOwned) {
    // 重复功法自动分解，按品阶返还灵石
    decomposed = true;
    refund = DECOMPOSE_STONES[tech.grade] || 20;
    user.spiritStones += refund;
  } else {
    user.ownedTechniques.push({ technique: tech._id, obtainedAt: new Date(), source: 'draw' });
  }
  await user.save();

  res.json({
    success: true,
    data: {
      grade: finalGrade,                                     // 实际命中的品阶（可能降级）
      duplicated: decomposed,
      refund,
      technique: {
        id: tech._id,
        name: tech.name,
        grade: tech.grade,
        type: tech.type,
        element: tech.element,
        effect: tech.effect,
        expBonusRate: tech.expBonusRate,
        requiredRealmLevel: tech.requiredRealmLevel
      },
      spiritStones: user.spiritStones,
      newlyOwned: !decomposed
    }
  });
}

// GET /api/techniques/backpack 功法背包（含装备状态）
async function backpack(req, res) {
  const user = await User.findById(req.userId).populate('ownedTechniques.technique');
  if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
  const equippedIds = new Set(user.practicingTechniques.map((p) => String(p.technique)));
  res.json({
    success: true,
    data: {
      list: (user.ownedTechniques || [])
        .filter((o) => o.technique)
        .map((o) => ({
          id: o.technique._id,
          name: o.technique.name,
          grade: o.technique.grade,
          type: o.technique.type,
          element: o.technique.element,
          effect: o.technique.effect,
          expBonusRate: o.technique.expBonusRate,
          requiredRealmLevel: o.technique.requiredRealmLevel,
          obtainedAt: o.obtainedAt,
          source: o.source,
          equipped: equippedIds.has(String(o.technique._id))
        })),
      total: user.ownedTechniques.length,
      spiritStones: user.spiritStones,
      drawCost: DRAW_COST
    }
  });
}

// POST /api/techniques/:id/equip 装备背包中的功法（最高倍率生效，可装备多个）
async function equip(req, res) {
  const technique = await Technique.findById(req.params.id);
  if (!technique || technique.status !== 'approved') {
    return res.status(404).json({ success: false, message: '功法不存在或未上架' });
  }
  const user = req.user;
  const inBackpack = user.ownedTechniques.some((o) => String(o.technique) === String(technique._id));
  if (!inBackpack) {
    return res.status(400).json({ success: false, message: '尚未拥有此功法，请先抽取或兑换' });
  }
  if (user.practicingTechniques.some((p) => String(p.technique) === String(technique._id))) {
    return res.status(400).json({ success: false, message: '此功法已在修炼中' });
  }
  if (user.realm < technique.requiredRealmLevel) {
    return res.status(403).json({
      success: false,
      message: `境界不足，需达到「${getRealmByLevel(technique.requiredRealmLevel).name}」`
    });
  }

  user.practicingTechniques.push({
    technique: technique._id,
    expBonusRate: technique.expBonusRate,
    startedAt: new Date(),
    currentLevel: 1,
    currentStats: calcLevelStats(technique.baseStats, technique.growthRate, 1)
  });
  await user.save();
  await Technique.updateOne({ _id: technique._id }, { $inc: { practitionerCount: 1 } });
  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      technique: { id: technique._id, name: technique.name, grade: technique.grade }
    }
  });
}

// POST /api/techniques/:id/practice 兑换并修炼功法（灵石直购：入背包并立即装备）
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
  // 未拥有才入背包（拥有但未装备的走 equip）
  if (!user.ownedTechniques.some((o) => String(o.technique) === String(technique._id))) {
    user.ownedTechniques.push({ technique: technique._id, obtainedAt: new Date(), source: 'practice' });
  }
  user.practicingTechniques.push({
    technique: technique._id,
    expBonusRate: technique.expBonusRate,
    startedAt: new Date(),
    currentLevel: 1,
    currentStats: calcLevelStats(technique.baseStats, technique.growthRate, 1)
  });
  await user.save();
  await Technique.updateOne({ _id: technique._id }, { $inc: { practitionerCount: 1 } });
  res.json({ success: true, data: { user: user.toJSON(), technique: { id: technique._id, name: technique.name } } });
}

// POST /api/techniques/:id/levelup 功法升层（修炼一层 → 重算属性 → 存库）
// 消耗灵气 = baseStats.cultivation × 目标层（挂机产出闭环）
async function levelup(req, res) {
  const technique = await Technique.findById(req.params.id);
  if (!technique || technique.status !== 'approved') {
    return res.status(404).json({ success: false, message: '功法不存在或未上架' });
  }
  const user = req.user;
  const entry = user.practicingTechniques.find((p) => String(p.technique) === String(technique._id));
  if (!entry) {
    return res.status(400).json({ success: false, message: '尚未修炼此功法，请先装备' });
  }
  const currentLevel = entry.currentLevel || 1;
  if (currentLevel >= technique.maxLevel) {
    return res.status(400).json({ success: false, message: `此功法已修至最高层（${technique.maxLevel} 层）` });
  }
  const targetLevel = currentLevel + 1;
  const cost = levelUpCost(technique.baseStats, targetLevel);
  if (user.qi < cost) {
    return res.status(400).json({ success: false, message: `灵气不足，升至第 ${targetLevel} 层需 ${cost} 灵气（当前 ${user.qi}）` });
  }

  const prevStats = entry.currentStats || calcLevelStats(technique.baseStats, technique.growthRate, currentLevel);
  const nextStats = calcLevelStats(technique.baseStats, technique.growthRate, targetLevel);

  user.qi -= cost;
  entry.currentLevel = targetLevel;
  entry.currentStats = nextStats;
  await user.save();

  const hasNext = targetLevel < technique.maxLevel;
  res.json({
    success: true,
    data: {
      technique: { id: technique._id, name: technique.name, grade: technique.grade },
      level: targetLevel,
      maxLevel: technique.maxLevel,
      cost,
      gained: statsDiff(prevStats, nextStats),       // 本次升级五维增量
      currentStats: nextStats,
      nextPreview: hasNext
        ? { level: targetLevel + 1, cost: levelUpCost(technique.baseStats, targetLevel + 1), gained: statsDiff(nextStats, calcLevelStats(technique.baseStats, technique.growthRate, targetLevel + 1)) }
        : null,
      qi: user.qi
    }
  });
}

module.exports = { list, detail, submit, practice, draw, backpack, equip, levelup };
