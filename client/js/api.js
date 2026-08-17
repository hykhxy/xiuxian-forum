// 统一 fetch 封装：自动携带 token、统一解析 {success, data, message}、401 自动登出
const api = {
  async request(path, options = {}) {
    const method = options.method || 'GET';
    const headers = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });
    } catch (e) {
      // Render 免费实例休眠后首次唤醒约需 50 秒
      return { ok: false, status: 0, message: '无法连接灵脉服务器（首次访问唤醒较慢，请稍候重试）' };
    }

    let payload;
    try {
      payload = await res.json();
    } catch (e) {
      payload = { success: false, message: '服务器响应异常（HTTP ' + res.status + '）' };
    }

    if (!payload.success && res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!/login\.html/.test(location.href)) {
        location.href = 'login.html';
        return { ok: false, status: 401, message: '登录已过期' };
      }
    }
    return { ok: !!payload.success, status: res.status, data: payload.data, message: payload.message };
  },
  get(p) { return this.request(p); },
  post(p, body) { return this.request(p, { method: 'POST', body }); },
  put(p, body) { return this.request(p, { method: 'PUT', body }); },
  del(p) { return this.request(p, { method: 'DELETE' }); }
};
