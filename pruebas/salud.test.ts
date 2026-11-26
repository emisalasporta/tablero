import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { abrirDb } from '../servidor/db.ts';
import { crearApp } from '../servidor/app.ts';
import { carpetaTemporal } from './ayuda.ts';

describe('chequeo de salud', () => {
  let app: FastifyInstance;
  let db: DatabaseSync;

  beforeEach(() => {
    const dir = carpetaTemporal();
    ({ db } = abrirDb(dir));
    app = crearApp({ db, zonaHoraria: 'America/Argentina/Buenos_Aires', dirArchivos: `${dir}/archivos` });
  });
  afterEach(async () => { await app.close(); db.close(); });

  it('responde ok con versión y cantidad de migraciones', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/salud' });
    expect(r.statusCode).toBe(200);
    const cuerpo = r.json();
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.app).toBe('meetmydash');
    expect(cuerpo.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(cuerpo.migraciones).toBeGreaterThanOrEqual(1);
  });

  it('una dirección /api que no existe devuelve 404 con mensaje claro', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe('no_existe');
  });
});
