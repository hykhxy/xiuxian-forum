/* ============================================================
   灵墟论道 · 全局组件：视频背景 + 多平台音乐播放器
   依赖：ui.js（el）；在所有页面于 ui.js/api.js 之后引入，底部自执行
   音乐数据源：GDStudio 聚合 API（netease / qq / kugou / kuwo）
   ============================================================ */
(function () {
  'use strict';

  var GD = 'https://music-api.gdstudio.xyz/api.php';
  var LS_KEY = 'dxplayer_state_v1';

  /* ------------------------------------------------------------
     模块一：全屏视频背景（纯视频，无音轨；失败降级静态山景）
     ------------------------------------------------------------ */
  function initVideoBg() {
    var scene = document.querySelector('.ink-scene');
    if (!scene || scene.querySelector('.ink-video')) return;
    var v = document.createElement('video');
    v.className = 'ink-video';
    v.autoplay = true;
    v.loop = true;
    v.muted = true;          // 纯视频：静音，不干扰播放器
    v.playsInline = true;
    v.preload = 'metadata';
    v.setAttribute('aria-hidden', 'true');
    v.src = 'assets/video/forum_bg.mp4';
    var failTimer = setTimeout(function () { fallback(); }, 6000); // 加载超时降级
    function fallback() {
      clearTimeout(failTimer);
      if (v.parentNode) v.remove();          // 移除后露出下层 ink-mountain 静态山景
      scene.classList.add('no-video');
    }
    v.addEventListener('loadeddata', function () { clearTimeout(failTimer); });
    v.addEventListener('error', fallback);
    v.addEventListener('stalled', function () { /* 网络波动等待，不降级 */ });
    scene.insertBefore(v, scene.firstChild); // 置于场景最底层
    // 部分浏览器要求用户手势后才 autoplay，补一次播放尝试
    var tryPlay = function () { v.play().catch(function () {}); };
    document.addEventListener('click', tryPlay, { once: true });
    tryPlay();
  }

  /* ------------------------------------------------------------
     模块二：多平台音乐播放器
     ------------------------------------------------------------ */
  // 内置演示歌单（网易云 ID 均实测可取直链；186016 源站已无直链，不作默认）
  var DEFAULT_LIST = [
    { source: 'netease', id: '347230', name: '演示曲 · 一' },
    { source: 'netease', id: '538551258', name: '演示曲 · 二' },
    { source: 'netease', id: '2034742057', name: '演示曲 · 三' }
  ];

  var state = {
    list: DEFAULT_LIST.slice(),
    index: 0,
    volume: 0.7,
    time: 0,
    playing: false,
    loopMode: 'list' // list 顺序连播
  };

  var audio = null;
  var lrc = [];          // [{t, text}]
  var saveTick = 0;

  // ---------- 工具 ----------
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        list: state.list, index: state.index, volume: state.volume,
        time: audio ? audio.currentTime : state.time, playing: !audio ? false : !audio.paused
      }));
    } catch (e) { /* 隐私模式忽略 */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (Array.isArray(s.list) && s.list.length) state.list = s.list;
      state.index = Math.min(s.index || 0, state.list.length - 1);
      state.volume = typeof s.volume === 'number' ? s.volume : 0.7;
      state.time = s.time || 0;
      state.playing = !!s.playing;
    } catch (e) { /* 损坏则忽略 */ }
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) { return r.json(); });
  }

  // 识别用户输入 → {type:'song',source,id} | {type:'direct',url,name} | {type:'playlist',source,id} | null
  function resolve(input) {
    var s = String(input || '').trim();
    if (!s) return null;
    // 直链音频
    if (/^https?:\/\/\S+\.(mp3|m4a|flac|wav)(\?\S*)?$/i.test(s)) {
      return { type: 'direct', url: s, name: decodeURIComponent(s.split('/').pop().split('?')[0]) };
    }
    // 网易云歌曲 / 歌单
    var m = s.match(/music\.163\.com\/song\?.*?id=(\d+)/i) || s.match(/163cn\.tv\/\w+/i && null);
    if (m) return { type: 'song', source: 'netease', id: m[1] };
    var pl = s.match(/music\.163\.com\/playlist\?.*?id=(\d+)/i);
    if (pl) return { type: 'playlist', source: 'netease', id: pl[1] };
    // QQ 音乐
    var q = s.match(/y\.qq\.com\/.*songDetail\/(\w+)/i);
    if (q) return { type: 'song', source: 'qq', id: q[1] };
    // 酷狗 / 酷我
    var kg = s.match(/kugou\.com\/\S*[?#&]hash=(\w+)/i);
    if (kg) return { type: 'song', source: 'kugou', id: kg[1] };
    var kw = s.match(/kuwo\.cn\/play_detail\/(\d+)/i);
    if (kw) return { type: 'song', source: 'kuwo', id: kw[1] };
    // 歌单指令 playlist:ID
    var pi = s.match(/^playlist[:：](\d+)$/i);
    if (pi) return { type: 'playlist', source: 'netease', id: pi[1] };
    // 纯数字默认网易云
    if (/^\d+$/.test(s)) return { type: 'song', source: 'netease', id: s };
    return null;
  }

  // 拉取直链（GDStudio 聚合，支持 netease/qq/kugou/kuwo）
  function fetchUrl(item) {
    return fetchJSON(GD + '?types=url&source=' + item.source + '&id=' + encodeURIComponent(item.id)).then(function (r) {
      if (!r || !r.url) {
        throw new Error('「' + (item.name || item.id) + '」源站暂无直链（可能版权下架或需 VIP），请换一首');
      }
      item.url = r.url;
      return item;
    });
  }

  // 拉取封面 / 歌词；歌名歌手从 LRC [ti:]/[ar:] 解析
  function fetchMeta(item) {
    var picP = fetchJSON(GD + '?types=pic&source=' + item.source + '&id=' + encodeURIComponent(item.id) + '&size=90')
      .then(function (r) { if (r && r.url) item.pic = r.url; }).catch(function () {});
    var lrcP = fetchJSON(GD + '?types=lyric&source=' + item.source + '&id=' + encodeURIComponent(item.id))
      .then(function (r) {
        var raw = (r && (r.lyric || r.lrc)) || '';
        item.name = item.name || tagOf(raw, 'ti') || (item.source + ' · ' + item.id);
        item.artist = item.artist || tagOf(raw, 'ar') || '';
        return parseLRC(raw);
      }).catch(function () { return []; });
    return Promise.all([picP, lrcP]).then(function (rs) { lrc = rs[1]; });
  }
  function tagOf(lrcRaw, tag) {
    var m = lrcRaw.match(new RegExp('\\[' + tag + ':([^\\]]*)\\]'));
    return m ? m[1].trim() : '';
  }
  function parseLRC(raw) {
    var out = [];
    String(raw || '').split(/\r?\n/).forEach(function (line) {
      var m = line.match(/^\[(\d+):(\d+)(?:\.(\d+))?\](.*)$/);
      if (m && m[4].trim()) out.push({ t: (+m[1]) * 60 + (+m[2]), text: m[4].trim() });
    });
    return out;
  }

  // ---------- 播放控制 ----------
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.volume = state.volume;
    audio.addEventListener('ended', function () { next(true); });
    audio.addEventListener('timeupdate', function () {
      updateProgressUI();
      highlightLyric();
      if (Date.now() - saveTick > 3000) { saveTick = Date.now(); save(); }
    });
    audio.addEventListener('play', function () { state.playing = true; updatePlayUI(); });
    audio.addEventListener('pause', function () { state.playing = false; updatePlayUI(); save(); });
    audio.addEventListener('error', function () {
      toastUI('音频加载失败，自动跳下一首', 'error');
      setTimeout(function () { next(true); }, 800);
    });
    return audio;
  }

  function loadTrack(item, autoplay) {
    var a = ensureAudio();
    toastUI('推演曲目：' + (item.name || item.id) + ' …', 'info');
    fetchUrl(item)
      .then(function (it) {
        a.src = it.url;
        a.play().catch(function () { /* autoplay 受限时静默待用户点按 */ });
        return fetchMeta(it);
      })
      .then(function () {
        updateTrackUI();
        renderLyricPanel();
        save();
      })
      .catch(function (e) { toastUI(e.message || '获取播放地址失败', 'error'); });
  }

  function playIndex(i, autoplay) {
    if (!state.list.length) return;
    state.index = ((i % state.list.length) + state.list.length) % state.list.length;
    state.time = 0;
    loadTrack(state.list[state.index], autoplay !== false);
  }
  function togglePlay() {
    var a = ensureAudio();
    if (!a.src) { playIndex(state.index); return; }
    if (a.paused) a.play().catch(function () {}); else a.pause();
  }
  function next(auto) { playIndex(state.index + 1); }
  function prev() { playIndex(state.index - 1); }

  // 供帖子卡片等外部调用
  window.DXPlayer = {
    playSong: function (source, id) {
      var item = { source: source, id: String(id) };
      state.list.push(item);
      playIndex(state.list.length - 1);
      toastUI('已加入播放：' + source + ' · ' + id, 'info');
    },
    addAndPlay: function (input) {
      var r = resolve(input);
      if (!r) return toastUI('无法识别，请输入歌曲链接 / ID / playlist:歌单ID', 'error');
      if (r.type === 'direct') {
        state.list.push({ source: 'direct', id: r.url, url: r.url, name: r.name, artist: '直链' });
        playIndex(state.list.length - 1);
        return;
      }
      if (r.type === 'playlist') return loadPlaylist(r.source, r.id);
      state.list.push({ source: r.source, id: r.id });
      playIndex(state.list.length - 1);
    }
  };

  function loadPlaylist(source, id) {
    toastUI('载入歌单 ' + id + ' …', 'info');
    fetchJSON(GD + '?types=playlist&source=' + source + '&id=' + id).then(function (arr) {
      if (!Array.isArray(arr) || !arr.length) throw new Error('歌单为空或不可用');
      state.list = arr.map(function (s) { return { source: source, id: String(s.id), name: s.name || s.title, artist: s.artist || s.author || '' }; });
      playIndex(0);
      toastUI('歌单载入成功，共 ' + state.list.length + ' 首', 'success');
    }).catch(function (e) { toastUI(e.message || '歌单获取失败', 'error'); });
  }

  /* ------------------------------------------------------------
     模块三：播放器 UI（底部半透明栏 + 竖排歌词面板）
     ------------------------------------------------------------ */
  var dom = {};

  function buildPlayer() {
    if (document.getElementById('dx-player')) return;
    var bar = document.createElement('div');
    bar.id = 'dx-player';
    bar.innerHTML =
      '<div class="dxp-main">' +
        '<img class="dxp-cover" alt="封面">' +
        '<div class="dxp-info"><div class="dxp-name">灵墟 · 仙音</div><div class="dxp-artist">输入链接或 ID，拜请仙音</div></div>' +
        '<button class="dxp-btn" data-act="prev" title="上一首">⏮</button>' +
        '<button class="dxp-btn dxp-play" data-act="toggle" title="播放/暂停">▶</button>' +
        '<button class="dxp-btn" data-act="next" title="下一首">⏭</button>' +
        '<span class="dxp-time dxp-cur">0:00</span>' +
        '<input class="dxp-progress" type="range" min="0" max="100" value="0" step="0.1">' +
        '<span class="dxp-time dxp-dur">0:00</span>' +
        '<span class="dxp-volglyph" title="音量">♪</span>' +
        '<input class="dxp-vol" type="range" min="0" max="1" value="0.7" step="0.01">' +
        '<button class="dxp-btn" data-act="lrc" title="歌词">词</button>' +
        '<button class="dxp-btn" data-act="add" title="添加歌曲/歌单">＋</button>' +
      '</div>' +
      '<div class="dxp-input">' +
        '<input class="dxp-addinput" type="text" placeholder="网易云/QQ/酷狗/酷我 歌曲链接或ID · 或 playlist:歌单ID · 或音频直链">' +
        '<button class="btn btn-sm btn-jade" data-act="doadd">拜 请</button>' +
      '</div>' +
      '<div class="dxp-lyric"><div class="dxp-lrc-inner"></div></div>';
    document.body.appendChild(bar);

    dom = {
      bar: bar,
      cover: bar.querySelector('.dxp-cover'),
      name: bar.querySelector('.dxp-name'),
      artist: bar.querySelector('.dxp-artist'),
      play: bar.querySelector('.dxp-play'),
      cur: bar.querySelector('.dxp-cur'),
      dur: bar.querySelector('.dxp-dur'),
      progress: bar.querySelector('.dxp-progress'),
      vol: bar.querySelector('.dxp-vol'),
      lyric: bar.querySelector('.dxp-lyric'),
      lrcInner: bar.querySelector('.dxp-lrc-inner'),
      inputBox: bar.querySelector('.dxp-input'),
      input: bar.querySelector('.dxp-addinput')
    };

    bar.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'toggle') togglePlay();
      else if (act === 'next') next();
      else if (act === 'prev') prev();
      else if (act === 'lrc') toggleLyric();
      else if (act === 'add') dom.inputBox.classList.toggle('show');
      else if (act === 'doadd') {
        DXPlayer.addAndPlay(dom.input.value);
        dom.input.value = '';
        dom.inputBox.classList.remove('show');
      }
    });
    dom.progress.addEventListener('input', function () {
      var a = ensureAudio();
      if (a.duration) a.currentTime = (dom.progress.value / 100) * a.duration;
    });
    dom.vol.addEventListener('input', function () {
      state.volume = +dom.vol.value;
      ensureAudio().volume = state.volume;
      save();
    });
  }

  function fmtTime(s) {
    if (!isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function updateProgressUI() {
    if (!audio) return;
    if (audio.duration) dom.progress.value = (audio.currentTime / audio.duration) * 100;
    dom.cur.textContent = fmtTime(audio.currentTime);
    dom.dur.textContent = fmtTime(audio.duration);
  }
  function updatePlayUI() {
    dom.play.textContent = state.playing ? '❚❚' : '▶';
  }
  function updateTrackUI() {
    var it = state.list[state.index] || {};
    dom.name.textContent = it.name || '未知曲目';
    dom.artist.textContent = (it.artist ? it.artist + ' · ' : '') + sourceName(it.source);
    if (it.pic) dom.cover.src = it.pic; else dom.cover.removeAttribute('src');
    updatePlayUI();
  }
  function sourceName(s) {
    return { netease: '网易云', qq: 'QQ音乐', kugou: '酷狗', kuwo: '酷我', direct: '直链' }[s] || s;
  }

  // 竖排楷体歌词面板
  function toggleLyric() { dom.lyric.classList.toggle('show'); }
  function renderLyricPanel() {
    dom.lrcInner.innerHTML = '';
    if (!lrc.length) {
      dom.lrcInner.appendChild(document.createTextNode('（此曲暂无歌词）'));
      return;
    }
    lrc.forEach(function (line) {
      var d = document.createElement('p');
      d.textContent = line.text;
      d.dataset.t = line.t;
      dom.lrcInner.appendChild(d);
    });
  }
  function highlightLyric() {
    if (!lrc.length || !dom.lyric.classList.contains('show')) return;
    var t = audio.currentTime, cur = -1;
    for (var i = 0; i < lrc.length; i++) { if (lrc[i].t <= t) cur = i; else break; }
    var lines = dom.lrcInner.children;
    for (var j = 0; j < lines.length; j++) lines[j].classList.toggle('cur', j === cur);
    if (cur >= 0 && lines[cur]) {
      // 竖排滚动：横向平移（transform，GPU 合成）
      dom.lrcInner.style.transform = 'translateX(' + (-cur * 34 + 60) + 'px)';
    }
  }

  // 播放器内轻提示（不与全局 toast 冲突）
  function toastUI(msg, type) {
    if (typeof toast === 'function') return toast(msg, type || 'info');
    console.log('[player]', msg);
  }

  /* ------------------------------------------------------------
     初始化（幂等）
     ------------------------------------------------------------ */
  function init() {
    restore();
    buildPlayer();
    dom.vol.value = state.volume;
    updateTrackUI();
    // 恢复上次曲目（不自动播，规避浏览器 autoplay 限制；进度待 canplay 跳转）
    var last = state.list[state.index];
    if (last) {
      fetchUrl(last).then(function (it) {
        var a = ensureAudio();
        a.src = it.url;
        a.addEventListener('canplay', function seekOnce() {
          a.removeEventListener('canplay', seekOnce);
          if (state.time > 0 && state.time < (a.duration || 1e9) - 2) a.currentTime = state.time;
          if (state.playing) a.play().catch(function () {}); // 受限则等待点按
        });
        return fetchMeta(it);
      }).then(function () { updateTrackUI(); renderLyricPanel(); })
        .catch(function () { /* 上次曲目失效，等待用户输入 */ });
    }
    window.addEventListener('beforeunload', save);
    // 页面隐藏/可见时保存（挂机页切走也不丢状态）
    document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  }

  initVideoBg();
  // DOM 就绪后建播放器（本脚本置于 body 末尾，直接执行即可）
  init();
})();
