const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const adminCtrl = require('../controllers/adminController');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/techniques', wrap(adminCtrl.listTechniques));
router.put('/techniques/:id/review', wrap(adminCtrl.reviewTechnique));
router.put('/posts/:id/status', wrap(adminCtrl.setPostStatus));
router.get('/stats', wrap(adminCtrl.stats));

module.exports = router;
