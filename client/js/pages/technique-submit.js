// 功法投稿 + 我的投稿列表
(function () {
  renderNav('techniques');
  if (!Auth.requireLogin()) return;

  const GRADE_CONFIG = {
    '黄阶': { rate: 1.05, price: 50, realm: '练气一层' },
    '玄阶': { rate: 1.10, price: 120, realm: '练气四层' },
    '地阶': { rate: 1.15, price: 300, realm: '练气七层' },
    '天阶': { rate: 1.25, price: 800, realm: '筑基期' },
    '仙阶': { rate: 1.40, price: 2000, realm: '化神期' }
  };
  const TYPES = ['心法', '剑法', '刀法', '身法', '丹道', '器道', '阵法', '杂学'];
  const ELEMENTS = ['金', '木', '水', '火', '土', '雷', '冰', '风', '无'];

  const gradeSel = document.getElementById('grade');
  const typeSel = document.getElementById('type');
  const elementSel = document.getElementById('element');
  const diffSel = document.getElementById('difficulty');
  const previewEl = document.getElementById('grade-preview');
  const myEl = document.getElementById('my-submissions');

  Object.entries(GRADE_CONFIG).forEach(([g, cfg]) => {
    const o = el('option', null, g);
    o.value = g;
    o.dataset.cfg = JSON.stringify(cfg);
    gradeSel.appendChild(o);
  });
  TYPES.forEach((t) => { const o = el('option', null, t); o.value = t; typeSel.appendChild(o); });
  ELEMENTS.forEach((e) => { const o = el('option', null, e); o.value = e; elementSel.appendChild(o); });
  for (let i = 1; i <= 5; i++) {
    const o = el('option', null, '★'.repeat(i));
    o.value = i;
    diffSel.appendChild(o);
  }
  diffSel.value = '3';

  function updatePreview() {
    const cfg = GRADE_CONFIG[gradeSel.value];
    if (cfg) {
      previewEl.textContent = `${gradeSel.value}将生成：修为加成 +${Math.round((cfg.rate - 1) * 100)}% · 兑换价 ◇${cfg.price} · 需境界 ${cfg.realm}`;
    }
  }
  gradeSel.addEventListener('change', updatePreview);
  updatePreview();

  document.getElementById('submit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: document.getElementById('name').value.trim(),
      type: typeSel.value,
      grade: gradeSel.value,
      element: elementSel.value,
      description: document.getElementById('description').value.trim(),
      effect: document.getElementById('effect').value.trim(),
      difficulty: parseInt(diffSel.value, 10),
      coverImage: document.getElementById('coverImage').value.trim()
    };
    if (!body.name || !body.description || !body.effect) return toast('请填写功法名、描述和效果', 'error');

    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = '提交中……';
    const r = await api.post('/techniques', body);
    btn.disabled = false;
    btn.textContent = '提交审核';
    if (!r.ok) return toast(r.message, 'error');

    toast('投稿成功，等待长老审核', 'success');
    e.target.reset();
    diffSel.value = '3';
    updatePreview();
    loadMine();
  });

  const STATUS_LABEL = { pending: ['status-pending', '待审核'], approved: ['status-approved', '已上架'], rejected: ['status-rejected', '已驳回'] };

  async function loadMine() {
    loadingState(myEl, '……');
    const r = await api.get('/techniques?mine=1&limit=50');
    if (!r.ok) return emptyState(myEl, r.message);
    myEl.innerHTML = '';
    if (!r.data.list.length) return emptyState(myEl, '还没有投稿记录');
    r.data.list.forEach((t) => {
      const row = el('div', null);
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bg-soft);flex-wrap:wrap';
      const link = el('a', null, t.name);
      link.href = 'technique-detail.html?id=' + t.id;
      link.style.cssText = 'font-weight:600;flex:1;min-width:120px';
      row.appendChild(gradeBadge(t.grade));
      row.appendChild(link);
      const st = STATUS_LABEL[t.status] || ['', t.status];
      const stEl = el('span', st[0], st[1]);
      stEl.style.fontSize = '13px';
      row.appendChild(stEl);
      row.appendChild(el('span', 'form-hint', timeAgo(t.createdAt)));
      if (t.status === 'rejected' && t.rejectReason) {
        const reason = el('div', 'form-hint status-rejected', '驳回原因：' + t.rejectReason);
        reason.style.cssText = 'width:100%;font-size:12px';
        row.appendChild(reason);
      }
      myEl.appendChild(row);
    });
  }

  loadMine();
})();
