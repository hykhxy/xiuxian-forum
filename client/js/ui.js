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

// ---------- 水墨动态背景（元素一次性注入，动画全部由 CSS @keyframes 驱动） ----------
function initInkScene() {
  if (document.querySelector('.ink-scene')) return;
  const scene = el('div', 'ink-scene');
  scene.setAttribute('aria-hidden', 'true');
  scene.appendChild(el('div', 'ink-mountain'));
  scene.appendChild(el('div', 'ink-water'));
  scene.appendChild(el('div', 'ink-cloud ink-cloud-1'));
  scene.appendChild(el('div', 'ink-cloud ink-cloud-2'));
  scene.appendChild(el('div', 'ink-cloud ink-cloud-3'));
  scene.appendChild(el('div', 'ink-mist'));
  const flies = el('div', 'ink-fireflies');
  for (let i = 0; i < 8; i++) flies.appendChild(el('i'));
  scene.appendChild(flies);
  document.body.appendChild(scene);
}

// 给容器内所有 .card 注入两粒面板萤火（每轮渲染后调用）
function sprinkleFireflies(container) {
  (container || document).querySelectorAll('.card').forEach((card) => {
    if (!card.querySelector('.ff')) {
      card.appendChild(el('i', 'ff'));
      card.appendChild(el('i', 'ff'));
    }
  });
}

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
    { key: 'dengxian', href: 'dengxian.html', label: '登仙' }
  ];
  links.forEach((l) => {
    const a = el('a', 'nav-link' + (active === l.key ? ' active' : ''), l.label);
    a.href = l.href;
    menu.appendChild(a);
  });

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
