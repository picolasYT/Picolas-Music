const router = require('express').Router();
const { authRequired } = require('../middlewares/auth.middleware');
const { listPlaylists, createPlaylist, deletePlaylist, addSong, removeSong } = require('../controllers/playlists.controller');

router.use(authRequired);
router.get('/', listPlaylists);
router.post('/', createPlaylist);
router.delete('/:id', deletePlaylist);
router.post('/:id/songs', addSong);
router.delete('/:id/songs/:songId', removeSong);

module.exports = router;
