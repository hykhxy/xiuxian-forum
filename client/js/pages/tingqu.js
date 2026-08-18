// 听曲 · 搜索即播（第10轮重写：播放彻底交给 MetingJS/APlayer 组件，前端不再自取直链）
// 搜索走本站稳定代理 /api/music/search；点击歌曲 → 重建 <meting-js>（方案A）；
// 组件加载失败/超时 → 自动降级网易云官方 iframe（方案B）
(function () {
  'use strict';

  renderNav('tingqu');
  sprinkleFireflies();

  /* ============ 一、搜索（自家后端代理，稳定） ============ */
  var LS = 'tq_last_song_v2';

  function apiSearch(kw) {
    return fetch(API_BASE_URL + '/music/search?kw=' + encodeURIComponent(kw))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success) throw new Error(d.message);
        return d.data.list;
      });
  }

  var input = document.getElementById('tq-input');
  var resultsEl = document.getElementById('tq-results');

  function doSearch() {
    var kw = input.value.trim();
    if (!kw) return toast('请输入歌名或歌手', 'error');
    resultsEl.innerHTML = '';
    resultsEl.appendChild(el('div', 'tq-item tq-loading', '寻曲中……'));
    apiSearch(kw).then(function (songs) {
      resultsEl.innerHTML = '';
      if (!songs.length) {
        resultsEl.appendChild(el('div', 'tq-item', '未寻得此曲，换个词试试'));
        return;
      }
      songs.forEach(function (s) {
        var item = el('div', 'tq-item');
        var left = el('div', 'tq-item-info');
        left.appendChild(el('div', 'tq-item-name', s.name));
        left.appendChild(el('div', 'tq-item-artist', (s.artist || '未知歌手') + ' · 网易云'));
        item.appendChild(left);
        item.appendChild(el('span', 'tq-item-play', '▶ 播放'));
        item.onclick = function () { playSong(s.id, s.name); };
        resultsEl.appendChild(item);
      });
    }).catch(function () {
      resultsEl.innerHTML = '';
      resultsEl.appendChild(el('div', 'tq-item', '寻曲失败，请稍后再试'));
    });
  }
  document.getElementById('tq-search-btn').onclick = doSearch;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  /* ============ 二、动态加载 APlayer + MetingJS（jsdelivr 主源 → unpkg 备源） ============ */
  var CDN = [
    { css: 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css', js: 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js', meting: 'https://cdn.jsdelivr.net/npm/meting@2.0.2/dist/Meting.min.js' },
    { css: 'https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.css', js: 'https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.js', meting: 'https://unpkg.com/meting@2.0.2/dist/Meting.min.js' }
  ];

  function loadCss(href) {
    return new Promise(function (resolve) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = function () { resolve(true); };
      l.onerror = function () { resolve(false); };
      document.head.appendChild(l);
    });
  }
  function loadJs(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.body.appendChild(s);
    });
  }

  var metingReady = false;   // 组件就绪（window.APlayer + meting-js 注册）
  var metingLoading = null;  // 加载 Promise（防重复）

  function ensureMeting() {
    if (metingReady) return Promise.resolve(true);
    if (metingLoading) return metingLoading;
    metingLoading = (async function () {
      for (var i = 0; i < CDN.length; i++) {
        var c = CDN[i];
        var cssOk = await loadCss(c.css);
        var jsOk = await loadJs(c.js);
        var metingOk = await loadJs(c.meting);
        if (jsOk && metingOk && window.APlayer) {
          metingReady = true;
          return true;
        }
      }
      return false;
    })();
    return metingLoading;
  }

  /* ============ 三、播放：方案A meting-js / 方案B 官方 iframe 降级 ============ */
  var metingBox = document.getElementById('tq-meting-box');
  var iframeBox = document.getElementById('tq-iframe-box');
  var modeTip = document.getElementById('tq-mode-tip');
  var currentSong = null;   // {id, name}
  var renderTimer = null;

  function setTip(text) {
    modeTip.textContent = text || '';
    modeTip.style.display = text ? '' : 'none';
  }

  // 方案B：网易云官方外链播放器（无任何解析依赖，最稳）
  function useIframe(id) {
    metingBox.innerHTML = '';
    iframeBox.innerHTML = '';
    var f = document.createElement('iframe');
    f.src = '//music.163.com/outchain/player?type=2&id=' + id + '&auto=1&height=66';
    f.frameBorder = 'no';
    f.border = '0';
    f.marginWidth = '0';
    f.marginHeight = '0';
    f.width = '100%';
    f.height = '86px';
    f.allow = 'autoplay';
    iframeBox.appendChild(f);
    setTip('仙音外链模式（官方播放器）');
  }

  // 方案A：重建 <meting-js> 组件（改 id 即换曲，组件接管播放/进度/歌词）
  function useMeting(id) {
    iframeBox.innerHTML = '';
    metingBox.innerHTML = '';
    var m = document.createElement('meting-js');
    m.setAttribute('server', 'netease');
    m.setAttribute('type', 'song');
    m.setAttribute('id', String(id));
    m.setAttribute('theme', '#b3543e');   // 朱砂主题色
    m.setAttribute('autoplay', 'true');
    m.setAttribute('order', 'list');
    m.setAttribute('lrc-type', '3');      // 歌词滚动
    metingBox.appendChild(m);
    setTip('仙音组件模式（MetingJS）');
    // 2.5s 内未渲染出 APlayer（CDN 慢/组件失败）→ 自动降级 iframe
    clearTimeout(renderTimer);
    renderTimer = setTimeout(function () {
      if (!metingBox.querySelector('.aplayer')) useIframe(id);
    }, 2500);
  }

  function playSong(id, name) {
    currentSong = { id: String(id), name: name || ('歌曲 ' + id) };
    try { localStorage.setItem(LS, JSON.stringify(currentSong)); } catch (e) {}
    toast('拜请《' + currentSong.name + '》…', 'info');
    ensureMeting().then(function (ok) {
      if (ok) useMeting(id); else useIframe(id);
    });
  }

  /* ============ 四、恢复上次歌曲（不自动播，等用户点击） ============ */
  try {
    var last = JSON.parse(localStorage.getItem(LS) || 'null');
    if (last && last.id) {
      currentSong = last;
      setTip('上次听：《' + (last.name || last.id) + '》—— 搜索或点击任意曲目开始');
    }
  } catch (e) {}

  // 预热组件（用户点击列表时即开即用）
  ensureMeting();
})();
