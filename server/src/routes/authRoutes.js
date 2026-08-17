const express = require('express');
const wrap = require('../utils/wrap');
const { register, login, me } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', wrap(register));
router.post('/login', wrap(login));
router.get('/me', requireAuth, wrap(me));

module.exports = router;
