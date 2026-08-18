// 功法图鉴列表 + 抽卡
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

  // ---------- 抽卡卡片 ----------
  const DRAW_COST = 100;
  function renderDrawCard() {
    const card = document.getElementById('draw-card');
    card.innerHTML = '';

    const wrap = el('div', 'checkin-box');
    const left = el('div');
    const title = el('div', 'page-title', '天机阁 · 功法抽取');
    title.style.fontSize = '17px';
    left.appendChild(title);
    const sub = el('div', 'page-sub', '消耗 ◇100 灵石随机抽取一部功法：天阶 1% · 地阶 5% · 玄阶 20% · 黄阶 74%（重复自动分解为灵石）');
    left.appendChild(sub);
    wrap.appendChild(left);

    const me = Auth.user();
    if (!me) {
      const login = el('a', 'btn btn-primary', '登录后抽取');
      login.href = 'login.html?from=' + encodeURIComponent(location.href);
      wrap.appendChild(login);
    } else {
      const stones = el('span', 'page-sub', '灵石 ◇' + (me.spiritStones || 0));
      stones.style.marginLeft = 'auto';
      wrap.appendChild(stones);
      const btn = el('button', 'btn btn-jade', '✦ 抽取功法（◇100）');
      btn.onclick = () => doDraw(btn);
      wrap.appendChild(btn);
    }
    card.appendChild(wrap);
  }

  function doDraw(btn) {
    const me = Auth.user();
    if ((me.spiritStones || 0) < DRAW_COST) return toast('灵石不足 ◇' + DRAW_COST + '（当前 ◇' + (me.spiritStones || 0) + '），签到与发帖可得灵石', 'error');
    btn.disabled = true;
    btn.textContent = '推演天机中……';
    api.post('/techniques/draw').then((r) => {
      btn.disabled = false;
      btn.textContent = '✦ 抽取功法（◇100）';
      if (!r.ok) return toast(r.message, 'error');
      Auth.updateUser(r.data.spiritStones !== undefined
        ? Object.assign({}, me, { spiritStones: r.data.spiritStones })
        : me);
      renderDrawCard();
      showDrawResult(r.data);
    });
  }

  function showDrawResult(d) {
    const mask = el('div', 'modal-mask');
    const box = el('div', 'modal draw-result');
    box.style.textAlign = 'center';

    const grade = el('div', null, d.technique.grade + '功法');
    grade.className = 'badge ' + (GRADE_CLS[d.technique.grade] || 'grade-huang');
    grade.style.fontSize = '14px';
    box.appendChild(grade);

    const name = el('div', null, '《' + d.technique.name + '》');
    name.style.cssText = 'font-size:24px;font-weight:700;color:var(--accent);margin:12px 0 4px';
    box.appendChild(name);

    const effect = el('div', 'form-hint', d.technique.type + ' · ' + d.technique.element + '属性 · 灵气获取 +' + Math.round((d.technique.expBonusRate - 1) * 100) + '%');
    box.appendChild(effect);

    let tip;
    if (d.duplicated) {
      tip = el('div', null, '已有此法，天机化石 → 分解返还 ◇' + d.refund);
      tip.style.color = 'var(--danger)';
    } else {
      tip = el('div', null, '已收入背包，可前往「个人主页 → 功法背包」装备');
      tip.style.color = 'var(--jade)';
    }
    tip.style.margin = '14px 0';
    box.appendChild(tip);

    const actions = el('div', null);
    actions.style.cssText = 'display:flex;gap:10px;justify-content:center';
    if (!d.duplicated) {
      const goEquip = el('a', 'btn btn-primary btn-sm', '去装备');
      goEquip.href = 'profile.html?id=' + Auth.userId() + '#backpack';
      actions.appendChild(goEquip);
    }
    const again = el('button', 'btn btn-sm', '再抽一次');
    again.onclick = () => { mask.remove(); doDrawAgain(); };
    actions.appendChild(again);
    const close = el('button', 'btn btn-sm', '关闭');
    close.onclick = () => mask.remove();
    actions.appendChild(close);
    box.appendChild(actions);

    mask.appendChild(box);
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    document.body.appendChild(mask);
    toast(d.duplicated ? '重复功法已分解 ◇' + d.refund : '喜得《' + d.technique.name + '》！', d.duplicated ? 'error' : 'exp');
  }

  function doDrawAgain() {
    const btn = document.querySelector('.draw-card .btn-jade');
    if (btn) doDraw(btn);
  }

  renderDrawCard();

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
    if (t.maxLevel) info.appendChild(el('span', 'tag', t.maxLevel + ' 层'));

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
