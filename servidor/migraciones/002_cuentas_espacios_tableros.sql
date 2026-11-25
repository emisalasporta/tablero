-- Tanda 2.1: personas, sesiones, espacios de trabajo, tableros (solo lo necesario para permisos),
-- invitaciones, pedidos de acceso y registro de actividad.

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,      -- nombre corto para mencionar: @marta
  nombre TEXT NOT NULL,
  iniciales TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar TEXT,                                       -- archivo de la foto, si subió una
  clave_hash TEXT NOT NULL,
  es_admin_general INTEGER NOT NULL DEFAULT 0,       -- administra toda la instalación
  es_robot INTEGER NOT NULL DEFAULT 0,               -- cuentas como Alex (Fase 3)
  zona_horaria TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  idioma TEXT NOT NULL DEFAULT 'es',
  debe_cambiar_clave INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

CREATE TABLE sesiones (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  creada_en TEXT NOT NULL,
  ultima_vez TEXT NOT NULL,
  expira_en TEXT NOT NULL,
  dispositivo TEXT NOT NULL DEFAULT ''
);
CREATE INDEX sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE espacios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  sitio_web TEXT NOT NULL DEFAULT '',
  logo TEXT,
  visibilidad TEXT NOT NULL DEFAULT 'privado' CHECK (visibilidad IN ('privado','publico')),
  ajustes TEXT NOT NULL,                             -- JSON: quién crea/borra tableros, quién suma invitados
  creado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL
);

CREATE TABLE espacio_miembros (
  espacio_id TEXT NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin','normal')),
  desactivado INTEGER NOT NULL DEFAULT 0,            -- conserva el historial, sin acceso
  creado_en TEXT NOT NULL,
  PRIMARY KEY (espacio_id, usuario_id)
);
CREATE INDEX espacio_miembros_usuario ON espacio_miembros(usuario_id);

CREATE TABLE tableros (
  id TEXT PRIMARY KEY,
  enlace TEXT NOT NULL UNIQUE,                       -- código corto de la dirección: /t/Ab3dE9xK
  espacio_id TEXT NOT NULL REFERENCES espacios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  visibilidad TEXT NOT NULL DEFAULT 'espacio' CHECK (visibilidad IN ('privado','espacio','publico')),
  permisos TEXT NOT NULL,                            -- JSON: quién comenta, quién invita, unión libre, edición del espacio
  cerrado INTEGER NOT NULL DEFAULT 0,
  creado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL
);
CREATE INDEX tableros_espacio ON tableros(espacio_id);

CREATE TABLE tablero_miembros (
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol TEXT NOT NULL CHECK (rol IN ('admin','normal','observador')),
  creado_en TEXT NOT NULL,
  PRIMARY KEY (tablero_id, usuario_id)
);
CREATE INDEX tablero_miembros_usuario ON tablero_miembros(usuario_id);

CREATE TABLE invitaciones (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('instalacion','espacio','tablero')),
  destino_id TEXT,                                   -- espacio o tablero; vacío si es a la instalación
  rol TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  creada_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creada_en TEXT NOT NULL,
  usos INTEGER NOT NULL DEFAULT 0,
  revocada INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX invitaciones_destino ON invitaciones(tipo, destino_id);

CREATE TABLE pedidos_acceso (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('espacio','tablero')),
  destino_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
  creado_en TEXT NOT NULL,
  resuelto_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  resuelto_en TEXT
);
CREATE UNIQUE INDEX pedidos_pendientes ON pedidos_acceso(tipo, destino_id, usuario_id) WHERE estado = 'pendiente';

-- Registro único de actividad: de acá salen la línea de tiempo, los comentarios y los avisos.
CREATE TABLE actividad (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  actor_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  espacio_id TEXT,
  tablero_id TEXT,
  tarjeta_id TEXT,
  datos TEXT NOT NULL DEFAULT '{}',
  creado_en TEXT NOT NULL
);
CREATE INDEX actividad_tablero ON actividad(tablero_id, creado_en);
CREATE INDEX actividad_espacio ON actividad(espacio_id, creado_en);
