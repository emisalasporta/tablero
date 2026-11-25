// Utilidades para las pruebas: cada prueba usa una carpeta de datos temporal propia.
// Nunca se tocan datos de verdad.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { abrirDb } from '../servidor/db.ts';
import { crearApp } from '../servidor/app.ts';

export function carpetaTemporal(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'meetmydash-prueba-'));
}

/** Una "persona" de prueba: recuerda su sesión entre pedidos, como un navegador. */
export class Persona {
  app: FastifyInstance;
  galleta = '';
  id = '';
  constructor(app: FastifyInstance) { this.app = app; }

  async pedir(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, cuerpo?: unknown) {
    const r = await this.app.inject({
      method: metodo, url,
      headers: { ...(this.galleta ? { cookie: this.galleta } : {}), ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}) },
      payload: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    const sc = r.headers['set-cookie'];
    if (sc) this.galleta = String(Array.isArray(sc) ? sc[0] : sc).split(';')[0];
    let json: any = null;
    try { json = r.json(); } catch { /* sin cuerpo */ }
    return { estado: r.statusCode, json };
  }
  get = (url: string) => this.pedir('GET', url);
  post = (url: string, cuerpo: unknown = {}) => this.pedir('POST', url, cuerpo);
  patch = (url: string, cuerpo: unknown = {}) => this.pedir('PATCH', url, cuerpo);
  del = (url: string) => this.pedir('DELETE', url);
}

export interface Mundo { app: FastifyInstance; db: DatabaseSync; cerrar: () => Promise<void>; anonimo: Persona;
  /** Crea una cuenta. La primera es administradora general; las demás necesitan invitación (se genera sola). */
  registrar: (nombre: string) => Promise<Persona>; }

export function crearMundo(): Mundo {
  const { db } = abrirDb(carpetaTemporal());
  const app = crearApp({ db, zonaHoraria: 'America/Argentina/Buenos_Aires' });
  let primera: Persona | null = null;
  const registrar = async (nombre: string) => {
    const p = new Persona(app);
    const email = `${nombre.toLowerCase().replace(/\s+/g, '.')}@prueba.test`;
    let invitacion: string | undefined;
    if (primera) invitacion = (await primera.post('/api/admin/invitaciones')).json.token;
    const r = await p.post('/api/cuenta/registro', { nombre, email, clave: 'clave-de-prueba', invitacion });
    if (r.estado !== 201) throw new Error(`No se pudo registrar a ${nombre}: ${JSON.stringify(r.json)}`);
    p.id = r.json.usuario.id;
    if (!primera) primera = p;
    return p;
  };
  return { app, db, registrar, anonimo: new Persona(app), cerrar: async () => { await app.close(); db.close(); } };
}
