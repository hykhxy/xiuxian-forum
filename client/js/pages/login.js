// 登录/注册（第2轮：用户名+密码+职业，职业终身不可更改）
(function () {
  renderNav('');

  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const profSelect = document.getElementById('reg-profession');
  const profHint = document.getElementById('profession-hint');

  // 职业选项（与后端 utils/profession.js 一致）
  const PROFESSIONS = [
    ['sword', '剑修 · 攻击力+20%'],
    ['mage', '法修 · 灵气获取+20%'],
    ['ghost', '鬼修 · 挂机速度+15%'],
    ['blood', '血修 · 突破成功率+10%'],
    ['monster', '妖修 · 功法抽取概率+5%'],
    ['demon', '魔修 · 全属性+10%（突破失败惩罚翻倍）'],
    ['body', '体修 · 气血上限+50%']
  ];
  PROFESSIONS.forEach(([key, label]) => {
    const opt = el('option', null, label);
    opt.value = key;
    profSelect.appendChild(opt);
  });
  const PROFESSION_DESC = {
    sword: '一剑破万法，攻击力+20%',
    mage: '掌天地灵气，所有修为获取+20%',
    ghost: '行幽冥之间，挂机速度+15%',
    blood: '以血证道，突破成功率+10%',
    monster: '夺天地造化，功法抽取概率+5%',
    demon: '入魔亦成道，全属性+10%，但突破失败惩罚翻倍',
    body: '肉身成圣，气血上限+50%'
  };
  profSelect.addEventListener('change', () => {
    profHint.textContent = profSelect.value ? PROFESSION_DESC[profSelect.value] : '职业决定修行方向，请慎重抉择';
  });

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
    if (!account || !password) return toast('请输入用户名和密码', 'error');

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
    const password = document.getElementById('reg-password').value;
    const profession = profSelect.value;
    if (!username || !password) return toast('请填写用户名和密码', 'error');
    if (password.length < 6) return toast('密码至少 6 位', 'error');
    if (!profession) return toast('请选择职业（注册后不可更改）', 'error');

    btn.disabled = true;
    btn.textContent = '开辟中……';
    const res = await api.post('/auth/register', { username, password, profession });
    btn.disabled = false;
    btn.textContent = '开辟道途';
    if (!res.ok) return toast(res.message, 'error');

    Auth.saveLogin(res.data.token, res.data.user);
    const profName = (PROFESSIONS.find(([k]) => k === profession) || ['', profession])[1].split(' ·')[0];
    toast('入道成功！「' + profName + '」之路已开启，赠送 100 灵石', 'exp');
    location.href = 'index.html';
  });
})();
