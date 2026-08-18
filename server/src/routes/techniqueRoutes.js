const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const techniqueCtrl = require('../controllers/techniqueController');

const router = express.Router();

router.get('/', optionalAuth, wrap(techniqueCtrl.list));
router.post('/draw', requireAuth, wrap(techniqueCtrl.draw));          // 抽卡（具名路由须在 /:id 前）
router.get('/backpack', requireAuth, wrap(techniqueCtrl.backpack));   // 功法背包
router.get('/:id', optionalAuth, wrap(techniqueCtrl.detail));
router.post('/', requireAuth, wrap(techniqueCtrl.submit));
router.post('/:id/practice', requireAuth, wrap(techniqueCtrl.practice));
router.post('/:id/equip', requireAuth, wrap(techniqueCtrl.equip));    // 装备背包功法
router.post('/:id/levelup', requireAuth, wrap(techniqueCtrl.levelup)); // 功法升层

module.exports = router;
