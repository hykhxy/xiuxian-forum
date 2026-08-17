const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth, optionalAuth } = require('../middlewares/auth');
const postCtrl = require('../controllers/postController');
const commentCtrl = require('../controllers/commentController');

const router = express.Router();

router.get('/', wrap(postCtrl.list));
router.get('/:id', optionalAuth, wrap(postCtrl.detail));
router.post('/', requireAuth, wrap(postCtrl.create));
router.put('/:id', requireAuth, wrap(postCtrl.update));
router.delete('/:id', requireAuth, wrap(postCtrl.remove));
router.post('/:id/like', requireAuth, wrap(postCtrl.toggleLike));
router.post('/:id/favorite', requireAuth, wrap(postCtrl.toggleFavorite));

router.get('/:id/comments', wrap(commentCtrl.listComments));
router.post('/:id/comments', requireAuth, wrap(commentCtrl.createComment));

module.exports = router;
