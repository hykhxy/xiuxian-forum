// 宗门（第17轮）：列表 / 创建 / 我的宗门（公告·任命·宣战·解散）/ 加入退出
(function () {
  renderNav('sect');
  const listEl = document.getElementById('sect-list');
  const myBox = document.getElementById('my-sect-box');
  const POSITIONS = ['宗主', '副宗主', '大长老', '亲传弟子', '外门弟子'];

  /* ---------- 列表 ---------- */
  function renderCard(s, createCost) {
    const card = el('a', 'card sect-card');
    card.href = 'javascript:void(0)';
    card.onclick = () => openSect(s.id);

    const head = el('div', 'sect-card-head');
    head.appendChild(el('span', 'sect-name', s.name));
    if (s.victory) head.appendChild(el('span', 'badge mark-essence', '凯旋'));
    if (s.defeated) head.appendChild(el('span', 'badge mark-top', '战败'));
    card.appendChild(head);

    card.appendChild(el('div', 'sect-meta', `宗主 ${s.leaderName} · ${s.memberCount} 人`));
    card.appendChild(el('div', 'sect-meta', `声望 ${s.prestige} · 宗库 ◇${s.treasury}`));

    if (Auth.isLoggedIn() && !s.isMember) {
      const join = el('button', 'btn btn-jade btn-sm', '拜入');
      join.onclick = (e) => { e.stopPropagation(); doJoin(s.id, s.name); };
      card.appendChild(join);
    } else if (s.isMember) {
      card.appendChild(el('span', 'badge realm-1', '本门'));
    }
    return card;
  }

  async function loadList() {
    loadingState(listEl, '……');
    const r = await api.get('/sects');
    if (!r.ok) return emptyState(listEl, r.message);
    listEl.innerHTML = '';
    if (!r.data.list.length) return emptyState(listEl, '灵墟尚无宗门，开山立派者何在？');
    r.data.list.forEach((s) => listEl.appendChild(renderCard(s, r.data.createCost)));
    return r.data.createCost;
  }

  /* ---------- 创建 ---------- */
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

  async function doJoin(id, name) {
    const r = await api.post(`/sects/${id}/join`);
    if (!r.ok) return toast(r.message, 'error');
    toast(`已拜入「${name}」，为${r.data.role}`, 'success');
    load();
  }

  /* ---------- 宗门详情弹窗 ---------- */
  function openSect(id) {
    loadingStateModal(id);
  }
  function loadingStateModal(id) {
    const box = el('div');
    box.appendChild(el('div', 'empty loading', '……'));
    const mask = modal('宗 门', box);
    api.get('/sects/' + id).then((r) => {
      mask.remove();
      if (!r.ok) return toast(r.message, 'error');
      renderSectModal(r.data.sect);
    });
  }

  function renderSectModal(s) {
    const box = el('div');

    // 标题
    const head = el('div', 'sect-card-head');
    head.appendChild(el('span', 'sect-name', s.name));
    if (s.victory) head.appendChild(el('span', 'badge mark-essence', '凯旋·7日'));
    if (s.defeated) head.appendChild(el('span', 'badge mark-top', '战败'));
    box.appendChild(head);
    box.appendChild(el('div', 'sect-meta', `声望 ${s.prestige} · 宗库 ◇${s.treasury} · ${s.memberCount} 人`));

    // 公告
    const ann = el('div', 'sect-announcement');
    ann.appendChild(el('div', 'kv-label', '宗门公告'));
    ann.appendChild(el('div', null, s.announcement.content || '（尚无公告）'));
    box.appendChild(ann);

    // 成员表
    box.appendChild(el('div', 'kv-label', `弟子名册（${s.members.length}）`));
    const list = el('div', 'sect-member-list');
    s.members.forEach((m) => {
      const row = el('div', 'sect-member-row');
      const left = el('span');
      left.appendChild(realmBadge(m.realmLevel || 1, m.realmName));
      left.appendChild(document.createTextNode(' ' + m.username));
      row.appendChild(left);
      row.appendChild(el('span', 'badge ' + (m.role === '宗主' ? 'realm-4' : 'realm-1'), m.role));

      // 任命（仅宗主）
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
          renderSectModal({ ...s, members: s.members.map((x) => x.id === m.id ? { ...x, role: sel.value } : x) });
          loadList();
        };
        row.appendChild(sel);
      }
      list.appendChild(row);
    });
    box.appendChild(list);

    // 操作区
    const actions = el('div', 'modal-actions');
    actions.style.flexWrap = 'wrap';

    if (s.isMember) {
      if (s.myRole !== '宗主') {
        const leave = el('button', 'btn btn-sm', '退出宗门');
        leave.onclick = async () => {
          if (!confirm('确认退出本门？')) return;
          const r = await api.post(`/sects/${s.id}/leave`);
          if (!r.ok) return toast(r.message, 'error');
          toast('已退出', 'success'); mask.remove(); load();
        };
        actions.appendChild(leave);
      }
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
        warBtn.onclick = () => openWarModal(s);
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
    }
    const close = el('button', 'btn btn-sm', '关闭');
    close.onclick = () => mask.remove();
    actions.appendChild(close);
    box.appendChild(actions);

    const mask = modal('宗 门 · ' + s.name, box);
  }

  function openWarModal(s) {
    const box = el('div');
    box.appendChild(el('div', 'form-hint', '宣战后按职务自动编队五人（宗主/副宗主/大长老/亲传/外门），缺员判负。'));
    const typeSel = el('select');
    [['武斗', '武斗（回合制自动战斗）'], ['文斗', '文斗（五轮问答·四评委）']].forEach(([v, l]) => {
      const o = el('option', null, l); o.value = v; typeSel.appendChild(o);
    });
    box.appendChild(typeSel);
    const targetSel = el('select');
    targetSel.appendChild(el('option', null, '选择目标宗门…'));
    api.get('/sects').then((r) => {
      if (!r.ok) return;
      r.data.list.filter((x) => x.id !== s.id).forEach((x) => {
        const o = el('option', null, `${x.name}（声望${x.prestige}·${x.memberCount}人）`);
        o.value = x.id;
        targetSel.appendChild(o);
      });
    });
    box.appendChild(targetSel);
    const act = el('div', 'modal-actions');
    const go = el('button', 'btn btn-danger', '下 战 书');
    go.onclick = async () => {
      if (!targetSel.value) return toast('请选择目标宗门', 'error');
      const r = await api.post(`/sects/${s.id}/declare-war`, { targetId: targetSel.value, warType: typeSel.value });
      if (!r.ok) return toast(r.message, 'error');
      toast(`${typeSel.value}战书已下！`, 'exp');
      m.remove(); mask.remove();
      location.href = 'battlefield.html?id=' + r.data.warId;
    };
    act.appendChild(go);
    box.appendChild(act);
    const m = modal('宣 战', box);
  }

  /* ---------- 我的宗门速览 ---------- */
  async function loadMySect() {
    if (!Auth.isLoggedIn()) { myBox.innerHTML = ''; return; }
    const r = await api.get('/sects');
    if (!r.ok) return;
    const mine = r.data.list.find((s) => s.isMember);
    if (!mine) { myBox.innerHTML = ''; return; }
    const d = await api.get('/sects/' + mine.id);
    if (!d.ok) return;
    const s = d.data.sect;
    const card = el('div', 'card my-sect-card');
    card.appendChild(el('div', 'sect-name', '本门 · ' + s.name));
    card.appendChild(el('div', 'sect-meta', `我的职务：${s.myRole || '外门弟子'} · 声望 ${s.prestige} · 宗库 ◇${s.treasury}`));
    const btn = el('button', 'btn btn-sm btn-jade', '进入宗门');
    btn.onclick = () => renderSectModal(s);
    card.appendChild(btn);
    myBox.innerHTML = '';
    myBox.appendChild(card);
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
