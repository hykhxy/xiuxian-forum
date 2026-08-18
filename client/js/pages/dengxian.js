// 登仙 · 闭关修行（第7轮：自个人主页迁移至此；API 与定时器逻辑不变）
(function () {
  renderNav('dengxian');

  // 权限控制：未登录自动跳回山门
  if (!Auth.isLoggedIn()) {
    toast('入山门者方可登仙，请先登录', 'error');
    location.href = 'index.html';
    return;
  }

  const cultCard = document.getElementById('cultivation-card');
  const stepsEl = document.getElementById('realm-steps');

  // ---------- 修行状态 ----------
  let cultTimer = null;
  let current = null;      // 最近一次 status 数据（用于实时跳动）

  async function loadCultivation() {
    const r = await api.get('/cultivation/status');
    if (!r.ok) return;
    current = r.data;
    renderCultivation(r.data);
    renderRealmSteps(r.data.realm.level);
    clearTimeout(cultTimer);
    // 挂机中每 5s 与后端对账一次（访问即结算，不打断挂机）
    if (r.data.isIdling) cultTimer = setTimeout(loadCultivation, 5000);
  }

  // 灵气数字实时跳动：按速率纯前端累加展示（不调 API，5s 对账自动校正）
  let tickTimer = null;
  function startTicker() {
    clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (!current || !current.isIdling) return;
      const numEl = document.getElementById('dx-qi-num');
      const barEl = document.getElementById('dx-qi-bar');
      if (!numEl) return;
      current.qi += current.idleRatePerMinute / 60;
      numEl.textContent = Math.floor(current.qi);
      if (barEl && current.breakthrough) {
        barEl.style.width = Math.min((current.qi / current.breakthrough.cost) * 100, 100) + '%';
      }
    }, 1000);
  }

  function renderCultivation(d) {
    cultCard.innerHTML = '';

    const head = el('div', 'checkin-box');
    const left = el('div');
    const title = el('div', 'dx-panel-title');
    title.textContent = d.isIdling ? '吐纳中 · ' + d.realm.name : '静室 · ' + d.realm.name;
    left.appendChild(title);
    const tip = el('div', 'page-sub');
    tip.textContent = d.isIdling
      ? '云雾为帐，星斗为灯 · ' + d.idleRatePerMinute + ' 灵气/分钟'
      : '未在挂机 · ' + d.realm.name + ' 速率 ' + d.idleRatePerMinute + ' 灵气/分钟';
    left.appendChild(tip);
    if (d.justSettled > 0) {
      left.appendChild(el('div', 'form-hint', '（步入此地，自动收获灵气 +' + d.justSettled + '）'));
    }
    head.appendChild(left);

    // 灵气大数
    const qiBox = el('div', 'dx-qi-box');
    const qiNum = el('div', 'dx-qi-num');
    qiNum.id = 'dx-qi-num';
    qiNum.textContent = d.qi;
    qiBox.appendChild(qiNum);
    qiBox.appendChild(el('div', 'stat-label', '灵气'));
    head.appendChild(qiBox);

    const idleBtn = el('button', 'btn ' + (d.isIdling ? 'btn-danger' : 'btn-jade'), d.isIdling ? '出关（结算灵气）' : '闭关挂机');
    idleBtn.onclick = async () => {
      idleBtn.disabled = true;
      const stopping = d.isIdling;
      const r = stopping
        ? await api.post('/cultivation/idle/stop')
        : await api.post('/cultivation/idle/start');
      if (!r.ok) { idleBtn.disabled = false; return toast(r.message, 'error'); }
      if (stopping) {
        toast('出关：' + r.data.durationMinutes + ' 分钟收获灵气 +' + r.data.gained, 'exp');
      } else {
        toast('闭关开始，云深之处灵气自聚', 'success');
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
      inner.id = 'dx-qi-bar';
      inner.style.width = pct + '%';
      bar.appendChild(inner);
      pw.appendChild(bar);
      const pt = el('div', 'progress-text');
      pt.appendChild(el('span', null, '灵气 ' + d.qi + ' / ' + d.breakthrough.cost));
      pt.appendChild(el('span', null, d.realm.name + ' → ' + d.breakthrough.toRealm + '（' + pct + '%）'));
      pw.appendChild(pt);

      const row = el('div', 'dx-bt-row');
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

    startTicker();
  }

  // ---------- 仙途八境长阶 ----------
  function renderRealmSteps(currentLevel) {
    stepsEl.innerHTML = '';
    const RATES = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
    REALM_NAMES.forEach((name, i) => {
      const lv = i + 1;
      const step = el('div', 'dx-step' + (lv === currentLevel ? ' current' : '') + (lv < currentLevel ? ' passed' : ''));
      step.appendChild(el('span', 'dx-step-name', name));
      step.appendChild(el('span', 'dx-step-rate', RATES[i] + '/分'));
      if (lv === currentLevel) step.appendChild(el('i', 'dx-step-mark'));
      stepsEl.appendChild(step);
    });
  }

  loadCultivation();
})();
