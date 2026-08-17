// 管理后台：统计 + 功法审核 + 帖子管理
(function () {
  renderNav('');
  if (!Auth.requireLogin() || !Auth.isAdmin()) {
    emptyState(document.getElementById('tab-content'), '此地乃执事洞府，闲人免进');
    return;
  }

  const statsEl = document.getElementById('stats');
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('tab-content');
  let activeTab = 'review';

  async function loadStats() {
    const r = await api.get('/admin/stats');
    if (!r.ok) return;
    statsEl.innerHTML = '';
    const items = [
      [r.data.userCount, '道友'],
      [r.data.postCount, '帖子'],
      [r.data.commentCount, '评论'],
      [r.data.pendingCount, '待审核功法']
    ];
    items.forEach(([num, label]) => {
      const b = el('div', 'stat-box');
      b.appendChild(el('div', 'stat-num', String(num)));
      b.appendChild(el('div', 'stat-label', label));
      statsEl.appendChild(b);
    });
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    [['review', '功法审核'], ['posts', '帖子管理']].forEach(([key, label]) => {
      const t = el('div', 'tab' + (activeTab === key ? ' active' : ''), label);
      t.onclick = () => { activeTab = key; renderTabs(); loadTab(); };
      tabsEl.appendChild(t);
    });
  }

  // ---------- 功法审核 ----------
  let reviewFilter = 'pending';
  async function loadReview() {
    loadingState(contentEl, '……');
    const r = await api.get(`/admin/techniques?status=${reviewFilter}&limit=30`);
    if (!r.ok) return emptyState(contentEl, r.message);
    contentEl.innerHTML = '';

    const bar = el('div', 'filter-bar');
    [['pending', '待审核'], ['approved', '已上架'], ['rejected', '已驳回']].forEach(([k, l]) => {
      const b = el('button', 'filter-tab' + (reviewFilter === k ? ' active' : ''), l);
      b.onclick = () => { reviewFilter = k; loadReview(); };
      bar.appendChild(b);
    });
    contentEl.appendChild(bar);

    if (!r.data.list.length) return contentEl.appendChild(el('div', 'empty', '暂无内容'));

    const table = el('table', 'admin-table');
    const thead = el('thead');
    const hrow = el('tr');
    ['功法', '品阶/类型', '投稿人', '时间', '操作'].forEach((h) => hrow.appendChild(el('th', null, h)));
    thead.appendChild(hrow);
    table.appendChild(thead);
    const tbody = el('tbody');

    r.data.list.forEach((t) => {
      const row = el('tr');

      const nameTd = el('td');
      const link = el('a', null, t.name);
      link.href = 'technique-detail.html?id=' + t.id;
      link.style.color = 'var(--accent)';
      nameTd.appendChild(link);
      const desc = el('div', 'form-hint', (t.description || '').slice(0, 40) + '…');
      nameTd.appendChild(desc);
      row.appendChild(nameTd);

      const gt = el('td');
      const gtBox = el('div', null);
      gtBox.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap';
      gtBox.appendChild(gradeBadge(t.grade));
      gtBox.appendChild(el('span', 'tag', t.type));
      gt.appendChild(gtBox);
      row.appendChild(gt);

      const st = el('td', null, t.submitter ? t.submitter.username : '—');
      row.appendChild(st);

      row.appendChild(el('td', null, timeAgo(t.createdAt)));

      const opTd = el('td');
      const ops = el('div', 'admin-actions');
      if (t.status === 'pending') {
        const okBtn = el('button', 'btn btn-sm btn-jade', '通过');
        okBtn.onclick = async () => {
          const res = await api.put(`/admin/techniques/${t.id}/review`, { action: 'approve' });
          if (res.ok) { toast('已上架', 'success'); loadReview(); loadStats(); }
          else toast(res.message, 'error');
        };
        const noBtn = el('button', 'btn btn-sm btn-danger', '驳回');
        noBtn.onclick = async () => {
          const reason = prompt('请输入驳回原因：');
          if (!reason) return;
          const res = await api.put(`/admin/techniques/${t.id}/review`, { action: 'reject', rejectReason: reason });
          if (res.ok) { toast('已驳回', 'success'); loadReview(); loadStats(); }
          else toast(res.message, 'error');
        };
        ops.appendChild(okBtn);
        ops.appendChild(noBtn);
      } else {
        const label = t.status === 'approved' ? '已上架' : '已驳回';
        const s = el('span', 'status-' + t.status, label);
        s.style.fontSize = '12.5px';
        ops.appendChild(s);
      }
      opTd.appendChild(ops);
      row.appendChild(opTd);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    contentEl.appendChild(table);
  }

  // ---------- 帖子管理 ----------
  async function loadPosts() {
    loadingState(contentEl, '……');
    const r = await api.get('/posts?limit=30');
    if (!r.ok) return emptyState(contentEl, r.message);
    // 管理视图需要看到 hidden 帖子 —— /posts 只返回 normal，这里混入详情信息足够管理 normal 帖
    contentEl.innerHTML = '';
    if (!r.data.list.length) return contentEl.appendChild(el('div', 'empty', '暂无帖子'));

    const table = el('table', 'admin-table');
    const thead = el('thead');
    const hrow = el('tr');
    ['标题', '作者', '数据', '状态', '操作'].forEach((h) => hrow.appendChild(el('th', null, h)));
    thead.appendChild(hrow);
    table.appendChild(thead);
    const tbody = el('tbody');

    r.data.list.forEach((p) => {
      const row = el('tr');

      const titleTd = el('td');
      const link = el('a', null, (p.isTop ? '[顶] ' : '') + (p.isEssence ? '[精] ' : '') + p.title);
      link.href = 'post-detail.html?id=' + p.id;
      link.style.color = 'var(--text)';
      titleTd.appendChild(link);
      row.appendChild(titleTd);

      row.appendChild(el('td', null, p.author ? p.author.username : '—'));

      const stat = el('td', null, '♡' + p.likeCount + ' ✎' + p.commentCount + ' 👁' + p.viewCount);
      stat.style.fontSize = '12px';
      row.appendChild(stat);

      const stTd = el('td');
      const st = el('span', p.status === 'hidden' ? 'status-hidden' : 'status-approved', p.status === 'hidden' ? '已隐藏' : '正常');
      stTd.appendChild(st);
      row.appendChild(stTd);

      const opTd = el('td');
      const ops = el('div', 'admin-actions');
      const topBtn = el('button', 'btn btn-sm', p.isTop ? '取消置顶' : '置顶');
      topBtn.onclick = () => setPost(p.id, { isTop: !p.isTop });
      const essBtn = el('button', 'btn btn-sm', p.isEssence ? '取消精华' : '加精');
      essBtn.onclick = () => setPost(p.id, { isEssence: !p.isEssence });
      const hideBtn = el('button', 'btn btn-sm btn-danger', p.status === 'hidden' ? '恢复' : '隐藏');
      hideBtn.onclick = () => setPost(p.id, { status: p.status === 'hidden' ? 'normal' : 'hidden' });
      ops.appendChild(topBtn);
      ops.appendChild(essBtn);
      ops.appendChild(hideBtn);
      opTd.appendChild(ops);
      row.appendChild(opTd);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    contentEl.appendChild(table);
  }

  async function setPost(id, body) {
    const res = await api.put(`/admin/posts/${id}/status`, body);
    if (res.ok) { toast('已执行', 'success'); loadPosts(); }
    else toast(res.message, 'error');
  }

  function loadTab() {
    if (activeTab === 'review') loadReview();
    else loadPosts();
  }

  loadStats();
  renderTabs();
  loadTab();
})();
