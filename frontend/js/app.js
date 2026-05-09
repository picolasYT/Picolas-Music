const state = {
  token: localStorage.getItem('picolas_token') || '',
  user: null,
  results: [],
  favorites: [],
  playlists: [],
  queue: [],
  currentIndex: -1,
  currentSong: null,
  authMode: 'login',
  isPlaying: false,
  playerReady: false,
  pendingSong: null,
  pendingQueue: []
};

let ytPlayer = null;
let ytApiLoading = false;
let directIframeMode = false;

const $ = (id) => document.getElementById(id);

const apiHeaders = () => ({
  'Content-Type': 'application/json',
  ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
});

function toast(msg) {
  const el = $('toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2400);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...apiHeaders(), ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Error inesperado');
  return data;
}

function getSongId(song) {
  return song?.songId || song?.videoId || song?.id || '';
}

function normalizeSong(song) {
  if (!song) return null;
  return {
    ...song,
    songId: song.songId || song.videoId || song.id,
    videoId: song.videoId || song.id,
    title: song.title || 'Sin título',
    artist: song.artist || 'YouTube',
    cover: song.cover || song.thumbnail || '/assets/img/default-cover.svg',
    duration: song.duration || ''
  };
}

function requireLogin() {
  if (!state.token || !state.user) {
    openAuth('login');
    toast('Primero iniciá sesión');
    return false;
  }
  return true;
}

function openAuth(mode) {
  state.authMode = mode;
  $('authTitle').textContent = mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
  $('authText').textContent = mode === 'login' ? 'Entrá a tu cuenta.' : 'Creá tu cuenta gratis.';
  $('authSubmit').textContent = mode === 'login' ? 'Entrar' : 'Crear cuenta';
  $('switchAuth').textContent = mode === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta';
  $('authModal').classList.remove('hidden');
}

function closeModal(id) {
  $(id).classList.add('hidden');
}

function setUserUI() {
  if (state.user) {
    $('authCard').classList.add('hidden');
    $('userCard').classList.remove('hidden');
    $('usernameLabel').textContent = state.user.username;
    $('avatarLetter').textContent = state.user.username[0]?.toUpperCase() || 'P';
    $('userRoleLabel').textContent = state.user.role === 'admin' ? 'Administrador' : 'Sesión iniciada';
    $('adminLink').classList.toggle('hidden', state.user.role !== 'admin');
  } else {
    $('authCard').classList.remove('hidden');
    $('userCard').classList.add('hidden');
    $('adminLink').classList.add('hidden');
  }
}

async function loadMe() {
  if (!state.token) {
    setUserUI();
    return;
  }
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    await Promise.all([loadFavorites(), loadPlaylists()]);
  } catch {
    localStorage.removeItem('picolas_token');
    state.token = '';
    state.user = null;
    state.favorites = [];
    state.playlists = [];
  }
  setUserUI();
}

async function handleAuth(e) {
  e.preventDefault();
  const username = $('authUsername').value.trim();
  const password = $('authPassword').value;
  if (!username || !password) return toast('Completá usuario y contraseña');

  try {
    const data = await api(`/api/auth/${state.authMode === 'login' ? 'login' : 'register'}`, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('picolas_token', state.token);
    closeModal('authModal');
    setUserUI();
    await Promise.all([loadFavorites(), loadPlaylists()]);
    renderAll();
    toast(state.authMode === 'login' ? 'Sesión iniciada' : 'Cuenta creada');
  } catch (err) {
    toast(err.message);
  }
}

async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
  state.token = '';
  state.user = null;
  state.favorites = [];
  state.playlists = [];
  localStorage.removeItem('picolas_token');
  setUserUI();
  renderAll();
  toast('Sesión cerrada');
}

async function searchSongs(e) {
  e?.preventDefault();
  const q = $('searchInput').value.trim();
  if (!q) return;
  $('searchStatus').textContent = 'Buscando...';
  $('resultsGrid').innerHTML = '';
  try {
    const data = await api(`/api/music/search?q=${encodeURIComponent(q)}`);
    state.results = (data.songs || []).map(normalizeSong).filter(song => song && song.videoId);
    state.queue = state.results;
    $('searchStatus').textContent = state.results.length ? `${state.results.length} resultados` : 'No encontré canciones.';
    renderSongs($('resultsGrid'), state.results);
    showView('home');
  } catch (err) {
    $('searchStatus').textContent = err.message;
  }
}

function isFavorite(song) {
  const id = getSongId(song);
  return state.favorites.some(f => getSongId(f) === id);
}

async function toggleFavorite(song) {
  if (!requireLogin()) return;
  song = normalizeSong(song);
  const id = getSongId(song);
  if (!id) return toast('Esta canción no tiene ID');

  try {
    if (isFavorite(song)) {
      await api(`/api/favorites/${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.favorites = state.favorites.filter(f => getSongId(f) !== id);
      toast('Quitado de favoritos');
    } else {
      const data = await api('/api/favorites', { method: 'POST', body: JSON.stringify(song) });
      state.favorites.unshift(normalizeSong(data.favorite));
      toast('Agregado a favoritos');
    }
    renderAll();
  } catch (err) {
    toast(err.message);
  }
}

async function loadFavorites() {
  if (!state.token) return;
  const data = await api('/api/favorites');
  state.favorites = (data.favorites || []).map(normalizeSong).filter(Boolean);
}

async function loadPlaylists() {
  if (!state.token) return;
  const data = await api('/api/playlists');
  state.playlists = (data.playlists || []).map(playlist => ({
    ...playlist,
    songs: (playlist.songs || []).map(normalizeSong).filter(Boolean)
  }));
}

async function createPlaylist(e) {
  e.preventDefault();
  if (!requireLogin()) return;
  const name = $('playlistName').value.trim();
  const description = $('playlistDescription').value.trim();
  if (!name) return toast('Poné un nombre para la playlist');

  try {
    const data = await api('/api/playlists', { method: 'POST', body: JSON.stringify({ name, description }) });
    state.playlists.unshift({ ...data.playlist, songs: data.playlist.songs || [] });
    $('playlistName').value = '';
    $('playlistDescription').value = '';
    closeModal('playlistModal');
    renderPlaylists();
    toast('Playlist creada');
  } catch (err) {
    toast(err.message);
  }
}

async function deletePlaylist(id) {
  if (!confirm('¿Borrar esta playlist?')) return;
  try {
    await api(`/api/playlists/${id}`, { method: 'DELETE' });
    state.playlists = state.playlists.filter(p => String(p.id) !== String(id));
    renderPlaylists();
    renderSongs($('resultsGrid'), state.results);
    toast('Playlist borrada');
  } catch (err) {
    toast(err.message);
  }
}

async function addToPlaylist(playlistId, song) {
  if (!requireLogin()) return;
  if (!playlistId) return;
  song = normalizeSong(song);
  try {
    await api(`/api/playlists/${playlistId}/songs`, { method: 'POST', body: JSON.stringify(song) });
    await loadPlaylists();
    renderAll();
    toast('Agregado a playlist');
  } catch (err) {
    toast(err.message);
  }
}

async function removeFromPlaylist(playlistId, songId) {
  try {
    await api(`/api/playlists/${playlistId}/songs/${encodeURIComponent(songId)}`, { method: 'DELETE' });
    await loadPlaylists();
    renderPlaylists();
    toast('Canción quitada');
  } catch (err) {
    toast(err.message);
  }
}

/* ===========================
   PLAYER YOUTUBE CON AUTOPLAY SIGUIENTE
   =========================== */

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    createYouTubePlayer();
    return;
  }
  if (ytApiLoading) return;

  ytApiLoading = true;
  window.onYouTubeIframeAPIReady = createYouTubePlayer;

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.onerror = () => {
    ytApiLoading = false;
    directIframeMode = true;
    if (state.pendingSong) playSongDirect(state.pendingSong, state.pendingQueue);
  };
  document.head.appendChild(tag);

  setTimeout(() => {
    if (!state.playerReady && state.pendingSong) {
      directIframeMode = true;
      playSongDirect(state.pendingSong, state.pendingQueue);
    }
  }, 4500);
}

function createYouTubePlayer() {
  if (ytPlayer) return;
  ytApiLoading = false;
  directIframeMode = false;

  const box = $('youtubeFrame');
  if (!box) return;
  box.innerHTML = '';

  ytPlayer = new YT.Player('youtubeFrame', {
    width: '100%',
    height: '100%',
    videoId: '',
    playerVars: {
      autoplay: 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onReady: () => {
        state.playerReady = true;
        if (state.pendingSong) {
          const song = state.pendingSong;
          const queue = state.pendingQueue;
          state.pendingSong = null;
          state.pendingQueue = [];
          playSong(song, queue);
        }
      },
      onStateChange: (event) => {
        if (!window.YT || !YT.PlayerState) return;
        if (event.data === YT.PlayerState.PLAYING) state.isPlaying = true;
        if (event.data === YT.PlayerState.PAUSED) state.isPlaying = false;
        if (event.data === YT.PlayerState.ENDED) {
          state.isPlaying = false;
          updatePlayButton();
          nextSong();
          return;
        }
        updatePlayButton();
      },
      onError: (event) => {
        console.warn('YouTube player error:', event.data);
        state.isPlaying = false;
        updatePlayButton();
        toast('Ese video no permite reproducirse. Paso al siguiente.');
        setTimeout(nextSong, 900);
      }
    }
  });
}

function updatePlayButton() {
  $('playPauseBtn').textContent = state.isPlaying ? '⏸' : '▶';
}

function getYouTubeUrl(videoId) {
  const origin = window.location.origin;
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
    origin,
    widget_referrer: origin
  });
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

function setCurrentSongUi(song, queue = []) {
  song = normalizeSong(song);
  state.currentSong = song;
  state.queue = queue.length ? queue.map(normalizeSong).filter(Boolean) : state.queue;
  const currentId = getSongId(song);
  state.currentIndex = state.queue.findIndex(s => getSongId(s) === currentId);
  $('playerTitle').textContent = song.title || 'Sin título';
  $('playerArtist').textContent = song.artist || 'YouTube';
  $('playerCover').src = song.cover || '/assets/img/default-cover.svg';
}

function playSong(song, queue = []) {
  song = normalizeSong(song);
  if (!song || !song.videoId) return toast('Esta canción no tiene video para reproducir');
  setCurrentSongUi(song, queue);

  if (directIframeMode) return playSongDirect(song, queue);

  if (!ytPlayer || !state.playerReady || !ytPlayer.loadVideoById) {
    state.pendingSong = song;
    state.pendingQueue = queue;
    $('youtubeFrame').innerHTML = '<div class="loading-player">Cargando player...</div>';
    loadYouTubeAPI();
    return;
  }

  try {
    ytPlayer.loadVideoById(song.videoId);
    state.isPlaying = true;
    updatePlayButton();
  } catch (err) {
    console.error(err);
    playSongDirect(song, queue);
  }
}

function playSongDirect(song, queue = []) {
  song = normalizeSong(song);
  if (!song || !song.videoId) return toast('Esta canción no tiene video para reproducir');
  setCurrentSongUi(song, queue);
  $('youtubeFrame').innerHTML = `
    <iframe
      class="yt-iframe"
      src="${getYouTubeUrl(song.videoId)}"
      title="${escapeAttr(song.title || 'Picolas Music')}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  state.isPlaying = true;
  updatePlayButton();
}

function nextSong() {
  if (!state.queue.length) return;
  const next = (state.currentIndex + 1) % state.queue.length;
  playSong(state.queue[next], state.queue);
}

function prevSong() {
  if (!state.queue.length) return;
  const prev = state.currentIndex <= 0 ? state.queue.length - 1 : state.currentIndex - 1;
  playSong(state.queue[prev], state.queue);
}

function togglePlayPause() {
  if (!state.currentSong) {
    if (state.queue.length) return playSong(state.queue[0], state.queue);
    return toast('Elegí una canción');
  }

  if (directIframeMode || !ytPlayer || !state.playerReady) {
    if (state.isPlaying) {
      $('youtubeFrame').innerHTML = '';
      state.isPlaying = false;
      updatePlayButton();
    } else {
      playSong(state.currentSong, state.queue);
    }
    return;
  }

  try {
    if (state.isPlaying) {
      ytPlayer.pauseVideo();
      state.isPlaying = false;
    } else {
      ytPlayer.playVideo();
      state.isPlaying = true;
    }
    updatePlayButton();
  } catch {
    playSongDirect(state.currentSong, state.queue);
  }
}

/* ===========================
   UI
   =========================== */

function songCard(song, queue) {
  song = normalizeSong(song);
  const fav = isFavorite(song);
  const playlistOptions = state.playlists.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  const card = document.createElement('article');
  card.className = 'song-card';
  card.innerHTML = `
    <img class="cover" src="${escapeAttr(song.cover || '/assets/img/default-cover.svg')}" alt="${escapeAttr(song.title || 'Canción')}" loading="lazy">
    <div class="song-body">
      <h4 title="${escapeAttr(song.title || '')}">${escapeHtml(song.title || 'Sin título')}</h4>
      <p title="${escapeAttr(song.artist || '')}">${escapeHtml(song.artist || 'YouTube')}</p>
      <div class="song-actions">
        <button class="icon-btn play" type="button">▶</button>
        <button class="icon-btn fav ${fav ? 'fav-active' : ''}" type="button">${fav ? '💜' : '♡'}</button>
      </div>
      <select class="add-select">
        <option value="">+ Agregar a playlist</option>
        ${playlistOptions}
      </select>
    </div>`;
  card.querySelector('.play').onclick = () => playSong(song, queue);
  card.querySelector('.fav').onclick = () => toggleFavorite(song);
  card.querySelector('.add-select').onchange = (e) => { addToPlaylist(e.target.value, song); e.target.value = ''; };
  return card;
}

function renderSongs(container, songs) {
  container.innerHTML = '';
  songs = (songs || []).map(normalizeSong).filter(Boolean);
  if (!songs.length) {
    container.innerHTML = `<div class="status">No hay canciones todavía.</div>`;
    return;
  }
  songs.forEach(song => container.appendChild(songCard(song, songs)));
}

function renderPlaylists() {
  const box = $('playlistsGrid');
  box.innerHTML = '';
  if (!state.user) { box.innerHTML = `<div class="status">Iniciá sesión para crear playlists.</div>`; return; }
  if (!state.playlists.length) { box.innerHTML = `<div class="status">Todavía no tenés playlists. Creá una con el botón de arriba.</div>`; return; }

  state.playlists.forEach(p => {
    const card = document.createElement('article');
    card.className = 'playlist-card';
    const songs = (p.songs || []).map(normalizeSong).filter(Boolean);
    card.innerHTML = `
      <h4>📂 ${escapeHtml(p.name)}</h4>
      <p>${escapeHtml(p.description || `${songs.length} canciones`)}</p>
      <div class="song-actions">
        <button class="icon-btn play-list" type="button">▶ Reproducir</button>
        <button class="icon-btn delete-list" type="button">🗑️</button>
      </div>
      <div class="songs-list"></div>`;
    card.querySelector('.play-list').onclick = () => songs.length ? playSong(songs[0], songs) : toast('Playlist vacía');
    card.querySelector('.delete-list').onclick = () => deletePlaylist(p.id);
    const list = card.querySelector('.songs-list');
    if (!songs.length) list.innerHTML = `<p>No tiene canciones.</p>`;
    songs.forEach(song => {
      const row = document.createElement('div');
      row.className = 'playlist-song';
      row.innerHTML = `
        <img src="${escapeAttr(song.cover || '/assets/img/default-cover.svg')}" alt="">
        <div><strong>${escapeHtml(song.title || 'Sin título')}</strong><p>${escapeHtml(song.artist || '')}</p></div>
        <button class="icon-btn" type="button">×</button>`;
      row.onclick = (ev) => { if (ev.target.tagName !== 'BUTTON') playSong(song, songs); };
      row.querySelector('button').onclick = () => removeFromPlaylist(p.id, getSongId(song));
      list.appendChild(row);
    });
    box.appendChild(card);
  });
}

function renderAll() {
  renderSongs($('resultsGrid'), state.results);
  renderSongs($('favoritesGrid'), state.favorites);
  renderPlaylists();
}

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $(`${view}View`).classList.add('active-view');
  const titles = {
    home: ['Inicio', 'Buscá canciones y armá tu biblioteca.'],
    favorites: ['Favoritos', 'Tus canciones guardadas.'],
    playlists: ['Playlists', 'Tus listas personales.']
  };
  $('viewTitle').textContent = titles[view][0];
  $('viewSubtitle').textContent = titles[view][1];
  if (view === 'favorites') renderSongs($('favoritesGrid'), state.favorites);
  if (view === 'playlists') renderPlaylists();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]));
}

function escapeAttr(str) { return escapeHtml(str); }

function bindEvents() {
  $('searchForm').addEventListener('submit', searchSongs);
  $('openLogin').onclick = () => openAuth('login');
  $('openRegister').onclick = () => openAuth('register');
  $('heroRegister').onclick = () => openAuth('register');
  $('switchAuth').onclick = () => openAuth(state.authMode === 'login' ? 'register' : 'login');
  $('authForm').addEventListener('submit', handleAuth);
  $('logoutBtn').onclick = logout;
  $('openPlaylistModal').onclick = () => { if (requireLogin()) $('playlistModal').classList.remove('hidden'); };
  $('playlistForm').addEventListener('submit', createPlaylist);
  $('nextBtn').onclick = nextSong;
  $('prevBtn').onclick = prevSong;
  $('playPauseBtn').onclick = togglePlayPause;
  document.querySelectorAll('.close').forEach(btn => btn.onclick = () => closeModal(btn.dataset.close));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.onclick = () => showView(btn.dataset.view));
}

bindEvents();
loadMe().then(renderAll);
