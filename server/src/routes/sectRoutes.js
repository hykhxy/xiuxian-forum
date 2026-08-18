const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const sectCtrl = require('../controllers/sectController');

const router = express.Router();

router.get('/', optionalAuth, wrap(sectCtrl.list));
router.post('/', requireAuth, wrap(sectCtrl.create));
router.get('/:id', optionalAuth, wrap(sectCtrl.detail));
router.post('/:id/join', requireAuth, wrap(sectCtrl.join));
router.post('/:id/leave', requireAuth, wrap(sectCtrl.leave));
router.post('/:id/dissolve', requireAuth, wrap(sectCtrl.dissolve));
router.put('/:id/roles', requireAuth, wrap(sectCtrl.setRole));
router.put('/:id/announcement', requireAuth, wrap(sectCtrl.setAnnouncement));
router.post('/:id/declare-war', requireAuth, wrap(sectCtrl.declareWar));

module.exports = router;
