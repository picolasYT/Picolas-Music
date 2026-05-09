# Picolas Music

Web player con:

- Registro gratis con usuario y contraseña
- Login / logout
- Búsqueda de música
- Player integrado con YouTube
- Autoplay de playlist: cuando termina una canción pasa a la siguiente
- Favoritos por usuario
- Playlists por usuario
- Admin panel en `/admin.html`
- PostgreSQL en Render
- Ban de usuarios e IPs

## Estructura

```txt
picolas-music/
├── server.js
├── package.json
├── frontend/
│   ├── index.html
│   ├── admin.html
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       └── admin.js
├── backend/
│   ├── config/db.js
│   ├── controllers/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   └── utils/
└── assets/
```

## Usar en Render

1. Crear una base de datos Postgres en Render.
2. Copiar la **Internal Database URL**.
3. En tu Web Service de Render, ir a Environment y agregar:

```txt
DATABASE_URL=postgresql://...
ADMIN_USERNAME=tu_usuario_admin
```

`ADMIN_USERNAME` es opcional, pero recomendado. Si ponés `ADMIN_USERNAME=picolas`, cuando exista el usuario `picolas`, el servidor lo marca como admin al iniciar.

4. Configurar:

```txt
Build Command: npm install
Start Command: npm start
```

5. Deploy.

Las tablas se crean solas al iniciar el servidor.

## Hacer admin manualmente desde Render SQL

Si ya creaste tu usuario y querés hacerlo admin:

```sql
UPDATE users
SET role = 'admin'
WHERE username = 'picolas';
```

Después cerrá sesión e iniciá sesión de nuevo.

## Admin panel

Abrí:

```txt
/admin.html
```

Permite ver:

- Usuarios registrados
- Últimos registros y logins
- IP de creación
- Última IP
- Estado activo / baneado
- Password hash cifrado
- Reset de contraseña
- Ban / desban de usuario
- Ban / desban de IP

Por seguridad, la app no guarda ni muestra contraseñas reales. Solo muestra el hash cifrado.

## Local

Necesitás tener PostgreSQL y una variable `DATABASE_URL`.

```bash
npm install
npm start
```

Abrir:

```txt
http://localhost:3000
```

## Nota sobre YouTube

El reproductor usa YouTube embebido. Algunos videos pueden no permitir reproducción embebida por decisión del dueño del video. Si eso pasa, la app intenta pasar al siguiente resultado.
