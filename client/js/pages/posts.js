// 论道台：古书目录式三栏（左板块目录 / 中帖子列表 / 右热帖雅集）
(function () {
  renderNav('posts');

  const catalogEl = document.getElementById('catalog-list');
  const listEl = document.getElementById('post-list');
  const pageEl = document.getElementById('pagination');
  const rankEl = document.getElementById('rank-list');
  const keywordEl = document.getElementById('keyword');
  const sortEl = document.getElementById('sort');
  const essenceEl = document.getElementById('essence');

  const state = {
    category: qs('category') || 'all',
    keyword: '',
    sort: 'new',
    essence: false,
    page: Math.max(parseInt(qs('page')) || 1, 1)
  };

  // ---- 左侧目录 ----
  const cats = [['all', '全部道帖']].concat(Object.entries(CATEGORIES));
  function renderCatalog() {
    catalogEl.innerHTML = '';
    cats.forEach(([key, label]) => {
      const item = el('div', 'catalog-item' + (state.category === key ? ' active' : ''));
      item.appendChild(el('span', null, label));
      item.onclick = () => {
        state.category = key;
        state.page = 1;
        renderCatalog();
        load();
      };
      catalogEl.appendChild(item);
    });
  }

  // ---- 右侧热帖 ----
  async function loadRank() {
    const r = await api.get('/posts?sort=hot&limit=8');
    if (!r.ok) return;
    rankEl.innerHTML = '';
    if (!r.data.list.length) return rankEl.appendChild(el('div', 'form-hint', '虚位以待'));
    r.data.list.forEach((p, i) => {
      const item = el('div', 'side-item');
      item.appendChild(el('span', 'rank', ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌'][i] || i + 1));
      const a = el('a', null, p.title);
      a.href = 'post-detail.html?id=' + p.id;
      a.title = p.title;
      item.appendChild(a);
      item.appendChild(el('span', 'num', '♡' + p.likeCount));
      rankEl.appendChild(item);
    });
  }

  // ---- 搜索/排序 ----
  let debounce;
  keywordEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.keyword = keywordEl.value.trim(); state.page = 1; load(); }, 400);
  });
  sortEl.addEventListener('change', () => { state.sort = sortEl.value; state.page = 1; load(); });
  essenceEl.addEventListener('change', () => { state.essence = essenceEl.checked; state.page = 1; load(); });

  function renderPost(p) {
    const a = el('a', 'post-item');
    a.href = 'post-detail.html?id=' + p.id;

    const top = el('div', 'post-item-top');
    top.appendChild(categoryBadge(p.category));
    if (p.isTop) top.appendChild(el('span', 'mark mark-top', '置顶'));
    if (p.isEssence) top.appendChild(el('span', 'mark mark-essence', '精华'));

    const title = el('div', 'post-title', p.title);
    const excerpt = el('div', 'post-excerpt', p.excerpt);

    const meta = el('div', 'post-meta');
    const chip = el('span', 'author-chip');
    if (p.author) {
      chip.appendChild(avatarHtml(p.author));
      chip.appendChild(el('span', null, p.author.username));
      chip.appendChild(realmBadge(p.author.realm, p.author.realmName));
      meta.appendChild(chip);
    }
    meta.appendChild(el('span', null, timeAgo(p.createdAt)));

    if (p.tags && p.tags.length) {
      const tags = el('span', null);
      p.tags.slice(0, 3).forEach((t) => tags.appendChild(el('span', 'tag', '#' + t)));
      meta.appendChild(tags);
    }

    const stats = el('span', 'post-stats');
    stats.appendChild(el('span', null, '♡ ' + p.likeCount));
    stats.appendChild(el('span', null, '✎ ' + p.commentCount));
    stats.appendChild(el('span', null, '观 ' + p.viewCount));
    meta.appendChild(stats);

    a.appendChild(top);
    a.appendChild(title);
    if (p.excerpt) a.appendChild(excerpt);
    a.appendChild(meta);
    return a;
  }

  async function load() {
    loadingState(listEl, '灵气凝聚中……');
    const params = new URLSearchParams();
    if (state.category !== 'all') params.set('category', state.category);
    if (state.keyword) params.set('keyword', state.keyword);
    if (state.sort) params.set('sort', state.sort);
    if (state.essence) params.set('isEssence', 'true');
    params.set('page', state.page);
    params.set('limit', '15');

    const res = await api.get('/posts?' + params.toString());
    if (!res.ok) return emptyState(listEl, res.message);

    listEl.innerHTML = '';
    if (!res.data.list.length) return emptyState(listEl, '此地空无一帖，静候高论');
    res.data.list.forEach((p) => listEl.appendChild(renderPost(p)));
    renderPagination(pageEl, res.data.page, res.data.totalPages, (p) => { state.page = p; load(); window.scrollTo(0, 0); });
  }

  if (state.keyword) keywordEl.value = state.keyword;
  renderCatalog();
  load();
  loadRank();
})();
