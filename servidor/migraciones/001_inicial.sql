-- Primera migración: solo una tabla de ajustes generales de la instalación.
-- Las tablas de usuarios, espacios, tableros, etc. llegan en la tanda 2.1 en adelante.
CREATE TABLE ajustes (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
INSERT INTO ajustes (clave, valor) VALUES ('instalada_en', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
