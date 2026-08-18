// 首页：帖子列表（板块/搜索/排序/精华/分页）
(function () {
  renderNav('index');

  const listEl = document.getElementById('post-list');
  const pageEl = document.getElementById('pagination');
  const tabsEl = document.getElementById('category-tabs');
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

  // 板块 tab
  const cats = [['all', '全部']].concat(Object.entries(CATEGORIES));
  function renderTabs() {
    tabsEl.innerHTML = '';
    cats.forEach(([key, label]) => {
      const b = el('button', 'filter-tab' + (state.category === key ? ' active' : ''), label);
      b.onclick = () => {
        state.category = key;
        state.page = 1;
        renderTabs();
        load();
      };
      tabsEl.appendChild(b);
    });
  }

  // 防抖搜索
  let debounce;
  keywordEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.keyword = keywordEl.value.trim();
      state.page = 1;
      load();
    }, 400);
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
    stats.appendChild(el('span', null, '👁 ' + p.viewCount));
    meta.appendChild(stats);

    a.appendChild(top);
    a.appendChild(title);
    if (p.excerpt) a.appendChild(excerpt);
    a.appendChild(meta);
    return a;
  }

  async function load() {
    loadingState(listEl, '灵力凝聚中……');
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
    if (!res.data.list.length) return emptyState(listEl, '此地空无一帖，静候道友高论');
    res.data.list.forEach((p) => listEl.appendChild(renderPost(p)));
    renderPagination(pageEl, res.data.page, res.data.totalPages, (p) => { state.page = p; load(); window.scrollTo(0, 0); });
  }

  renderTabs();
  if (state.keyword) keywordEl.value = state.keyword;
  load();
})();
