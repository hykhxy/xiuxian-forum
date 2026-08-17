// 个人主页：资料 + 境界进度 + 签到日历 + 帖子/收藏/功法 Tab + 编辑资料/密码
(function () {
  renderNav('');
  const userId = qs('id') || Auth.userId();
  const headEl = document.getElementById('profile-head');
  const checkinCard = document.getElementById('checkin-card');
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('tab-content');

  if (!userId) { emptyState(headEl, '未指定用户'); return; }

  // 境界进度数据（与后端 utils/realm.js 一致）
  const REALM_EXP = [0, 10, 25, 50, 90, 150, 240, 360, 520, 800, 1300, 2200, 3800, 6500, 11000, 18000, 30000, 50000];

  let profileUser = null;
  let isSelf = false;
  let activeTab = 'posts';

  // ---------- 头部 ----------
  function renderHead(d) {
    profileUser = d.user;
    isSelf = d.isSelf;
    headEl.innerHTML = '';

    const head = el('div', 'profile-head');
    head.appendChild(avatarHtml(profileUser, ''));

    const info = el('div', 'profile-info');
    const nameRow = el('div', 'profile-name');
    nameRow.appendChild(el('span', null, profileUser.username));
    nameRow.appendChild(realmBadge(profileUser.realmLevel, profileUser.realmName));
    const profBadge = profileUser.profession ? professionBadge(profileUser.profession.key || profileUser.profession) : null;
    if (profBadge) nameRow.appendChild(profBadge);
    if (profileUser.role === 'admin') nameRow.appendChild(el('span', 'badge realm-4', '执事'));
    info.appendChild(nameRow);

    if (profileUser.profession && profileUser.profession.desc) {
      info.appendChild(el('div', 'profile-bio', '【' + profileUser.profession.name + '】' + profileUser.profession.desc));
    }

    const bio = el('div', 'profile-bio', profileUser.bio || '（此人道心深邃，未留一言）');
    info.appendChild(bio);

    // 境界进度
    const level = profileUser.realmLevel || 1;
    const curExp = profileUser.exp || 0;
    const pw = el('div', 'progress-wrap');
    if (level >= 18) {
      const pt = el('div', 'progress-text');
      pt.appendChild(el('span', null, '修为 ' + curExp));
      pt.appendChild(el('span', null, '已臻化境'));
      const bar = el('div', 'progress-bar');
      const inner = el('div', 'progress-inner');
      inner.style.width = '100%';
      bar.appendChild(inner);
      pw.appendChild(bar);
      pw.appendChild(pt);
    } else {
      const base = REALM_EXP[level - 1];
      const next = REALM_EXP[level];
      const pct = Math.min(Math.round(((curExp - base) / (next - base)) * 100), 100);
      const bar = el('div', 'progress-bar');
      const inner = el('div', 'progress-inner');
      inner.style.width = pct + '%';
      bar.appendChild(inner);
      pw.appendChild(bar);
      const pt = el('div', 'progress-text');
      pt.appendChild(el('span', null, '修为 ' + curExp + ' / ' + next));
      pt.appendChild(el('span', null, REALM_NAMES[level] + ' → ' + REALM_NAMES[level] + '（' + pct + '%）'));
      pt.childNodes[1].textContent = '距 ' + REALM_NAMES[level] + ' 尚差 ' + (next - curExp) + ' 修为';
      pw.appendChild(pt);
    }
    info.appendChild(pw);

    // 统计
    const stats = el('div', 'stats-row');
    function statBox(num, label) {
      const b = el('div', 'stat-box');
      b.appendChild(el('div', 'stat-num', String(num)));
      b.appendChild(el('div', 'stat-label', label));
      return b;
    }
    stats.appendChild(statBox(profileUser.postCount, '帖子'));
    stats.appendChild(statBox(profileUser.commentCount, '评论'));
    stats.appendChild(statBox(curExp, '修为'));
    if (isSelf) stats.appendChild(statBox('◇ ' + profileUser.spiritStones, '灵石'));
    info.appendChild(stats);

    if (isSelf) {
      const btnRow = el('div', null);
      btnRow.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap';
      const edit = el('button', 'btn btn-sm', '编辑资料');
      edit.onclick = openEditModal;
      const pwBtn = el('button', 'btn btn-sm', '修改密码');
      pwBtn.onclick = openPasswordModal;
      btnRow.appendChild(edit);
      btnRow.appendChild(pwBtn);
      info.appendChild(btnRow);
    }

    head.appendChild(info);
    headEl.appendChild(head);

    if (isSelf) {
      checkinCard.style.display = '';
      loadCheckin();
    }
    renderTabs();
    loadTab();
  }

  // ---------- 签到 ----------
  let checkedDates = [];

  async function loadCheckin() {
    const r = await api.get('/users/me/checkin');
    if (!r.ok) return;
    const btn = document.getElementById('checkin-btn');
    const tip = document.getElementById('checkin-tip');
    const streak = document.getElementById('streak-tip');
    checkedDates = r.data.monthDates || [];

    if (r.data.todayCheckedIn) {
      btn.disabled = true;
      btn.textContent = '今日已签';
    } else {
      btn.onclick = doCheckin;
    }
    streak.textContent = '已连签 ' + r.data.consecutiveDays + ' 天';
    renderCalendar();
  }

  async function doCheckin() {
    const btn = document.getElementById('checkin-btn');
    btn.disabled = true;
    const r = await api.post('/users/me/checkin');
    if (!r.ok) { btn.disabled = false; return toast(r.message, 'error'); }
    Auth.updateUser(r.data.user);
    const bonus = r.data.hitStreak ? '（连签 ' + r.data.consecutiveDays + ' 天，额外奖励！）' : '';
    toast('签到成功：修为 +' + r.data.expGained + '、灵石 +' + r.data.stonesGained + bonus, 'exp');
    loadCheckin();
    load(); // 刷新头部修为
  }

  function renderCalendar() {
    const cal = document.getElementById('calendar');
    cal.innerHTML = '';
    // 标题行（周一起）
    ['一', '二', '三', '四', '五', '六', '日'].forEach((d) => {
      const c = el('div', 'calendar-week', d);
      cal.appendChild(c);
    });
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startWeekday = firstDay.getDay() - 1; // 周一=0
    if (startWeekday < 0) startWeekday = 6;

    const pad = (n) => String(n).padStart(2, '0');
    const monthKey = year + '-' + pad(month + 1);
    const todayKey = monthKey + '-' + pad(today);

    for (let i = 0; i < startWeekday; i++) cal.appendChild(el('div', 'calendar-cell muted', ''));
    for (let day = 1; day <= daysInMonth; day++) {
      const key = monthKey + '-' + pad(day);
      const cls = ['calendar-cell'];
      if (checkedDates.includes(key)) cls.push('checked');
      if (key === todayKey) cls.push('today');
      const c = el('div', cls.join(' '), checkedDates.includes(key) ? '✓' : String(day));
      cal.appendChild(c);
    }
  }

  // ---------- Tab ----------
  function renderTabs() {
    tabsEl.innerHTML = '';
    const tabs = [['posts', '帖子']];
    if (isSelf) tabs.push(['favorites', '收藏'], ['techniques', '修炼功法']);
    tabs.forEach(([key, label]) => {
      const t = el('div', 'tab' + (activeTab === key ? ' active' : ''), label);
      t.onclick = () => { activeTab = key; renderTabs(); loadTab(); };
      tabsEl.appendChild(t);
    });
  }

  async function loadTab() {
    loadingState(contentEl, '……');
    if (activeTab === 'posts') {
      const r = await api.get(`/posts?author=${userId}&limit=20`);
      if (!r.ok) return emptyState(contentEl, r.message);
      const wrap = el('div', 'post-list');
      if (!r.data.list.length) wrap.appendChild(el('div', 'empty', '尚未发帖'));
      r.data.list.forEach((p) => wrap.appendChild(postRow(p)));
      contentEl.innerHTML = '';
      contentEl.appendChild(wrap);
    } else if (activeTab === 'favorites') {
      const r = await api.get('/users/me/favorites?limit=20');
      if (!r.ok) return emptyState(contentEl, r.message);
      const wrap = el('div', 'post-list');
      if (!r.data.list.length) wrap.appendChild(el('div', 'empty', '锦囊空空'));
      r.data.list.forEach((p) => wrap.appendChild(postRow(p)));
      contentEl.innerHTML = '';
      contentEl.appendChild(wrap);
    } else if (activeTab === 'techniques') {
      loadingState(contentEl, '……');
      const list = profileUser.practicingTechniques || [];
      const wrap = el('div', null);
      if (!list.length) wrap.appendChild(el('div', 'empty', '尚未修炼任何功法'));
      for (const pt of list) {
        const t = await api.get('/techniques/' + pt.technique);
        if (!t.ok) continue;
        const row = el('div', null);
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--bg-soft)';
        const link = el('a', null, t.data.technique.name);
        link.href = 'technique-detail.html?id=' + pt.technique;
        link.style.cssText = 'font-weight:600;flex:1';
        row.appendChild(gradeBadge(t.data.technique.grade));
        row.appendChild(link);
        row.appendChild(el('span', 'form-hint', '修为 +' + Math.round((pt.expBonusRate - 1) * 100) + '% · 修炼于 ' + fmtDateTime(pt.startedAt)));
        wrap.appendChild(row);
      }
      contentEl.innerHTML = '';
      contentEl.appendChild(wrap);
    }
  }

  function postRow(p) {
    const a = el('a', 'post-item');
    a.href = 'post-detail.html?id=' + p.id;
    const top = el('div', 'post-item-top');
    top.appendChild(categoryBadge(p.category));
    if (p.isEssence) top.appendChild(el('span', 'mark mark-essence', '精华'));
    a.appendChild(top);
    a.appendChild(el('div', 'post-title', p.title));
    const meta = el('div', 'post-meta');
    meta.appendChild(el('span', null, timeAgo(p.createdAt)));
    const stats = el('span', 'post-stats');
    stats.appendChild(el('span', null, '♡ ' + p.likeCount));
    stats.appendChild(el('span', null, '✎ ' + p.commentCount));
    meta.appendChild(stats);
    a.appendChild(meta);
    return a;
  }

  // ---------- 弹窗 ----------
  function modal(title, inner) {
    const mask = el('div', 'modal-mask');
    const box = el('div', 'modal');
    box.appendChild(el('div', 'modal-title', title));
    box.appendChild(inner);
    mask.appendChild(box);
    mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
    document.body.appendChild(mask);
    return mask;
  }

  function openEditModal() {
    const form = el('form');
    const avatarItem = el('div', 'form-item');
    avatarItem.appendChild(el('label', null, '头像链接（选填）'));
    const avatarInput = el('input');
    avatarInput.type = 'url';
    avatarInput.value = profileUser.avatar || '';
    avatarInput.placeholder = 'https://…（留空使用首字头像）';
    avatarItem.appendChild(avatarInput);
    const bioItem = el('div', 'form-item');
    bioItem.appendChild(el('label', null, '签名'));
    const bioInput = el('textarea');
    bioInput.maxLength = 200;
    bioInput.value = profileUser.bio || '';
    bioItem.appendChild(bioInput);
    const actions = el('div', 'modal-actions');
    const save = el('button', 'btn btn-primary', '保存');
    save.type = 'submit';
    actions.appendChild(save);
    form.appendChild(avatarItem);
    form.appendChild(bioItem);
    form.appendChild(actions);

    form.onsubmit = async (e) => {
      e.preventDefault();
      const r = await api.put('/users/me', { avatar: avatarInput.value.trim(), bio: bioInput.value.trim() });
      if (!r.ok) return toast(r.message, 'error');
      Auth.updateUser(r.data.user);
      toast('已保存', 'success');
      mask.remove();
      load();
    };
    const mask = modal('编辑资料', form);
  }

  function openPasswordModal() {
    const form = el('form');
    function field(label, type) {
      const item = el('div', 'form-item');
      item.appendChild(el('label', null, label));
      const input = el('input');
      input.type = type;
      input.required = true;
      item.appendChild(input);
      form.appendChild(item);
      return input;
    }
    const oldInput = field('旧密码', 'password');
    const newInput = field('新密码（≥6 位）', 'password');
    const againInput = field('确认新密码', 'password');
    const actions = el('div', 'modal-actions');
    const save = el('button', 'btn btn-primary', '修改');
    save.type = 'submit';
    actions.appendChild(save);
    form.appendChild(actions);

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (newInput.value !== againInput.value) return toast('两次新密码不一致', 'error');
      const r = await api.put('/users/me/password', { oldPassword: oldInput.value, newPassword: newInput.value });
      if (!r.ok) return toast(r.message, 'error');
      toast('密码已修改', 'success');
      mask.remove();
    };
    const mask = modal('修改密码', form);
  }

  async function load() {
    loadingState(headEl, '……');
    const r = await api.get('/users/' + userId);
    if (!r.ok) return emptyState(headEl, r.message);
    renderHead(r.data);
  }

  load();
})();
