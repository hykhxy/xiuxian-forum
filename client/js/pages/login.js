// 登录/注册（第14轮：守夜人毛玻璃 + 邮箱验证码注册 + 七职业光效选择）
(function () {
  initInkScene();   // 登录页无导航栏，手动注入背景层

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  /* ---------- 七职业（与后端 utils/profession.js 一致；glow 与 CSS 配套） ---------- */
  const PROFESSIONS = [
    { key: 'sword',   glyph: '剑', name: '剑修', desc: '攻击力+20%',        glowCls: 'pg-sword',   long: '一剑破万法，锋芒映暗金' },
    { key: 'mage',    glyph: '法', name: '法修', desc: '灵气获取+20%',      glowCls: 'pg-mage',    long: '掌天地灵气，法辉流转' },
    { key: 'ghost',   glyph: '鬼', name: '鬼修', desc: '挂机速度+15%',      glowCls: 'pg-ghost',   long: '行幽冥之间，青焰随行' },
    { key: 'blood',   glyph: '血', name: '血修', desc: '突破成功率+10%',    glowCls: 'pg-blood',   long: '以血证道，赤光灼灼' },
    { key: 'monster', glyph: '妖', name: '妖修', desc: '功法抽取概率+5%',   glowCls: 'pg-monster', long: '夺天地造化，琥珀妖辉' },
    { key: 'demon',   glyph: '魔', name: '魔修', desc: '全属性+10%（突破失败惩罚翻倍）', glowCls: 'pg-demon', long: '入魔亦成道，紫电缠身' },
    { key: 'body',    glyph: '体', name: '体修', desc: '气血上限+50%',      glowCls: 'pg-body',    long: '肉身成圣，铜光不坏' }
  ];
  let selectedProfession = '';

  const profGrid = document.getElementById('prof-grid');
  const profHint = document.getElementById('profession-hint');
  PROFESSIONS.forEach((p) => {
    const tile = el('div', 'prof-tile ' + p.glowCls);
    tile.dataset.key = p.key;
    tile.appendChild(el('div', 'prof-glyph', p.glyph));
    tile.appendChild(el('div', 'prof-name', p.name));
    tile.appendChild(el('div', 'prof-desc', p.desc));
    tile.onclick = () => {
      selectedProfession = p.key;
      profGrid.querySelectorAll('.prof-tile').forEach((t) => t.classList.toggle('selected', t === tile));
      profHint.textContent = p.long;
    };
    profGrid.appendChild(tile);
  });

  /* ---------- Tab 切换 ---------- */
  function switchTo(isLogin) {
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    formLogin.style.display = isLogin ? '' : 'none';
    formRegister.style.display = isLogin ? 'none' : '';
  }
  tabLogin.onclick = () => switchTo(true);
  tabRegister.onclick = () => switchTo(false);

  /* ---------- 邮箱验证码（60s 倒计时；开发模式回显） ---------- */
  const sendBtn = document.getElementById('send-code-btn');
  const devHint = document.getElementById('dev-code-hint');
  let countdown = 0;
  let cdTimer = null;

  function startCountdown(sec) {
    countdown = sec;
    sendBtn.disabled = true;
    clearInterval(cdTimer);
    cdTimer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(cdTimer);
        sendBtn.disabled = false;
        sendBtn.textContent = '获取验证码';
      } else {
        sendBtn.textContent = countdown + 's 后重发';
      }
    }, 1000);
    sendBtn.textContent = countdown + 's 后重发';
  }

  sendBtn.onclick = async () => {
    const email = document.getElementById('reg-email').value.trim();
    if (!email) return toast('请先填写邮箱', 'error');
    sendBtn.disabled = true;
    const r = await api.post('/auth/send-code', { email });
    if (!r.ok) {
      sendBtn.disabled = false;
      return toast(r.message, 'error');
    }
    if (r.data.devMode && r.data.devCode) {
      devHint.textContent = '【开发模式】验证码：' + r.data.devCode + '（接入 SMTP 后改为邮箱发送）';
      devHint.classList.add('show');
      document.getElementById('reg-code').value = r.data.devCode; // 开发模式自动填入
    } else {
      devHint.textContent = '验证码已发送至邮箱，10 分钟内有效';
    }
    startCountdown(60);
  };

  /* ---------- 提交 ---------- */
  function busy(btn, on, text) {
    btn.disabled = on;
    if (on) btn.textContent = text || '……';
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-submit');
    const account = document.getElementById('login-account').value.trim();
    const password = document.getElementById('login-password').value;
    if (!account || !password) return toast('请输入用户名和密码', 'error');

    busy(btn, true, '推演中……');
    const res = await api.post('/auth/login', { account, password });
    busy(btn, false, '踏 入 灵 墟');
    if (!res.ok) return toast(res.message, 'error');

    Auth.saveLogin(res.data.token, res.data.user);
    toast('欢迎回来，' + res.data.user.username, 'success');
    location.href = qs('from') || 'index.html';
  });

  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('register-submit');
    const email = document.getElementById('reg-email').value.trim();
    const code = document.getElementById('reg-code').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!email) return toast('请填写注册邮箱', 'error');
    if (!/^\d{6}$/.test(code)) return toast('请填写 6 位验证码', 'error');
    if (!username || !password) return toast('请填写用户名和密码', 'error');
    if (password.length < 6) return toast('密码至少 6 位', 'error');
    if (!selectedProfession) return toast('请择一道统（职业注册后不可更改）', 'error');

    btn.disabled = true;
    btn.textContent = '开辟中……';
    const res = await api.post('/auth/register', { email, code, username, password, profession: selectedProfession });
    btn.disabled = false;
    btn.textContent = '开 辟 道 途';
    if (!res.ok) return toast(res.message, 'error');

    Auth.saveLogin(res.data.token, res.data.user);
    const prof = PROFESSIONS.find((p) => p.key === selectedProfession);
    toast('入道成功！「' + prof.name + '」之路已开启，赠 100 灵石', 'exp');
    location.href = 'index.html';
  });
})();
