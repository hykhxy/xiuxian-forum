// 职业系统：注册时选择，终身不可更改
// 已接入玩法：法修/魔修 灵气获取倍率（reward.grantQi 与挂机产出）、鬼修 挂机速度、
// 血修 突破成功率、魔修 突破失败惩罚（见 utils/cultivation.js）。
// 其余数值（攻击/气血/抽取）由 getDerivedStats 统一计算，供用户信息接口返回，
// 待战斗、功法抽取等系统实现时直接消费。
const PROFESSIONS = {
  sword: {
    key: 'sword',
    name: '剑修',
    slogan: '一剑破万法',
    desc: '攻击力+20%',
    effects: { attackBonusRate: 0.2 }
  },
  mage: {
    key: 'mage',
    name: '法修',
    slogan: '掌天地灵气',
    desc: '灵气获取+20%',
    effects: { expGainBonusRate: 0.2 }
  },
  ghost: {
    key: 'ghost',
    name: '鬼修',
    slogan: '行幽冥之间',
    desc: '挂机速度+15%',
    effects: { idleSpeedBonusRate: 0.15 }
  },
  blood: {
    key: 'blood',
    name: '血修',
    slogan: '以血证道',
    desc: '突破成功率+10%',
    effects: { breakthroughSuccessBonus: 0.1 }
  },
  monster: {
    key: 'monster',
    name: '妖修',
    slogan: '夺天地造化',
    desc: '功法抽取概率+5%',
    effects: { techniqueDrawBonusRate: 0.05 }
  },
  demon: {
    key: 'demon',
    name: '魔修',
    slogan: '入魔亦成道',
    desc: '全属性+10%，但突破失败惩罚翻倍',
    effects: { allStatsBonusRate: 0.1, breakthroughPenaltyMultiplier: 2 }
  },
  body: {
    key: 'body',
    name: '体修',
    slogan: '肉身成圣',
    desc: '气血上限+50%',
    effects: { hpBonusRate: 0.5 }
  }
};

const PROFESSION_KEYS = Object.keys(PROFESSIONS);

// 基础属性（后续战斗/挂机/突破系统统一从这里取基线）
const BASE_STATS = {
  attack: 100,            // 攻击力
  maxHp: 1000,            // 气血上限
  idleSpeed: 100,         // 挂机速度基准（实际速度 = 境界速率 × getIdleRate）
  breakthroughBaseRate: 0.5,   // （历史字段）血修突破加成由此差值推算
  techniqueDrawBaseRate: 0.05  // 功法抽取基准概率
};

function getProfession(key) {
  return PROFESSIONS[key] || null;
}

// 职业对灵气获取的倍率（法修 1.2、魔修 1.1、其余 1）
// 作用于发帖/评论/签到/投稿奖励与挂机产出
function getExpGainRate(professionKey) {
  const p = getProfession(professionKey);
  if (!p) return 1;
  const e = p.effects;
  return 1 + (e.expGainBonusRate || 0) + (e.allStatsBonusRate || 0);
}

// 挂机速度倍率 = 灵气获取倍率 × (1 + 挂机速度加成)
// 鬼修 1.15、法修 1.2、魔修 1.1（全属性已在灵气倍率中计入，不重复叠加）
function getIdleRate(professionKey) {
  const p = getProfession(professionKey);
  const idleBonus = p ? (p.effects.idleSpeedBonusRate || 0) : 0;
  return +(getExpGainRate(professionKey) * (1 + idleBonus)).toFixed(4);
}

// 综合基础属性 + 职业加成，得出面板属性
function getDerivedStats(professionKey) {
  const p = getProfession(professionKey);
  const e = p ? p.effects : {};
  const all = e.allStatsBonusRate || 0;

  return {
    attack: Math.round(BASE_STATS.attack * (1 + (e.attackBonusRate || 0) + all)),
    maxHp: Math.round(BASE_STATS.maxHp * (1 + (e.hpBonusRate || 0) + all)),
    idleSpeed: Math.round(BASE_STATS.idleSpeed * getIdleRate(professionKey)),
    breakthroughRate: +(BASE_STATS.breakthroughBaseRate + (e.breakthroughSuccessBonus || 0)).toFixed(2),
    techniqueDrawRate: +(BASE_STATS.techniqueDrawBaseRate + (e.techniqueDrawBonusRate || 0)).toFixed(2),
    expGainRate: +getExpGainRate(professionKey).toFixed(2),
    breakthroughPenaltyMultiplier: e.breakthroughPenaltyMultiplier || 1
  };
}

// 序列化给前端的职业信息（不含内部 effects 结构）
function toProfessionInfo(professionKey) {
  const p = getProfession(professionKey);
  if (!p) return null;
  return { key: p.key, name: p.name, slogan: p.slogan, desc: p.desc };
}

module.exports = {
  PROFESSIONS,
  PROFESSION_KEYS,
  BASE_STATS,
  getProfession,
  getExpGainRate,
  getIdleRate,
  getDerivedStats,
  toProfessionInfo
};
