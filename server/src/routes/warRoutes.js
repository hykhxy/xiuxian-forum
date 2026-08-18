const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const warCtrl = require('../controllers/warController');

const router = express.Router();

router.get('/', optionalAuth, wrap(warCtrl.list));
router.get('/:id', optionalAuth, wrap(warCtrl.detail));
router.post('/:id/start', requireAuth, wrap(warCtrl.start));
router.post('/:id/question', requireAuth, wrap(warCtrl.question));
router.post('/:id/answer', requireAuth, wrap(warCtrl.answer));
router.post('/:id/vote', requireAuth, wrap(warCtrl.vote));

module.exports = router;
