// 全链路冒烟测试：需先启动服务（npm run dev / node src/server.js）
// 运行：node scripts/smoke.js
const BASE = process.env.SMOKE_BASE || 'http://localhost:3000/api';

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
  const adminName = '掌门' + ts;
  const userName = '散修' + ts;

  // 1. 健康检查
  const health = await call('GET', '/health');
  ok(health.success === true, 'GET /health');

  // 2. 注册管理员（ADMIN_EMAIL 匹配）
  const regA = await call('POST', '/auth/register', {
    body: { username: adminName, email: 'admin@xiuxian.local', password: 'admin123' }
  });
  ok(regA.success === true && regA.data.token, '注册管理员');
  ok(regA.data && regA.data.user && regA.data.user.role === 'admin', 'ADMIN_EMAIL 注册自动成为 admin');
  const adminToken = regA.data && regA.data.token;

  // 3. 注册普通用户
  const regU = await call('POST', '/auth/register', {
    body: { username: userName, email: `u${ts}@test.dev`, password: 'user123' }
  });
  ok(regU.success === true, '注册普通用户');
  ok(regU.data && regU.data.user && regU.data.user.spiritStones === 100, '注册赠送 100 灵石');
  const userToken = regU.data && regU.data.token;
  const userId = regU.data.user.id || regU.data.user._id;

  // 4. 重复注册
  const dup = await call('POST', '/auth/register', {
    body: { username: userName, email: `x${ts}@test.dev`, password: 'user123' }
  });
  ok(dup.status === 409, '重复道号返回 409', dup.message);

  // 5. 登录（用户名）+ 邮箱登录
  const login1 = await call('POST', '/auth/login', { body: { account: userName, password: 'user123' } });
  const login2 = await call('POST', '/auth/login', { body: { account: `u${ts}@test.dev`, password: 'user123' } });
  ok(login1.success === true && login2.success === true, '用户名/邮箱登录');
  const badLogin = await call('POST', '/auth/login', { body: { account: userName, password: 'wrong' } });
  ok(badLogin.status === 401, '错误密码返回 401');

  // 6. me
  const me = await call('GET', '/auth/me', { token: userToken });
  ok(me.success === true && me.data.user.username === userName, 'GET /auth/me');
  ok(me.data.user.realmLevel === 1, '初始境界 练气一层');

  // 7. 发帖（修为+10）
  const post1 = await call('POST', '/posts', {
    token: userToken,
    body: { title: '初入修真界请教', content: '如何凝聚灵气？'.repeat(3), category: 'ask', tags: ['新手', '灵气'] }
  });
  ok(post1.success === true && post1.data.expGained === 10, '发帖成功且修为+10', post1.data);
  const postId = post1.data && post1.data.post.id;

  // 8. 未登录发帖 → 401
  const noAuth = await call('POST', '/posts', { body: { title: 'x', content: 'x', category: 'chat' } });
  ok(noAuth.status === 401, '未登录发帖返回 401');

  // 9. 评论 + 楼中楼
  const c1 = await call('POST', `/posts/${postId}/comments`, {
    token: adminToken,
    body: { content: '打坐冥想即可凝聚灵气' }
  });
  ok(c1.success === true && c1.data.expGained === 3, '管理员评论且修为+3', c1.data);
  const c1Id = c1.data && c1.data.comment.id;
  const c2 = await call('POST', `/posts/${postId}/comments`, {
    token: userToken,
    body: { content: '多谢道友指点！', parentCommentId: c1Id }
  });
  ok(c2.success === true, '楼中楼回复');
  const c2Id = c2.data && c2.data.comment.id;
  const c3 = await call('POST', `/posts/${postId}/comments`, {
    token: adminToken,
    body: { content: '不客气', parentCommentId: c2Id } // 回复楼中楼 → 归到顶级评论
  });
  ok(c3.success === true && String(c3.data.comment.parentComment) === String(c1Id), '回复楼中楼时归并到顶级评论', c3.data);

  const cList = await call('GET', `/posts/${postId}/comments`);
  ok(cList.success === true && cList.data.list.length === 3, '评论列表全量返回');

  // 10. 点赞 toggle
  const like1 = await call('POST', `/posts/${postId}/like`, { token: adminToken });
  ok(like1.data && like1.data.liked === true && like1.data.likeCount === 1, '点赞');
  const like2 = await call('POST', `/posts/${postId}/like`, { token: adminToken });
  ok(like2.data && like2.data.liked === false && like2.data.likeCount === 0, '取消点赞');

  // 11. 收藏 toggle
  const fav1 = await call('POST', `/posts/${postId}/favorite`, { token: userToken });
  ok(fav1.data && fav1.data.favorited === true, '收藏');
  const favList = await call('GET', '/users/me/favorites', { token: userToken });
  ok(favList.success === true && favList.data.total === 1, '我的收藏列表');
  const fav2 = await call('POST', `/posts/${postId}/favorite`, { token: userToken });
  ok(fav2.data && fav2.data.favorited === false, '取消收藏');

  // 12. 列表筛选与搜索
  const listAll = await call('GET', '/posts');
  ok(listAll.success === true && listAll.data.list.some((p) => String(p.id) === String(postId)), '帖子列表包含新帖');
  const listAsk = await call('GET', '/posts?category=ask');
  ok(listAsk.data.list.every((p) => p.category === 'ask'), '板块筛选');
  const search = await call('GET', '/posts?keyword=' + encodeURIComponent('灵气'));
  ok(search.data.list.some((p) => String(p.id) === String(postId)), '关键词搜索');
  const searchNone = await call('GET', '/posts?keyword=' + encodeURIComponent('不存在的词汇xyz'));
  ok(searchNone.data.total === 0, '关键词无结果');

  // 13. 详情 + 浏览量
  const detail = await call('GET', `/posts/${postId}`, { token: userToken });
  ok(detail.success === true && detail.data.isOwner === true, '帖子详情+isOwner');
  const detail2 = await call('GET', `/posts/${postId}`);
  ok(detail2.data.post.viewCount >= detail.data.post.viewCount + 1, '浏览量自增');

  // 14. 编辑/删除权限
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

  // 15. 签到
  const ck = await call('POST', '/users/me/checkin', { token: userToken });
  ok(ck.success === true && ck.data.expGained === 5 && ck.data.stonesGained === 2, '每日签到 修为+5 灵石+2', ck.data);
  const ck2 = await call('POST', '/users/me/checkin', { token: userToken });
  ok(ck2.status === 400, '重复签到返回 400');
  const ckStatus = await call('GET', '/users/me/checkin', { token: userToken });
  ok(ckStatus.data.todayCheckedIn === true && ckStatus.data.consecutiveDays === 1, '签到状态与日历');
  ok(ckStatus.data.monthDates.length === 1, '签到日历含今日');

  // 16. 功法投稿（普通用户）
  const sub = await call('POST', '/techniques', {
    token: userToken,
    body: {
      name: '吐纳诀' + ts, type: '心法', grade: '黄阶', element: '无',
      description: '最基础的吐纳法门，引导灵气入体。', effect: '修为获取+5%', difficulty: 1
    }
  });
  ok(sub.success === true && sub.data.technique.status === 'pending', '投稿功法进入待审核');
  const techId = sub.data && sub.data.technique.id;

  // 17. 待审核功法不出现在图鉴
  const tList = await call('GET', '/techniques');
  ok(!tList.data.list.some((t) => String(t.id) === String(techId)), '未上架功法不公开');
  const tMine = await call('GET', '/techniques?mine=1', { token: userToken });
  ok(tMine.data.list.some((t) => String(t.id) === String(techId) && t.status === 'pending'), '我的投稿可见');

  // 18. 普通用户无审核权
  const revDenied = await call('PUT', `/admin/techniques/${techId}/review`, {
    token: userToken, body: { action: 'approve' }
  });
  ok(revDenied.status === 403, '普通用户审核返回 403');

  // 19. 管理员审核通过 → 投稿人获得奖励（修为+15、灵石+20）
  const before = (await call('GET', '/auth/me', { token: userToken })).data.user;
  const rev = await call('PUT', `/admin/techniques/${techId}/review`, {
    token: adminToken, body: { action: 'approve' }
  });
  ok(rev.success === true && rev.data.technique.status === 'approved', '审核上架');
  const after = (await call('GET', '/auth/me', { token: userToken })).data.user;
  ok(after.exp - before.exp === 15, '投稿被采纳修为+15', { before: before.exp, after: after.exp });
  ok(after.spiritStones - before.spiritStones === 20, '投稿被采纳灵石+20');

  // 20. 兑换修炼
  const stonesBefore = after.spiritStones;
  const prac = await call('POST', `/techniques/${techId}/practice`, { token: userToken });
  ok(prac.success === true && prac.data.user.spiritStones === stonesBefore - 50, '兑换黄阶功法扣 50 灵石', prac.data);
  ok(
    prac.data.user.practicingTechniques.some((p) => String(p.technique) === String(techId)),
    '已修炼功法入档'
  );
  const pracAgain = await call('POST', `/techniques/${techId}/practice`, { token: userToken });
  ok(pracAgain.status === 400, '重复修炼返回 400');

  // 21. 境界不足的功法（仙阶需化神期+2000灵石）
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

  // 22. 功法加成生效（发帖基础10 × 1.05 = 10.5 → 10；评论基础3 × 1.05 = 3.15 → 3）
  // 用签到（基础5 × 1.05 = 5.25 → 5）无法区分，故以修炼成功+扣灵石为准，倍率已由单测覆盖

  // 23. 管理员帖子管理：置顶/加精/隐藏
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

  // 24. 置顶帖排序在首
  await call('PUT', `/admin/posts/${postId}/status`, { token: adminToken, body: { isTop: true } });
  const listTop = await call('GET', '/posts?limit=5');
  ok(String(listTop.data.list[0].id) === String(postId), '置顶帖排最前');

  // 25. 个人主页
  const profile = await call('GET', `/users/${userId}`, { token: userToken });
  ok(profile.success === true && profile.data.isSelf === true && profile.data.user.spiritStones !== undefined, '个人主页（本人含灵石）');
  const profileGuest = await call('GET', `/users/${userId}`);
  ok(profileGuest.success === true && profileGuest.data.user.spiritStones === undefined, '游客看不到灵石');

  // 26. 编辑资料 + 改密码
  const upd = await call('PUT', '/users/me', { token: userToken, body: { bio: '大道三千，取其一。' } });
  ok(upd.success === true && upd.data.user.bio === '大道三千，取其一。', '编辑签名');
  const pw = await call('PUT', '/users/me/password', { token: userToken, body: { oldPassword: 'user123', newPassword: 'newpass123' } });
  ok(pw.success === true, '修改密码');
  const reLogin = await call('POST', '/auth/login', { body: { account: userName, password: 'newpass123' } });
  ok(reLogin.success === true, '新密码可登录');

  // 27. 删评论/删帖
  const delC = await call('DELETE', `/comments/${c2Id}`, { token: userToken });
  ok(delC.success === true, '删除自己的评论');
  const delPost = await call('DELETE', `/posts/${postId}`, { token: userToken });
  ok(delPost.success === true, '删除帖子');
  const gone = await call('GET', `/posts/${postId}`);
  ok(gone.status === 404, '删除后 404');
  const meAfter = (await call('GET', '/auth/me', { token: userToken })).data.user;
  ok(meAfter.postCount === 0, '删帖后发帖数归还');

  // 28. 管理统计
  const stats = await call('GET', '/admin/stats', { token: adminToken });
  ok(stats.success === true && stats.data.userCount >= 2, '管理统计');

  console.log(`\n===== SMOKE RESULT: ${passed} passed, ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('SMOKE_ERROR', e);
  process.exit(1);
});
