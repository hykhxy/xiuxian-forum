// 登录/注册
(function () {
  renderNav('');

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  function switchTo(isLogin) {
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    formLogin.style.display = isLogin ? '' : 'none';
    formRegister.style.display = isLogin ? 'none' : '';
  }
  tabLogin.onclick = () => switchTo(true);
  tabRegister.onclick = () => switchTo(false);

  function busy(btn, on, text) {
    btn.disabled = on;
    if (on) btn.textContent = text || '……';
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    const account = document.getElementById('login-account').value.trim();
    const password = document.getElementById('login-password').value;
    if (!account || !password) return toast('请输入账号和密码', 'error');

    busy(btn, true, '推演中……');
    const res = await api.post('/auth/login', { account, password });
    busy(btn, false, '踏入灵墟');
    if (!res.ok) return toast(res.message, 'error');

    Auth.saveLogin(res.data.token, res.data.user);
    toast('欢迎回来，' + res.data.user.username, 'success');
    location.href = qs('from') || 'index.html';
  });

  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-submit');
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!username || !email || !password) return toast('请填写完整', 'error');
    if (password.length < 6) return toast('密码至少 6 位', 'error');

    busy(btn, true, '开辟中……');
    const res = await api.post('/auth/register', { username, email, password });
    busy(btn, false, '开辟道途');
    if (!res.ok) return toast(res.message, 'error');

    Auth.saveLogin(res.data.token, res.data.user);
    toast('入道成功！赠送 100 灵石', 'exp');
    location.href = 'index.html';
  });
})();
