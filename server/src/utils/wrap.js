// Express 4 不会自动捕获 async handler 的异常（Node 22 下未处理的 rejection 会崩溃），
// 统一用 wrap 包装后交给 errorHandler
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = wrap;
