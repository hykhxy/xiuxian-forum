const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const {
  getMyProfile,
  getMyStats,
  getPublicProfile,
  updateMe,
  changePassword,
  checkin,
  checkinStatus,
  myFavorites
} = require('../controllers/userController');

const router = express.Router();

// 具名路由须在 /:id 之前注册
router.get('/me/profile', requireAuth, wrap(getMyProfile));
router.get('/me/stats', requireAuth, wrap(getMyStats));
router.put('/me', requireAuth, wrap(updateMe));
router.put('/me/password', requireAuth, wrap(changePassword));
router.post('/me/checkin', requireAuth, wrap(checkin));
router.get('/me/checkin', requireAuth, wrap(checkinStatus));
router.get('/me/favorites', requireAuth, wrap(myFavorites));

router.get('/:id', optionalAuth, wrap(getPublicProfile));

module.exports = router;
