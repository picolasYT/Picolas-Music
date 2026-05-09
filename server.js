const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { initDb } = require('./backend/config/db');

const authRoutes = require('./backend/routes/auth.routes');
const musicRoutes = require('./backend/routes/music.routes');
const favoritesRoutes = require('./backend/routes/favorites.routes');
const playlistsRoutes = require('./backend/routes/playlists.routes');
const adminRoutes = require('./backend/routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "https://www.youtube.com", "https://s.ytimg.com"],
      "frame-src": ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com"],
      "img-src": ["'self'", "data:", "https:", "http:"],
      "connect-src": ["'self'", "https:"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "media-src": ["'self'", "https:", "http:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true, app: 'Picolas Music' }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Picolas Music iniciado en puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('Error iniciando base de datos:', err);
    process.exit(1);
  });
