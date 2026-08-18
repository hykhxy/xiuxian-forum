// 功法详情：信息展示 + 兑换修炼
(function () {
  renderNav('techniques');
  const cardEl = document.getElementById('tech-card');
  const techId = qs('id');
  if (!techId) { emptyState(cardEl, '未指定功法'); return; }

  async function load() {
    loadingState(cardEl, '灵力凝聚中……');
    const r = await api.get('/techniques/' + techId);
    if (!r.ok) return emptyState(cardEl, r.message);
    const t = r.data.technique;
    const me = Auth.user();
    cardEl.innerHTML = '';

    // ---- 头部 ----
    const head = el('div', 'tech-detail-head');
    const left = el('div');
    const info = el('div', 'tech-card-info');
    info.appendChild(gradeBadge(t.grade));
    info.appendChild(el('span', 'tag', t.type));
    info.appendChild(el('span', 'tag', t.element + '属性'));
    if (t.status !== 'approved') info.appendChild(el('span', 'tag', t.status === 'pending' ? '待审核' : '已驳回'));
    const name = el('div', 'tech-detail-name', t.name);
    left.appendChild(info);
    left.appendChild(name);

    const sub = el('div', 'page-sub');
    sub.appendChild(document.createTextNode('投稿人 '));
    if (t.submitter) {
      const a = el('a', null, t.submitter.username);
      a.href = 'profile.html?id=' + t.submitter.id;
      a.style.color = 'var(--accent)';
      sub.appendChild(a);
    } else sub.appendChild(document.createTextNode('佚名'));
    sub.appendChild(document.createTextNode(' · ' + timeAgo(t.createdAt)));
    left.appendChild(sub);
    head.appendChild(left);

    // ---- 修炼按钮（根据状态渲染） ----
    const actionWrap = el('div', null);
    actionWrap.style.display = 'flex';
    actionWrap.style.flexDirection = 'column';
    actionWrap.style.gap = '8px';
    actionWrap.style.alignItems = 'flex-end';

    const bonusPct = Math.round((t.expBonusRate - 1) * 100);
    if (!me) {
      const login = el('a', 'btn btn-primary', '登录后可修炼');
      login.href = 'login.html?from=' + encodeURIComponent(location.href);
      actionWrap.appendChild(login);
    } else if (r.data.practicedByMe) {
      actionWrap.appendChild(el('button', 'btn btn-jade', '✓ 已在修炼'));
    } else {
      const needRealm = REALM_NAMES[t.requiredRealmLevel - 1] || '练气';
      const realmOk = (me.realm || 1) >= t.requiredRealmLevel;
      const stonesOk = (me.spiritStones || 0) >= t.price;
      const btn = el('button', 'btn btn-primary', '兑换修炼（◇ ' + t.price + '）');
      if (!realmOk) {
        btn.disabled = true;
        actionWrap.appendChild(el('div', 'form-hint', '需境界：' + needRealm + '（当前 ' + (REALM_NAMES[(me.realm || 1) - 1]) + '）'));
      } else if (!stonesOk) {
        btn.disabled = true;
        actionWrap.appendChild(el('div', 'form-hint', '灵石不足（持有 ' + (me.spiritStones || 0) + '，需 ' + t.price + '）'));
      } else {
        btn.onclick = async () => {
          if (!confirm('消耗 ' + t.price + ' 灵石修炼《' + t.name + '》？')) return;
          btn.disabled = true;
          const res = await api.post(`/techniques/${techId}/practice`);
          if (!res.ok) { btn.disabled = false; return toast(res.message, 'error'); }
          Auth.updateUser(res.data.user);
          toast('修炼成功！修为获取 +' + bonusPct + '%', 'exp');
          load();
        };
      }
      actionWrap.appendChild(btn);
    }
    head.appendChild(actionWrap);

    // ---- 修炼层数（第16轮）：层数进度 + 升层按钮 + 下层预览 ----
    if (t.maxLevel && t.baseStats && t.baseStats.atk > 0) {
      const lvBox = el('div', null);
      lvBox.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px dashed var(--line-strong)';

      const myEntry = r.data.myEntry || null;   // 后端返回（已修炼时）
      const level = myEntry ? myEntry.level : 0;

      // 层数进度条
      const pw = el('div', 'progress-wrap');
      const pct = Math.round((level / t.maxLevel) * 100);
      const bar = el('div', 'progress-bar');
      const inner = el('div', 'progress-inner');
      inner.style.width = pct + '%';
      bar.appendChild(inner);
      pw.appendChild(bar);
      const pt = el('div', 'progress-text');
      pt.appendChild(el('span', null, '修炼层数 ' + (level || '—') + ' / ' + t.maxLevel));
      pt.appendChild(el('span', null, level >= t.maxLevel ? '圆满' : '第1层攻+' + t.baseStats.atk + ' 血+' + t.baseStats.hp));
      pw.appendChild(pt);
      lvBox.appendChild(pw);

      // 每层成长表（基础 → 满层）
      const growthRow = el('div', 'form-hint',
        '每层成长：攻/防/血/灵气/修炼基础 × ' + Math.round((1 + t.growthRate) * 100) + '%/层（' +
        '满层攻+' + Math.round(t.baseStats.atk * Math.pow(1 + t.growthRate, t.maxLevel - 1)) + '）');
      lvBox.appendChild(growthRow);

      // 升层按钮（已修炼且未满层时）
      if (myEntry && level < t.maxLevel && myEntry.nextPreview) {
        const row = el('div', null);
        row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap';
        const np = myEntry.nextPreview;
        const lvBtn = el('button', 'btn btn-primary btn-sm',
          '参悟上卷 · 升至第 ' + np.level + ' 层（' + np.cost + ' 灵气）');
        const qi = Auth.user() ? (r.data.myQi || 0) : 0;
        if (qi < np.cost) lvBtn.disabled = true;
        lvBtn.onclick = async () => {
          lvBtn.disabled = true;
          const res = await api.post(`/techniques/${techId}/levelup`);
          lvBtn.disabled = false;
          if (!res.ok) return toast(res.message, 'error');
          const g = res.data.gained;
          toast('参悟成功！第 ' + res.data.level + ' 层：攻+' + g.atk + ' 防+' + g.def + ' 血+' + g.hp, 'exp');
          load();
        };
        row.appendChild(lvBtn);
        const g = np.gained;
        row.appendChild(el('span', 'form-hint', '下层收益：攻+' + g.atk + ' 防+' + g.def + ' 血+' + g.hp + ' 灵气+' + g.qi));
        lvBox.appendChild(row);
      } else if (myEntry && level >= t.maxLevel) {
        lvBox.appendChild(el('div', 'form-hint', '此法已修至圆满之境'));
      }

      head.appendChild(lvBox);
    }

    // ---- 正文 ----
    const desc = el('div', 'tech-detail-desc', t.description);
    const effect = el('div', null);
    effect.appendChild(el('div', 'kv-label', '修炼效果'));
    const effText = el('div', null, '「' + t.effect + '」（实际：修为获取 +' + bonusPct + '%）');
    effText.style.color = 'var(--jade)';
    effect.appendChild(effText);

    const kv = el('div', 'kv-list');
    function kvItem(label, value) {
      const box = el('div', 'kv-item');
      box.appendChild(el('div', 'kv-label', label));
      box.appendChild(el('div', 'kv-value', value));
      return box;
    }
    kv.appendChild(kvItem('品阶', t.grade));
    kv.appendChild(kvItem('类型 / 属性', t.type + ' · ' + t.element));
    kv.appendChild(kvItem('修炼难度', '★'.repeat(t.difficulty) + '☆'.repeat(5 - t.difficulty)));
    kv.appendChild(kvItem('境界要求', REALM_NAMES[t.requiredRealmLevel - 1] || '练气'));
    kv.appendChild(kvItem('兑换灵石', '◇ ' + t.price));
    kv.appendChild(kvItem('修炼人数', t.practitionerCount + ' 人'));

    if (t.status === 'rejected' && t.rejectReason) {
      kv.appendChild(el('div', 'form-hint status-rejected', '驳回原因：' + t.rejectReason));
    }

    cardEl.appendChild(head);
    const hr = el('hr');
    hr.style.cssText = 'border:none;border-top:1px solid var(--border);margin:8px 0';
    cardEl.appendChild(hr);
    cardEl.appendChild(desc);
    cardEl.appendChild(effect);
    cardEl.appendChild(kv);
  }

  load();
})();
