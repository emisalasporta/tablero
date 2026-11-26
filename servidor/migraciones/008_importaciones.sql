-- Fase 5: registro de lo que se trajo de afuera (por ahora, exportaciones JSON de Trello).
-- Sirve para avisar si un tablero ya se había importado y para guardar el informe de qué entró y qué no.
CREATE TABLE importaciones (
  id TEXT PRIMARY KEY,
  origen TEXT NOT NULL,                               -- 'trello'
  origen_id TEXT NOT NULL,                            -- identificador del tablero en el origen
  tablero_id TEXT REFERENCES tableros(id) ON DELETE SET NULL,
  informe TEXT NOT NULL,                              -- JSON: cantidades, personas sin emparejar, lo que no entró
  creado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en TEXT NOT NULL
);
CREATE INDEX importaciones_origen ON importaciones(origen, origen_id);
