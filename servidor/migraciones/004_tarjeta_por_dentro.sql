-- Tanda 2.3: lo que va adentro de una tarjeta.
-- Fechas, completada y portada son datos de la tarjeta; el resto son tablas propias.

ALTER TABLE tarjetas ADD COLUMN inicio TEXT;                       -- día de inicio: 2026-11-30
ALTER TABLE tarjetas ADD COLUMN vence TEXT;                        -- fecha y hora de vencimiento (UTC)
ALTER TABLE tarjetas ADD COLUMN completada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tarjetas ADD COLUMN portada TEXT NOT NULL DEFAULT '';  -- JSON: color o adjunto, tamaño y tono del texto

-- Ajustes de cómo se ve el tablero (mostrar portadas, mostrar el tilde de completada).
ALTER TABLE tableros ADD COLUMN ajustes TEXT NOT NULL DEFAULT '{}';

CREATE TABLE etiquetas (
  id TEXT PRIMARY KEY,
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',                                  -- por ejemplo "azul-2"; vacío = sin color
  creada_en TEXT NOT NULL
);
CREATE INDEX etiquetas_tablero ON etiquetas(tablero_id);

CREATE TABLE tarjeta_etiquetas (
  tarjeta_id TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  etiqueta_id TEXT NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (tarjeta_id, etiqueta_id)
);
CREATE INDEX tarjeta_etiquetas_etiqueta ON tarjeta_etiquetas(etiqueta_id);

CREATE TABLE tarjeta_miembros (
  tarjeta_id TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (tarjeta_id, usuario_id)
);
CREATE INDEX tarjeta_miembros_usuario ON tarjeta_miembros(usuario_id);

CREATE TABLE checklists (
  id TEXT PRIMARY KEY,
  tarjeta_id TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  posicion REAL NOT NULL,
  creada_en TEXT NOT NULL
);
CREATE INDEX checklists_tarjeta ON checklists(tarjeta_id, posicion);

CREATE TABLE checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  hecho INTEGER NOT NULL DEFAULT 0,
  posicion REAL NOT NULL,
  asignado_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  vence TEXT,
  creado_en TEXT NOT NULL
);
CREATE INDEX checklist_items_checklist ON checklist_items(checklist_id, posicion);

-- Adjuntos: un archivo subido (se guarda en la carpeta de datos con el id como nombre) o un enlace.
CREATE TABLE adjuntos (
  id TEXT PRIMARY KEY,
  tarjeta_id TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('archivo','enlace')),
  nombre TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT '',
  tamano INTEGER NOT NULL DEFAULT 0,
  posicion REAL NOT NULL,
  creado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL
);
CREATE INDEX adjuntos_tarjeta ON adjuntos(tarjeta_id, posicion);

CREATE TABLE comentarios (
  id TEXT PRIMARY KEY,
  tarjeta_id TEXT NOT NULL REFERENCES tarjetas(id) ON DELETE CASCADE,
  autor_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  creado_en TEXT NOT NULL,
  editado_en TEXT
);
CREATE INDEX comentarios_tarjeta ON comentarios(tarjeta_id, creado_en);

CREATE TABLE reacciones (
  comentario_id TEXT NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (comentario_id, usuario_id, emoji)
);

CREATE INDEX actividad_tarjeta ON actividad(tarjeta_id, creado_en);
