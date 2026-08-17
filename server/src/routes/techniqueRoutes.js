const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const techniqueCtrl = require('../controllers/techniqueController');

const router = express.Router();

router.get('/', optionalAuth, wrap(techniqueCtrl.list));
router.get('/:id', optionalAuth, wrap(techniqueCtrl.detail));
router.post('/', requireAuth, wrap(techniqueCtrl.submit));
router.post('/:id/practice', requireAuth, wrap(techniqueCtrl.practice));

module.exports = router;
