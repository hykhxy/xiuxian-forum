// 宗门+战场 e2e（第17轮）：双宗建立→任命→宣战武斗→结算→奖励→文斗问答投票全链路
const BASE = process.env.E2E_BASE || 'http://localhost:3000/api';
let passed = 0, failed = 0;
const ok = (c, l, e) => { if (c) { passed++; console.log('PASS ' + l); } else { failed++; console.log('FAIL ' + l + (e !== undefined ? ' :: ' + JSON.stringify(e).slice(0, 200) : '')); } };

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let payload;
  try { payload = await res.json(); } catch { payload = {}; }
  return { success: payload.success, data: payload.data, message: payload.message };
}

async function regUser(name, prof) {
  const email = 's' + Math.random().toString(36).slice(2, 8) + '@t.dev';
  const s = await call('POST', '/auth/send-code', { body: { email } });
  const r = await call('POST', '/auth/register', { body: { username: name, password: 'test1234', profession: prof, email, code: s.data.devCode } });
  return { token: r.data.token, id: r.data.user.id, username: r.data.user.username };
}

(async () => {
  // ===== 宗门 =====
  const A = await regUser('宗主甲' + Date.now().toString().slice(-4), 'sword');
  const B = await regUser('宗主乙' + Date.now().toString().slice(-4), 'body');
  const J1 = await regUser('评委一' + Date.now().toString().slice(-4), 'mage');

  const mk = await call('POST', '/sects', { token: A.token, body: { name: '青云剑宗' + Math.random().toString(36).slice(2, 5) } });
  ok(mk.success, '创建宗门A（扣100灵石入宗库）', mk.message);
  const sectA = mk.data.sect.id;

  const mkB = await call('POST', '/sects', { token: B.token, body: { name: '玄武体宗' + Math.random().toString(36).slice(2, 5) } });
  ok(mkB.success, '创建宗门B', mkB.message);
  const sectB = mkB.data.sect.id;

  // 拉人：评委一加入A宗（做亲传弟子），再找几个散修当评委
  const join = await call('POST', `/sects/${sectA}/join`, { token: J1.token });
  ok(join.success && join.data.role === '外门弟子', '加入宗门默认外门弟子');

  const dup = await call('POST', `/sects/${sectB}/join`, { token: J1.token });
  ok(!dup.success && /已身在/.test(dup.message), '一人只可入一宗');

  const appoint = await call('PUT', `/sects/${sectA}/roles`, { token: A.token, body: { userId: J1.id, role: '亲传弟子' } });
  ok(appoint.success, '宗主任命亲传弟子');

  const ann = await call('PUT', `/sects/${sectA}/announcement`, { token: A.token, body: { content: '今夜子时，演武场集合。' } });
  ok(ann.success, '宗主发布公告');
  const annDeny = await call('PUT', `/sects/${sectA}/announcement`, { token: J1.token, body: { content: 'x' } });
  ok(!annDeny.success, '亲传弟子无权公告');

  const det = await call('GET', `/sects/${sectA}`, { token: A.token });
  ok(det.data.sect.myRole === '宗主' && det.data.sect.members.length === 2, '宗门详情+职务');

  // ===== 武斗 =====
  const dw = await call('POST', `/sects/${sectA}/declare-war`, { token: A.token, body: { targetId: sectB, warType: '武斗' } });
  ok(dw.success && dw.data.status === '准备中', '宣战武斗（编队快照）', dw.message);
  const warId = dw.data.warId;

  const dwDeny = await call('POST', `/sects/${sectB}/declare-war`, { token: B.token, body: { targetId: sectA, warType: '武斗' } });
  ok(!dwDeny.success, '已有进行中战争不可重复宣战');

  const wdet0 = await call('GET', `/wars/${warId}`, { token: A.token });
  ok(wdet0.data.war.attackerTeam.length === 5, '5 职位阵容快照');

  const startDeny = await call('POST', `/wars/${warId}/start`, { token: J1.token });
  ok(!startDeny.success, '亲传弟子不可开战');

  const start = await call('POST', `/wars/${warId}/start`, { token: A.token });
  ok(start.success && start.data.result && start.data.score.attacker + start.data.score.defender >= 0, '武斗一键结算', start.message);

  const wdet1 = await call('GET', `/wars/${warId}`, { token: A.token });
  ok(wdet1.data.war.status === '已结束' && wdet1.data.war.battles.length === 5, '5 场对战记录+已结束');
  ok(wdet1.data.war.battles.every(b => b.rounds && Array.isArray(b.rounds)), '每场含回合日志');

  // 战报帖
  const posts = await call('GET', '/posts?keyword=' + encodeURIComponent('战报'));
  ok(posts.data.list.length >= 1, '战报帖已发布');

  // ===== 文斗 =====
  const wd = await call('POST', `/sects/${sectA}/declare-war`, { token: A.token, body: { targetId: sectB, warType: '文斗' } });
  ok(wd.success && wd.data.status === '进行中', '宣战文斗（即刻进行中）', wd.message);
  const wid = wd.data.warId;

  // 第1轮：攻方(A)提问
  const q1 = await call('POST', `/wars/${wid}/question`, { token: B.token, body: { question: '试问灵气从何而来？' } });
  ok(!q1.success, '守方不可提问（轮次校验）');
  const q = await call('POST', `/wars/${wid}/question`, { token: A.token, body: { question: '试问灵气从何而来？' } });
  ok(q.success, '第1轮攻方提问');

  const a1 = await call('POST', `/wars/${wid}/answer`, { token: A.token, body: { answer: 'x' } });
  ok(!a1.success, '提问方不可作答');
  const ans = await call('POST', `/wars/${wid}/answer`, { token: B.token, body: { answer: '天地灵气源于阴阳交泰、五行运化，禀受于混沌初分之清气。' } });
  ok(ans.success, '守方作答');

  // 评委投票：需4票。评委须非交战方（J1 已入 A 宗被编入战队，不可投票——专设 4 名散修评委）
  const rnd = Date.now().toString().slice(-4);
  const J2 = await regUser('评委二' + rnd, 'mage');
  const J3 = await regUser('评委三' + rnd, 'ghost');
  const J4 = await regUser('评委四' + rnd, 'blood');
  const J5 = await regUser('评委五' + rnd, 'demon');
  const vDeny = await call('POST', `/wars/${wid}/vote`, { token: A.token, body: { pass: true } });
  ok(!vDeny.success, '交战方不可投票');
  const vDenyJ1 = await call('POST', `/wars/${wid}/vote`, { token: J1.token, body: { pass: true } });
  ok(!vDenyJ1.success, '参战宗门成员不可投票');

  for (const [i, j] of [J2, J3, J4, J5].entries()) {
    const v = await call('POST', `/wars/${wid}/vote`, { token: j.token, body: { pass: i < 3 } });  // 3过1否
    ok(v.success, `评委${i + 1}投票`);
  }
  const dupVote = await call('POST', `/wars/${wid}/vote`, { token: J2.token, body: { pass: true } });
  ok(!dupVote.success, '重复投票拦截');

  const wdet2 = await call('GET', `/wars/${wid}`, { token: A.token });
  ok(wdet2.data.war.rounds[0].winner === 'defender', '3/4 通过 → 答方(守方)得1分');

  // 第2轮：守方(B)提问（偶数轮互换）
  const q2 = await call('POST', `/wars/${wid}/question`, { token: B.token, body: { question: '「朝闻道」下一句？' } });
  ok(q2.success, '第2轮守方提问（轮换）');
  await call('POST', `/wars/${wid}/answer`, { token: A.token, body: { answer: '夕死可矣。' } });
  for (const j of [J2, J3, J4, J5]) await call('POST', `/wars/${wid}/vote`, { token: j.token, body: { pass: true } });
  const wdet3 = await call('GET', `/wars/${wid}`, { token: A.token });
  ok(wdet3.data.war.rounds[1].winner === 'attacker', '第2轮答方(攻方)得分');

  // 跳过剩余轮（懒超时会在24h后由提问方胜）——验证计分现状与列表
  const wars = await call('GET', '/wars');
  ok(wars.data.list.length >= 2, '战场历史列表');
  ok(wars.data.list.some(w => w.status === '已结束'), '已结束战争入历史');

  console.log(`\n===== SECT-WAR E2E: ${passed} passed, ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.log('E2E_ERROR', e.message); process.exit(1); });
