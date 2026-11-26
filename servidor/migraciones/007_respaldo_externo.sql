-- Fase 4: qué archivos subidos ya tienen su copia fuera del servidor (para no volver a subirlos cada día).
CREATE TABLE respaldo_externo (
  ruta TEXT PRIMARY KEY,                              -- adjuntos/<código> o fotos/<nombre>
  subido_en TEXT NOT NULL
);
