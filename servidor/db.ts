// Base de datos: un solo archivo SQLite dentro de la carpeta de datos (el volumen en Dokploy).
// Las "migraciones" son los cambios de estructura, numerados. Se aplican solas al arrancar,
// una sola vez cada una, y antes de aplicar se guarda una copia del archivo.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DIR_MIGRACIONES = path.join(import.meta.dirname, 'migraciones');

export interface ResultadoMigracion {
  aplicadas: string[];
  copiaPrevia: string | null;
}

export function listarMigraciones(dir = DIR_MIGRACIONES): string[] {
  return fs.readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
}

export function abrirDb(dirDatos: string): { db: DatabaseSync; migracion: ResultadoMigracion } {
  fs.mkdirSync(dirDatos, { recursive: true });
  const archivo = path.join(dirDatos, 'tablero.db');
  const existia = fs.existsSync(archivo);
  const db = new DatabaseSync(archivo);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const migracion = migrar(db, dirDatos, existia);
  return { db, migracion };
}

export function migrar(db: DatabaseSync, dirDatos: string, respaldarAntes: boolean, dir = DIR_MIGRACIONES): ResultadoMigracion {
  db.exec(`CREATE TABLE IF NOT EXISTS migraciones (
    nombre TEXT PRIMARY KEY,
    aplicada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  const hechas = new Set(
    (db.prepare('SELECT nombre FROM migraciones').all() as { nombre: string }[]).map((f) => f.nombre),
  );
  const pendientes = listarMigraciones(dir).filter((n) => !hechas.has(n));
  if (pendientes.length === 0) return { aplicadas: [], copiaPrevia: null };

  let copiaPrevia: string | null = null;
  if (respaldarAntes) {
    const dirResp = path.join(dirDatos, 'respaldos');
    fs.mkdirSync(dirResp, { recursive: true });
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    copiaPrevia = path.join(dirResp, `antes-de-${pendientes[0].slice(0, 3)}-${sello}.db`);
    db.exec(`VACUUM INTO '${copiaPrevia.replace(/'/g, "''")}'`);
  }

  for (const nombre of pendientes) {
    const sql = fs.readFileSync(path.join(dir, nombre), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO migraciones (nombre) VALUES (?)').run(nombre);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Falló la migración ${nombre}: ${(e as Error).message}`);
    }
  }
  return { aplicadas: pendientes, copiaPrevia };
}
