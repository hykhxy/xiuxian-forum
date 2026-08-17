// 统一错误处理：把各种异常转成 { success: false, message }
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[error]', err.message);

  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map((e) => e.message).join('；');
    return res.status(400).json({ success: false, message: msg });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || '字段';
    const label = field === 'username' ? '道号' : field === 'email' ? '邮箱' : field === 'name' ? '功法名' : field;
    return res.status(409).json({ success: false, message: `${label}已被占用` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: '参数格式错误' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
  }
  res.status(err.status || 500).json({ success: false, message: err.message || '服务器内部错误' });
}

module.exports = errorHandler;
