// 音乐接口代理：前端 → 本站后端 → GDStudio 聚合 API
// 解决浏览器直连第三方的不稳定/跨域问题；60 秒内存缓存
// GET /api/music/search?kw=关键词[&source=netease][&count=20]
// GET /api/music/url?id=歌曲ID[&source=netease]
// GET /api/music/pic?id=歌曲ID[&size=90]
// GET /api/music/lyric?id=歌曲ID
const GD = 'https://music-api.gdstudio.xyz/api.php';
const SOURCE = ['netease', 'qq', 'kugou', 'kuwo'];

const cache = new Map(); // key -> { at, payload }
const TTL = 60 * 1000;

async function gd(params, retries = 2) {
  const qs = new URLSearchParams(params).toString();
  const key = qs;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.payload;

  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${GD}?${qs}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) throw new Error('上游返回非 JSON');
      const payload = JSON.parse(text);
      cache.set(key, { at: Date.now(), payload });
      return payload;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function bad(res, message) {
  return res.status(502).json({ success: false, message });
}

// GET /api/music/search
async function search(req, res) {
  const kw = String(req.query.kw || '').trim();
  if (!kw) return res.status(400).json({ success: false, message: '缺少关键词 kw' });
  const source = SOURCE.includes(req.query.source) ? req.query.source : 'netease';
  const count = Math.min(Math.max(parseInt(req.query.count) || 20, 1), 50);
  try {
    const raw = await gd({ types: 'search', source, count, name: kw });
    const list = (Array.isArray(raw) ? raw : []).map((s) => ({
      id: s.id,
      name: s.name,
      artist: Array.isArray(s.artist) ? s.artist.join('/') : (s.artist || ''),
      album: s.album || ''
    }));
    res.json({ success: true, data: { list } });
  } catch (e) {
    bad(res, '乐库暂不可达，请稍后再试');
  }
}

// GET /api/music/url
async function url(req, res) {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ success: false, message: '缺少 id' });
  const source = SOURCE.includes(req.query.source) ? req.query.source : 'netease';
  try {
    const raw = await gd({ types: 'url', source, id });
    res.json({ success: true, data: { url: raw.url || '', br: raw.br || 0 } });
  } catch (e) {
    bad(res, '取播放地址失败');
  }
}

// GET /api/music/pic
async function pic(req, res) {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ success: false, message: '缺少 id' });
  const size = [90, 130, 300].includes(parseInt(req.query.size)) ? req.query.size : 90;
  try {
    const raw = await gd({ types: 'pic', source: 'netease', id, size });
    res.json({ success: true, data: { url: raw.url || '' } });
  } catch (e) {
    bad(res, '取封面失败');
  }
}

// GET /api/music/lyric
async function lyric(req, res) {
  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ success: false, message: '缺少 id' });
  try {
    const raw = await gd({ types: 'lyric', source: 'netease', id });
    res.json({ success: true, data: { lyric: raw.lyric || '' } });
  } catch (e) {
    bad(res, '取歌词失败');
  }
}

module.exports = { search, url, pic, lyric };
