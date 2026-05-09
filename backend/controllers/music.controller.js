const { searchMusic } = require('../services/music.service');

async function search(req, res) {
  try {
    const q = req.query.q || '';
    const songs = await searchMusic(q);
    res.json({ ok: true, query: q, songs });
  } catch (err) {
    console.error('Error buscando música:', err);
    res.status(500).json({ ok: false, error: 'No se pudo buscar música' });
  }
}

module.exports = { search };
