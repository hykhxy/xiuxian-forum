const express = require('express');
const wrap = require('../utils/wrap');
const musicCtrl = require('../controllers/musicController');

const router = express.Router();

// 音乐代理对单 IP 放宽限流（听曲高频搜索场景）
router.get('/search', wrap(musicCtrl.search));
router.get('/url', wrap(musicCtrl.url));
router.get('/pic', wrap(musicCtrl.pic));
router.get('/lyric', wrap(musicCtrl.lyric));

module.exports = router;
