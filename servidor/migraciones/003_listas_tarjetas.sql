-- Tanda 2.2: listas y tarjetas.
-- El orden se guarda como un número con decimales ("posicion"), separado de a 65.536:
-- para meter algo entre dos se usa el número del medio y no hay que tocar a los vecinos.

CREATE TABLE listas (
  id TEXT PRIMARY KEY,
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  posicion REAL NOT NULL,
  archivada INTEGER NOT NULL DEFAULT 0,
  creada_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creada_en TEXT NOT NULL
);
CREATE INDEX listas_tablero ON listas(tablero_id, posicion);

CREATE TABLE tarjetas (
  id TEXT PRIMARY KEY,
  enlace TEXT NOT NULL UNIQUE,                       -- código corto para la dirección de la tarjeta
  numero INTEGER NOT NULL,                           -- número de la tarjeta dentro de su tablero (#12)
  tablero_id TEXT NOT NULL REFERENCES tableros(id) ON DELETE CASCADE,
  lista_id TEXT NOT NULL REFERENCES listas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  posicion REAL NOT NULL,
  archivada INTEGER NOT NULL DEFAULT 0,
  creada_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creada_en TEXT NOT NULL
);
CREATE INDEX tarjetas_lista ON tarjetas(lista_id, posicion);
CREATE INDEX tarjetas_tablero ON tarjetas(tablero_id);

-- Último número de tarjeta entregado en cada tablero.
ALTER TABLE tableros ADD COLUMN ultimo_numero INTEGER NOT NULL DEFAULT 0;
