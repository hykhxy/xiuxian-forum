// 宗门（第17轮列表 + 第18轮内部详情6模块）
// 数据：SECT_DATA JSON 集中定义（Mock）；人员/职位优先真实接口，签到调真实接口
(function () {
  renderNav('sect');
  const listEl = document.getElementById('sect-list');
  const myBox = document.getElementById('my-sect-box');
  const listView = document.getElementById('sect-list-view');
  const innerView = document.getElementById('sect-inner-view');
  const tabbarEl = document.getElementById('sect-tab-bar');
  const tabContentEl = document.getElementById('sect-tab-content');
  const POSITIONS = ['宗主', '副宗主', '大长老', '亲传弟子', '外门弟子'];

  /* ============================================================
   * SECT_DATA：宗门内部数据源（集中 JSON，方便对接后端）
   * 后端对接点：
   *   contribution → Sect 增加 contribution 字段（Map userId→数值）
   *   techniques   → 宗门功法阁集合（或复用 Technique 加 sectPrice）
   *   tasks        → SectTask 集合（含 status: available/accepted/done）
   *   forum        → Post 按 tags 含宗门名筛选
   *   rank         → Sect.members 按 qi 降序聚合（$lookup User）
   *   members      → 已有真实接口 GET /api/sects/:id（当前即用）
   * ============================================================ */
  var SECT_DATA = {
    contribution: 0,          // 我的贡献值（签到 +10）
    checkinDone: false,
    techniques: [             // 功法阁：贡献值兑换
      { id: 'st1', name: '青元剑诀', grade: '玄阶', cost: 120, desc: '宗门藏经·剑修本命', exchanged: false },
      { id: 'st2', name: '混元桩功', grade: '黄阶', cost: 40,  desc: '筑基炼体第一桩', exchanged: false },
      { id: 'st3', name: '御风符经', grade: '地阶', cost: 260, desc: '符修入门到进阶', exchanged: false },
      { id: 'st4', name: '九转还魂丹方', grade: '天阶', cost: 600, desc: '丹道至宝（残卷）', exchanged: false }
    ],
    tasks: [                  // 任务堂
      { id: 'tk1', name: '巡山护法', reward: '贡献+15 · 灵石+20', status: 'available', desc: '巡视宗门山门一日' },
      { id: 'tk2', name: '炼丹房值守', reward: '贡献+30 · 灵气+500', status: 'available', desc: '为丹房看守地火三个时辰' },
      { id: 'tk3', name: '讨伐魔修', reward: '贡献+80 · 声望+5', status: 'available', desc: '黑风崖出没魔修，前去清剿' },
      { id: 'tk4', name: '采集灵草', reward: '贡献+20 · 灵草×3', status: 'available', desc: '后山药圃成熟，采摘百年灵草' }
    ],
    forum: [                  // 宗门论坛（Mock 帖子）
      { id: 'f1', title: '本月宗门大比排期公示', author: '执法长老', time: '3 小时前', replies: 26 },
      { id: 'f2', title: '丹房新出一炉筑基丹，亲传以下勿扰', author: '丹堂首座', time: '昨天', replies: 41 },
      { id: 'f3', title: '黑风崖魔修踪迹汇总，接任务的师弟看', author: '巡山队长', time: '2 天前', replies: 13 },
      { id: 'f4', title: '新入门弟子请先读宗规三章', author: '宗主', time: '5 天前', replies: 8 }
    ],
    rank: [                   // 风云榜：修为排名（Mock）
      { pos: 1, name: '青云子', realm: '金丹期', qi: 12480, prof: '剑修' },
      { pos: 2, name: '玄岳真人', realm: '金丹期', qi: 11205, prof: '体修' },
      { pos: 3, name: '白芷仙子', realm: '筑基期', qi: 8360, prof: '丹修' },
      { pos: 4, name: '风行者', realm: '筑基期', qi: 6120, prof: '剑修' },
      { pos: 5, name: '守夜人', realm: '筑基期', qi: 5980, prof: '符修' }
    ],
    membersFallback: [        // 人员/职位 Mock（真实接口失败时回落）
      { username: '青云子', role: '宗主', realm: '金丹期' },
      { username: '玄岳真人', role: '大长老', realm: '金丹期' },
      { username: '白芷仙子', role: '亲传弟子', realm: '筑基期' },
      { username: '风行者', role: '外门弟子', realm: '筑基期' },
      { username: '守夜人', role: '外门弟子', realm: '筑基期' }
    ]
  };

  /* ============================================================
   * 视图切换（0.5s 淡入淡出）
   * ============================================================ */
  function switchView(toInner, sectInfo) {
    const out = toInner ? listView : innerView;
    const in_ = toInner ? innerView : listView;
    out.classList.add('fading');
    setTimeout(() => {
      out.style.display = 'none';
      out.classList.remove('fading');
      if (toInner && sectInfo) enterSect(sectInfo);
      in_.style.display = '';
      in_.classList.add('fading');
      requestAnimationFrame(() => requestAnimationFrame(() => in_.classList.remove('fading')));
      window.scrollTo(0, 0);
    }, 500); // 0.5 秒
  }

  document.getElementById('sect-back-btn').onclick = () => switchView(false);

  /* ============================================================
   * 列表视图（第17轮原有逻辑）
   * ============================================================ */
  function renderCard(s) {
    const card = el('a', 'card sect-card');
    card.href = 'javascript:void(0)';
    card.onclick = () => openSectModal(s.id);

    const head = el('div', 'sect-card-head');
    head.appendChild(el('span', 'sect-name', s.name));
    if (s.victory) head.appendChild(el('span', 'badge mark-essence', '凯旋'));
    if (s.defeated) head.appendChild(el('span', 'badge mark-top', '战败'));
    card.appendChild(head);

    card.appendChild(el('div', 'sect-meta', `宗主 ${s.leaderName} · ${s.memberCount} 人`));
    card.appendChild(el('div', 'sect-meta', `声望 ${s.prestige} · 宗库 ◇${s.treasury}`));

    const enter = el('button', 'btn btn-jade btn-sm', s.isMember ? '进入宗门' : '拜 入');
    enter.onclick = (e) => {
      e.stopPropagation();
      if (Auth.isLoggedIn() && !s.isMember) {
        api.post(`/sects/${s.id}/join`).then((r) => {
          if (!r.ok) return toast(r.message, 'error');
          toast(`已拜入「${s.name}」`, 'success');
          switchView(true, { id: s.id, name: s.name, meta: `声望 ${s.prestige} · ${s.memberCount + 1} 人` });
        });
      } else {
        if (!Auth.isLoggedIn()) return Auth.requireLogin();
        switchView(true, { id: s.id, name: s.name, meta: `声望 ${s.prestige} · ${s.memberCount} 人` });
      }
    };
    card.appendChild(enter);
    return card;
  }

  async function loadList() {
    loadingState(listEl, '……');
    const r = await api.get('/sects');
    if (!r.ok) return emptyState(listEl, r.message);
    listEl.innerHTML = '';
    if (!r.data.list.length) return emptyState(listEl, '灵墟尚无宗门，开山立派者何在？');
    r.data.list.forEach((s) => listEl.appendChild(renderCard(s)));
  }

  document.getElementById('create-sect-btn').onclick = () => {
    if (!Auth.requireLogin()) return;
    const box = el('div');
    box.appendChild(el('div', 'form-hint', '开山立派需 100 灵石（全数充入宗门灵石库），立后你即宗主。'));
    const name = el('input');
    name.maxLength = 12;
    name.placeholder = '宗门名（2-12 字）';
    box.appendChild(name);
    const actions = el('div', 'modal-actions');
    const okBtn = el('button', 'btn btn-primary', '立 派');
    okBtn.onclick = async () => {
      const r = await api.post('/sects', { name: name.value.trim() });
      if (!r.ok) return toast(r.message, 'error');
      toast('「' + r.data.sect.name + '」立派成功！', 'exp');
      mask.remove();
      load();
    };
    actions.appendChild(okBtn);
    box.appendChild(actions);
    const mask = modal('开 山 立 派', box);
  };

  // 宗门管理弹窗（任命/公告/宣战/解散——保留第17轮能力）
  async function openSectModal(id) {
    const box = el('div');
    box.appendChild(el('div', 'empty loading', '……'));
    const mask = modal('宗 门', box);
    const r = await api.get('/sects/' + id);
    mask.remove();
    if (!r.ok) return toast(r.message, 'error');
    renderSectModal(r.data.sect);
  }

  function renderSectModal(s) {
    const box = el('div');
    const head = el('div', 'sect-card-head');
    head.appendChild(el('span', 'sect-name', s.name));
    if (s.victory) head.appendChild(el('span', 'badge mark-essence', '凯旋·7日'));
    if (s.defeated) head.appendChild(el('span', 'badge mark-top', '战败'));
    box.appendChild(head);
    box.appendChild(el('div', 'sect-meta', `声望 ${s.prestige} · 宗库 ◇${s.treasury} · ${s.memberCount} 人`));

    const ann = el('div', 'sect-announcement');
    ann.appendChild(el('div', 'kv-label', '宗门公告'));
    ann.appendChild(el('div', null, s.announcement.content || '（尚无公告）'));
    box.appendChild(ann);

    box.appendChild(el('div', 'kv-label', `弟子名册（${s.members.length}）`));
    const list = el('div', 'sect-member-list');
    s.members.forEach((m) => {
      const row = el('div', 'sect-member-row');
      const left = el('span');
      left.appendChild(realmBadge(m.realmLevel || 1, m.realmName));
      left.appendChild(document.createTextNode(' ' + m.username));
      row.appendChild(left);
      row.appendChild(el('span', 'badge ' + (m.role === '宗主' ? 'realm-4' : 'realm-1'), m.role));
      if (s.perms.appoint && String(m.id) !== String(Auth.userId())) {
        const sel = el('select', 'sect-role-select');
        POSITIONS.forEach((p) => {
          const o = el('option', null, p);
          o.value = p;
          if (p === m.role) o.selected = true;
          sel.appendChild(o);
        });
        sel.onchange = async () => {
          const r = await api.put(`/sects/${s.id}/roles`, { userId: m.id, role: sel.value });
          if (!r.ok) { toast(r.message, 'error'); return; }
          toast(`${m.username} 已任「${sel.value}」`, 'success');
        };
        row.appendChild(sel);
      }
      list.appendChild(row);
    });
    box.appendChild(list);

    const actions = el('div', 'modal-actions');
    actions.style.flexWrap = 'wrap';
    if (s.perms.announce) {
      const annBtn = el('button', 'btn btn-sm', '发布公告');
      annBtn.onclick = () => {
        const inner = el('div');
        const ta = el('textarea');
        ta.maxLength = 1000;
        ta.value = s.announcement.content || '';
        inner.appendChild(ta);
        const act = el('div', 'modal-actions');
        const pub = el('button', 'btn btn-primary', '发布');
        pub.onclick = async () => {
          const r = await api.put(`/sects/${s.id}/announcement`, { content: ta.value.trim() });
          if (!r.ok) return toast(r.message, 'error');
          toast('公告已发布', 'success');
          m2.remove(); mask.remove(); load();
        };
        act.appendChild(pub);
        inner.appendChild(act);
        const m2 = modal('宗门公告', inner);
      };
      actions.appendChild(annBtn);
    }
    if (s.perms.declareWar) {
      const warBtn = el('button', 'btn btn-sm btn-danger', '宣 战');
      warBtn.onclick = () => {
        const inner = el('div');
        const typeSel = el('select');
        [['武斗', '武斗（回合制自动战斗）'], ['文斗', '文斗（五轮问答·四评委）']].forEach(([v, l]) => {
          const o = el('option', null, l); o.value = v; typeSel.appendChild(o);
        });
        inner.appendChild(typeSel);
        const targetSel = el('select');
        targetSel.appendChild(el('option', null, '选择目标宗门…'));
        api.get('/sects').then((r) => {
          if (!r.ok) return;
          r.data.list.filter((x) => x.id !== s.id).forEach((x) => {
            const o = el('option', null, `${x.name}（声望${x.prestige}）`);
            o.value = x.id;
            targetSel.appendChild(o);
          });
        });
        inner.appendChild(targetSel);
        const act = el('div', 'modal-actions');
        const go = el('button', 'btn btn-danger', '下 战 书');
        go.onclick = async () => {
          if (!targetSel.value) return toast('请选择目标宗门', 'error');
          const r = await api.post(`/sects/${s.id}/declare-war`, { targetId: targetSel.value, warType: typeSel.value });
          if (!r.ok) return toast(r.message, 'error');
          toast('战书已下！', 'exp');
          m3.remove(); mask.remove();
          location.href = 'battlefield.html?id=' + r.data.warId;
        };
        act.appendChild(go);
        inner.appendChild(act);
        const m3 = modal('宣 战', inner);
      };
      actions.appendChild(warBtn);
    }
    if (s.perms.dissolve) {
      const dis = el('button', 'btn btn-sm btn-danger', '解散');
      dis.onclick = async () => {
        if (!confirm('解散宗门不可逆，确认？')) return;
        const r = await api.post(`/sects/${s.id}/dissolve`);
        if (!r.ok) return toast(r.message, 'error');
        toast('宗门已解散', 'success'); mask.remove(); load();
      };
      actions.appendChild(dis);
    }
    const close = el('button', 'btn btn-sm', '关闭');
    close.onclick = () => mask.remove();
    actions.appendChild(close);
    box.appendChild(actions);

    const mask = modal('宗 门 · ' + s.name, box);
  }

  async function loadMySect() {
    if (!Auth.isLoggedIn()) { myBox.innerHTML = ''; return; }
    const r = await api.get('/sects');
    if (!r.ok) return;
    const mine = r.data.list.find((s) => s.isMember);
    if (!mine) { myBox.innerHTML = ''; return; }
    const card = el('div', 'card my-sect-card');
    card.appendChild(el('div', 'sect-name', '本门 · ' + mine.name));
    const enter = el('button', 'btn btn-sm btn-jade', '进入宗门');
    enter.onclick = () => switchView(true, { id: mine.id, name: mine.name, meta: `声望 ${mine.prestige} · ${mine.memberCount} 人` });
    const manage = el('button', 'btn btn-sm', '宗门管理');
    manage.onclick = () => openSectModal(mine.id);
    card.appendChild(enter);
    card.appendChild(manage);
    myBox.innerHTML = '';
    myBox.appendChild(card);
  }

  /* ============================================================
   * 内部视图（第18轮：6 模块 Tab）
   * ============================================================ */
  const TABS = [
    ['checkin', '签到·贡献'], ['tech', '功法阁'], ['task', '任务堂'],
    ['forum', '宗门论坛'], ['rank', '风云榜'], ['members', '人员·职位']
  ];
  let activeTab = 'checkin';
  let currentSect = null;   // { id, name, meta }
  let membersCache = null;  // 人员数据（真实 or Mock）

  function enterSect(info) {
    currentSect = info;
    SECT_DATA.contribution = 0;
    SECT_DATA.checkinDone = false;
    SECT_DATA.tasks.forEach((t) => { if (t.status === 'accepted') t.status = 'available'; });
    SECT_DATA.techniques.forEach((t) => { t.exchanged = false; });
    document.getElementById('inner-sect-name').textContent = info.name;
    document.getElementById('inner-sect-meta').textContent = info.meta || '';
    membersCache = null;
    activeTab = 'checkin';
    renderTabbar();
    loadTab();
  }

  function renderTabbar() {
    tabbarEl.innerHTML = '';
    TABS.forEach(([key, label]) => {
      const t = el('div', 'tab sect-tab' + (activeTab === key ? ' active' : ''), label);
      t.onclick = () => { activeTab = key; renderTabbar(); loadTab(); };
      tabbarEl.appendChild(t);
    });
  }

  async function loadTab() {
    loadingState(tabContentEl, '……');
    if (activeTab === 'checkin') return renderCheckin();
    if (activeTab === 'tech') return renderTechStore();
    if (activeTab === 'task') return renderTasks();
    if (activeTab === 'forum') return renderForum();
    if (activeTab === 'rank') return renderRank();
    if (activeTab === 'members') return renderMembers();
  }

  // ---- 1. 签到/贡献 ----
  function renderCheckin() {
    tabContentEl.innerHTML = '';
    const box = el('div', 'checkin-contribution');
    const left = el('div');
    left.appendChild(el('div', 'page-title', '宗门签到', null));
    left.firstChild.style.fontSize = '18px';
    left.appendChild(el('div', 'page-sub', '每日签到：贡献 +10（同时完成个人修行签到）'));
    box.appendChild(left);
    const btn = el('button', 'btn btn-jade', SECT_DATA.checkinDone ? '今日已签' : '签 到');
    btn.disabled = SECT_DATA.checkinDone;
    btn.onclick = async () => {
      btn.disabled = true;
      const r = await api.post('/users/me/checkin');   // 真实接口
      if (!r.ok) {
        if (/已签到|已签/.test(r.message || '')) {
          SECT_DATA.checkinDone = true;
          btn.textContent = '今日已签';
          return toast('今日已签到（个人签到已完成）', 'info');
        }
        btn.disabled = false;
        return toast(r.message, 'error');
      }
      SECT_DATA.checkinDone = true;
      SECT_DATA.contribution += 10;
      btn.textContent = '今日已签';
      toast(`签到成功：贡献 +10，灵气 +${r.data.qiGained}`, 'exp');
      renderCheckin();
    };
    box.appendChild(btn);
    const bal = el('div', 'contribution-balance');
    bal.appendChild(el('div', 'stat-num', String(SECT_DATA.contribution)));
    bal.appendChild(el('div', 'stat-label', '贡献值'));
    box.appendChild(bal);
    tabContentEl.appendChild(box);

    tabContentEl.appendChild(el('div', 'form-hint',
      '贡献值可用于功法阁兑换与任务奖励结算（当前为演示数据，后端对接：Sect.contribution 字段）'));
  }

  // ---- 2. 功法阁 ----
  function renderTechStore() {
    tabContentEl.innerHTML = '';
    tabContentEl.appendChild(el('div', 'kv-label',
      `功法阁 · 我的贡献 ${SECT_DATA.contribution}（兑换直接扣减，演示数据）`));
    const grid = el('div', 'tech-grid');
    SECT_DATA.techniques.forEach((t) => {
      const card = el('div', 'tech-card');
      const info = el('div', 'tech-card-info');
      info.appendChild(gradeBadge(t.grade));
      info.appendChild(el('span', 'tag', '宗门'));
      card.appendChild(info);
      card.appendChild(el('div', 'tech-card-name', t.name));
      card.appendChild(el('div', 'tech-card-desc', t.desc));
      const foot = el('div', 'tech-card-foot');
      foot.appendChild(el('span', 'stone', '贡献 ' + t.cost));
      const btn = el('button', 'btn btn-sm ' + (t.exchanged ? '' : 'btn-jade'), t.exchanged ? '已兑换' : '兑 换');
      btn.disabled = t.exchanged || SECT_DATA.contribution < t.cost;
      btn.onclick = () => {
        SECT_DATA.contribution -= t.cost;
        t.exchanged = true;
        toast(`已兑换《${t.name}》（贡献 -${t.cost}）`, 'exp');
        renderTechStore();
      };
      foot.appendChild(btn);
      card.appendChild(foot);
      grid.appendChild(card);
    });
    tabContentEl.appendChild(grid);
  }

  // ---- 3. 任务堂 ----
  function renderTasks() {
    tabContentEl.innerHTML = '';
    tabContentEl.appendChild(el('div', 'kv-label', '任务堂 · 接取宗门任务赢取奖励（演示数据）'));
    SECT_DATA.tasks.forEach((t) => {
      const row = el('div', 'task-row');
      const left = el('div', 'task-info');
      left.appendChild(el('div', 'task-name', t.name));
      left.appendChild(el('div', 'form-hint', t.desc + ' · 奖励：' + t.reward));
      row.appendChild(left);
      const btn = el('button', 'btn btn-sm ' + (t.status === 'available' ? 'btn-jade' : ''),
        t.status === 'available' ? '接 取' : '进行中');
      btn.disabled = t.status !== 'available';
      btn.onclick = () => {
        t.status = 'accepted';
        toast(`已接取「${t.name}」`, 'success');
        renderTasks();
      };
      row.appendChild(btn);
      tabContentEl.appendChild(row);
    });
  }

  // ---- 4. 宗门论坛 ----
  function renderForum() {
    tabContentEl.innerHTML = '';
    tabContentEl.appendChild(el('div', 'kv-label', '宗门论坛 · 门内帖（演示数据）'));
    SECT_DATA.forum.forEach((p) => {
      const a = el('a', 'post-item');
      a.href = 'javascript:void(0)';
      a.onclick = () => toast('演示帖子：后端对接后跳详情（按宗门标签筛选）', 'info');
      a.appendChild(el('div', 'post-title', p.title));
      const meta = el('div', 'post-meta');
      meta.appendChild(el('span', null, p.author));
      meta.appendChild(el('span', null, p.time));
      const stats = el('span', 'post-stats');
      stats.appendChild(el('span', null, '✎ ' + p.replies));
      meta.appendChild(stats);
      a.appendChild(meta);
      tabContentEl.appendChild(a);
    });
  }

  // ---- 5. 风云榜 ----
  function renderRank() {
    tabContentEl.innerHTML = '';
    tabContentEl.appendChild(el('div', 'kv-label', '风云榜 · 门内修为排名（演示数据）'));
    const table = el('table', 'admin-table rank-table');
    const thead = el('thead');
    const hr = el('tr');
    ['名次', '道号', '境界', '修为', '职业'].forEach((h) => hr.appendChild(el('th', null, h)));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = el('tbody');
    SECT_DATA.rank.forEach((r) => {
      const tr = el('tr');
      const posTd = el('td');
      posTd.appendChild(el('span', 'rank-num', ['壹', '贰', '叁', '肆', '伍'][r.pos - 1] || String(r.pos)));
      tr.appendChild(posTd);
      tr.appendChild(el('td', null, r.name));
      tr.appendChild(el('td', null, r.realm));
      tr.appendChild(el('td', null, String(r.qi)));
      tr.appendChild(el('td', null, r.prof));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tabContentEl.appendChild(table);
  }

  // ---- 6. 人员/职位（真实接口优先，回落 Mock） ----
  async function renderMembers() {
    tabContentEl.innerHTML = '';
    tabContentEl.appendChild(el('div', 'empty loading', '……'));

    let list = null;
    let real = false;
    if (currentSect && currentSect.id) {
      const r = await api.get('/sects/' + currentSect.id);
      if (r.ok && r.data.sect.members.length) {
        real = true;
        list = r.data.sect.members.map((m) => ({ username: m.username, role: m.role, realm: m.realmName || '练气' }));
      }
    }
    if (!list) list = SECT_DATA.membersFallback;

    tabContentEl.innerHTML = '';
    tabContentEl.appendChild(el('div', 'kv-label',
      (real ? '弟子名册（实时）' : '弟子名册（演示数据）') + ' · 共 ' + list.length + ' 人'));

    // 按职务分组渲染
    POSITIONS.forEach((pos) => {
      const group = list.filter((m) => m.role === pos);
      if (!group.length) return;
      const section = el('div', 'member-section');
      section.appendChild(el('div', 'member-section-title',
        pos + '（' + group.length + '）'));
      group.forEach((m) => {
        const row = el('div', 'sect-member-row');
        const left = el('span');
        left.appendChild(el('span', 'badge ' + (pos === '宗主' ? 'realm-4' : 'realm-1'), m.realm));
        left.appendChild(document.createTextNode(' ' + m.username));
        row.appendChild(left);
        section.appendChild(row);
      });
      tabContentEl.appendChild(section);
    });
  }

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

  function load() { loadList(); loadMySect(); }
  load();
})();
