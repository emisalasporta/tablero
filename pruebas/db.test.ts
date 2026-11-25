import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { abrirDb, listarMigraciones, migrar } from '../servidor/db.ts';
import { carpetaTemporal } from './ayuda.ts';

describe('base de datos y migraciones', () => {
  it('una instalación nueva aplica todas las migraciones', () => {
    const { db, migracion } = abrirDb(carpetaTemporal());
    expect(migracion.aplicadas).toEqual(listarMigraciones());
    expect(migracion.copiaPrevia).toBeNull(); // no había nada que respaldar
    db.close();
  });

  it('al volver a abrir no repite migraciones y los datos siguen ahí', () => {
    const dir = carpetaTemporal();
    const a = abrirDb(dir);
    a.db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('prueba', 'sigue')").run();
    a.db.close();
    const b = abrirDb(dir);
    expect(b.migracion.aplicadas).toEqual([]);
    const fila = b.db.prepare("SELECT valor FROM ajustes WHERE clave = 'prueba'").get() as { valor: string };
    expect(fila.valor).toBe('sigue');
    b.db.close();
  });

  it('antes de una migración nueva sobre datos existentes guarda una copia que se puede abrir', () => {
    const dir = carpetaTemporal();
    const { db } = abrirDb(dir);
    db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('antes', 'si')").run();
    const dirMig = carpetaTemporal();
    for (const f of listarMigraciones()) fs.copyFileSync(path.join('servidor/migraciones', f), path.join(dirMig, f));
    fs.writeFileSync(path.join(dirMig, '999_prueba.sql'), 'CREATE TABLE de_prueba (x TEXT);');
    const r = migrar(db, dir, true, dirMig);
    expect(r.aplicadas).toEqual(['999_prueba.sql']);
    expect(r.copiaPrevia && fs.existsSync(r.copiaPrevia)).toBe(true);
    const copia = new DatabaseSync(r.copiaPrevia!);
    expect((copia.prepare("SELECT valor FROM ajustes WHERE clave = 'antes'").get() as { valor: string }).valor).toBe('si');
    expect(copia.prepare("SELECT name FROM sqlite_master WHERE name = 'de_prueba'").get()).toBeUndefined();
    copia.close();
    db.close();
  });

  it('si una migración falla no deja cambios a medias', () => {
    const dir = carpetaTemporal();
    const { db } = abrirDb(dir);
    const dirMig = carpetaTemporal();
    for (const f of listarMigraciones()) fs.copyFileSync(path.join('servidor/migraciones', f), path.join(dirMig, f));
    fs.writeFileSync(path.join(dirMig, '999_rota.sql'), 'CREATE TABLE medio (x TEXT); ESTO NO ES SQL;');
    expect(() => migrar(db, dir, false, dirMig)).toThrow(/999_rota/);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'medio'").get()).toBeUndefined();
    db.close();
  });
});
