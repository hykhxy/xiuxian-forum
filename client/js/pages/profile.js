// 个人主页：资料 + 签到日历 + 帖子/收藏/功法 Tab + 编辑资料/密码
// （第7轮：闭关修行模块已迁往「登仙」页 dengxian.html）
(function () {
  renderNav('');
  const userId = qs('id') || Auth.userId();
  const headEl = document.getElementById('profile-head');
  const checkinCard = document.getElementById('checkin-card');
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('tab-content');

  if (!userId) { emptyState(headEl, '未指定用户'); return; }

  let profileUser = null;
  let isSelf = false;
  let activeTab = 'posts';

  // ---------- 头部 ----------
  function renderHead(d) {
    profileUser = d.user;
    isSelf = d.isSelf;
    headEl.innerHTML = '';

    const head = el('div', 'profile-head');
    if (isSelf) {
      // 圆形头像 + hover 浮层（上传 / AI 生成）
      const wrap = el('div', 'avatar-wrap');
      wrap.id = 'avatar-wrap';
      wrap.appendChild(avatarHtml(profileUser, 'avatar-main'));
      const overlay = el('div', 'avatar-overlay');
      const upBtn = el('button', 'avatar-act', '上 传');
      upBtn.onclick = (e) => { e.stopPropagation(); fileInput.click(); };
      const aiBtn = el('button', 'avatar-act', 'AI 生成');
      aiBtn.onclick = (e) => { e.stopPropagation(); openAiModal(); };
      overlay.appendChild(upBtn);
      overlay.appendChild(el('div', 'avatar-act-divider'));
      overlay.appendChild(aiBtn);
      wrap.appendChild(overlay);
      head.appendChild(wrap);
    } else {
      head.appendChild(avatarHtml(profileUser, ''));
    }

    const info = el('div', 'profile-info');
    const nameRow = el('div', 'profile-name');
    nameRow.appendChild(el('span', null, profileUser.username));
    nameRow.appendChild(realmBadge(profileUser.realm, profileUser.realmName));
    const profBadge = profileUser.profession ? professionBadge(profileUser.profession.key || profileUser.profession) : null;
    if (profBadge) nameRow.appendChild(profBadge);
    if (profileUser.role === 'admin') nameRow.appendChild(el('span', 'badge realm-4', '执事'));
    info.appendChild(nameRow);

    if (profileUser.profession && profileUser.profession.desc) {
      info.appendChild(el('div', 'profile-bio', '【' + profileUser.profession.name + '】' + profileUser.profession.desc));
    }

    const bio = el('div', 'profile-bio', profileUser.bio || '（此人道心深邃，未留一言）');
    info.appendChild(bio);

    // 境界行（灵气进度细节在「修行」卡片中展示）
    const realmLine = el('div', 'profile-bio', profileUser.nextRealmName
      ? '当前境界 ' + profileUser.realmName + ' → 下一境 ' + profileUser.nextRealmName
      : '当前境界 ' + profileUser.realmName + '（已至顶点）');
    info.appendChild(realmLine);

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
    stats.appendChild(statBox(profileUser.qi, '灵气'));
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
      // 闭关修行已迁「登仙」页，此处留入口指引
      const cultLink = el('a', 'btn btn-sm btn-jade', '前往登仙 · 闭关修行');
      cultLink.href = 'dengxian.html';
      btnRow.appendChild(cultLink);
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
    toast('签到成功：灵气 +' + r.data.qiGained + '、灵石 +' + r.data.stonesGained + bonus, 'exp');
    loadCheckin();
    load(); // 刷新头部灵气
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
    if (isSelf) tabs.push(['favorites', '收藏'], ['techniques', '修炼功法'], ['backpack', '功法背包']);
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
        row.appendChild(el('span', 'form-hint', '灵气 +' + Math.round((pt.expBonusRate - 1) * 100) + '% · 修炼于 ' + fmtDateTime(pt.startedAt)));
        wrap.appendChild(row);
      }
      contentEl.innerHTML = '';
      contentEl.appendChild(wrap);
    } else if (activeTab === 'backpack') {
      const r = await api.get('/techniques/backpack');
      if (!r.ok) return emptyState(contentEl, r.message);
      contentEl.innerHTML = '';
      const card = el('div', 'card');
      card.appendChild(el('div', 'page-sub', '抽卡与兑换获得的功法存放于此，装备后属性生效（多功法取最高倍率）。抽取入口：功法图鉴页「天机阁」'));
      if (!r.data.list.length) {
        card.appendChild(el('div', 'empty', '背包空空，去天机阁抽取一部功法吧'));
      } else {
        const list = el('div', null);
        list.style.marginTop = '8px';
        r.data.list.forEach((b) => {
          const row = el('div', null);
          row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--bg-soft);flex-wrap:wrap';
          const link = el('a', null, '《' + b.name + '》');
          link.href = 'technique-detail.html?id=' + b.id;
          link.style.cssText = 'font-weight:600;flex:1;min-width:130px';
          row.appendChild(gradeBadge(b.grade));
          row.appendChild(link);
          row.appendChild(el('span', 'form-hint', '灵气 +' + Math.round((b.expBonusRate - 1) * 100) + '% · ' + (b.source === 'draw' ? '天机抽取' : '灵石兑换')));
          if (b.equipped) {
            row.appendChild(el('span', 'badge realm-1', '✓ 修炼中'));
          } else {
            const needRealm = REALM_NAMES[b.requiredRealmLevel - 1] || '练气';
            const realmOk = (profileUser.realm || 1) >= b.requiredRealmLevel;
            const eqBtn = el('button', 'btn btn-sm btn-jade', '装备');
            if (!realmOk) {
              eqBtn.disabled = true;
              eqBtn.title = '需境界 ' + needRealm;
              eqBtn.textContent = '需 ' + needRealm;
            }
            eqBtn.onclick = async () => {
              eqBtn.disabled = true;
              const res = await api.post(`/techniques/${b.id}/equip`);
              eqBtn.disabled = false;
              if (!res.ok) return toast(res.message, 'error');
              Auth.updateUser(res.data.user);
              toast('已装备《' + b.name + '》，灵气获取 +' + Math.round((b.expBonusRate - 1) * 100) + '%', 'exp');
              loadTab();
              load();
            };
            row.appendChild(eqBtn);
          }
          list.appendChild(row);
        });
        card.appendChild(list);
      }
      contentEl.appendChild(card);
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

  // ---------- 头像：本地上传（FileReader 预览 + 确认提交） ----------
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // 允许重复选择同一文件
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return toast('仅支持 JPG / PNG 格式', 'error');
    if (file.size > 2 * 1024 * 1024) return toast('图片不能超过 2MB', 'error');

    const reader = new FileReader();
    reader.onload = () => {
      // 预览 + 确认弹窗
      const box = el('div');
      const img = el('img', 'avatar-preview');
      img.src = reader.result;
      box.appendChild(img);
      box.appendChild(el('div', 'form-hint', file.name + '（' + (file.size / 1024).toFixed(0) + ' KB）'));
      const actions = el('div', 'modal-actions');
      const okBtn = el('button', 'btn btn-primary', '就以此像');
      okBtn.onclick = async () => {
        const fd = new FormData();
        fd.append('file', file);
        okBtn.disabled = true; okBtn.textContent = '上传中……';
        const r = await api.postForm('/users/me/avatar/upload', fd);
        okBtn.disabled = false; okBtn.textContent = '就以此像';
        if (!r.ok) return toast(r.message, 'error');
        Auth.updateUser(r.data.user);
        toast('头像已更新', 'success');
        mask.remove();
        load();
      };
      const cancel = el('button', 'btn', '再想想');
      cancel.onclick = () => mask.remove();
      actions.appendChild(okBtn);
      actions.appendChild(cancel);
      box.appendChild(actions);
      const mask = modal('仙 像', box);
    };
    reader.readAsDataURL(file);
  });

  // ---------- 头像：AI 生成（描述 → 生成预览 → 确认保存） ----------
  function openAiModal() {
    const box = el('div');
    const input = el('input');
    input.type = 'text';
    input.maxLength = 200;
    input.placeholder = '例如：水墨风剑修，红衣持剑，凌厉眼神';
    box.appendChild(input);

    const row = el('div', 'modal-actions');
    row.style.justifyContent = 'flex-start';
    const genBtn = el('button', 'btn btn-jade', '绘 制 仙 像');
    row.appendChild(genBtn);
    box.appendChild(row);

    const previewBox = el('div', 'ai-preview-box');
    previewBox.style.display = 'none';
    const img = el('img', 'avatar-preview');
    const tip = el('div', 'form-hint', '');
    const row2 = el('div', 'modal-actions');
    const okBtn = el('button', 'btn btn-primary', '就以此像');
    okBtn.onclick = async () => {
      okBtn.disabled = true;
      const r = await api.post('/users/me/avatar/ai-confirm');
      okBtn.disabled = false;
      if (!r.ok) return toast(r.message, 'error');
      Auth.updateUser(r.data.user);
      toast('仙像已定为头像', 'success');
      mask.remove();
      load();
    };
    const regen = el('button', 'btn', '重新绘制');
    regen.onclick = () => { previewBox.style.display = 'none'; genBtn.disabled = false; };
    row2.appendChild(okBtn);
    row2.appendChild(regen);
    previewBox.appendChild(img);
    previewBox.appendChild(tip);
    previewBox.appendChild(row2);
    box.appendChild(previewBox);

    genBtn.onclick = async () => {
      const prompt = input.value.trim();
      if (!prompt) return toast('请先描述你的仙像', 'error');
      genBtn.disabled = true; genBtn.textContent = '绘制中……（约数十秒）';
      const r = await api.post('/users/me/avatar/ai-generate', { prompt });
      genBtn.disabled = false; genBtn.textContent = '绘 制 仙 像';
      if (!r.ok) return toast(r.message, 'error');
      previewBox.style.display = '';
      img.src = r.data.previewUrl;
      tip.textContent = '满意则「就以此像」，不满意可重新绘制';
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') genBtn.click(); });

    const mask = modal('AI 仙 像', box);
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
