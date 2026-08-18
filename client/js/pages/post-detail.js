// 帖子详情：正文 + 点赞/收藏 + 评论（楼中楼） + 作者/管理员操作
(function () {
  renderNav('');
  const postId = qs('id');
  const cardEl = document.getElementById('post-card');
  const commentsEl = document.getElementById('comments');
  const editorEl = document.getElementById('comment-editor');
  const countEl = document.getElementById('comment-count');

  if (!postId) { emptyState(cardEl, '未指定帖子'); return; }

  let post = null;
  let liked = false;
  let favorited = false;

  // ---------- 渲染主帖 ----------
  function renderCard(d) {
    post = d.post;
    liked = d.likedByMe;
    favorited = d.favoritedByMe;
    cardEl.innerHTML = '';

    const top = el('div', 'post-item-top');
    top.appendChild(categoryBadge(post.category));
    if (post.isTop) top.appendChild(el('span', 'mark mark-top', '置顶'));
    if (post.isEssence) top.appendChild(el('span', 'mark mark-essence', '精华'));
    if (post.status === 'hidden') top.appendChild(el('span', 'mark mark-top', '已隐藏'));

    const title = el('div', 'post-detail-title', post.title);

    const meta = el('div', 'post-detail-meta');
    if (post.author) {
      const chip = el('a', 'author-chip');
      chip.href = 'profile.html?id=' + post.author.id;
      chip.appendChild(avatarHtml(post.author));
      chip.appendChild(el('span', null, post.author.username));
      meta.appendChild(chip);
      meta.appendChild(realmBadge(post.author.realm, post.author.realmName));
    }
    meta.appendChild(el('span', null, fmtDateTime(post.createdAt)));
    meta.appendChild(el('span', null, '👁 ' + post.viewCount));

    const content = el('div', 'post-content', post.content);

    if (post.tags && post.tags.length) {
      const tags = el('div');
      post.tags.forEach((t) => tags.appendChild(el('span', 'tag', '#' + t)));
      meta.appendChild(tags);
    }

    const actions = el('div', 'post-actions');
    const likeBtn = el('button', 'btn btn-sm' + (liked ? ' btn-liked' : ''), (liked ? '♡ 已赞 ' : '♡ 点赞 ') + post.likeCount);
    likeBtn.onclick = async () => {
      if (!Auth.requireLogin()) return;
      const r = await api.post(`/posts/${postId}/like`);
      if (r.ok) {
        liked = r.data.liked;
        likeBtn.textContent = (liked ? '♡ 已赞 ' : '♡ 点赞 ') + r.data.likeCount;
        likeBtn.classList.toggle('btn-liked', liked);
      } else toast(r.message, 'error');
    };
    actions.appendChild(likeBtn);

    const favBtn = el('button', 'btn btn-sm' + (favorited ? ' btn-faved' : ''), favorited ? '★ 已收藏' : '☆ 收藏');
    favBtn.onclick = async () => {
      if (!Auth.requireLogin()) return;
      const r = await api.post(`/posts/${postId}/favorite`);
      if (r.ok) {
        favorited = r.data.favorited;
        favBtn.textContent = favorited ? '★ 已收藏' : '☆ 收藏';
        favBtn.classList.toggle('btn-faved', favorited);
        toast(favorited ? '已收入锦囊' : '已移出锦囊', 'success');
      } else toast(r.message, 'error');
    };
    actions.appendChild(favBtn);

    if (d.isOwner) {
      const editBtn = el('button', 'btn btn-sm', '编辑');
      editBtn.onclick = () => location.href = 'post-edit.html?id=' + postId;
      actions.appendChild(editBtn);
      const delBtn = el('button', 'btn btn-sm btn-danger', '删除');
      delBtn.onclick = async () => {
        if (!confirm('确认焚毁此帖？此举不可逆。')) return;
        const r = await api.del('/posts/' + postId);
        if (r.ok) { toast('帖子已焚毁', 'success'); location.href = 'index.html'; }
        else toast(r.message, 'error');
      };
      actions.appendChild(delBtn);
    }

    if (d.isAdmin) {
      const topBtn = el('button', 'btn btn-sm', post.isTop ? '取消置顶' : '置顶');
      topBtn.onclick = () => adminStatus({ isTop: !post.isTop });
      const essBtn = el('button', 'btn btn-sm', post.isEssence ? '取消精华' : '加精');
      essBtn.onclick = () => adminStatus({ isEssence: !post.isEssence });
      const hideBtn = el('button', 'btn btn-sm btn-danger', post.status === 'hidden' ? '取消隐藏' : '隐藏');
      hideBtn.onclick = () => adminStatus({ status: post.status === 'hidden' ? 'normal' : 'hidden' });
      actions.appendChild(topBtn);
      actions.appendChild(essBtn);
      actions.appendChild(hideBtn);
    }

    cardEl.appendChild(top);
    cardEl.appendChild(title);
    cardEl.appendChild(meta);
    cardEl.appendChild(content);
    cardEl.appendChild(actions);
  }

  async function adminStatus(body) {
    const r = await api.put(`/admin/posts/${postId}/status`, body);
    if (r.ok) { toast('已执行', 'success'); load(); }
    else toast(r.message, 'error');
  }

  // ---------- 评论 ----------
  function renderEditor() {
    editorEl.innerHTML = '';
    if (!Auth.isLoggedIn()) {
      const tip = el('div', 'form-hint');
      const a = el('a', null, '登录');
      a.href = 'login.html?from=' + encodeURIComponent(location.href);
      a.style.color = 'var(--accent)';
      tip.appendChild(document.createTextNode('道友尚未登录，'));
      tip.appendChild(a);
      tip.appendChild(document.createTextNode('方可参与论道。'));
      editorEl.appendChild(tip);
      return;
    }
    const ta = el('textarea', null);
    ta.placeholder = '畅所欲言（500 字内），发言可得修为……';
    ta.maxLength = 500;
    const btn = el('button', 'btn btn-primary', '留言');
    btn.style.marginTop = '8px';
    btn.onclick = async () => {
      const content = ta.value.trim();
      if (!content) return toast('评论不能为空', 'error');
      btn.disabled = true;
      const r = await api.post(`/posts/${postId}/comments`, { content });
      btn.disabled = false;
      if (!r.ok) return toast(r.message, 'error');
      ta.value = '';
      if (r.data.qiGained > 0) toast('灵气 +' + r.data.qiGained, 'exp');
      loadComments();
    };
    editorEl.appendChild(ta);
    editorEl.appendChild(btn);
  }

  function commentNode(c, replies, canDelete) {
    const item = el('div', 'comment-item');
    if (c.author) item.appendChild(avatarHtml(c.author));
    else item.appendChild(el('div', 'avatar avatar-fallback', '？'));

    const body = el('div', null);
    body.style.flex = '1';

    const head = el('div', 'comment-head');
    if (c.author) {
      const nameLink = el('a', null, c.author.username);
      nameLink.href = 'profile.html?id=' + c.author.id;
      nameLink.style.color = 'var(--text)';
      head.appendChild(nameLink);
      head.appendChild(realmBadge(c.author.realm, c.author.realmName));
    } else {
      head.appendChild(el('span', 'deleted-tip', '已注销'));
    }
    if (c.replyToUser) head.appendChild(el('span', null, '回复 @' + c.replyToUser.username));
    head.appendChild(el('span', null, timeAgo(c.createdAt)));
    body.appendChild(head);

    if (c.isDeleted) {
      body.appendChild(el('div', 'comment-content deleted-tip', '（此言已随风散去）'));
    } else {
      body.appendChild(el('div', 'comment-content', c.content));
    }

    const actions = el('div', 'comment-actions');
    if (Auth.isLoggedIn() && !c.isDeleted) {
      const reply = el('a', null, '回复');
      reply.href = 'javascript:void(0)';
      reply.onclick = () => openReply(c, item);
      actions.appendChild(reply);
    }
    const mine = Auth.userId() && c.author && String(c.author.id) === String(Auth.userId());
    if (!c.isDeleted && (mine || Auth.isAdmin())) {
      const del = el('a', null, '删除');
      del.href = 'javascript:void(0)';
      del.style.color = 'var(--danger)';
      del.onclick = async () => {
        if (!confirm('删除这条评论？')) return;
        const r = await api.del('/comments/' + c.id);
        if (r.ok) { toast('已删除', 'success'); loadComments(); loadCount(); }
        else toast(r.message, 'error');
      };
      actions.appendChild(del);
    }
    body.appendChild(actions);

    // 回复输入框（隐藏，点回复时展开）
    const replyBox = el('div', 'comment-input');
    replyBox.style.display = 'none';
    const rta = el('textarea', null);
    rta.placeholder = '回复 @' + ((c.author && c.author.username) || '') + '……';
    rta.maxLength = 500;
    const rbtn = el('button', 'btn btn-primary btn-sm', '回复');
    rbtn.style.marginTop = '6px';
    rbtn.onclick = async () => {
      const content = rta.value.trim();
      if (!content) return toast('回复不能为空', 'error');
      rbtn.disabled = true;
      const r = await api.post(`/posts/${postId}/comments`, {
        content,
        parentCommentId: c.parentComment || c.id // 楼中楼归并到顶级（后端亦有兜底）
      });
      rbtn.disabled = false;
      if (!r.ok) return toast(r.message, 'error');
      toast('回复成功', 'success');
      loadComments();
    };
    replyBox.appendChild(rta);
    replyBox.appendChild(rbtn);
    body.appendChild(replyBox);

    item.appendChild(body);
    return item;
  }

  function openReply(c, item) {
    const box = item.querySelector('.comment-input');
    box.style.display = '';
    box.querySelector('textarea').focus();
  }

  function renderComments(list) {
    commentsEl.innerHTML = '';
    const tops = list.filter((c) => !c.parentComment);
    const replies = list.filter((c) => c.parentComment);
    if (!tops.length) return emptyState(commentsEl, '尚无论道，虚位以待');

    const byId = {};
    tops.forEach((t) => { byId[t.id] = { comment: t, replies: [] }; });
    replies.forEach((r) => {
      const key = String(r.parentComment);
      if (byId[key]) byId[key].replies.push(r);
    });

    tops.forEach((t) => {
      const node = commentNode(t, byId[t.id].replies, true);
      const rl = el('div', 'reply-list');
      byId[t.id].replies.forEach((r) => rl.appendChild(commentNode(r, [], false)));
      if (byId[t.id].replies.length) node.appendChild(rl);
      commentsEl.appendChild(node);
    });
  }

  async function loadCount() {
    const r = await api.get('/posts/' + postId);
    if (r.ok) countEl.textContent = '（' + r.data.post.commentCount + ' 条）';
  }

  async function loadComments() {
    const r = await api.get(`/posts/${postId}/comments`);
    if (r.ok) renderComments(r.data.list);
  }

  async function load() {
    loadingState(cardEl, '灵力凝聚中……');
    const r = await api.get('/posts/' + postId);
    if (!r.ok) return emptyState(cardEl, r.message);
    renderCard(r.data);
    renderEditor();
    loadComments();
    loadCount();
  }

  load();
})();
