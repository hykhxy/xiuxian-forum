// 种子脚本：功法库初始化（第16轮完整版：22 本功法，含层数系统全部数值）
// 幂等：已存在的功法若缺 maxLevel/baseStats/growthRate 则回填；老用户修炼记录缺层数也回填
// 用法：node scripts/seed-techniques.js [dev|prod]
const mongoose = require('mongoose');
const Technique = require('../src/models/Technique');
const User = require('../src/models/User');
const { buildGradeStats, calcLevelStats } = require('../src/utils/techniqueStats');

const target = process.argv[2] || 'dev';
const hosts = 'ac-8sfwhqj-shard-00-00.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-01.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-02.kwtoj7y.mongodb.net:27017';
const db = target === 'prod' ? 'xiuxian-forum' : 'xiuxian-dev';
const uri = `mongodb://xiuxian:xiuxian2026@${hosts}/${db}?tls=true&retryWrites=true&w=majority&authSource=admin`;

// 品阶价格/境界要求（与 utils/reward.GRADE_CONFIG 一致）；mult 为同品阶基础值浮动（1=标准）
const GRADE_META = {
  '黄阶': { price: 50, realm: 1 },
  '玄阶': { price: 120, realm: 2 },
  '地阶': { price: 300, realm: 3 },
  '天阶': { price: 800, realm: 4 },
  '仙阶': { price: 2000, realm: 5 }
};

const SEEDS = [
  // 黄阶 ×6
  { name: '吐纳诀', type: '心法', grade: '黄阶', element: '无', mult: 1.0, difficulty: 1, description: '修真界最基础的吐纳法门，凡人开蒙第一课。引导天地灵气入体，涓滴成河。', effect: '灵气获取略微提升' },
  { name: '青锋十三式', type: '剑法', grade: '黄阶', element: '金', mult: 1.1, difficulty: 2, description: '外门弟子必修剑法，十三式环环相扣，练至纯熟可开碑裂石。', effect: '剑气锋锐' },
  { name: '踏云步', type: '身法', grade: '黄阶', element: '风', mult: 0.9, difficulty: 1, description: '以风灵之力加持双足，日行三百里不在话下。', effect: '身轻如燕' },
  { name: '聚气散方', type: '丹道', grade: '黄阶', element: '木', mult: 1.0, difficulty: 2, description: '最入门的丹方，以三味灵草炼制聚气散，服之可增速修行。', effect: '丹香袭人' },
  { name: '粗坯锻法', type: '器道', grade: '黄阶', element: '火', mult: 1.15, difficulty: 2, description: '铁匠铺里传出的锻器粗法，却能奠定器道根基。', effect: '炉火纯青之始' },
  { name: '市井杂闻录', type: '杂学', grade: '黄阶', element: '无', mult: 0.85, difficulty: 1, description: '游方说书人辑录的三百六十行杂学，处处皆可悟道。', effect: '见多识广' },
  // 玄阶 ×5
  { name: '流云剑诀', type: '剑法', grade: '玄阶', element: '风', mult: 1.05, difficulty: 3, description: '剑出如流云舒卷，以柔克刚。内门真传之一。', effect: '剑随云动' },
  { name: '凝元功', type: '心法', grade: '玄阶', element: '无', mult: 1.0, difficulty: 2, description: '将吸入灵气凝聚成元种，蕴养于丹田之中。', effect: '凝气成元' },
  { name: '水遁术', type: '身法', grade: '玄阶', element: '水', mult: 0.95, difficulty: 3, description: '化入流水千里，踪迹难寻。', effect: '如鱼得水' },
  { name: '清心咒', type: '心法', grade: '玄阶', element: '木', mult: 0.9, difficulty: 2, description: '涤荡心魔杂念的静心法门，突破前诵之有益。', effect: '心如止水' },
  { name: '符箓初解', type: '符道', grade: '玄阶', element: '雷', mult: 1.1, difficulty: 3, description: '以朱砂黄纸承载雷意，一符既出，草木皆兵。', effect: '落笔惊雷' },
  // 地阶 ×5
  { name: '赤炎掌', type: '心法', grade: '地阶', element: '火', mult: 1.1, difficulty: 4, description: '掌心藏烈焰，一击焚山岳。散修中大名鼎鼎的攻伐功法。', effect: '焚天之志' },
  { name: '雷引术', type: '心法', grade: '地阶', element: '雷', mult: 1.05, difficulty: 4, description: '以肉身引九天之雷淬体，险之又险，成则大成。', effect: '雷霆淬体' },
  { name: '玄冰诀', type: '心法', grade: '地阶', element: '冰', mult: 1.0, difficulty: 3, description: '北境冰宫不传之秘，寒气所至万物凝滞。', effect: '冰封千里' },
  { name: '百草集', type: '丹道', grade: '地阶', element: '木', mult: 0.95, difficulty: 3, description: '收录百种灵药的丹道典籍，可炼筑基丹、凝婴丹。', effect: '丹成九转' },
  { name: '镇岳锤法', type: '器道', grade: '地阶', element: '土', mult: 1.15, difficulty: 4, description: '一锤定山河，重器修士的立身之本。', effect: '重逾千钧' },
  // 天阶 ×4
  { name: '紫霄神雷', type: '心法', grade: '天阶', element: '雷', mult: 1.1, difficulty: 5, description: '传说中紫霄宫镇宫之法，神雷涤荡诸邪。', effect: '紫霄雷威' },
  { name: '万剑归宗', type: '剑法', grade: '天阶', element: '金', mult: 1.15, difficulty: 5, description: '一剑化万剑，万剑归一宗。剑修毕生所求。', effect: '剑道极致' },
  { name: '星河引', type: '阵法', grade: '天阶', element: '水', mult: 1.0, difficulty: 5, description: '引星河之力布周天之阵，困敌于方寸之间。', effect: '星河入阵' },
  { name: '大衍决', type: '心法', grade: '天阶', element: '无', mult: 1.0, difficulty: 4, description: '推演天机的大衍之数，修至深处可窥命运一角。', effect: '窥探天机' },
  // 仙阶 ×2
  { name: '太上忘情录', type: '心法', grade: '仙阶', element: '无', mult: 1.0, difficulty: 5, description: '太上一脉至高典籍，忘情而证大道。', effect: '太上忘情' },
  { name: '混沌未分诀', type: '心法', grade: '仙阶', element: '无', mult: 1.2, difficulty: 5, description: '天地未开时的混沌法门，一念可开一方世界。', effect: '混沌初开' }
];

(async () => {
  await mongoose.connect(uri);
  const admin = (await User.findOne({ role: 'admin' })) || (await User.findOne());
  if (!admin) { console.error(`[${db}] 无用户，先注册一个账号再执行`); process.exit(1); }

  let created = 0;
  let backfilled = 0;

  for (const s of SEEDS) {
    const gs = buildGradeStats(s.grade, s.mult);
    const meta = GRADE_META[s.grade];
    const doc = {
      ...s,
      mult: undefined,
      maxLevel: gs.maxLevel,
      growthRate: gs.growthRate,
      baseStats: gs.baseStats,
      expBonusRate: { '黄阶': 1.05, '玄阶': 1.10, '地阶': 1.15, '天阶': 1.25, '仙阶': 1.40 }[s.grade],
      requiredRealmLevel: meta.realm,
      price: meta.price,
      submitter: admin._id,
      status: 'approved'
    };
    delete doc.mult;

    const existing = await Technique.findOne({ name: s.name });
    if (!existing) {
      await Technique.create(doc);
      created++;
    } else if (
      !existing.maxLevel || existing.maxLevel === 3 && existing.grade !== '黄阶' ||
      !existing.baseStats || !existing.baseStats.atk
    ) {
      await Technique.updateOne(
        { _id: existing._id },
        { $set: { maxLevel: gs.maxLevel, growthRate: gs.growthRate, baseStats: gs.baseStats } }
      );
      backfilled++;
    }
  }

  // 老用户修炼记录回填：currentLevel/currentStats
  let usersFixed = 0;
  const users = await User.find({ 'practicingTechniques.0': { $exists: true } });
  for (const u of users) {
    let dirty = false;
    for (const p of u.practicingTechniques) {
      if (!p.currentLevel || !p.currentStats || !p.currentStats.atk) {
        const t = await Technique.findById(p.technique);
        if (t) {
          p.currentLevel = p.currentLevel || 1;
          p.currentStats = calcLevelStats(t.baseStats, t.growthRate, p.currentLevel);
          dirty = true;
        }
      }
    }
    if (dirty) { await u.save(); usersFixed++; }
  }

  console.log(`[${db}] 功法种子：新增 ${created}，回填 ${backfilled}，用户层数回填 ${usersFixed} 位`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
