// 发帖 / 编辑帖子
(function () {
  renderNav('post-edit');
  if (!Auth.requireLogin()) return;

  const editId = qs('id');
  const titleInput = document.getElementById('title');
  const contentInput = document.getElementById('content');
  const categorySelect = document.getElementById('category');
  const tagsInput = document.getElementById('tags');
  const submitBtn = document.getElementById('submit-btn');
  const countEl = document.getElementById('char-count');

  // 板块选项（公告仅管理员）
  Object.entries(CATEGORIES).forEach(([key, label]) => {
    if (key === 'announce' && !Auth.isAdmin()) return;
    const opt = el('option', null, label);
    opt.value = key;
    categorySelect.appendChild(opt);
  });

  function updateCount() {
    countEl.textContent = contentInput.value.length + ' / 10000';
  }
  contentInput.addEventListener('input', updateCount);

  // 编辑模式：加载原帖
  if (editId) {
    document.getElementById('page-title').textContent = '编辑帖子';
    document.getElementById('page-sub').textContent = '';
    (async () => {
      const r = await api.get('/posts/' + editId);
      if (!r.ok) { toast(r.message, 'error'); return location.href = 'index.html'; }
      if (!r.data.isOwner) { toast('只能编辑自己的帖子', 'error'); return location.href = 'post-detail.html?id=' + editId; }
      const p = r.data.post;
      titleInput.value = p.title;
      contentInput.value = p.content;
      categorySelect.value = p.category;
      tagsInput.value = (p.tags || []).join(', ');
      updateCount();
    })();
  }

  document.getElementById('post-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const category = categorySelect.value;
    const tags = tagsInput.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean).slice(0, 5);

    if (!title) return toast('标题不能为空', 'error');
    if (!content) return toast('正文不能为空', 'error');

    submitBtn.disabled = true;
    submitBtn.textContent = editId ? '保存中……' : '发布中……';
    const body = { title, content, category, tags };

    const r = editId
      ? await api.put('/posts/' + editId, body)
      : await api.post('/posts', body);

    submitBtn.disabled = false;
    submitBtn.textContent = editId ? '保存' : '发布';
    if (!r.ok) return toast(r.message, 'error');

    if (!editId && r.data.qiGained > 0) toast('发布成功，灵气 +' + r.data.qiGained, 'exp');
    else toast('已保存', 'success');
    location.href = 'post-detail.html?id=' + (editId || r.data.post.id);
  });
})();
