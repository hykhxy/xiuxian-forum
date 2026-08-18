const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth } = require('../middlewares/auth');
const { startIdle, stopIdle, getStatus, breakthrough } = require('../controllers/cultivationController');

const router = express.Router();

router.post('/idle/start', requireAuth, wrap(startIdle));
router.post('/idle/stop', requireAuth, wrap(stopIdle));
router.get('/status', requireAuth, wrap(getStatus));
router.post('/breakthrough', requireAuth, wrap(breakthrough));

module.exports = router;
