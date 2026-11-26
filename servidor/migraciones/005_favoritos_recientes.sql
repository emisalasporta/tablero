-- Tanda 2.4: lo que cada persona guarda de cada tablero: si lo marcó como favorito y cuándo lo abrió por última vez.
CREATE TABLE tablero_usuario (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  favorito INTEGER NOT NULL DEFAULT 0,
  favorito_en TEXT,
  visto_en TEXT,
  PRIMARY KEY (usuario_id, tablero_id)
);
