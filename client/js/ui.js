// 公共 UI 组件：导航、徽章、toast、时间格式化、分页、头像（全部用 textContent 渲染，防 XSS）

const REALM_NAMES = [
  '练气一层', '练气二层', '练气三层', '练气四层', '练气五层', '练气六层', '练气七层', '练气八层', '练气九层',
  '筑基期', '金丹期', '元婴期', '化神期', '炼虚期', '合体期', '大乘期', '渡劫期', '仙人'
];
// 境界大阶段 → 徽章配色档位（0-4）
const REALM_TIERS = [
  { max: 9, cls: 'realm-0' },   // 练气
  { max: 12, cls: 'realm-1' },  // 筑基/金丹/元婴
  { max: 14, cls: 'realm-2' },  // 化神/炼虚
  { max: 17, cls: 'realm-3' },  // 合体/大乘/渡劫
  { max: 18, cls: 'realm-4' }   // 仙人
];

const CATEGORIES = {
  ask: '问道',
  insight: '感悟',
  chat: '杂谈',
  technique: '功法',
  announce: '公告'
};

const GRADE_CLS = { '黄阶': 'grade-huang', '玄阶': 'grade-xuan', '地阶': 'grade-di', '天阶': 'grade-tian', '仙阶': 'grade-xian' };

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

// ---------- 导航栏 ----------
function renderNav(active) {
  const nav = document.getElementById('site-nav');
  if (!nav) return;
  nav.innerHTML = '';

  const brand = el('a', 'nav-brand', '灵墟论道');
  brand.href = 'index.html';

  const menu = el('nav', 'nav-menu');
  const links = [
    { key: 'index', href: 'index.html', label: '论坛' },
    { key: 'techniques', href: 'techniques.html', label: '功法图鉴' },
    { key: 'post-edit', href: 'post-edit.html', label: '发帖' }
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
function realmBadge(realmLevel, realmName) {
  const name = realmName || REALM_NAMES[Math.min(Math.max((realmLevel || 1) - 1, 0), 17)];
  const tier = REALM_TIERS.find((t) => (realmLevel || 1) <= t.max) || REALM_TIERS[4];
  return el('span', 'badge ' + tier.cls, name);
}

function gradeBadge(grade) {
  return el('span', 'badge ' + (GRADE_CLS[grade] || 'grade-huang'), grade);
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

// ---------- 退出提示（后端休眠唤醒慢时的首次请求） ----------
function loadingState(container, text) {
  container.innerHTML = '';
  container.appendChild(el('div', 'empty loading', text || '灵力凝聚中……'));
}
