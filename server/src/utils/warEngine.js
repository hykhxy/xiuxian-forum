// 武斗引擎（第17轮）：5 场职位对位、回合制自动战斗
// 伤害复用 combat.calculateDamage（含跨境界免疫规则）；60 回合上限，超时按 HP 百分比较高者胜
const { calculateDamage } = require('./combat');

const WAR_POSITIONS = ['宗主', '副宗主', '大长老', '亲传弟子', '外门弟子'];
const MAX_ROUNDS = 60;

// 单场战斗：A/B 形如 { userId, username, realmLevel, total:{atk,def,hp} }，缺员传 null
function simulateBattle(positionName, A, B) {
  if (!A && !B) return { position: positionName, rounds: [], winner: null, timeout: false };
  if (!B) return mkForfeit(positionName, 'attacker', A);
  if (!A) return mkForfeit(positionName, 'defender', B);

  const hpA0 = A.total.hp, hpB0 = B.total.hp;
  let hpA = hpA0, hpB = hpB0;
  const rounds = [];
  let turn = A.realmLevel >= B.realmLevel ? 'A' : 'B'; // 境界高者先手；同境攻方先手
  let timeout = false;

  for (let i = 0; i < MAX_ROUNDS && hpA > 0 && hpB > 0; i++) {
    let dmg;
    if (turn === 'A') {
      dmg = calculateDamage(A, B);           // 可能为 0（跨两境完全免疫）
      hpB = Math.max(0, hpB - dmg);
      rounds.push({ by: A.username, dmg, hpA, hpB });
      turn = 'B';
    } else {
      dmg = calculateDamage(B, A);
      hpA = Math.max(0, hpA - dmg);
      rounds.push({ by: B.username, dmg, hpA, hpB });
      turn = 'A';
    }
  }

  let winner;
  if (hpA <= 0 && hpB <= 0) winner = 'draw';
  else if (hpB <= 0) winner = 'attacker';
  else if (hpA <= 0) winner = 'defender';
  else {
    timeout = true;
    const pctA = hpA / hpA0, pctB = hpB / hpB0;   // 超时：HP 百分比较高者胜
    winner = pctA === pctB ? 'draw' : (pctA > pctB ? 'attacker' : 'defender');
  }
  return { position: positionName, rounds, winner, timeout };
}

function mkForfeit(positionName, winnerSide, present) {
  return {
    position: positionName,
    rounds: [{ by: present.username, dmg: 0, hpA: present.total.hp, hpB: 0, forfeit: true }],
    winner: winnerSide,
    timeout: false
  };
}

// 5 场汇总：胜场多者赢整场战争
function summarize(battles) {
  let attacker = 0, defender = 0;
  for (const b of battles) {
    if (b.winner === 'attacker') attacker++;
    else if (b.winner === 'defender') defender++;
  }
  const result = attacker === defender ? 'draw' : (attacker > defender ? 'attacker' : 'defender');
  return { score: { attacker, defender }, result };
}

module.exports = { WAR_POSITIONS, simulateBattle, summarize };
