// 战场（第17轮）：武斗一键开战全自动结算；文斗问答状态机；奖励与战报
const War = require('../models/War');
const Sect = require('../models/Sect');
const Post = require('../models/Post');
const { simulateBattle, summarize, WAR_POSITIONS } = require('../utils/warEngine');

const DAY = 86400 * 1000;

function toWarItem(w, sects) {
  const a = sects.get(String(w.attackerSect));
  const d = sects.get(String(w.defenderSect));
  return {
    id: w._id,
    attacker: a ? { id: a._id, name: a.name } : { name: '（已散）' },
    defender: d ? { id: d._id, name: d.name } : { name: '（已散）' },
    warType: w.warType,
    status: w.status,
    score: w.score,
    result: w.result,
    createdAt: w.createdAt,
    endedAt: w.endedAt
  };
}

// GET /api/wars
async function list(req, res) {
  const wars = await War.find().sort({ createdAt: -1 }).limit(50);
  const sectIds = [...new Set(wars.flatMap((w) => [String(w.attackerSect), String(w.defenderSect)]))];
  const sectDocs = await Sect.find({ _id: { $in: sectIds } });
  const map = new Map(sectDocs.map((s) => [String(s._id), s]));
  res.json({ success: true, data: { list: wars.map((w) => toWarItem(w, map)) } });
}

// GET /api/wars/:id （含文斗懒超时推进）
async function detail(req, res) {
  const w = await War.findById(req.params.id)
    .populate('attackerSect', 'name')
    .populate('defenderSect', 'name');
  if (!w) return res.status(404).json({ success: false, message: '战争记录不存在' });

  if (w.warType === '文斗' && w.status === '进行中') await applyLazyTimeouts(w);

  const me = req.user;
  const inAttacker = me && w.attackerTeam.some((t) => String(t.user) === String(me._id));
  const inDefender = me && w.defenderTeam.some((t) => String(t.user) === String(me._id));
  const isJudge = me && !inAttacker && !inDefender;

  // 文斗交互上下文
  let debate = null;
  if (w.warType === '文斗') {
    const idx = w.rounds.findIndex((r) => r.passed === null && !r.winner);
    const round = idx >= 0 ? w.rounds[idx] : null;
    const askingSide = idx % 2 === 0 ? 'attacker' : 'defender';  // 奇数轮(0起)攻方问
    debate = round ? {
      roundIndex: idx + 1,
      askingSide,
      answeringSide: askingSide === 'attacker' ? 'defender' : 'attacker',
      phase: !round.question ? 'question' : (!round.answer ? 'answer' : 'vote'),
      question: round.question,
      answer: round.answer,
      votes: round.votes.length,
      myVote: me ? (round.votes.find((v) => String(v.user) === String(me._id))?.pass ?? null) : null,
      canAsk: !!me && ((askingSide === 'attacker' && inAttacker) || (askingSide === 'defender' && inDefender)),
      canAnswer: !!me && ((!askingSide && inAttacker) || (askingSide && inDefender)),
      canVote: isJudge && me && !round.votes.some((v) => String(v.user) === String(me._id))
    } : null;
    // canAnswer 修正：答方是"非提问方"
    if (debate) {
      debate.canAnswer = !!me && ((debate.answeringSide === 'attacker' && inAttacker) || (debate.answeringSide === 'defender' && inDefender));
    }
  }

  res.json({
    success: true,
    data: {
      war: {
        ...toWarItem(w, new Map([[String(w.attackerSect._id), w.attackerSect], [String(w.defenderSect._id), w.defenderSect]])),
        attackerTeam: w.attackerTeam,
        defenderTeam: w.defenderTeam,
        battles: w.battles,
        rounds: w.rounds,
        mySide: inAttacker ? 'attacker' : (inDefender ? 'defender' : null),
        isJudge,
        canStart: w.warType === '武斗' && w.status === '准备中' &&
          !!me && !!((inAttacker || inDefender)) && req.user &&
          (await (async () => {
            const sectId = inAttacker ? w.attackerSect._id : w.defenderSect._id;
            const s = await Sect.findById(sectId);
            const role = s && s.roles.get(String(me._id));
            return ['宗主', '副宗主'].includes(role || '');
          })())
      },
      debate
    }
  });
}

// POST /api/wars/:id/start —— 武斗：服务端全自动结算 5 场
async function start(req, res) {
  const w = await War.findById(req.params.id);
  if (!w) return res.status(404).json({ success: false, message: '战争记录不存在' });
  if (w.warType !== '武斗') return res.status(400).json({ success: false, message: '文斗无此操作' });
  if (w.status !== '准备中') return res.status(400).json({ success: false, message: '战争已开始或已结束' });

  // 权限：任一方宗主/副宗主可开战
  const me = req.user;
  const inA = w.attackerTeam.some((t) => String(t.user) === String(me._id));
  const inD = w.defenderTeam.some((t) => String(t.user) === String(me._id));
  if (!inA && !inD) return res.status(403).json({ success: false, message: '非交战方不可开战' });
  const sectId = inA ? w.attackerSect : w.defenderSect;
  const s = await Sect.findById(sectId);
  const role = s && s.roles.get(String(me._id));
  if (!['宗主', '副宗主'].includes(role || '')) {
    return res.status(403).json({ success: false, message: '仅宗主/副宗主可下令开战' });
  }

  const battles = WAR_POSITIONS.map((pos, i) => {
    const A = w.attackerTeam[i] && w.attackerTeam[i].user
      ? { userId: w.attackerTeam[i].user, username: w.attackerTeam[i].username, realmLevel: w.attackerTeam[i].realmLevel, total: w.attackerTeam[i].total }
      : null;
    const B = w.defenderTeam[i] && w.defenderTeam[i].user
      ? { userId: w.defenderTeam[i].user, username: w.defenderTeam[i].username, realmLevel: w.defenderTeam[i].realmLevel, total: w.defenderTeam[i].total }
      : null;
    return simulateBattle(pos, A, B);
  });
  const { score, result } = summarize(battles);

  w.battles = battles;
  w.score = score;
  w.result = result;
  w.status = '已结束';
  w.endedAt = new Date();
  await w.save();
  await applyRewards(w);
  res.json({ success: true, data: { score, result } });
}

// ---------- 文斗 ----------
// POST /api/wars/:id/question { question }
async function question(req, res) {
  const w = await War.findById(req.params.id);
  if (!w || w.warType !== '文斗' || w.status !== '进行中') {
    return res.status(400).json({ success: false, message: '文斗未在进行中' });
  }
  const idx = w.rounds.findIndex((r) => r.passed === null && !r.winner);
  if (idx < 0) return res.status(400).json({ success: false, message: '五轮已满' });
  const askingSide = idx % 2 === 0 ? 'attacker' : 'defender';
  const me = req.user;
  const inA = w.attackerTeam.some((t) => String(t.user) === String(me._id));
  const inD = w.defenderTeam.some((t) => String(t.user) === String(me._id));
  const isAsker = (askingSide === 'attacker' && inA) || (askingSide === 'defender' && inD);
  if (!isAsker) return res.status(403).json({ success: false, message: '本轮由对方提问' });

  const round = w.rounds[idx];
  if (round.question) return res.status(400).json({ success: false, message: '本轮问题已提交' });
  const q = String((req.body || {}).question || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ success: false, message: '问题不能为空' });
  round.question = q;
  round.askedBy = me._id;
  round.askedAt = new Date();
  await w.save();
  res.json({ success: true, data: { roundIndex: idx + 1 } });
}

// POST /api/wars/:id/answer { answer }
async function answer(req, res) {
  const w = await War.findById(req.params.id);
  if (!w || w.warType !== '文斗' || w.status !== '进行中') {
    return res.status(400).json({ success: false, message: '文斗未在进行中' });
  }
  const idx = w.rounds.findIndex((r) => r.passed === null && !r.winner);
  if (idx < 0) return res.status(400).json({ success: false, message: '五轮已满' });
  const askingSide = idx % 2 === 0 ? 'attacker' : 'defender';
  const answeringSide = askingSide === 'attacker' ? 'defender' : 'attacker';
  const me = req.user;
  const inA = w.attackerTeam.some((t) => String(t.user) === String(me._id));
  const inD = w.defenderTeam.some((t) => String(t.user) === String(me._id));
  const isAnswerer = (answeringSide === 'attacker' && inA) || (answeringSide === 'defender' && inD);
  if (!isAnswerer) return res.status(403).json({ success: false, message: '本轮由对方作答' });

  const round = w.rounds[idx];
  if (!round.question) return res.status(400).json({ success: false, message: '本轮问题尚未提交' });
  if (round.answer) return res.status(400).json({ success: false, message: '本轮答案已提交' });
  const a = String((req.body || {}).answer || '').trim().slice(0, 1000);
  if (!a) return res.status(400).json({ success: false, message: '答案不能为空' });
  round.answer = a;
  round.answeredBy = me._id;
  round.answeredAt = new Date();
  await w.save();
  res.json({ success: true, data: { roundIndex: idx + 1 } });
}

// POST /api/wars/:id/vote { pass }
async function vote(req, res) {
  const w = await War.findById(req.params.id);
  if (!w || w.warType !== '文斗' || w.status !== '进行中') {
    return res.status(400).json({ success: false, message: '文斗未在进行中' });
  }
  const idx = w.rounds.findIndex((r) => r.passed === null && !r.winner);
  if (idx < 0) return res.status(400).json({ success: false, message: '五轮已满' });
  const round = w.rounds[idx];
  if (!round.question || !round.answer) {
    return res.status(400).json({ success: false, message: '本轮问答尚未完成' });
  }
  const me = req.user;
  const inA = w.attackerTeam.some((t) => String(t.user) === String(me._id));
  const inD = w.defenderTeam.some((t) => String(t.user) === String(me._id));
  if (inA || inD) return res.status(403).json({ success: false, message: '交战方不可担任评委' });
  if (round.votes.some((v) => String(v.user) === String(me._id))) {
    return res.status(400).json({ success: false, message: '你已投过票' });
  }

  round.votes.push({ user: me._id, pass: !!((req.body || {}).pass) });
  if (round.votes.length >= 4) finalizeRound(w, idx, round.votes);
  await w.save();
  maybeFinishDebate(w);
  await w.save();
  res.json({ success: true, data: { votes: round.votes.length, passed: round.passed } });
}

// 4 票判轮：≥3 通过
function finalizeRound(w, idx, votes) {
  const round = w.rounds[idx];
  const passes = votes.filter((v) => v.pass).length;
  round.passed = passes >= 3;
  const askingSide = idx % 2 === 0 ? 'attacker' : 'defender';
  const answeringSide = askingSide === 'attacker' ? 'defender' : 'attacker';
  round.winner = round.passed ? answeringSide : askingSide;
  w.score[answeringSide] += round.passed ? 1 : 0;
  w.score[askingSide] += round.passed ? 0 : 1;
}

// 懒超时：问题>24h 无答案→提问方胜轮；答案>24h 票<4→按已投票多数
async function applyLazyTimeouts(w) {
  const now = Date.now();
  let dirty = false;
  w.rounds.forEach((round, idx) => {
    if (round.passed !== null || round.winner) return;
    const askingSide = idx % 2 === 0 ? 'attacker' : 'defender';
    const answeringSide = askingSide === 'attacker' ? 'defender' : 'attacker';
    if (round.question && !round.answer && round.askedAt && now - new Date(round.askedAt) > DAY) {
      round.winner = askingSide;          // 未作答→提问方胜
      round.passed = false;
      w.score[askingSide] += 1;
      dirty = true;
    } else if (round.answer && round.votes.length < 4 && round.answeredAt && now - new Date(round.answeredAt) > DAY) {
      const passes = round.votes.filter((v) => v.pass).length;
      const fails = round.votes.length - passes;
      round.passed = passes > fails;      // 已投多数
      round.winner = round.passed ? answeringSide : askingSide;
      w.score[round.winner] += 1;
      dirty = true;
    }
  });
  if (dirty) { maybeFinishDebate(w); await w.save(); }
}

function maybeFinishDebate(w) {
  if (w.rounds.every((r) => r.winner)) {
    w.result = w.score.attacker === w.score.defender
      ? 'draw'
      : (w.score.attacker > w.score.defender ? 'attacker' : 'defender');
    w.status = '已结束';
    w.endedAt = new Date();
    applyRewards(w).catch(() => {});
  }
}

// ---------- 战争结算奖励 ----------
async function applyRewards(w) {
  if (!w.result) return;
  const [a, d] = await Promise.all([Sect.findById(w.attackerSect), Sect.findById(w.defenderSect)]);
  if (!a || !d) return;
  const winner = w.result === 'attacker' ? a : (w.result === 'defender' ? d : null);

  if (winner) {
    const loser = winner === a ? d : a;
    winner.prestige += 50;
    winner.treasury += 200;
    winner.victoryUntil = new Date(Date.now() + 7 * DAY);
    loser.prestige = Math.max(0, loser.prestige - 20);
    loser.defeatedAt = new Date();
    await Promise.all([winner.save(), loser.save()]);
    // 战报帖：以胜方宗主名义
    const leaderId = [...winner.roles.entries()].find(([, r]) => r === '宗主')?.[0];
    if (leaderId && winner === a || winner === d) {
      const title = `【战报·${w.warType}】${a.name} ${w.score.attacker}:${w.score.defender} ${d.name}`;
      const content = `「${winner.name}」于战场大获全胜！\n\n比分 ${w.score.attacker} : ${w.score.defender}\n胜方获：声望 +50、宗门库 +200 灵石、凯旋展示 7 日。\n（战场记录永久可查）`;
      try {
        await Post.create({
          title, content, category: 'chat',
          tags: ['宗门战报', w.warType],
          author: leaderId
        });
      } catch (e) { /* 战报帖失败不阻塞结算 */ }
    }
  } else {
    // 平局：双方声望各 +10
    a.prestige += 10; d.prestige += 10;
    await Promise.all([a.save(), d.save()]);
  }
}

module.exports = { list, detail, start, question, answer, vote };
