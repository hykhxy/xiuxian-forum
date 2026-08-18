// 公共 UI 组件：导航、徽章、toast、时间格式化、分页、头像（全部用 textContent 渲染，防 XSS）

const REALM_NAMES = ['练气', '筑基', '金丹', '元婴', '化神', '合体', '大乘', '渡劫'];
// 境界 → 徽章配色档位（0-4）
const REALM_TIERS = [
  { max: 1, cls: 'realm-0' },   // 练气
  { max: 2, cls: 'realm-1' },   // 筑基
  { max: 3, cls: 'realm-2' },   // 金丹
  { max: 4, cls: 'realm-3' },   // 元婴
  { max: 8, cls: 'realm-4' }    // 化神~渡劫
];

const CATEGORIES = {
  ask: '问道',
  insight: '感悟',
  chat: '杂谈',
  technique: '功法',
  announce: '公告'
};

const GRADE_CLS = { '黄阶': 'grade-huang', '玄阶': 'grade-xuan', '地阶': 'grade-di', '天阶': 'grade-tian', '仙阶': 'grade-xian' };

// 职业徽章（与后端 utils/profession.js 对应）
const PROFESSIONS = {
  sword: { name: '剑修', cls: 'prof-sword' },
  mage: { name: '法修', cls: 'prof-mage' },
  ghost: { name: '鬼修', cls: 'prof-ghost' },
  blood: { name: '血修', cls: 'prof-blood' },
  monster: { name: '妖修', cls: 'prof-monster' },
  demon: { name: '魔修', cls: 'prof-demon' },
  body: { name: '体修', cls: 'prof-body' }
};

const AVATAR_COLORS = ['#7a6cc4', '#4e9e8a', '#c07a4a', '#b5533c', '#5a8ab4', '#a4783a', '#6a9c58', '#9c5890'];

// ---------- 基础 DOM ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

// ---------- 全站背景层（第13轮：红黑水墨静态图） ----------
// .ink-scene 由 CSS 承载 assets/img/bg.webp（cover/fixed + 提亮滤镜，z-index:-2），
// 之上是 body::before 深红遮罩 rgba(10,5,5,0.45)（z-index:-1）；此处仅注入空壳元素。
function initInkScene() {
  if (document.querySelector('.ink-scene')) return;
  const scene = el('div', 'ink-scene');
  scene.setAttribute('aria-hidden', 'true');
  document.body.appendChild(scene);
}

// 保留 API 兼容旧调用（dengxian/tingqu 等页面仍在调用）；萤火层已随旧背景移除
function sprinkleFireflies() { /* no-op */ }

// ---------- 导航栏 ----------
function renderNav(active) {
  initInkScene();
  const nav = document.getElementById('site-nav');
  if (!nav) return;
  nav.innerHTML = '';

  const brand = el('a', 'nav-brand');
  brand.href = 'index.html';
  brand.appendChild(el('span', 'seal', '灵'));
  brand.appendChild(document.createTextNode('灵墟论道'));

  const menu = el('nav', 'nav-menu');
  const links = [
    { key: 'index', href: 'index.html', label: '山门' },
    { key: 'posts', href: 'posts.html', label: '论道台' },
    { key: 'techniques', href: 'techniques.html', label: '藏经阁' },
    { key: 'post-edit', href: 'post-edit.html', label: '执笔' },
    { key: 'dengxian', href: 'dengxian.html', label: '登仙' },
    { key: 'tingqu', href: 'tingqu.html', label: '听曲' },
    { key: 'sect', href: 'sect.html', label: '宗门' },
    { key: 'battlefield', href: 'battlefield.html', label: '战场' }
  ];
  links.forEach((l) => {
    const a = el('a', 'nav-link' + (active === l.key ? ' active' : ''), l.label);
    a.href = l.href;
    menu.appendChild(a);
  });
  // 「真我」RPG 人物卡（模态框，全站可用）
  const zhenwo = el('a', 'nav-link nav-btn-zhenwo', '真我');
  zhenwo.href = 'javascript:void(0)';
  zhenwo.onclick = () => openTrueSelf();
  menu.appendChild(zhenwo);

  const right = el('div', 'nav-right');
  const user = Auth.user();
  if (user && Auth.isLoggedIn()) {
    const profile = el('a', 'nav-user', null);
    profile.href = 'profile.html?id=' + (user.id || user._id);
    profile.appendChild(avatarHtml(user, 'nav-avatar'));
    profile.appendChild(el('span', 'nav-username', user.username));
    right.appendChild(profile);

    if (user.role === 'admin') {
      const admin = el('a', 'nav-link', '洞府管理');
      admin.href = 'admin.html';
      right.appendChild(admin);
    }
    const logout = el('a', 'nav-link', '退出');
    logout.href = 'javascript:void(0)';
    logout.onclick = () => Auth.logout();
    right.appendChild(logout);
  } else {
    const login = el('a', 'nav-link nav-btn', '登录 / 注册');
    login.href = 'login.html';
    right.appendChild(login);
  }

  nav.appendChild(brand);
  nav.appendChild(menu);
  nav.appendChild(right);
  sprinkleFireflies();
}

// ---------- 头像（无图时用道号首字的彩色圆） ----------
function avatarHtml(user, cls) {
  if (user && user.avatar) {
    const img = el('img', 'avatar ' + (cls || ''));
    img.src = user.avatar;
    img.alt = user.username || '';
    img.onerror = function () { this.style.display = 'none'; };
    return img;
  }
  const name = (user && user.username) || '客';
  const div = el('div', 'avatar avatar-fallback ' + (cls || ''), name.trim().charAt(0).toUpperCase());
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  div.style.background = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return div;
}

// ---------- 徽章 ----------
function realmBadge(realm, realmName) {
  const lv = Math.min(Math.max(realm || 1, 1), 8);
  const name = realmName || REALM_NAMES[lv - 1];
  const tier = REALM_TIERS.find((t) => lv <= t.max) || REALM_TIERS[4];
  return el('span', 'badge ' + tier.cls, name);
}

function gradeBadge(grade) {
  return el('span', 'badge ' + (GRADE_CLS[grade] || 'grade-huang'), grade);
}

function professionBadge(key) {
  const p = PROFESSIONS[key];
  if (!p) return null;
  return el('span', 'badge ' + p.cls, p.name);
}

function categoryBadge(category) {
  return el('span', 'badge cat-' + category, CATEGORIES[category] || category);
}

// ---------- 时间 ----------
function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前';
  return d.toLocaleDateString('zh-CN');
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

// ---------- Toast ----------
function toast(message, type) {
  let box = document.querySelector('.toast-box');
  if (!box) {
    box = el('div', 'toast-box');
    document.body.appendChild(box);
  }
  const t = el('div', 'toast ' + (type || 'info'), message);
  box.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

// ---------- 分页 ----------
function renderPagination(container, page, totalPages, onPage) {
  container.innerHTML = '';
  if (totalPages <= 1) return;
  const add = (label, target, disabled, current) => {
    const b = el('button', 'page-btn' + (current ? ' current' : ''), label);
    b.disabled = !!disabled;
    if (!disabled && !current) b.onclick = () => onPage(target);
    container.appendChild(b);
  };
  add('上一页', page - 1, page <= 1, false);
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);
  for (let i = windowStart; i <= windowEnd; i++) add(String(i), i, false, i === page);
  add('下一页', page + 1, page >= totalPages, false);
}

// ---------- 空状态 ----------
function emptyState(container, text) {
  container.innerHTML = '';
  const d = el('div', 'empty', text || '空空如也，一无所有');
  container.appendChild(d);
}

// ---------- 加载提示 ----------
function loadingState(container, text) {
  container.innerHTML = '';
  container.appendChild(el('div', 'empty loading', text || '灵气凝聚中……'));
}

// ---------- 富文本渲染（防 XSS）：普通文本 textContent；音乐平台歌曲链接 → 播放卡片 ----------
var MUSIC_LINK_RE = /(https?:\/\/(?:music\.163\.com\/song\?.*?id=(\d+)|y\.qq\.com\/\S*?songDetail\/(\w+)|www\.kugou\.com\/\S*?hash=(\w+)|kuwo\.cn\/play_detail\/(\d+))\S*)/i;

function renderRichText(container, text) {
  container.innerHTML = '';
  var rest = String(text || '');
  var m;
  while ((m = rest.match(MUSIC_LINK_RE))) {
    if (m.index > 0) container.appendChild(document.createTextNode(rest.slice(0, m.index)));
    var source = m[2] ? 'netease' : (m[3] ? 'qq' : (m[4] ? 'kugou' : 'kuwo'));
    var songId = m[2] || m[3] || m[4] || m[5];
    var card = el('button', 'btn btn-sm btn-jade dx-song-card', '▶ ' + (source === 'netease' ? '网易云' : source === 'qq' ? 'QQ音乐' : source === 'kugou' ? '酷狗' : '酷我') + ' · 点击播放');
    card.type = 'button';
    card.dataset.source = source;
    card.dataset.songId = songId;
    card.onclick = function () {
      if (window.DXPlayer) window.DXPlayer.playSong(this.dataset.source, this.dataset.songId);
      else toast('仙音组件尚未就绪', 'error');
    };
    container.appendChild(card);
    container.appendChild(document.createElement('br'));
    rest = rest.slice(m.index + m[1].length);
  }
  if (rest) container.appendChild(document.createTextNode(rest));
}

// ---------- 「真我」RPG 人物卡（第18轮）：左打坐剪影 + 右两列属性，深色磨砂玻璃 ----------
function openTrueSelf() {
  document.querySelector('.zw-mask')?.remove();
  const mask = el('div', 'zw-mask');
  const card = el('div', 'zw-card');

  // ---- 第20轮：2D 角色立绘按性别切换（左区 45%）----
  // localStorage.gender 为准（兼容旧键 user_gender）；无数据默认男
  const ZW_CHAR = { male: 'assets/char-male.png', female: 'assets/char-female.png' };
  const genderBtn = el('button', 'zw-gender-toggle', '');
  const charArea = el('div', 'zw-char-area');
  const charImg = el('img', 'zw-char-img');
  const charGlow = el('div', 'zw-char-glow');

  function readGender() {
    const g = localStorage.getItem('gender') || localStorage.getItem('user_gender');
    return g === 'female' ? 'female' : 'male';   // 兜底默认男
  }
  function applyGender(g) {
    charImg.src = ZW_CHAR[g];
    charImg.alt = g === 'male' ? '白衣持剑男修' : '白衣回眸女修';
    charGlow.className = 'zw-char-glow ' + (g === 'male' ? 'glow-male' : 'glow-female');
    genderBtn.textContent = g === 'male' ? '♂' : '♀';
    genderBtn.title = g === 'male' ? '当前：乾造（点击切换坤造）' : '当前：坤造（点击切换乾造）';
  }
  let userGender = readGender();
  applyGender(userGender);
  genderBtn.onclick = () => {
    userGender = userGender === 'male' ? 'female' : 'male';
    localStorage.setItem('gender', userGender);          // 本轮规范键
    localStorage.setItem('user_gender', userGender);     // 兼容旧键
    applyGender(userGender);
    toast(userGender === 'male' ? '已切换：乾造（男）' : '已切换：坤造（女）', 'info');
  };
  charArea.appendChild(charGlow);
  charArea.appendChild(charImg);

  // 头部
  const head = el('div', 'zw-head');
  head.appendChild(el('div', 'zw-title', '真 我'));
  head.appendChild(genderBtn);
  const close = el('span', 'zw-close', '✕');
  close.onclick = () => mask.remove();
  head.appendChild(close);
  card.appendChild(head);

  const body = el('div', 'zw-body');
  body.appendChild(charArea);   // 左：角色区 45%

  // 右：属性区 55%（两列）
  const statsBox = el('div', 'zw-stats');
  statsBox.appendChild(el('div', 'zw-loading', '推演命格中……'));
  body.appendChild(statsBox);
  card.appendChild(body);
  mask.appendChild(card);
  mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
  document.body.appendChild(mask);

  // 未登录
  if (!Auth.isLoggedIn()) {
    statsBox.innerHTML = '';
    const tip = el('div', 'zw-login-tip');
    const a = el('a', null, '登 录');
    a.href = 'login.html?from=' + encodeURIComponent(location.href);
    tip.appendChild(document.createTextNode('尚未入道，'));
    tip.appendChild(a);
    tip.appendChild(document.createTextNode('方可观真我。'));
    statsBox.appendChild(tip);
    return;
  }

  // 数据：真实 stats + me；暴击率为展示值（后端暂无此字段）
  Promise.all([api.get('/users/me/stats'), api.get('/auth/me')]).then(([st, me]) => {
    statsBox.innerHTML = '';
    if (!st.ok || !me.ok) {
      statsBox.appendChild(el('div', 'zw-login-tip', '推演失败，请稍后再试'));
      return;
    }
    const u = me.data.user;
    const critRate = 5 + (u.profession === 'sword' ? 10 : u.profession === 'monster' ? 5 : 3); // Mock 展示值

    const colL = el('div', 'zw-col');
    const colR = el('div', 'zw-col');
    colL.appendChild(el('div', 'zw-name', u.username));
    colL.appendChild(zwKv('境 界', st.data.realm.name));
    colL.appendChild(zwKv('职 业', PROFESSIONS[u.profession] ? PROFESSIONS[u.profession].name : (u.profession || '散修')));
    colL.appendChild(zwKv('灵气值', String(st.data.total.qi)));
    colL.appendChild(zwKv('生命值', String(st.data.total.hp)));
    colR.appendChild(el('div', 'zw-sub', '· 战斗 ·'));
    colR.appendChild(zwKv('攻击力', String(st.data.total.atk)));
    colR.appendChild(zwKv('防御值', String(st.data.total.def)));
    colR.appendChild(zwKv('暴击率', critRate + '%'));
    colR.appendChild(zwKv('灵 石', '◇ ' + (u.spiritStones ?? 0)));

    statsBox.appendChild(colL);
    statsBox.appendChild(colR);

    // 已修炼功法徽标（最多3）
    const techs = (st.data.techniques || []).slice(0, 3);
    if (techs.length) {
      const techRow = el('div', 'zw-tech-row');
      techs.forEach((t) => {
        const b = gradeBadge(t.grade);
        b.appendChild(document.createTextNode(' ' + t.name));
        techRow.appendChild(b);
      });
      statsBox.appendChild(techRow);
    }
  });

  function zwKv(label, value) {
    const row = el('div', 'zw-kv');
    row.appendChild(el('span', 'zw-kv-label', label));
    row.appendChild(el('span', 'zw-kv-value', value));
    return row;
  }
}
