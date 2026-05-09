const token = localStorage.getItem('picolas_token') || '';
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2400);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || 'Error inesperado');
  return data;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]));
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-AR');
}

async function loadAdmin() {
  if (!token) {
    $('adminStatus').textContent = 'No tenés sesión. Volvé a la app e iniciá sesión con un usuario admin.';
    return;
  }

  try {
    const [statsData, usersData, logsData, ipsData] = await Promise.all([
      api('/api/admin/stats'),
      api('/api/admin/users'),
      api('/api/admin/logs'),
      api('/api/admin/ips')
    ]);

    $('adminStatus').classList.add('hidden');
    $('statsGrid').classList.remove('hidden');
    $('usersPanel').classList.remove('hidden');
    $('logsPanel').classList.remove('hidden');
    $('ipsPanel').classList.remove('hidden');

    $('statUsers').textContent = statsData.stats.users;
    $('statPlaylists').textContent = statsData.stats.playlists;
    $('statFavorites').textContent = statsData.stats.favorites;
    $('statBannedUsers').textContent = statsData.stats.bannedUsers;
    $('statBannedIps').textContent = statsData.stats.bannedIps;

    renderUsers(usersData.users || []);
    renderLogs(logsData.logs || []);
    renderIps(ipsData.bannedIps || []);
  } catch (err) {
    $('adminStatus').classList.remove('hidden');
    $('adminStatus').textContent = err.message.includes('Solo administradores')
      ? 'No sos administrador. Entrá con una cuenta role=admin.'
      : err.message;
  }
}

function renderUsers(users) {
  $('usersBody').innerHTML = users.map(user => `
    <tr>
      <td><strong>${user.id}</strong></td>
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td><span class="badge">${escapeHtml(user.role)}</span></td>
      <td>${user.banned ? `<span class="badge danger">Baneado</span><br><small>${escapeHtml(user.bannedReason || '')}</small>` : '<span class="badge ok">Activo</span>'}</td>
      <td class="hash-cell">${escapeHtml(user.passwordHash)}</td>
      <td>${escapeHtml(user.createdIp || '-')}</td>
      <td>${escapeHtml(user.lastIp || '-')}</td>
      <td>${user.favoritesCount || 0} fav<br>${user.playlistsCount || 0} listas</td>
      <td>${formatDate(user.createdAt)}</td>
      <td>
        ${user.banned
          ? `<button class="small-btn primary-mini" onclick="unbanUser(${user.id})">Desbanear</button>`
          : `<button class="small-btn danger" onclick="banUser(${user.id})">Banear</button>`}
        <button class="small-btn" onclick="resetPassword(${user.id}, '${escapeHtml(user.username)}')">Reset pass</button>
        ${user.createdIp ? `<button class="small-btn danger" onclick="banIp('${escapeHtml(user.createdIp)}')">Ban IP creación</button>` : ''}
        ${user.lastIp ? `<button class="small-btn danger" onclick="banIp('${escapeHtml(user.lastIp)}')">Ban última IP</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function renderLogs(logs) {
  $('logsBody').innerHTML = logs.map(log => `
    <tr>
      <td>${log.id}</td>
      <td><strong>${escapeHtml(log.username || '-')}</strong></td>
      <td>${escapeHtml(log.ip || '-')}</td>
      <td><span class="badge">${escapeHtml(log.action)}</span></td>
      <td>${formatDate(log.createdAt)}</td>
    </tr>
  `).join('');
}

function renderIps(ips) {
  $('ipsBody').innerHTML = ips.map(item => `
    <tr>
      <td><strong>${escapeHtml(item.ip)}</strong></td>
      <td>${escapeHtml(item.reason || '')}</td>
      <td>${formatDate(item.createdAt)}</td>
      <td><button class="small-btn" onclick="unbanIp('${encodeURIComponent(item.ip)}')">Quitar ban</button></td>
    </tr>
  `).join('') || '<tr><td colspan="4">No hay IPs baneadas.</td></tr>';
}

async function banUser(id) {
  const reason = prompt('Razón del ban:', 'Baneado por admin') || 'Baneado por admin';
  try {
    await api(`/api/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });
    toast('Usuario baneado');
    loadAdmin();
  } catch (err) { toast(err.message); }
}

async function unbanUser(id) {
  try {
    await api(`/api/admin/users/${id}/unban`, { method: 'POST' });
    toast('Usuario desbaneado');
    loadAdmin();
  } catch (err) { toast(err.message); }
}

async function resetPassword(id, username) {
  const password = prompt(`Nueva contraseña para ${username}:`);
  if (!password) return;
  try {
    await api(`/api/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
    toast('Contraseña reseteada');
    loadAdmin();
  } catch (err) { toast(err.message); }
}

async function banIp(ipValue) {
  const ip = ipValue || $('ipInput').value.trim();
  const reason = $('ipReason')?.value.trim() || prompt('Razón del ban de IP:', 'IP baneada por admin') || 'IP baneada por admin';
  if (!ip) return toast('Falta IP');
  try {
    await api('/api/admin/ips/ban', { method: 'POST', body: JSON.stringify({ ip, reason }) });
    toast('IP baneada');
    if ($('ipInput')) $('ipInput').value = '';
    if ($('ipReason')) $('ipReason').value = '';
    loadAdmin();
  } catch (err) { toast(err.message); }
}

async function unbanIp(encodedIp) {
  try {
    await api(`/api/admin/ips/${encodedIp}`, { method: 'DELETE' });
    toast('IP desbaneada');
    loadAdmin();
  } catch (err) { toast(err.message); }
}

$('refreshBtn').onclick = loadAdmin;
$('banIpForm').addEventListener('submit', (e) => {
  e.preventDefault();
  banIp();
});

window.banUser = banUser;
window.unbanUser = unbanUser;
window.resetPassword = resetPassword;
window.banIp = banIp;
window.unbanIp = unbanIp;

loadAdmin();
