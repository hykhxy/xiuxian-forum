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
  // 普通用户用法修（验证灵气+20%加成链路），管理员用剑修
  const userProfession = 'mage';

  // 1. 健康检查
  const health = await call('GET', '/health');
  ok(health.success === true, 'GET /health');

  // 2. 注册协议校验
  const noProf = await call('POST', '/auth/register', {
    body: { username: '无职' + ts, password: 'user123' }
  });
  ok(noProf.status === 400 && /职业/.test(noProf.message), '未选职业注册返回 400', noProf.message);

  const badProf = await call('POST', '/auth/register', {
    body: { username: '邪职' + ts, password: 'user123', profession: 'hacker' }
  });
  ok(badProf.status === 400, '非法职业注册返回 400');

  const shortPwd = await call('POST', '/auth/register', {
    body: { username: '短密' + ts, password: '123', profession: 'sword' }
  });
  ok(shortPwd.status === 400, '密码过短注册返回 400');

  // 3. 注册管理员（ADMIN_USERNAME 匹配；幂等：已注册过则直接登录复用）
  let regA = await call('POST', '/auth/register', {
    body: { username: ADMIN_USERNAME, password: 'admin123', profession: 'sword' }
  });
  let reusedAdmin = false;
  if (!regA.success && regA.status === 409) {
    regA = await call('POST', '/auth/login', { body: { account: ADMIN_USERNAME, password: 'admin123' } });
    reusedAdmin = true;
  }
  ok(regA.success === true && regA.data.token, reusedAdmin ? '管理员登录复用（幂等）' : '注册管理员');
  ok(regA.data && regA.data.user && regA.data.user.role === 'admin', 'ADMIN_USERNAME 注册自动成为 admin');
  ok(regA.data.user.profession === 'sword', '管理员职业为剑修');
  const adminToken = regA.data && regA.data.token;

  // 4. 注册普通用户（法修）
  const regU = await call('POST', '/auth/register', {
    body: { username: userName, password: 'user123', profession: userProfession }
  });
  ok(regU.success === true, '注册普通用户（法修）');
  ok(regU.data && regU.data.user && regU.data.user.spiritStones === 100, '注册赠送 100 灵石');
  const userToken = regU.data && regU.data.token;
  const userId = regU.data.user.id || regU.data.user._id;

  // 5. 重复注册
  const dup = await call('POST', '/auth/register', {
    body: { username: userName, password: 'user123', profession: 'body' }
  });
  ok(dup.status === 409, '重复用户名返回 409', dup.message);

  // 6. 登录（用户名）+ 错误密码
  const login1 = await call('POST', '/auth/login', { body: { account: userName, password: 'user123' } });
  ok(login1.success === true && login1.data.token, '用户名登录');
  const badLogin = await call('POST', '/auth/login', { body: { account: userName, password: 'wrong' } });
  ok(badLogin.status === 401, '错误密码返回 401');

  // 7. me
  const me = await call('GET', '/auth/me', { token: userToken });
  ok(me.success === true && me.data.user.username === userName, 'GET /auth/me');
  ok(me.data.user.realmLevel === 1, '初始境界 练气一层');
  ok(me.data.user.profession === 'mage', 'me 返回职业字段');
  ok(!('password' in me.data.user), '响应不含密码');

  // 8. 用户信息接口 /users/me/profile
  const prof = await call('GET', '/users/me/profile', { token: userToken });
  ok(prof.success === true && prof.data.nickname === userName, 'profile 返回昵称');
  ok(prof.data.profession && prof.data.profession.key === 'mage' && prof.data.profession.name === '法修', 'profile 返回职业详情');
  ok(prof.data.realm && prof.data.realm.name === '练气一层', 'profile 返回境界');
  ok(typeof prof.data.spiritStones === 'number', 'profile 返回灵石');
  ok(prof.data.derivedStats && prof.data.derivedStats.expGainRate === 1.2, 'profile 派生属性：法修灵气获取 1.2');
  ok(Array.isArray(prof.data.techniques) && prof.data.techniques.length === 0, 'profile 初始功法为空');

  // 9. 发帖（法修修为 = 10 × 1.2 = 12）
  const post1 = await call('POST', '/posts', {
    token: userToken,
    body: { title: '初入修真界请教', content: '如何凝聚灵气？'.repeat(3), category: 'ask', tags: ['新手', '灵气'] }
  });
  ok(post1.success === true && post1.data.expGained === 12, '发帖修为+12（法修加成）', post1.data);

  // 10. 未登录发帖 → 401
  const noAuth = await call('POST', '/posts', { body: { title: 'x', content: 'x', category: 'chat' } });
  ok(noAuth.status === 401, '未登录发帖返回 401');

  // 11. 评论 + 楼中楼（管理员评论无灵气加成：3）
  const c1 = await call('POST', `/posts/${post1.data.post.id}/comments`, {
    token: adminToken,
    body: { content: '打坐冥想即可凝聚灵气' }
  });
  ok(c1.success === true && c1.data.expGained === 3, '管理员（剑修）评论修为+3 无灵气加成', c1.data);
  const c1Id = c1.data && c1.data.comment.id;
  const c2 = await call('POST', `/posts/${post1.data.post.id}/comments`, {
    token: userToken,
    body: { content: '多谢道友指点！', parentCommentId: c1Id }
  });
  ok(c2.success === true, '楼中楼回复');
  const c2Id = c2.data && c2.data.comment.id;
  const c3 = await call('POST', `/posts/${post1.data.post.id}/comments`, {
    token: adminToken,
    body: { content: '不客气', parentCommentId: c2Id }
  });
  ok(c3.success === true && String(c3.data.comment.parentComment) === String(c1Id), '回复楼中楼时归并到顶级评论');

  const cList = await call('GET', `/posts/${post1.data.post.id}/comments`);
  ok(cList.success === true && cList.data.list.length === 3, '评论列表全量返回');

  // 12. 点赞/收藏 toggle
  const postId = post1.data.post.id;
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

  // 13. 列表筛选与搜索
  const listAll = await call('GET', '/posts');
  ok(listAll.success === true && listAll.data.list.some((p) => String(p.id) === String(postId)), '帖子列表包含新帖');
  const listAsk = await call('GET', '/posts?category=ask');
  ok(listAsk.data.list.every((p) => p.category === 'ask'), '板块筛选');
  const search = await call('GET', '/posts?keyword=' + encodeURIComponent('灵气'));
  ok(search.data.list.some((p) => String(p.id) === String(postId)), '关键词搜索');
  const searchNone = await call('GET', '/posts?keyword=' + encodeURIComponent('不存在的词汇xyz'));
  ok(searchNone.data.total === 0, '关键词无结果');

  // 14. 详情 + 浏览量
  const detail = await call('GET', `/posts/${postId}`, { token: userToken });
  ok(detail.success === true && detail.data.isOwner === true, '帖子详情+isOwner');
  const detail2 = await call('GET', `/posts/${postId}`);
  ok(detail2.data.post.viewCount >= detail.data.post.viewCount + 1, '浏览量自增');

  // 15. 编辑/删除权限
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

  // 16. 签到（法修：5 × 1.2 = 6）
  const ck = await call('POST', '/users/me/checkin', { token: userToken });
  ok(ck.success === true && ck.data.expGained === 6 && ck.data.stonesGained === 2, '每日签到 修为+6（法修）灵石+2', ck.data);
  const ck2 = await call('POST', '/users/me/checkin', { token: userToken });
  ok(ck2.status === 400, '重复签到返回 400');
  const ckStatus = await call('GET', '/users/me/checkin', { token: userToken });
  ok(ckStatus.data.todayCheckedIn === true && ckStatus.data.consecutiveDays === 1, '签到状态与日历');
  ok(ckStatus.data.monthDates.length === 1, '签到日历含今日');

  // 17. 功法投稿（普通用户）
  const sub = await call('POST', '/techniques', {
    token: userToken,
    body: {
      name: '吐纳诀' + ts, type: '心法', grade: '黄阶', element: '无',
      description: '最基础的吐纳法门，引导灵气入体。', effect: '修为获取+5%', difficulty: 1
    }
  });
  ok(sub.success === true && sub.data.technique.status === 'pending', '投稿功法进入待审核');
  const techId = sub.data && sub.data.technique.id;

  // 18. 待审核功法不出现在图鉴
  const tList = await call('GET', '/techniques');
  ok(!tList.data.list.some((t) => String(t.id) === String(techId)), '未上架功法不公开');
  const tMine = await call('GET', '/techniques?mine=1', { token: userToken });
  ok(tMine.data.list.some((t) => String(t.id) === String(techId) && t.status === 'pending'), '我的投稿可见');

  // 19. 普通用户无审核权
  const revDenied = await call('PUT', `/admin/techniques/${techId}/review`, {
    token: userToken, body: { action: 'approve' }
  });
  ok(revDenied.status === 403, '普通用户审核返回 403');

  // 20. 管理员审核通过 → 投稿人获得奖励（法修：修为 15×1.2=18、灵石+20）
  const before = (await call('GET', '/auth/me', { token: userToken })).data.user;
  const rev = await call('PUT', `/admin/techniques/${techId}/review`, {
    token: adminToken, body: { action: 'approve' }
  });
  ok(rev.success === true && rev.data.technique.status === 'approved', '审核上架');
  const after = (await call('GET', '/auth/me', { token: userToken })).data.user;
  ok(after.exp - before.exp === 18, '投稿被采纳修为+18（法修15×1.2）', { before: before.exp, after: after.exp });
  ok(after.spiritStones - before.spiritStones === 20, '投稿被采纳灵石+20');

  // 21. 兑换修炼
  const stonesBefore = after.spiritStones;
  const prac = await call('POST', `/techniques/${techId}/practice`, { token: userToken });
  ok(prac.success === true && prac.data.user.spiritStones === stonesBefore - 50, '兑换黄阶功法扣 50 灵石');
  ok(
    prac.data.user.practicingTechniques.some((p) => String(p.technique) === String(techId)),
    '已修炼功法入档'
  );
  const pracAgain = await call('POST', `/techniques/${techId}/practice`, { token: userToken });
  ok(pracAgain.status === 400, '重复修炼返回 400');

  // 22. 境界不足的功法（仙阶需化神期+2000灵石）
  const subXian = await call('POST', '/techniques', {
    token: adminToken,
    body: {
      name: '太上忘情录' + ts, type: '心法', grade: '仙阶', element: '无',
      description: '上古仙家法诀。', effect: '修为获取+40%', difficulty: 5
    }
  });
  const revXian = await call('PUT', `/admin/techniques/${subXian.data.technique.id}/review`, {
    token: adminToken, body: { action: 'approve' }
  });
  const pracXian = await call('POST', `/techniques/${subXian.data.technique.id}/practice`, { token: userToken });
  ok(pracXian.status === 403 && /境界不足/.test(pracXian.message), '境界不足返回 403', pracXian.message);

  // 23. 功法+法修复合加成：评论基础3 × 1.05 × 1.2 = 3.78 → 3（floor）
  const c4 = await call('POST', `/posts/${postId}/comments`, {
    token: userToken,
    body: { content: '修炼功法后再评论验证复合加成' }
  });
  ok(c4.success === true && c4.data.expGained === 3, '复合加成向下取整（3.78→3）', c4.data);

  // 24. profile 功法列表已包含修炼功法
  const prof2 = await call('GET', '/users/me/profile', { token: userToken });
  ok(
    prof2.data.techniques.some((t) => String(t.id) === String(techId) && t.expBonusRate === 1.05),
    'profile 已拥有功法列表含修炼功法'
  );

  // 25. 职业不可更改：PUT /users/me 传 profession 应被忽略
  const updProf = await call('PUT', '/users/me', { token: userToken, body: { profession: 'demon', bio: '试试改职业' } });
  ok(updProf.success === true && updProf.data.user.profession === 'mage', 'updateMe 忽略 profession 字段（职业不可更改）');

  // 26. 管理员帖子管理：置顶/加精/隐藏
  const top = await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { isTop: true, isEssence: true } });
  ok(top.success === true && top.data.post.isTop === true, '置顶+加精');
  const hide = await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { status: 'hidden' } });
  ok(hide.success === true, '隐藏帖子');
  const guestView = await call('GET', `/posts/${postId}`);
  ok(guestView.status === 403, '游客访问隐藏帖返回 403');
  const ownerView = await call('GET', `/posts/${postId}`, { token: userToken });
  ok(ownerView.success === true, '作者仍可查看隐藏帖');
  const restore = await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { status: 'normal', isTop: false } });
  ok(restore.success === true, '恢复帖子');

  // 27. 置顶帖排序在首
  await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { isTop: true } });
  const listTop = await call('GET', '/posts?limit=5');
  ok(String(listTop.data.list[0].id) === String(postId), '置顶帖排最前');

  // 28. 公开主页
  const pub = await call('GET', `/users/${userId}`, { token: userToken });
  ok(pub.success === true && pub.data.isSelf === true && pub.data.user.spiritStones !== undefined, '公开主页（本人含灵石）');
  const pubGuest = await call('GET', `/users/${userId}`);
  ok(pubGuest.success === true && pubGuest.data.user.spiritStones === undefined, '游客看不到灵石');
  ok(pubGuest.data.user.profession && pubGuest.data.user.profession.name === '法修', '公开主页显示职业');

  // 29. 编辑资料 + 改密码
  const upd = await call('PUT', '/users/me', { token: userToken, body: { bio: '大道三千，取其一。' } });
  ok(upd.success === true && upd.data.user.bio === '大道三千，取其一。', '编辑签名');
  const pw = await call('PUT', '/users/me/password', { token: userToken, body: { oldPassword: 'user123', newPassword: 'newpass123' } });
  ok(pw.success === true, '修改密码');
  const reLogin = await call('POST', '/auth/login', { body: { account: userName, password: 'newpass123' } });
  ok(reLogin.success === true, '新密码可登录');

  // 30. 删评论/删帖
  const delC = await call('DELETE', `/comments/${c2Id}`, { token: userToken });
  ok(delC.success === true, '删除自己的评论');
  const delPost = await call('DELETE', `/posts/${postId}`, { token: userToken });
  ok(delPost.success === true, '删除帖子');
  const gone = await call('GET', `/posts/${postId}`);
  ok(gone.status === 404, '删除后 404');
  const meAfter = (await call('GET', '/auth/me', { token: userToken })).data.user;
  ok(meAfter.postCount === 0, '删帖后发帖数归还');
  ok(meAfter.profession === 'mage', '全程职业未变化');

  // 31. 管理统计
  const stats = await call('GET', '/admin/stats', { token: adminToken });
  ok(stats.success === true && stats.data.userCount >= 2, '管理统计');

  console.log(`\n===== SMOKE RESULT: ${passed} passed, ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE_ERROR', e);
  process.exit(1);
});
