const router = require('express').Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { listFavorites, addFavorite, removeFavorite } = require('../controllers/favorites.controller');

router.use(authRequired);
router.get('/', listFavorites);
router.post('/', addFavorite);
router.delete('/:songId', removeFavorite);

module.exports = router;
