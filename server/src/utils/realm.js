// 境界表：门槛为累计修为，等级越高突破越难
const REALMS = [
  { level: 1, name: '练气一层', exp: 0 },
  { level: 2, name: '练气二层', exp: 10 },
  { level: 3, name: '练气三层', exp: 25 },
  { level: 4, name: '练气四层', exp: 50 },
  { level: 5, name: '练气五层', exp: 90 },
  { level: 6, name: '练气六层', exp: 150 },
  { level: 7, name: '练气七层', exp: 240 },
  { level: 8, name: '练气八层', exp: 360 },
  { level: 9, name: '练气九层', exp: 520 },
  { level: 10, name: '筑基期', exp: 800 },
  { level: 11, name: '金丹期', exp: 1300 },
  { level: 12, name: '元婴期', exp: 2200 },
  { level: 13, name: '化神期', exp: 3800 },
  { level: 14, name: '炼虚期', exp: 6500 },
  { level: 15, name: '合体期', exp: 11000 },
  { level: 16, name: '大乘期', exp: 18000 },
  { level: 17, name: '渡劫期', exp: 30000 },
  { level: 18, name: '仙人', exp: 50000 }
];

const MAX_LEVEL = REALMS[REALMS.length - 1].level;

// 累计修为 → 境界等级
function calcRealmLevel(exp) {
  let level = 1;
  for (const r of REALMS) {
    if (exp >= r.exp) level = r.level;
    else break;
  }
  return level;
}

function getRealmByLevel(level) {
  const clamped = Math.min(Math.max(Number(level) || 1, 1), MAX_LEVEL);
  return REALMS.find((r) => r.level === clamped) || REALMS[0];
}

function getNextRealm(level) {
  if (!level || level >= MAX_LEVEL) return null;
  return getRealmByLevel(level + 1);
}

module.exports = { REALMS, MAX_LEVEL, calcRealmLevel, getRealmByLevel, getNextRealm };
