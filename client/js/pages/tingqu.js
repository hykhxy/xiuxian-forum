// 听曲 · 搜索即播（纯前端逻辑；数据走本站后端代理 /api/music/*，规避第三方直连不稳定）
// 若日后自建 NeteaseCloudMusicApi，把 NETEASE_API_BASE 改为自建地址即可
// 自动切换为 /search?keywords= 与 /song/url?id= 接口格式
(function () {
  'use strict';

  /* ---------------- API 适配层 ---------------- */
  var NETEASE_API_BASE = ''; // 例：'https://your-ncm.example.com'（留空则用本站代理 /api/music/*）

  function proxyJSON(path) {
    return fetch(API_BASE_URL + path).then(function (r) { return r.json(); });
  }

  var apiSearch = NETEASE_API_BASE
    ? function (kw) {
        return fetch(NETEASE_API_BASE + '/search?keywords=' + encodeURIComponent(kw) + '&limit=20')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            return (d.result && d.result.songs || []).map(function (s) {
              return { id: s.id, name: s.name, artist: (s.artists || []).map(function (a) { return a.name; }).join('/') };
            });
          });
      }
    : function (kw) {
        return proxyJSON('/music/search?kw=' + encodeURIComponent(kw))
          .then(function (d) {
            if (!d.success) throw new Error(d.message);
            return d.data.list;
          });
      };

  var apiSongUrl = NETEASE_API_BASE
    ? function (id) {
        return fetch(NETEASE_API_BASE + '/song/url?id=' + id).then(function (r) { return r.json(); })
          .then(function (d) { return (d.data && d.data[0] && d.data[0].url) || ''; });
      }
    : function (id) {
        return proxyJSON('/music/url?id=' + id).then(function (d) { return (d.success && d.data.url) || ''; });
      };

  function apiPic(id) {
    return proxyJSON('/music/pic?id=' + id)
      .then(function (d) { return (d.success && d.data.url) || ''; }).catch(function () { return ''; });
  }
  function apiLyric(id) {
    return proxyJSON('/music/lyric?id=' + id)
      .then(function (d) { return (d.success && d.data.lyric) || ''; }).catch(function () { return ''; });
  }

  /* ---------------- 全站统一视频背景（./assets/video/forum_bg.mp4，由 player.js 公共组件注入） ---------------- */
  renderNav('tingqu');
  sprinkleFireflies();

  /* ---------------- 状态 ---------------- */
  var LS = 'tq_state_v1';
  var list = [];      // 当前播放列表（=最近一次搜索结果）
  var index = -1;
  var lrc = [];
  var audio = null;
  var saveTick = 0;

  function save() {
    try {
      localStorage.setItem(LS, JSON.stringify({
        list: list, index: index,
        volume: audio ? audio.volume : 0.7,
        time: audio ? audio.currentTime : 0,
        playing: audio && !audio.paused
      }));
    } catch (e) {}
  }
  function restore() {
    try {
      var s = JSON.parse(localStorage.getItem(LS) || 'null');
      if (s && Array.isArray(s.list) && s.list.length) {
        list = s.list;
        index = Math.min(s.index || 0, list.length - 1);
        pendingVolume = typeof s.volume === 'number' ? s.volume : 0.7;
        pendingTime = s.time || 0;
        pendingPlay = !!s.playing;
        return true;
      }
    } catch (e) {}
    return false;
  }
  var pendingVolume = null, pendingTime = 0, pendingPlay = false;

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var input = $('tq-input'), resultsEl = $('tq-results');
  var nameEl = $('tq-name'), artistEl = $('tq-artist'), coverEl = $('tq-cover');
  var toggleBtn = $('tq-toggle'), prevBtn = $('tq-prev'), nextBtn = $('tq-next');
  var progress = $('tq-progress'), curEl = $('tq-cur'), durEl = $('tq-dur');
  var vol = $('tq-vol'), lrcBtn = $('tq-lrc-btn'), lrcPanel = $('tq-lyric'), lrcInner = $('tq-lrc-inner');

  /* ---------------- 搜索 ---------------- */
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
      list = songs; // 搜索结果即播放列表
      songs.forEach(function (s, i) {
        var item = el('div', 'tq-item');
        var left = el('div', 'tq-item-info');
        left.appendChild(el('div', 'tq-item-name', s.name));
        left.appendChild(el('div', 'tq-item-artist', s.artist || '未知歌手'));
        item.appendChild(left);
        item.appendChild(el('span', 'tq-item-play', '▶ 播放'));
        item.onclick = function () { playIndex(i); };
        resultsEl.appendChild(item);
      });
    }).catch(function () {
      resultsEl.innerHTML = '';
      resultsEl.appendChild(el('div', 'tq-item', '寻曲失败，请稍后再试'));
    });
  }
  $('tq-search-btn').onclick = doSearch;
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

  /* ---------------- 播放 ---------------- */
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.volume = pendingVolume !== null ? pendingVolume : 0.7;
    audio.addEventListener('ended', function () { playIndex(index + 1); }); // 自动连播
    audio.addEventListener('timeupdate', function () {
      if (audio.duration) progress.value = (audio.currentTime / audio.duration) * 100;
      curEl.textContent = fmt(audio.currentTime);
      durEl.textContent = fmt(audio.duration);
      highlightLrc();
      if (Date.now() - saveTick > 3000) { saveTick = Date.now(); save(); }
    });
    audio.addEventListener('play', function () { toggleBtn.textContent = '❚❚'; save(); });
    audio.addEventListener('pause', function () { toggleBtn.textContent = '▶'; save(); });
    audio.addEventListener('error', function () {
      toast('此曲源站暂无直链（版权/VIP），自动下一首', 'error');
      setTimeout(function () { playIndex(index + 1); }, 600);
    });
    return audio;
  }

  function playIndex(i) {
    if (!list.length) return;
    index = ((i % list.length) + list.length) % list.length;
    var song = list[index];
    nameEl.textContent = song.name;
    artistEl.textContent = (song.artist ? song.artist + ' · ' : '') + '网易云';
    coverEl.removeAttribute('src');
    lrc = [];
    renderLrc();

    var a = ensureAudio();
    toast('拜请《' + song.name + '》…', 'info');
    apiSongUrl(song.id).then(function (url) {
      if (!url) throw new Error('empty');
      a.src = url;
      return a.play();
    }).then(function () {
      // 封面与歌词并行补载（不阻塞播放）
      apiPic(song.id).then(function (p) { if (p) coverEl.src = p; });
      apiLyric(song.id).then(function (raw) {
        song.artist = song.artist || tagOf(raw, 'ar');
        artistEl.textContent = (song.artist ? song.artist + ' · ' : '') + '网易云';
        lrc = parseLRC(raw);
        renderLrc();
      });
      save();
    }).catch(function () {
      toast('《' + song.name + '》暂无直链，换一首试试', 'error');
    });
  }

  toggleBtn.onclick = function () {
    var a = ensureAudio();
    if (!a.src) { if (list.length) playIndex(Math.max(index, 0)); else toast('先搜索一首曲子吧', 'error'); return; }
    if (a.paused) a.play().catch(function () {}); else a.pause();
  };
  prevBtn.onclick = function () { if (list.length) playIndex(index - 1); };
  nextBtn.onclick = function () { if (list.length) playIndex(index + 1); };
  progress.addEventListener('input', function () {
    var a = ensureAudio();
    if (a.duration) a.currentTime = (progress.value / 100) * a.duration;
  });
  vol.addEventListener('input', function () { ensureAudio().volume = +vol.value; save(); });
  lrcBtn.onclick = function () { lrcPanel.classList.toggle('show'); };

  /* ---------------- 歌词（竖排楷体） ---------------- */
  function tagOf(raw, tag) {
    var m = String(raw).match(new RegExp('\\[' + tag + ':([^\\]]*)\\]'));
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
  function renderLrc() {
    lrcInner.innerHTML = '';
    if (!lrc.length) { lrcInner.appendChild(document.createTextNode('（暂无歌词）')); return; }
    lrc.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line.text;
      p.dataset.t = line.t;
      lrcInner.appendChild(p);
    });
  }
  function highlightLrc() {
    if (!lrc.length || !lrcPanel.classList.contains('show')) return;
    var t = audio.currentTime, cur = -1;
    for (var i = 0; i < lrc.length; i++) { if (lrc[i].t <= t) cur = i; else break; }
    var rows = lrcInner.children;
    for (var j = 0; j < rows.length; j++) rows[j].classList.toggle('cur', j === cur);
    if (cur >= 0 && rows[cur]) lrcInner.style.transform = 'translateX(' + (-cur * 34 + 60) + 'px)';
  }

  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  /* ---------------- 恢复上次状态 ---------------- */
  if (restore()) {
    var song = list[index];
    if (song) {
      nameEl.textContent = song.name;
      artistEl.textContent = (song.artist ? song.artist + ' · ' : '') + '网易云';
      apiSongUrl(song.id).then(function (url) {
        if (!url) return;
        var a = ensureAudio();
        a.src = url;
        a.addEventListener('canplay', function seekOnce() {
          a.removeEventListener('canplay', seekOnce);
          if (pendingTime > 0 && pendingTime < (a.duration || 1e9) - 2) a.currentTime = pendingTime;
          if (pendingPlay) a.play().catch(function () {}); // autoplay 受限则待点按
        });
        apiPic(song.id).then(function (p) { if (p) coverEl.src = p; });
        apiLyric(song.id).then(function (raw) { lrc = parseLRC(raw); renderLrc(); });
      }).catch(function () {});
    }
    vol.value = pendingVolume !== null ? pendingVolume : 0.7;
  }
  window.addEventListener('beforeunload', save);
})();
