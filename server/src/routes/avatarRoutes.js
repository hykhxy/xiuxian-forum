const express = require('express');
const wrap = require('../utils/wrap');
const { requireAuth } = require('../middlewares/auth');
const { upload, multerErrorHandler, uploadAvatar, aiGenerate, aiConfirm } = require('../controllers/avatarController');

const router = express.Router();

router.post('/upload', requireAuth, upload.single('file'), multerErrorHandler, wrap(uploadAvatar));
router.post('/ai-generate', requireAuth, wrap(aiGenerate));
router.post('/ai-confirm', requireAuth, wrap(aiConfirm));

module.exports = router;
