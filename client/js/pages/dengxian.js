// 登仙 · 闭关修行（自个人中心完整迁移；挂机 API 与逻辑不变，仅迁移 UI）
(function () {
  renderNav('dengxian');
  sprinkleFireflies();

  // 权限控制：未登录自动跳回山门首页
  if (!Auth.isLoggedIn()) {
    toast('尚未入道，先去山门拜入仙门吧', 'error');
    location.replace('index.html');
    return;
  }

  const cultCard = document.getElementById('cultivation-card');
  let cultTimer = null;
  let cultData = null; // 最近一次 status，供按钮上下文使用

  async function loadCultivation() {
    const r = await api.get('/cultivation/status');
    if (!r.ok) return;
    cultData = r.data;
    renderCultivation(r.data);
    clearTimeout(cultTimer);
    // 挂机中每 5s 刷新（纯 transform/opacity 动画不受影响，持续运行）
    if (r.data.isIdling) cultTimer = setTimeout(loadCultivation, 5000);
  }

  function renderCultivation(d) {
    cultCard.innerHTML = '';
    // 重挂面板萤火（innerHTML 清空后）
    cultCard.appendChild(el('i', 'ff'));
    cultCard.appendChild(el('i', 'ff'));

    const head = el('div', 'checkin-box');
    const left = el('div');
    const title = el('div', 'dx-card-title', '闭 关');
    left.appendChild(title);
    const tip = el('div', 'page-sub');
    tip.textContent = d.isIdling
      ? '吐纳中… ' + d.idleRatePerMinute + ' 灵气/分钟（' + d.realm.name + '）'
      : '未在挂机 · ' + d.realm.name + ' 挂机速率 ' + d.idleRatePerMinute + ' 灵气/分钟';
    left.appendChild(tip);
    if (d.justSettled > 0) {
      const gain = el('div', 'form-hint', '本次访问结算灵气 +' + d.justSettled);
      gain.style.color = 'var(--jade-ink)';
      left.appendChild(gain);
    }
    head.appendChild(left);

    const idleBtn = el('button', 'btn ' + (d.isIdling ? 'btn-danger' : 'btn-jade'), d.isIdling ? '出关（结算灵气）' : '开始挂机');
    idleBtn.onclick = async () => {
      idleBtn.disabled = true;
      const r = d.isIdling
        ? await api.post('/cultivation/idle/stop')
        : await api.post('/cultivation/idle/start');
      if (!r.ok) { idleBtn.disabled = false; return toast(r.message, 'error'); }
      if (d.isIdling) {
        toast('出关：' + r.data.durationMinutes + ' 分钟收获灵气 +' + r.data.gained, 'exp');
      } else {
        toast('开始吐纳，灵气将随时间累积', 'success');
      }
      loadCultivation();
    };
    head.appendChild(idleBtn);
    cultCard.appendChild(head);

    // 灵气进度 + 突破
    const pw = el('div', 'progress-wrap');
    if (d.breakthrough) {
      const pct = Math.min(Math.round((d.qi / d.breakthrough.cost) * 100), 100);
      const bar = el('div', 'progress-bar');
      const inner = el('div', 'progress-inner');
      inner.style.width = pct + '%';
      bar.appendChild(inner);
      pw.appendChild(bar);
      const pt = el('div', 'progress-text');
      pt.appendChild(el('span', null, '灵气 ' + d.qi + ' / ' + d.breakthrough.cost));
      pt.appendChild(el('span', null, d.realm.name + ' → ' + d.breakthrough.toRealm + '（' + pct + '%）'));
      pw.appendChild(pt);

      const row = el('div', null);
      row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap';
      const btBtn = el('button', 'btn btn-primary', '一键突破 ' + d.realm.name + ' → ' + d.breakthrough.toRealm);
      if (d.qi < d.breakthrough.cost) btBtn.disabled = true;
      btBtn.onclick = async () => {
        if (!confirm('消耗 ' + d.breakthrough.cost + ' 灵气尝试突破？\n成功率 ' + Math.round(d.breakthrough.successRate * 100) + '%，失败损失 ' + d.breakthrough.failLoss + ' 灵气')) return;
        btBtn.disabled = true;
        const r = await api.post('/cultivation/breakthrough');
        btBtn.disabled = false;
        if (!r.ok) return toast(r.message, 'error');
        if (r.data.success) toast(r.data.message, 'exp');
        else toast(r.data.message, 'error');
        loadCultivation();
      };
      row.appendChild(btBtn);
      row.appendChild(el('span', 'form-hint',
        '成功率 ' + Math.round(d.breakthrough.successRate * 100) + '% · 失败损 ' + d.breakthrough.failLoss));
      pw.appendChild(row);
    } else {
      const pt = el('div', 'progress-text');
      pt.appendChild(el('span', null, '灵气 ' + d.qi));
      pt.appendChild(el('span', null, '已至渡劫，修为圆满'));
      pw.appendChild(pt);
    }
    cultCard.appendChild(pw);
    sprinkleFireflies(cultCard);
  }

  loadCultivation();
})();
