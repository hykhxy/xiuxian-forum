// 运维脚本：预置基础功法库（冷启动卡池；幂等，按名称跳过已存在）
// 用法：node scripts/seed-techniques.js [dev|prod]
const mongoose = require('mongoose');
const Technique = require('../src/models/Technique');
const User = require('../src/models/User');

const target = process.argv[2] || 'dev';
const hosts = 'ac-8sfwhqj-shard-00-00.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-01.kwtoj7y.mongodb.net:27017,ac-8sfwhqj-shard-00-02.kwtoj7y.mongodb.net:27017';
const db = target === 'prod' ? 'xiuxian-forum' : 'xiuxian-dev';
const uri = `mongodb://xiuxian:xiuxian2026@${hosts}/${db}?tls=true&retryWrites=true&w=majority&authSource=admin`;

// 与 utils/draw.js 卡池概率对应：黄阶最丰富，天阶稀少；仙阶不进卡池仅图鉴
const SEEDS = [
  // 黄阶（74% 主要产出，数量最多保证多样性）
  { name: '吐纳诀', type: '心法', grade: '黄阶', element: '无', difficulty: 1, description: '修真界最基础的吐纳法门，凡人开蒙第一课。引导天地灵气入体，涓滴成河。', effect: '灵气获取略微提升' },
  { name: '青锋十三式', type: '剑法', grade: '黄阶', element: '金', difficulty: 2, description: '外门弟子必修剑法，十三式环环相扣，练至纯熟可开碑裂石。', effect: '剑气锋锐，灵气获取略微提升' },
  { name: '踏云步', type: '身法', grade: '黄阶', element: '风', difficulty: 1, description: '以风灵之力加持双足，日行三百里不在话下。', effect: '身轻如燕，灵气获取略微提升' },
  { name: '聚气散方', type: '丹道', grade: '黄阶', element: '木', difficulty: 2, description: '最入门的丹方，以三味灵草炼制聚气散，服之可增速修行。', effect: '丹香袭人，灵气获取略微提升' },
  { name: '粗坯锻法', type: '器道', grade: '黄阶', element: '火', difficulty: 2, description: '铁匠铺里传出的锻器粗法，却能奠定器道根基。', effect: '炉火纯青之始，灵气获取略微提升' },
  { name: '市井杂闻录', type: '杂学', grade: '黄阶', element: '无', difficulty: 1, description: '游方说书人辑录的三百六十行杂学，处处皆可悟道。', effect: '见多识广，灵气获取略微提升' },
  // 玄阶（20%）
  { name: '流云剑诀', type: '剑法', grade: '玄阶', element: '风', difficulty: 3, description: '剑出如流云舒卷，以柔克刚。内门真传之一。', effect: '剑随云动，灵气获取小幅提升' },
  { name: '凝元功', type: '心法', grade: '玄阶', element: '无', difficulty: 2, description: '将吸入灵气凝聚成元种，蕴养于丹田之中。', effect: '凝气成元，灵气获取小幅提升' },
  { name: '水遁术', type: '身法', grade: '玄阶', element: '水', difficulty: 3, description: '化入流水千里，踪迹难寻。', effect: '如鱼得水，灵气获取小幅提升' },
  { name: '清心咒', type: '心法', grade: '玄阶', element: '木', difficulty: 2, description: '涤荡心魔杂念的静心法门，突破前诵之有益。', effect: '心如止水，灵气获取小幅提升' },
  // 地阶（5%）
  { name: '赤炎掌', type: '心法', grade: '地阶', element: '火', difficulty: 4, description: '掌心藏烈焰，一击焚山岳。散修中大名鼎鼎的攻伐功法。', effect: '焚天之志，灵气获取中幅提升' },
  { name: '雷引术', type: '心法', grade: '地阶', element: '雷', difficulty: 4, description: '以肉身引九天之雷淬体，险之又险，成则大成。', effect: '雷霆淬体，灵气获取中幅提升' },
  { name: '玄冰诀', type: '心法', grade: '地阶', element: '冰', difficulty: 3, description: '北境冰宫不传之秘，寒气所至万物凝滞。', effect: '冰封千里，灵气获取中幅提升' },
  // 天阶（1%）
  { name: '紫霄神雷', type: '心法', grade: '天阶', element: '雷', difficulty: 5, description: '传说中紫霄宫镇宫之法，神雷涤荡诸邪。', effect: '紫霄雷威，灵气获取大幅提升' },
  { name: '万剑归宗', type: '剑法', grade: '天阶', element: '金', difficulty: 5, description: '一剑化万剑，万剑归一宗。剑修毕生所求。', effect: '剑道极致，灵气获取大幅提升' },
  // 仙阶（不进卡池，图鉴稀有展示）
  { name: '太上忘情录', type: '心法', grade: '仙阶', element: '无', difficulty: 5, description: '太上一脉至高典籍，忘情而证大道。', effect: '太上忘情，灵气获取极大幅提升' },
  { name: '混沌未分诀', type: '心法', grade: '仙阶', element: '无', difficulty: 5, description: '天地未开时的混沌法门，可遇不可求。', effect: '混沌初开，灵气获取极大幅提升' }
];

(async () => {
  await mongoose.connect(uri);
  const admin = await User.findOne({ role: 'admin' }) || await User.findOne();
  if (!admin) { console.error(`[${db}] 无用户，先注册一个账号再执行`); process.exit(1); }

  let created = 0;
  let skipped = 0;
  for (const s of SEEDS) {
    if (await Technique.exists({ name: s.name })) { skipped++; continue; }
    const grade = s.grade;
    const cfg = { '黄阶': [1.05, 50, 1], '玄阶': [1.10, 120, 2], '地阶': [1.15, 300, 3], '天阶': [1.25, 800, 4], '仙阶': [1.40, 2000, 5] }[grade];
    await Technique.create({
      ...s,
      expBonusRate: cfg[0],
      price: cfg[1],
      requiredRealmLevel: cfg[2],
      submitter: admin._id,
      status: 'approved'
    });
    created++;
  }
  console.log(`[${db}] 种子功法完成：新增 ${created} 部，已存在跳过 ${skipped} 部（上架者为 ${admin.username}）`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
