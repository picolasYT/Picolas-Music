const router = require('express').Router();
const { search } = require('../controllers/music.controller');
router.get('/search', search);
module.exports = router;
