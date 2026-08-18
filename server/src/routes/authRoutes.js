const express = require('express');
const wrap = require('../utils/wrap');
const { sendCode, register, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/send-code', wrap(sendCode));   // 注册邮箱验证码（开发模式回显）
router.post('/register', wrap(register));
router.post('/login', wrap(login));
router.get('/me', requireAuth, wrap(me));

module.exports = router;
