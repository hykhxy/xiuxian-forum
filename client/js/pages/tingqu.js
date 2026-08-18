// 听曲 · MetingJS 方案（第11轮重写）
// 搜索：本站代理 /api/music/search（稳定，保持不变）
// 播放：MetingJS 组件（fixed 吸底 / autoplay / 主题 #8B0000 / list-folded）
//   - meting-js 的 api 属性指向实测可用的社区镜像 api.injahow.cn
//     （MetingJS 默认 API meting.qier222.com 在本网络 DNS 不可达，必须显式指定）
// 降级：组件加载失败 → 网易云官方外链 iframe
(function () {
  'use strict';

  renderNav('tingqu');
  sprinkleFireflies();

  /* ============ 一、搜索（自家后端代理，保持不变） ============ */
  var METING_API = 'https://api.injahow.cn/meting/';
  var LS = 'tq_last_song_v3';

  function apiSearch(kw) {
    return fetch(API_BASE_URL + '/music/search?kw=' + encodeURIComponent(kw))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.success) throw new Error(d.message);
        return d.data.list;
      });
  }

  var input = document.getElementById('tq-input');
  var resultsEl = document.getElementById('search-results');

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
      // 渲染结果列表（动态插入 search-results）
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
      // 自动播放第一首（搜索即听）
      playSong(songs[0].id, songs[0].name);
    }).catch(function () {
      resultsEl.innerHTML = '';
      resultsEl.appendChild(el('div', 'tq-item', '寻曲失败，请稍后再试'));
    });
  }
  document.getElementById('tq-search-btn').onclick = doSearch;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  /* ============ 二、动态加载 APlayer + MetingJS（jsdelivr → unpkg 双源） ============ */
  var CDN = [
    { css: 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css', js: 'https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js', meting: 'https://cdn.jsdelivr.net/npm/meting@2.0.2/dist/Meting.min.js' },
    { css: 'https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.css', js: 'https://unpkg.com/aplayer@1.10.1/dist/APlayer.min.js', meting: 'https://unpkg.com/meting@2.0.2/dist/Meting.min.js' }
  ];

  function loadCss(href) {
    return new Promise(function (resolve) {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
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

  var metingReady = false;
  var metingLoading = null;

  function ensureMeting() {
    if (metingReady) return Promise.resolve(true);
    if (metingLoading) return metingLoading;
    metingLoading = (async function () {
      for (var i = 0; i < CDN.length; i++) {
        var c = CDN[i];
        await loadCss(c.css);
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

  /* ============ 三、播放：MetingJS 组件（fixed 吸底）/ iframe 降级 ============ */
  var container = document.getElementById('player-container');
  var currentSong = null;

  // 降级：网易云官方外链（零解析依赖，最稳）
  function useIframe(id) {
    container.innerHTML = '';
    var f = document.createElement('iframe');
    f.src = '//music.163.com/outchain/player?type=2&id=' + id + '&auto=1&height=66';
    f.frameBorder = 'no';
    f.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:12px;width:min(640px,92vw);height:86px;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.45);z-index:150;background:#fff;';
    f.allow = 'autoplay';
    container.appendChild(f);
    toast('仙音外链模式（官方播放器）', 'info');
  }

  // 方案A：重建 <meting-js>（换 id 即换曲；fixed 吸底 / 自动播放 / 暗红主题 / 列表折叠）
  function useMeting(id) {
    container.innerHTML = '';
    var m = document.createElement('meting-js');
    m.setAttribute('server', 'netease');
    m.setAttribute('type', 'song');
    m.setAttribute('id', String(id));
    m.setAttribute('api', METING_API);        // 显式指定可用镜像（默认 API 本网络不可达）
    m.setAttribute('theme', '#8B0000');       // 暗红主题（红黑水墨）
    m.setAttribute('fixed', 'true');          // 吸底模式
    m.setAttribute('autoplay', 'true');
    m.setAttribute('list-folded', 'true');    // 列表折叠
    m.setAttribute('order', 'list');
    container.appendChild(m);
    // 4s 未渲染出 APlayer → 降级官方 iframe
    setTimeout(function () {
      if (!container.querySelector('.aplayer')) useIframe(id);
    }, 4000);
  }

  function playSong(id, name) {
    currentSong = { id: String(id), name: name || ('歌曲 ' + id) };
    try { localStorage.setItem(LS, JSON.stringify(currentSong)); } catch (e) {}
    toast('拜请《' + currentSong.name + '》…', 'info');
    ensureMeting().then(function (ok) {
      if (ok) useMeting(id); else useIframe(id);
    });
  }

  /* ============ 四、上次歌曲提示（不自动播，等用户搜索/点击） ============ */
  try {
    var last = JSON.parse(localStorage.getItem(LS) || 'null');
    if (last && last.id) {
      toast('上次听《' + (last.name || last.id) + '》，搜索即可再听', 'info');
    }
  } catch (e) {}

  // 预热组件（首次搜索前完成加载，点击即播零等待）
  ensureMeting();
})();
