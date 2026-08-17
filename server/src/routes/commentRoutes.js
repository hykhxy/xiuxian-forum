const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth } = require('../middlewares/auth');
const { removeComment } = require('../controllers/commentController');

const router = express.Router();

router.delete('/:id', requireAuth, wrap(removeComment));

module.exports = router;
