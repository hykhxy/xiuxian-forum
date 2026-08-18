// 山门主页：宗门标语 + 功能卡片（论道台/藏经阁/修炼室/天机阁/执事堂）
(function () {
  renderNav('index');
  const grid = document.getElementById('palace-grid');

  const CARDS = [
    { key: 'lundaotai', glyph: '论', name: '论道台', href: 'posts.html', desc: '问道、感悟、杂谈与交易，万千道友在此坐而论道。', stat: '灵气涌动 · 发帖得灵气' },
    { key: 'cangjingge', glyph: '经', name: '藏经阁', href: 'techniques.html', desc: '黄玄地天仙五品功法尽收于此，抽取兑换，皆可修行。', stat: '功法典籍 · 天机抽取' },
    { key: 'dengxian', glyph: '仙', name: '登仙', href: 'dengxian.html', desc: '云雾为帐闭关挂机，聚灵气，破境界，一朝登仙。', stat: '闭关 · 挂机 · 突破' },
    { key: 'dongfu', glyph: '府', name: '洞府', href: 'profile.html', desc: '签到日历、功法背包、收藏与道友资料，皆归洞府。', stat: '签到 · 背包 · 收藏' }
  ];
  if (Auth.isAdmin()) {
    CARDS.push({ key: 'zhishitang', glyph: '执', name: '执事堂', href: 'admin.html', desc: '功法审核、帖子置顶加精、洞府诸事治理。', stat: '管理员专用' });
  }

  function renderCard(c) {
    const a = el('a', 'palace-card');
    a.href = c.href;

    const name = el('div', 'palace-name');
    name.appendChild(el('span', 'glyph', c.glyph));
    name.appendChild(el('span', null, c.name));

    a.appendChild(name);
    a.appendChild(el('div', 'palace-desc', c.desc));
    a.appendChild(el('div', 'palace-stat', '❖ ' + c.stat));
    return a;
  }

  // 实时统计（游客亦可看；失败静默）
  async function decorate() {
    try {
      const [posts, techs] = await Promise.all([
        api.get('/posts?limit=1'),
        api.get('/techniques?limit=1')
      ]);
      const setStat = (key, text) => {
        const idx = CARDS.findIndex((c) => c.key === key);
        if (idx >= 0) grid.children[idx].querySelector('.palace-stat').textContent = '❖ ' + text;
      };
      if (posts.ok) setStat('lundaotai', '道帖 ' + posts.data.total + ' 篇');
      if (techs.ok) setStat('cangjingge', '功法 ' + techs.data.total + ' 部');
    } catch (e) { /* 静默 */ }
  }

  CARDS.forEach((c) => grid.appendChild(renderCard(c)));
  decorate();
})();
