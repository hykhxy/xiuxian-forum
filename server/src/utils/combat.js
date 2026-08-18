// 面板数值与战斗伤害（第16轮）：境界基础表 + 总面板计算 + 跨境界伤害规则
// 纯函数模块，供武斗/文斗/日常战斗复用
const { getProfession } = require('./profession');
const { combatKeys } = require('./techniqueStats');

// 境界基础属性表（realm 1-8；化神后按趋势类推补全合体/大乘/渡劫）
const REALM_BASE_STATS = [
  { level: 1, name: '练气', atk: 10, def: 10, hp: 100, qi: 50 },
  { level: 2, name: '筑基', atk: 50, def: 40, hp: 500, qi: 200 },
  { level: 3, name: '金丹', atk: 200, def: 150, hp: 2000, qi: 800 },
  { level: 4, name: '元婴', atk: 800, def: 600, hp: 8000, qi: 3000 },
  { level: 5, name: '化神', atk: 3000, def: 2000, hp: 30000, qi: 10000 },
  { level: 6, name: '合体', atk: 10000, def: 6000, hp: 100000, qi: 30000 },
  { level: 7, name: '大乘', atk: 30000, def: 18000, hp: 300000, qi: 90000 },
  { level: 8, name: '渡劫', atk: 100000, def: 60000, hp: 1000000, qi: 300000 }
];

function realmBase(realmLevel) {
  const i = Math.min(Math.max(Number(realmLevel) || 1, 1), 8);
  return REALM_BASE_STATS[i - 1];
}

// 职业对基础面板的加成率（剑修攻20%/法修灵气20%/体修血50%/魔修全10% 等，effects 复用）
function professionRates(professionKey) {
  const p = getProfession(professionKey);
  const e = p ? p.effects : {};
  const all = e.allStatsBonusRate || 0;
  return {
    atk: 1 + (e.attackBonusRate || 0) + all,
    def: 1 + all,
    hp: 1 + (e.hpBonusRate || 0) + all,
    qi: 1 + (e.expGainBonusRate || 0) + all + (e.idleSpeedBonusRate || 0) * 0 // 灵气面板沿用获取加成
  };
}

// 总面板 = round(境界基础 × 职业率) + Σ功法层加成 + 装备（预留 0）
// user: mongoose User 文档或含 {realm, profession, practicingTechniques} 的等价对象
// techniqueMap: { [techniqueId字符串]: {currentStats} }——为避免 populate 依赖，调用方可传缓存
function calcPanel(user, techniqueStatsList) {
  const base = realmBase(user.realm);
  const rates = professionRates(user.profession);
  const boosted = {
    atk: Math.round(base.atk * rates.atk),
    def: Math.round(base.def * rates.def),
    hp: Math.round(base.hp * rates.hp),
    qi: Math.round(base.qi * rates.qi)
  };
  const fromTechniques = { atk: 0, def: 0, hp: 0, qi: 0 };
  for (const s of techniqueStatsList || []) {
    const c = combatKeys(s);
    fromTechniques.atk += c.atk;
    fromTechniques.def += c.def;
    fromTechniques.hp += c.hp;
    fromTechniques.qi += c.qi;
  }
  return {
    realm: { level: base.level, name: base.name },
    base: boosted,
    fromTechniques,
    fromEquipment: { atk: 0, def: 0, hp: 0, qi: 0 }, // 装备系统预留
    total: {
      atk: boosted.atk + fromTechniques.atk,
      def: boosted.def + fromTechniques.def,
      hp: boosted.hp + fromTechniques.hp,
      qi: boosted.qi + fromTechniques.qi
    }
  };
}

// 战斗方（attacker/defender 需含）：realmLevel、total{atk,def,hp,qi}
// 跨境界伤害规则（核心）：
//   diff ≤ -2：完全免疫（0，不破防）
//   diff = -1：伤害 ×0.3，且不超过守方血量上限 5%
//   diff = 0 ：正常
//   diff = +1：伤害 ×1.3
//   diff ≥ +2：伤害 ×2，并额外无视 50% 防御
function calculateDamage(attacker, defender) {
  const realmDiff = attacker.realmLevel - defender.realmLevel;
  if (realmDiff <= -2) return 0;

  let baseDamage = attacker.total.atk - defender.total.def;
  baseDamage = Math.max(1, baseDamage); // 最低 1 点

  if (realmDiff === -1) {
    baseDamage = baseDamage * 0.3;
    baseDamage = Math.min(baseDamage, defender.total.hp * 0.05);
  } else if (realmDiff === 1) {
    baseDamage = baseDamage * 1.3;
  } else if (realmDiff >= 2) {
    baseDamage = baseDamage * 2;
    baseDamage += defender.total.def * 0.5; // 无视 50% 防御
  }

  return Math.round(baseDamage);
}

module.exports = { REALM_BASE_STATS, realmBase, professionRates, calcPanel, calculateDamage };
