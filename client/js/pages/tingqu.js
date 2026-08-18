// 听曲 · 搜索即播
// 播放策略（第9轮修复）：
//   1) 主路径：经本站代理取网易云直链 → <audio> 播放（全功能：进度/音量/歌词/连播）
//   2) 兜底：直链为空 / <audio> 加载失败 / 6 秒未出声 → 自动切换网易云官方外链 iframe
//      （官方播放器无版权直链限制，VIP 亦可试听；音频走 163 官方域名，浏览器兼容性最佳）
//   3) 手动：播放栏「官」按钮随时切换
(function () {
  'use strict';

  var NETEASE_API_BASE = ''; // 若自建 NeteaseCloudMusicApi 可填此地址（自动切 /search?keywords= 格式）

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

  renderNav('tingqu');
  sprinkleFireflies();

  var LS = 'tq_state_v2';
  var list = [];
  var index = -1;
  var lrc = [];
  var audio = null;
  var saveTick = 0;
  var loadTimer = null;   // <audio> 出声超时探测
  var embedMode = false;  // 当前是否官方 iframe 模式

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

  var $ = function (id) { return document.getElementById(id); };
  var input = $('tq-input'), resultsEl = $('tq-results');
  var nameEl = $('tq-name'), artistEl = $('tq-artist'), coverEl = $('tq-cover');
  var toggleBtn = $('tq-toggle'), prevBtn = $('tq-prev'), nextBtn = $('tq-next');
  var progress = $('tq-progress'), curEl = $('tq-cur'), durEl = $('tq-dur');
  var vol = $('tq-vol'), lrcBtn = $('tq-lrc-btn'), lrcPanel = $('tq-lyric'), lrcInner = $('tq-lrc-inner');
  var embedWrap = $('tq-embed'), embedBox = $('tq-embed-box'), embedTip = $('tq-embed-tip'), embedBtn = $('tq-embed-btn');

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
      list = songs;
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

  /* ---------------- 官方 iframe 兜底 ---------------- */
  function showEmbed(song, reason) {
    embedMode = true;
    hideAudioUI();
    embedTip.textContent = reason || '已切换网易云音乐官方播放器（VIP 亦可试听）';
    embedWrap.style.display = '';
    embedBox.innerHTML = '';
    var ifr = document.createElement('iframe');
    ifr.setAttribute('frameborder', 'no');
    ifr.setAttribute('border', '0');
    ifr.setAttribute('marginwidth', '0');
    ifr.setAttribute('marginheight', '0');
    ifr.width = '330'; ifr.height = '86';
    ifr.src = 'https://music.163.com/outchain/player?type=2&id=' + song.id + '&auto=1&height=66';
    embedBox.appendChild(ifr);
    nameEl.textContent = song.name;
    artistEl.textContent = (song.artist ? song.artist + ' · ' : '') + '官方播放中';
    toast('已切换官方播放器：《' + song.name + '》', 'info');
  }
  function hideEmbed() {
    embedMode = false;
    embedWrap.style.display = 'none';
    embedBox.innerHTML = '';
  }
  function hideAudioUI() {
    // iframe 模式下原生进度/播放键不再驱动音频，仅作展示提示
    toggleBtn.textContent = '▶';
    curEl.textContent = '--:--';
    durEl.textContent = '--:--';
    progress.value = 0;
  }

  /* ---------------- <audio> 主路径 ---------------- */
  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.volume = pendingVolume !== null ? pendingVolume : 0.7;
    audio.addEventListener('ended', function () { playIndex(index + 1); });
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
      // 直链拉取失败（CDN 拒绝/网络）→ 官方 iframe 兜底
      if (!embedMode && list[index]) showEmbed(list[index], '直链加载失败，已切换官方播放器');
    });
    return audio;
  }

  function armLoadWatch(song) {
    // 6 秒未出声（拿不到时长）视为加载失败 → 切官方播放器
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      if (!embedMode && audio && (!audio.duration || !audio.currentTime) && list[index] === song) {
        showEmbed(song, '直链较慢，已切换官方播放器');
      }
    }, 6000);
  }

  function playIndex(i) {
    if (!list.length) return;
    hideEmbed();                       // 新歌先回原生模式
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
      if (!url) {
        // 接口层即无直链（版权/VIP）→ 直接官方播放器
        showEmbed(song, '此曲直链受限，已切换官方播放器（VIP 亦可试听）');
        return;
      }
      a.src = url;
      armLoadWatch(song);
      return a.play().catch(function () { /* autoplay 受限待点按，watch 超时逻辑兜底 */ });
    }).then(function (ok) {
      apiPic(song.id).then(function (p) { if (p) coverEl.src = p; });
      apiLyric(song.id).then(function (raw) {
        song.artist = song.artist || tagOf(raw, 'ar');
        if (!embedMode) artistEl.textContent = (song.artist ? song.artist + ' · ' : '') + '网易云';
        lrc = parseLRC(raw);
        renderLrc();
      });
      save();
    }).catch(function (e) {
      if (!embedMode) showEmbed(song, '直链不可用，已切换官方播放器');
    });
  }

  toggleBtn.onclick = function () {
    if (embedMode) { toast('官方播放器中，请在其面板内操作', 'info'); return; }
    var a = ensureAudio();
    if (!a.src) { if (list.length) playIndex(Math.max(index, 0)); else toast('先搜索一首曲子吧', 'error'); return; }
    if (a.paused) { a.play().catch(function () {}); } else a.pause();
  };
  prevBtn.onclick = function () { if (list.length) playIndex(index - 1); };
  nextBtn.onclick = function () { if (list.length) playIndex(index + 1); };
  progress.addEventListener('input', function () {
    if (embedMode) return;
    var a = ensureAudio();
    if (a.duration) a.currentTime = (progress.value / 100) * a.duration;
  });
  vol.addEventListener('input', function () { ensureAudio().volume = +vol.value; save(); });
  lrcBtn.onclick = function () { lrcPanel.classList.toggle('show'); };
  embedBtn.onclick = function () {
    // 手动切官方播放器
    if (embedMode) { hideEmbed(); toast('已切回直连模式，正在重试…', 'info'); playIndex(index); return; }
    if (list[index]) showEmbed(list[index]);
    else toast('先搜索并选择一首曲子', 'error');
  };

  /* ---------------- 歌词 ---------------- */
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

  /* ---------------- 恢复 ---------------- */
  if (restore()) {
    var song = list[index];
    if (song) {
      nameEl.textContent = song.name;
      artistEl.textContent = (song.artist ? song.artist + ' · ' : '') + '网易云';
      // 恢复时直接走官方播放器最稳（免直链时序问题）
      if (pendingPlay) showEmbed(song, '继续上次曲目');
      else {
        apiSongUrl(song.id).then(function (url) {
          if (!url) return;
          var a = ensureAudio();
          a.src = url;
          a.addEventListener('canplay', function seekOnce() {
            a.removeEventListener('canplay', seekOnce);
            if (pendingTime > 0 && pendingTime < (a.duration || 1e9) - 2) a.currentTime = pendingTime;
          });
        }).catch(function () {});
      }
      vol.value = pendingVolume !== null ? pendingVolume : 0.7;
    }
  }
  window.addEventListener('beforeunload', save);
})();
