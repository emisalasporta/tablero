-- Fase 3: la puerta de Alex.
-- "llaves": cada forma de entrar sin contraseña en nombre de una cuenta robot (Alex).
--   · una conexión hecha desde Claude con permiso (tiene cliente y llave de renovación), o
--   · una llave fija creada a mano desde la app (no vence hasta que se anula).
-- De cada llave se guarda solo la huella: el valor real se muestra una única vez.

CREATE TABLE clientes_oauth (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  redirecciones TEXT NOT NULL,                       -- JSON: direcciones a las que se puede volver después del permiso
  creado_en TEXT NOT NULL
);

CREATE TABLE codigos_oauth (
  codigo_hash TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes_oauth(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,      -- la cuenta robot
  aprobado_por TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,    -- la persona que dio el permiso
  redireccion TEXT NOT NULL,
  desafio TEXT NOT NULL,
  expira_en TEXT NOT NULL
);

CREATE TABLE llaves (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  refresco_hash TEXT UNIQUE,
  cliente_id TEXT REFERENCES clientes_oauth(id) ON DELETE CASCADE,
  creada_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creada_en TEXT NOT NULL,
  ultima_vez TEXT,
  expira_en TEXT                                      -- vacío: no vence
);
CREATE INDEX llaves_usuario ON llaves(usuario_id);
