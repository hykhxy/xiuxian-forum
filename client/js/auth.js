// 登录态管理：token + user 缓存在 localStorage
const Auth = {
  token() { return localStorage.getItem('token'); },
  user() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { return null; }
  },
  userId() {
    const u = this.user();
    return u ? (u.id || u._id) : null;
  },
  saveLogin(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  updateUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = 'index.html';
  },
  isLoggedIn() { return !!localStorage.getItem('token'); },
  isAdmin() {
    const u = this.user();
    return !!u && u.role === 'admin';
  },
  // 需要登录的页面调用；未登录跳转登录页
  requireLogin() {
    if (!this.isLoggedIn()) {
      location.href = 'login.html';
      return false;
    }
    return true;
  }
};
