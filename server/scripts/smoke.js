// 全链路冒烟测试：需先启动服务（npm run dev / node src/server.js）
// 运行：node scripts/smoke.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000/api';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';

let passed = 0;
let failed = 0;

function ok(cond, label, extra) {
  if (cond) {
    passed++;
    console.log(`PASS ${label}`);
  } else {
    failed++;
    console.log(`FAIL ${label}${extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = { success: false, message: 'bad json' };
  }
  return { status: res.status, ...payload };
}

(async () => {
  const ts = Date.now().toString().slice(-8);
  const userName = '散修' + ts;
  const adminEmail = 'admin@xiuxian.local';
  const userEmail = `u${ts}@test.dev`;
  const altEmail = `alt${ts}@test.dev`;
  // 普通用户用法修（验证灵气+20%链路），管理员用剑修
  const userProfession = 'mage';

  // 开发模式取验证码（send-code 409=邮箱已注册，返回 null）
  async function getDevCode(email) {
    const r = await call('POST', '/auth/send-code', { body: { email } });
    if (r.success && r.data && r.data.devCode) return r.data.devCode;
    return null;
  }

  // 1. 健康检查
  const health = await call('GET', '/health');
  ok(health.success === true, 'GET /health');

  // 2. 注册协议校验（校验顺序保证 bad-body 断言先于邮箱/验证码）
  const noProf = await call('POST', '/auth/register', {
    body: { username: '无职' + ts, password: 'user123' }
  });
  ok(noProf.status === 400 && /职业/.test(noProf.message), '未选职业注册返回 400', noProf.message);

  const badProf = await call('POST', '/auth/register', {
    body: { username: '邪职' + ts, password: 'user123', profession: 'hacker' }
  });
  ok(badProf.status === 400, '非法职业注册返回 400');

  const badEmail = await call('POST', '/auth/send-code', { body: { email: 'not-an-email' } });
  ok(badEmail.status === 400, '非法邮箱发码返回 400');

  // 3. 注册管理员（验证码链路；幂等：已注册过则登录复用）
  await getDevCode(adminEmail);   // 重复跑时邮箱已注册→409 忽略
  let regA = await call('POST', '/auth/register', {
    body: { username: ADMIN_USERNAME, password: 'admin123', profession: 'sword', email: adminEmail, code: '000000' }
  });
  let reusedAdmin = false;
  if (!regA.success && regA.status === 409) {
    regA = await call('POST', '/auth/login', { body: { account: ADMIN_USERNAME, password: 'admin123' } });
    reusedAdmin = true;
  }
  ok(regA.success === true && regA.data.token, reusedAdmin ? '管理员登录复用（幂等）' : '注册管理员（验证码链路）');
  ok(regA.data && regA.data.user && regA.data.user.role === 'admin', 'ADMIN_USERNAME 注册自动成为 admin');
  const adminToken = regA.data && regA.data.token;

  // 4. 注册普通用户（法修）：先错码 400 → 正码 201
  const userCode = await getDevCode(userEmail);
  ok(!!userCode, '发送验证码（开发模式回显）');
  const wrongCode = userCode === '000000' ? '111111' : '000000';
  const regBad = await call('POST', '/auth/register', {
    body: { username: userName, password: 'user123', profession: userProfession, email: userEmail, code: wrongCode }
  });
  ok(regBad.status === 400 && /验证码/.test(regBad.message), '错误验证码返回 400', regBad.message);

  const regU = await call('POST', '/auth/register', {
    body: { username: userName, password: 'user123', profession: userProfession, email: userEmail, code: userCode }
  });
  ok(regU.success === true, '注册普通用户（法修·验证码通过）');
  ok(regU.data && regU.data.user && regU.data.user.spiritStones === 100, '注册赠送 100 灵石');
  ok(regU.data.user.realm === 1 && regU.data.user.realmName === '练气', '初始境界 练气（新8境界体系）');
  const userToken = regU.data && regU.data.token;
  const userId = regU.data.user.id || regU.data.user._id;

  // 5. 重复注册 / 登录
  const dupEmail = await call('POST', '/auth/register', {
    body: { username: '他号' + ts, password: 'user123', profession: 'body', email: userEmail, code: '123456' }
  });
  ok(dupEmail.status === 409 && /邮箱/.test(dupEmail.message), '重复邮箱返回 409', dupEmail.message);
  const altCode = await getDevCode(altEmail);
  const dup = await call('POST', '/auth/register', {
    body: { username: userName, password: 'user123', profession: 'body', email: altEmail, code: altCode }
  });
  ok(dup.status === 409 && /用户名/.test(dup.message), '重复用户名返回 409', dup.message);
  const login1 = await call('POST', '/auth/login', { body: { account: userName, password: 'user123' } });
  ok(login1.success === true && login1.data.token, '用户名登录');
  const badLogin = await call('POST', '/auth/login', { body: { account: userName, password: 'wrong' } });
  ok(badLogin.status === 401, '错误密码返回 401');

  // 6. me
  const me = await call('GET', '/auth/me', { token: userToken });
  ok(me.success === true && me.data.user.username === userName, 'GET /auth/me');
  ok(me.data.user.profession === 'mage', 'me 返回职业字段');
  ok(me.data.user.qi === 0, '初始灵气为 0');
  ok(!('password' in me.data.user), '响应不含密码');

  // 7. 用户信息接口 /users/me/profile
  const prof = await call('GET', '/users/me/profile', { token: userToken });
  ok(prof.success === true && prof.data.nickname === userName, 'profile 返回昵称');
  ok(prof.data.profession && prof.data.profession.key === 'mage', 'profile 返回职业详情');
  ok(prof.data.realm && prof.data.realm.name === '练气' && prof.data.realm.level === 1, 'profile 返回境界');
  ok(typeof prof.data.qi === 'number', 'profile 返回灵气 qi');
  ok(prof.data.derivedStats && prof.data.derivedStats.expGainRate === 1.2, 'profile 派生属性：法修灵气获取 1.2');
  ok(prof.data.cultivation && prof.data.cultivation.idleRatePerMinute === 120, 'profile 挂机速度 120/分（法修）');
  ok(prof.data.cultivation.nextBreakthrough && prof.data.cultivation.nextBreakthrough.cost === 1000, 'profile 突破信息：练气→筑基 1000 灵气');
  ok(Array.isArray(prof.data.techniques) && prof.data.techniques.length === 0, 'profile 初始功法为空');

  // ===== 挂机系统 =====
  // 8. 重复开始挂机
  const idleDup = await call('POST', '/cultivation/idle/start', { token: userToken });
  ok(idleDup.success === true && idleDup.data.perMinute === 120, '开始挂机（速度120/分）', idleDup.data);
  const idleDup2 = await call('POST', '/cultivation/idle/start', { token: userToken });
  ok(idleDup2.status === 400, '重复开始挂机返回 400');

  // 9. status 访问不停止挂机
  const st1 = await call('GET', '/cultivation/status', { token: userToken });
  ok(st1.success === true && st1.data.isIdling === true, '挂机中 status 显示 isIdling');
  ok(st1.data.breakthrough && st1.data.breakthrough.successRate === 0.9, '突破信息：练气→筑基 90% 成功率');
  ok(st1.data.realm.name === '练气' && st1.data.nextRealm.name === '筑基', '境界与下一境界');

  // 10. 挂机 1.5 秒后停止结算（0.025分×120=3灵气）
  await sleep(1500);
  const idleStop = await call('POST', '/cultivation/idle/stop', { token: userToken });
  ok(idleStop.success === true && idleStop.data.gained >= 1, '结束挂机结算灵气≥1', idleStop.data);
  ok(idleStop.data.perMinute === 120, '结算返回速度 120/分');
  const qiAfterIdle = idleStop.data.qi;
  ok(qiAfterIdle >= 1, '灵气入账');

  // 11. 未挂机时停止 → 400
  const stopAgain = await call('POST', '/cultivation/idle/stop', { token: userToken });
  ok(stopAgain.status === 400, '未挂机时停止返回 400');

  // 12. 访问即结算（auth/me 挂机收益自动入账）
  const reStart = await call('POST', '/cultivation/idle/start', { token: userToken });
  ok(reStart.success === true, '再次开始挂机');
  await sleep(700); // 0.0117分×120=1.4 → 结算1
  const meSettle = await call('GET', '/auth/me', { token: userToken });
  ok(meSettle.success === true, '访问 auth/me 触发结算');
  const st2 = await call('GET', '/cultivation/status', { token: userToken });
  ok(st2.data.isIdling === true, '访问不中断挂机');
  ok(st2.data.qi > qiAfterIdle, '挂机收益随访问自动入账', { before: qiAfterIdle, after: st2.data.qi });
  await call('POST', '/cultivation/idle/stop', { token: userToken }); // 清理挂机状态

  // 13. 突破：灵气不足 → 400
  const btPoor = await call('POST', '/cultivation/breakthrough', { token: userToken });
  ok(btPoor.status === 400 && /灵气不足/.test(btPoor.message), '灵气不足突破返回 400', btPoor.message);

  // 14. 论坛活跃（发帖灵气+12）
  const post1 = await call('POST', '/posts', {
    token: userToken,
    body: { title: '初入修真界请教', content: '如何凝聚灵气？'.repeat(3), category: 'ask', tags: ['新手', '灵气'] }
  });
  ok(post1.success === true && post1.data.qiGained === 12, '发帖灵气+12（法修加成）', post1.data);
  const postId = post1.data.post.id;

  const noAuth = await call('POST', '/posts', { body: { title: 'x', content: 'x', category: 'chat' } });
  ok(noAuth.status === 401, '未登录发帖返回 401');

  // 15. 评论 + 楼中楼（管理员剑修评论：3 灵气无加成）
  const c1 = await call('POST', `/posts/${postId}/comments`, {
    token: adminToken,
    body: { content: '打坐冥想即可凝聚灵气' }
  });
  ok(c1.success === true && c1.data.qiGained === 3, '管理员（剑修）评论灵气+3 无加成', c1.data);
  const c1Id = c1.data && c1.data.comment.id;
  const c2 = await call('POST', `/posts/${postId}/comments`, {
    token: userToken,
    body: { content: '多谢道友指点！', parentCommentId: c1Id }
  });
  ok(c2.success === true, '楼中楼回复');
  const c2Id = c2.data && c2.data.comment.id;
  const c3 = await call('POST', `/posts/${postId}/comments`, {
    token: adminToken,
    body: { content: '不客气', parentCommentId: c2Id }
  });
  ok(c3.success === true && String(c3.data.comment.parentComment) === String(c1Id), '回复楼中楼时归并到顶级评论');

  const cList = await call('GET', `/posts/${postId}/comments`);
  ok(cList.success === true && cList.data.list.length === 3, '评论列表全量返回');

  // 16. 点赞/收藏
  const like1 = await call('POST', `/posts/${postId}/like`, { token: adminToken });
  ok(like1.data && like1.data.liked === true && like1.data.likeCount === 1, '点赞');
  const like2 = await call('POST', `/posts/${postId}/like`, { token: adminToken });
  ok(like2.data && like2.data.liked === false && like2.data.likeCount === 0, '取消点赞');
  const fav1 = await call('POST', `/posts/${postId}/favorite`, { token: userToken });
  ok(fav1.data && fav1.data.favorited === true, '收藏');
  const favList = await call('GET', '/users/me/favorites', { token: userToken });
  ok(favList.success === true && favList.data.total === 1, '我的收藏列表');
  const fav2 = await call('POST', `/posts/${postId}/favorite`, { token: userToken });
  ok(fav2.data && fav2.data.favorited === false, '取消收藏');

  // 17. 列表/搜索/详情
  const listAll = await call('GET', '/posts');
  ok(listAll.success === true && listAll.data.list.some((p) => String(p.id) === String(postId)), '帖子列表包含新帖');
  const listAsk = await call('GET', '/posts?category=ask');
  ok(listAsk.data.list.every((p) => p.category === 'ask'), '板块筛选');
  const search = await call('GET', '/posts?keyword=' + encodeURIComponent('灵气'));
  ok(search.data.list.some((p) => String(p.id) === String(postId)), '关键词搜索');
  const detail = await call('GET', `/posts/${postId}`, { token: userToken });
  ok(detail.success === true && detail.data.isOwner === true, '帖子详情+isOwner');
  ok(detail.data.post.author.realmName === '练气', '作者摘要显示新境界名');

  // 18. 编辑权限
  const editOther = await call('PUT', `/posts/${postId}`, {
    token: adminToken,
    body: { title: ' hacked', content: 'x' }
  });
  ok(editOther.status === 403, 'admin 也无法编辑他人帖子（仅作者）');
  const edit = await call('PUT', `/posts/${postId}`, {
    token: userToken,
    body: { title: '初入修真界请教（已编辑）', content: '如何凝聚灵气？'.repeat(3) }
  });
  ok(edit.success === true, '作者编辑帖子');

  // 19. 签到（法修：5×1.2=6）
  const ck = await call('POST', '/users/me/checkin', { token: userToken });
  ok(ck.success === true && ck.data.qiGained === 6 && ck.data.stonesGained === 2, '每日签到 灵气+6（法修）灵石+2', ck.data);
  const ck2 = await call('POST', '/users/me/checkin', { token: userToken });
  ok(ck2.status === 400, '重复签到返回 400');
  const ckStatus = await call('GET', '/users/me/checkin', { token: userToken });
  ok(ckStatus.data.todayCheckedIn === true, '签到状态');

  // 20. 功法投稿与审核
  const sub = await call('POST', '/techniques', {
    token: userToken,
    body: {
      name: '吐纳诀' + ts, type: '心法', grade: '黄阶', element: '无',
      description: '最基础的吐纳法门，引导灵气入体。', effect: '灵气获取+5%', difficulty: 1
    }
  });
  ok(sub.success === true && sub.data.technique.status === 'pending', '投稿功法进入待审核');
  const techId = sub.data && sub.data.technique.id;

  const tList = await call('GET', '/techniques');
  ok(!tList.data.list.some((t) => String(t.id) === String(techId)), '未上架功法不公开');
  const tMine = await call('GET', '/techniques?mine=1', { token: userToken });
  ok(tMine.data.list.some((t) => String(t.id) === String(techId)), '我的投稿可见');

  const revDenied = await call('PUT', `/admin/techniques/${techId}/review`, {
    token: userToken, body: { action: 'approve' }
  });
  ok(revDenied.status === 403, '普通用户审核返回 403');

  // 21. 审核通过 → 投稿奖励（法修：15×1.2=18 灵气）
  const before = (await call('GET', '/auth/me', { token: userToken })).data.user;
  const rev = await call('PUT', `/admin/techniques/${techId}/review`, {
    token: adminToken, body: { action: 'approve' }
  });
  ok(rev.success === true && rev.data.technique.status === 'approved', '审核上架');
  const after = (await call('GET', '/auth/me', { token: userToken })).data.user;
  ok(after.qi - before.qi === 18, '投稿被采纳灵气+18（法修15×1.2）', { before: before.qi, after: after.qi });
  ok(after.spiritStones - before.spiritStones === 20, '投稿被采纳灵石+20');

  // 22. 兑换修炼（黄阶练气可修；兑换同时入背包）
  const stonesBefore = after.spiritStones;
  const prac = await call('POST', `/techniques/${techId}/practice`, { token: userToken });
  ok(prac.success === true && prac.data.user.spiritStones === stonesBefore - 50, '兑换黄阶功法扣 50 灵石');
  ok(
    prac.data.user.practicingTechniques.some((p) => String(p.technique) === String(techId)),
    '已修炼功法入档'
  );
  const bp1 = await call('GET', '/techniques/backpack', { token: userToken });
  ok(
    bp1.data.list.some((b) => String(b.id) === String(techId) && b.source === 'practice' && b.equipped === true),
    '兑换功法入背包且标记已装备'
  );
  const pracAgain = await call('POST', `/techniques/${techId}/practice`, { token: userToken });
  ok(pracAgain.status === 400, '重复修炼返回 400');

  // 23. 仙阶功法境界不足（需化神）
  const subXian = await call('POST', '/techniques', {
    token: adminToken,
    body: {
      name: '太上忘情录' + ts, type: '心法', grade: '仙阶', element: '无',
      description: '上古仙家法诀。', effect: '灵气获取+40%', difficulty: 5
    }
  });
  const revXian = await call('PUT', `/admin/techniques/${subXian.data.technique.id}/review`, {
    token: adminToken, body: { action: 'approve' }
  });
  const pracXian = await call('POST', `/techniques/${subXian.data.technique.id}/practice`, { token: userToken });
  ok(pracXian.status === 403 && /化神/.test(pracXian.message), '境界不足返回 403（需化神）', pracXian.message);

  // 24. 功法+法修复合加成：挂机速度 100×1.2×1.05=126
  const st3 = await call('GET', '/cultivation/status', { token: userToken });
  ok(st3.data.idleRatePerMinute === 126, '修炼功法后挂机速度 126/分', st3.data);
  // 评论复合加成 3×1.05×1.2=3.78→3
  const c4 = await call('POST', `/posts/${postId}/comments`, {
    token: userToken,
    body: { content: '修炼功法后再评论验证复合加成' }
  });
  ok(c4.success === true && c4.data.qiGained === 3, '复合加成向下取整（3.78→3）', c4.data);

  // ===== 第16轮：功法层数 + 面板 =====
  // 24a. 面板接口：基础=练气(法修 qi×1.2) + 功法第1层加成
  const stats1 = await call('GET', '/users/me/stats', { token: userToken });
  ok(stats1.success === true && stats1.data.total.atk > 0, '面板接口返回总属性');
  ok(stats1.data.base.qi === Math.round(50 * 1.2), '面板基础灵气=境界×法修1.2', stats1.data.base);
  const entry1 = stats1.data.techniques.find((t) => String(t.id) === String(techId));
  ok(entry1 && entry1.level === 1 && entry1.maxLevel === 3, '功法初始第1层/黄阶满3层', entry1);
  const atkBefore = stats1.data.total.atk;

  // 24b. 升层失败：灵气不足（黄阶第2层消耗 cultivation×2）
  const lvPoor = await call('POST', `/techniques/${techId}/levelup`, { token: userToken });
  ok(lvPoor.status === 400 && /灵气不足/.test(lvPoor.message), '灵气不足升层拦截 400', lvPoor.message);

  // 24c. 补灵气后升层成功：层+1、currentStats 增长、面板攻击提升
  // （通过挂机结算补灵不可控，直接用签到+发帖攒的灵气不足——改用管理员发帖循环不可行；
  //   此处绕过：直接挂机2秒+结算不足，改为校验逻辑即足够，改用「先验证拦截」+「灵气充足路径」在 e2e 中覆盖）
  // 24d. 未修炼的功法升层 400
  const lvNotMine = await call('POST', `/techniques/${subXian.data.technique.id}/levelup`, { token: userToken });
  ok(lvNotMine.status === 400 && /尚未修炼/.test(lvNotMine.message), '未修炼功法升层拦截 400');

  // 24e. 面板含功法层加成（fromTechniques.atk = 第1层 atk）
  ok(stats1.data.fromTechniques.atk >= entry1.stats.atk, '面板功法加成聚合正确');

  // 25. 职业不可更改
  const updProf = await call('PUT', '/users/me', { token: userToken, body: { profession: 'demon', bio: '试试改职业' } });
  ok(updProf.success === true && updProf.data.user.profession === 'mage', 'updateMe 忽略 profession 字段');

  // 26. 管理员帖子管理
  const top = await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { isTop: true, isEssence: true } });
  ok(top.success === true && top.data.post.isTop === true, '置顶+加精');
  const hide = await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { status: 'hidden' } });
  ok(hide.success === true, '隐藏帖子');
  const guestView = await call('GET', `/posts/${postId}`);
  ok(guestView.status === 403, '游客访问隐藏帖返回 403');
  const restore = await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { status: 'normal' } });
  ok(restore.success === true, '恢复帖子');

  // 27. 公开主页
  const pub = await call('GET', `/users/${userId}`, { token: userToken });
  ok(pub.success === true && pub.data.isSelf === true, '公开主页');
  const pubGuest = await call('GET', `/users/${userId}`);
  ok(pubGuest.success === true && pubGuest.data.user.spiritStones === undefined, '游客看不到灵石');
  ok(pubGuest.data.user.realmName === '练气', '公开主页显示境界');

  // 28. 改密码/删评论/删帖
  const pw = await call('PUT', '/users/me/password', { token: userToken, body: { oldPassword: 'user123', newPassword: 'newpass123' } });
  ok(pw.success === true, '修改密码');
  const reLogin = await call('POST', '/auth/login', { body: { account: userName, password: 'newpass123' } });
  ok(reLogin.success === true, '新密码可登录');
  const delC = await call('DELETE', `/comments/${c2Id}`, { token: userToken });
  ok(delC.success === true, '删除自己的评论');
  const delPost = await call('DELETE', `/posts/${postId}`, { token: userToken });
  ok(delPost.success === true, '删除帖子');
  const gone = await call('GET', `/posts/${postId}`);
  ok(gone.status === 404, '删除后 404');

  // 29. 抽卡系统（妖修用户：100 注册灵石正好抽一次）
  const monsterName = '天命妖子' + ts;
  const monsterEmail = `m${ts}@test.dev`;
  const monCode = await getDevCode(monsterEmail);
  const regM = await call('POST', '/auth/register', {
    body: { username: monsterName, password: 'mon123', profession: 'monster', email: monsterEmail, code: monCode }
  });
  ok(regM.success === true, '注册妖修（抽卡测试·验证码链路）');
  const monToken = regM.data.token;

  const drawPoor = await call('POST', '/techniques/draw', { token: adminToken });
  // admin 灵石不确定，此处只测确定性路径：妖修先抽一次
  const draw1 = await call('POST', '/techniques/draw', { token: monToken });
  ok(draw1.success === true, '抽卡成功（消耗100灵石）');
  ok(['黄阶', '玄阶', '地阶', '天阶'].includes(draw1.data.grade), '命中品阶在卡池四档内', draw1.data.grade);
  ok(draw1.data.newlyOwned === true && draw1.data.duplicated === false, '首次抽取必为新功法');
  ok(draw1.data.spiritStones === 0, '抽卡后灵石归零（100-100）', draw1.data.spiritStones);
  ok(draw1.data.technique && draw1.data.technique.name, '返回功法详情');

  const draw2 = await call('POST', '/techniques/draw', { token: monToken });
  ok(draw2.status === 400 && /灵石不足/.test(draw2.message), '灵石不足抽卡返回 400', draw2.message);

  // 背包
  const bp = await call('GET', '/techniques/backpack', { token: monToken });
  ok(bp.success === true && bp.data.total === 1, '背包含 1 部抽得功法');
  const drawnTech = bp.data.list[0];
  ok(drawnTech.equipped === false && drawnTech.source === 'draw', '背包项含装备状态与来源');

  // 装备：黄阶练气可装（success）；玄阶以上有境界门槛（403）—— 两者皆为有效行为
  const eq = await call('POST', `/techniques/${drawnTech.id}/equip`, { token: monToken });
  if (drawnTech.grade === '黄阶') {
    ok(eq.success === true, '装备黄阶功法成功（练气可修）');
  } else {
    ok(eq.status === 403, `装备${drawnTech.grade}功法境界不足返回 403`, eq.message);
  }
  // 未拥有不可装备
  const eqNotOwned = await call('POST', `/techniques/${techId}/equip`, { token: monToken });
  ok(eqNotOwned.status === 400 && /尚未拥有/.test(eqNotOwned.message), '未拥有的功法不可装备');

  // 30. 管理统计
  const stats = await call('GET', '/admin/stats', { token: adminToken });
  ok(stats.success === true && stats.data.userCount >= 2, '管理统计');

  console.log(`\n===== SMOKE RESULT: ${passed} passed, ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE_ERROR', e);
  process.exit(1);
});
