// 功法图鉴列表
(function () {
  renderNav('techniques');

  const GRADES = ['黄阶', '玄阶', '地阶', '天阶', '仙阶'];
  const TYPES = ['心法', '剑法', '刀法', '身法', '丹道', '器道', '阵法', '杂学'];
  const ELEMENTS = ['金', '木', '水', '火', '土', '雷', '冰', '风', '无'];

  const gradeSel = document.getElementById('grade');
  const typeSel = document.getElementById('type');
  const elementSel = document.getElementById('element');
  const keywordEl = document.getElementById('keyword');
  const sortSel = document.getElementById('sort');
  const listEl = document.getElementById('tech-list');
  const pageEl = document.getElementById('pagination');

  GRADES.forEach((g) => { const o = el('option', null, g); o.value = g; gradeSel.appendChild(o); });
  TYPES.forEach((t) => { const o = el('option', null, t); o.value = t; typeSel.appendChild(o); });
  ELEMENTS.forEach((e) => { const o = el('option', null, e); o.value = e; elementSel.appendChild(o); });

  const state = { page: 1, grade: '', type: '', element: '', keyword: '', sort: 'new' };

  function bind(sel, key) {
    sel.addEventListener('change', () => { state[key] = sel.value; state.page = 1; load(); });
  }
  bind(gradeSel, 'grade'); bind(typeSel, 'type'); bind(elementSel, 'element'); bind(sortSel, 'sort');
  let debounce;
  keywordEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.keyword = keywordEl.value.trim(); state.page = 1; load(); }, 400);
  });

  function renderCard(t) {
    const card = el('div', 'tech-card');
    card.onclick = () => location.href = 'technique-detail.html?id=' + t.id;

    const info = el('div', 'tech-card-info');
    info.appendChild(gradeBadge(t.grade));
    info.appendChild(el('span', 'tag', t.type));
    info.appendChild(el('span', 'tag', t.element + '属性'));

    const name = el('div', 'tech-card-name', t.name);
    const desc = el('div', 'tech-card-desc', t.description);

    const foot = el('div', 'tech-card-foot');
    foot.appendChild(el('span', 'stone', '◇ ' + t.price));
    const right = el('span', null);
    right.appendChild(document.createTextNode('+' + Math.round((t.expBonusRate - 1) * 100) + '% 修为 · ' + t.practitionerCount + ' 人修炼'));
    foot.appendChild(right);

    card.appendChild(info);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(foot);
    return card;
  }

  async function load() {
    loadingState(listEl, '灵力凝聚中……');
    const params = new URLSearchParams();
    if (state.grade) params.set('grade', state.grade);
    if (state.type) params.set('type', state.type);
    if (state.element) params.set('element', state.element);
    if (state.keyword) params.set('keyword', state.keyword);
    if (state.sort) params.set('sort', state.sort);
    params.set('page', state.page);
    params.set('limit', '16');

    const res = await api.get('/techniques?' + params.toString());
    if (!res.ok) return emptyState(listEl, res.message);

    listEl.innerHTML = '';
    if (!res.data.list.length) return emptyState(listEl, '图鉴空空，欢迎投稿');
    res.data.list.forEach((t) => listEl.appendChild(renderCard(t)));
    renderPagination(pageEl, res.data.page, res.data.totalPages, (p) => { state.page = p; load(); window.scrollTo(0, 0); });
  }

  load();
})();
