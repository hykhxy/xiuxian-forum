// 战场（第17轮）：战争列表 + 详情（武斗战报回放动画 / 文斗问答·投票·计分板）
(function () {
  renderNav('battlefield');
  const listEl = document.getElementById('war-list');
  const detailEl = document.getElementById('war-detail');
  const warId = qs('id');

  /* ---------- 列表 ---------- */
  function renderWarItem(w) {
    const card = el('a', 'card war-item');
    card.href = 'battlefield.html?id=' + w.id;
    const head = el('div', 'war-item-head');
    head.appendChild(el('span', 'badge ' + (w.warType === '武斗' ? 'mark-top' : 'cat-ask'), w.warType));
    const resultBadge = w.status === '已结束'
      ? el('span', 'badge ' + (w.result === 'draw' ? 'realm-0' : 'realm-4'),
          w.result === 'draw' ? '平局' : (w.result === 'attacker' ? '攻方胜' : '守方胜'))
      : el('span', 'badge realm-1', w.status);
    head.appendChild(resultBadge);
    card.appendChild(head);
    card.appendChild(el('div', 'war-vs', `${w.attacker.name}  ${w.status === '已结束' ? w.score.attacker + ':' + w.score.defender : 'vs'}  ${w.defender.name}`));
    card.appendChild(el('div', 'sect-meta', timeAgo(w.createdAt)));
    return card;
  }

  async function loadList() {
    loadingState(listEl, '……');
    const r = await api.get('/wars');
    if (!r.ok) return emptyState(listEl, r.message);
    listEl.innerHTML = '';
    if (!r.data.list.length) return emptyState(listEl, '烽烟未起，天下太平');
    r.data.list.forEach((w) => listEl.appendChild(renderWarItem(w)));
  }

  /* ---------- 详情 ---------- */
  const RESULT_TXT = { attacker: '攻方胜', defender: '守方胜', draw: '平局' };

  function memberCard(t, side) {
    const c = el('div', 'war-member ' + side);
    if (!t || !t.user) {
      c.appendChild(el('div', 'war-member-name muted', '（虚位）'));
      return c;
    }
    c.appendChild(el('div', 'war-member-pos', t.position));
    c.appendChild(el('div', 'war-member-name', t.username));
    const stats = el('div', 'war-member-stats');
    stats.appendChild(el('span', null, `攻${t.total.atk}`));
    stats.appendChild(el('span', null, `防${t.total.def}`));
    stats.appendChild(el('span', null, `血${t.total.hp}`));
    c.appendChild(stats);
    return c;
  }

  function renderBattleRow(b, i) {
    const row = el('div', 'war-battle-row');
    row.appendChild(el('span', 'war-battle-pos', `第${i + 1}场·${b.position}`));
    const badge = b.winner === 'attacker' ? el('span', 'badge realm-4', '攻方胜')
      : b.winner === 'defender' ? el('span', 'badge mark-top', '守方胜')
      : el('span', 'badge realm-0', '平');
    row.appendChild(badge);
    if (b.timeout) row.appendChild(el('span', 'form-hint', '超时判定'));
    if (b.rounds[0] && b.rounds[0].forfeit) row.appendChild(el('span', 'form-hint', '对方虚位'));

    // 播放按钮（有回合日志时）
    if (b.rounds.length > 1) {
      const play = el('button', 'btn btn-sm', '播放战报');
      play.onclick = () => playBattle(b, row);
      row.appendChild(play);
    }
    const hpTrack = el('div', 'war-hp-track');
    hpTrack.style.display = 'none';
    row.appendChild(hpTrack);
    return row;
  }

  // 战报回放：逐回合扣减血条
  function playBattle(b, row) {
    const track = row.querySelector('.war-hp-track');
    track.style.display = '';
    track.innerHTML = '';
    const aBar = mkBar('攻'), dBar = mkBar('守');
    track.appendChild(aBar.wrap); track.appendChild(dBar.wrap);
    let i = 0;
    const timer = setInterval(() => {
      if (i >= b.rounds.length) {
        clearInterval(timer);
        track.appendChild(el('div', 'form-hint', `战毕：${RESULT_TXT[b.winner] || '平'}（${b.rounds.length} 回合）`));
        return;
      }
      const r = b.rounds[i++];
      aBar.set(r.hpA); dBar.set(r.hpB);
      track.appendChild(el('div', 'form-hint', `第${i}手 ${r.by} 出招 → 伤 ${r.dmg}`));
    }, 350);
  }
  function mkBar(label) {
    const wrap = el('div', 'war-hp-bar-wrap');
    wrap.appendChild(el('span', 'war-hp-label', label));
    const bar = el('div', 'war-hp-bar');
    const inner = el('div', 'war-hp-inner');
    bar.appendChild(inner);
    wrap.appendChild(bar);
    let max = null;
    return {
      wrap,
      set(hp) {
        if (max === null) max = hp || 1;
        inner.style.width = Math.max(0, Math.round((hp / max) * 100)) + '%';
        inner.textContent = hp;
      }
    };
  }

  // 文斗面板
  function renderDebate(d, war) {
    const box = el('div', 'card war-debate');
    box.appendChild(el('div', 'kv-label', `文斗 · 第 ${d.roundIndex} / 5 轮`));
    box.appendChild(el('div', 'war-score', `${war.attacker.name} ${war.score.attacker} : ${war.score.defender} ${war.defender.name}`));

    if (d.phase === 'question') {
      if (d.canAsk) {
        box.appendChild(el('div', 'form-hint', `本轮由${d.askingSide === 'attacker' ? '攻方' : '守方'}提问（修仙相关，300字内）`));
        const ta = el('textarea'); ta.maxLength = 300;
        box.appendChild(ta);
        const go = el('button', 'btn btn-primary btn-sm', '出 题');
        go.onclick = async () => {
          const r = await api.post(`/wars/${war.id}/question`, { question: ta.value.trim() });
          if (!r.ok) return toast(r.message, 'error');
          toast('题目已出', 'success'); loadDetail();
        };
        box.appendChild(go);
      } else {
        box.appendChild(el('div', 'form-hint', `等待${d.askingSide === 'attacker' ? '攻方' : '守方'}出题……`));
      }
    } else if (d.phase === 'answer') {
      box.appendChild(el('div', 'war-question', '问：' + d.question));
      if (d.canAnswer) {
        const ta = el('textarea'); ta.maxLength = 1000;
        box.appendChild(ta);
        const go = el('button', 'btn btn-primary btn-sm', '作 答');
        go.onclick = async () => {
          const r = await api.post(`/wars/${war.id}/answer`, { answer: ta.value.trim() });
          if (!r.ok) return toast(r.message, 'error');
          toast('答案已提交，待评委判定', 'success'); loadDetail();
        };
        box.appendChild(go);
      } else {
        box.appendChild(el('div', 'form-hint', '等待对方作答……'));
      }
    } else if (d.phase === 'vote') {
      box.appendChild(el('div', 'war-question', '问：' + d.question));
      box.appendChild(el('div', null, '答：' + d.answer));
      box.appendChild(el('div', 'form-hint', `评委判定 ${d.votes} / 4 票`));
      if (d.canVote) {
        const row = el('div', 'war-vote-row');
        const pass = el('button', 'btn btn-jade btn-sm', '合格');
        pass.onclick = () => doVote(true);
        const fail = el('button', 'btn btn-danger btn-sm', '不合格');
        fail.onclick = () => doVote(false);
        row.appendChild(pass); row.appendChild(fail);
        box.appendChild(row);
        box.appendChild(el('div', 'form-hint', '评委须知：你非交战宗门弟子，方可执评'));
      } else if (d.myVote !== null) {
        box.appendChild(el('div', 'form-hint', `你已投票（${d.myVote ? '合格' : '不合格'}），等待其余评委…`));
      } else {
        box.appendChild(el('div', 'form-hint', '等待四位评委投票……'));
      }
    }

    // 历史轮
    if (war.warType === '文斗' && war.rounds && war.rounds.some((r) => r.winner)) {
      war.rounds.forEach((r, i) => {
        if (!r.winner) return;
        const row = el('div', 'war-battle-row');
        row.appendChild(el('span', 'war-battle-pos', `第${i + 1}轮`));
        row.appendChild(el('span', 'badge ' + (r.passed ? 'realm-1' : 'mark-top'), r.passed ? '答题合格' : '未过关'));
        if (r.question) row.appendChild(el('span', 'form-hint', r.question.slice(0, 20) + (r.question.length > 20 ? '…' : '')));
        box.appendChild(row);
      });
    }
    return box;

    async function doVote(pass_) {
      const r = await api.post(`/wars/${war.id}/vote`, { pass: pass_ });
      if (!r.ok) return toast(r.message, 'error');
      toast(r.data.passed === null ? '已投票，等待其余评委' : (r.data.passed ? '本轮判定：合格！' : '本轮判定：未过关'), 'success');
      loadDetail();
    }
  }

  async function loadDetail() {
    loadingState(detailEl, '……');
    const r = await api.get('/wars/' + warId);
    if (!r.ok) return emptyState(detailEl, r.message);
    const war = r.data.war;
    detailEl.innerHTML = '';

    // 头部
    const head = el('div', 'card');
    const hb = el('div', 'war-item-head');
    hb.appendChild(el('span', 'badge ' + (war.warType === '武斗' ? 'mark-top' : 'cat-ask'), war.warType));
    hb.appendChild(el('span', 'badge realm-1', war.status));
    if (war.result) hb.appendChild(el('span', 'badge realm-4', RESULT_TXT[war.result]));
    head.appendChild(hb);
    head.appendChild(el('div', 'war-vs war-vs-big', `${war.attacker.name}  ${war.status === '已结束' ? war.score.attacker + ':' + war.score.defender : 'vs'}  ${war.defender.name}`));

    // 阵容对比
    const teams = el('div', 'war-teams');
    const colA = el('div', 'war-team-col'), colB = el('div', 'war-team-col');
    colA.appendChild(el('div', 'kv-label', `攻方 · ${war.attacker.name}`));
    colB.appendChild(el('div', 'kv-label', `守方 · ${war.defender.name}`));
    war.attackerTeam.forEach((t, i) => {
      colA.appendChild(memberCard(t, 'a'));
      colB.appendChild(memberCard(war.defenderTeam[i], 'b'));
    });
    teams.appendChild(colA); teams.appendChild(colB);
    head.appendChild(teams);

    // 武斗：开战 / 战报
    if (war.warType === '武斗') {
      if (r.data.war.canStart) {
        const go = el('button', 'btn btn-danger', '下 令 开 战');
        go.onclick = async () => {
          if (!confirm('两军对垒，一触即发！确认开战？')) return;
          const res = await api.post(`/wars/${warId}/start`);
          if (!res.ok) return toast(res.message, 'error');
          toast(`战毕！${res.data.score.attacker}:${res.data.score.defender}（${RESULT_TXT[res.data.result]}）`, 'exp');
          loadDetail();
        };
        head.appendChild(go);
      }
      if (war.battles && war.battles.length) {
        const list = el('div', null);
        war.battles.forEach((b, i) => list.appendChild(renderBattleRow(b, i)));
        head.appendChild(list);
      }
    }

    detailEl.appendChild(head);

    // 文斗面板
    if (war.warType === '文斗' && war.status === '进行中' && r.data.debate) {
      detailEl.appendChild(renderDebate(r.data.debate, war));
    }
  }

  function load() {
    if (warId) { listEl.style.display = 'none'; loadDetail(); }
    else { detailEl.style.display = 'none'; loadList(); }
  }
  load();
})();
