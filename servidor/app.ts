// Arma el servidor: las rutas /api y las pantallas ya construidas (dist/web).
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { identificar } from './nucleo.ts';
import { rutasCuenta } from './rutas/cuenta.ts';
import { rutasEspacios } from './rutas/espacios.ts';
import { rutasTableros } from './rutas/tableros.ts';
import { ErrorApi } from './util.ts';
import { leerVersion } from './version.ts';

export interface Dependencias {
  db: DatabaseSync;
  zonaHoraria: string;
  dirWeb?: string;
}

export function crearApp({ db, zonaHoraria, dirWeb }: Dependencias): FastifyInstance {
  // trustProxy: la app corre detrás del proxy de Dokploy y de Cloudflare; así sabe si el pedido original vino por HTTPS.
  const app = Fastify({ logger: false, trustProxy: true, bodyLimit: 1024 * 1024 });
  const version = leerVersion();

  app.decorateRequest('usuario', null);
  app.decorateRequest('sesionId', null);
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/')) identificar(db, req);
  });

  // Todos los errores salen con la misma forma: { error: código, mensaje: texto para la persona }.
  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, _req, reply) => {
    if (err instanceof ErrorApi) return reply.code(err.estado).send({ error: err.codigo, mensaje: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: 'pedido_invalido', mensaje: 'El pedido no tiene el formato esperado.' });
    console.error(err);
    return reply.code(500).send({ error: 'interno', mensaje: 'Algo falló del lado del servidor. Probá de nuevo.' });
  });

  // Chequeo de salud: sirve para saber qué versión está publicada y si la base responde.
  app.get('/api/salud', async () => {
    const fila = db.prepare('SELECT count(*) AS n FROM migraciones').get() as { n: number };
    return {
      ok: true,
      app: 'meetmydash',
      version: version.version,
      commit: version.commit,
      armada_en: version.armada_en,
      migraciones: fila.n,
      zona: zonaHoraria,
      ahora: new Date().toISOString(),
    };
  });

  rutasCuenta(app, db);
  rutasEspacios(app, db);
  rutasTableros(app, db);

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'no_existe', mensaje: 'Esa dirección no existe.' });
    // Cualquier otra dirección la resuelve la pantalla (para que /t/xxxx funcione al recargar).
    if (dirWeb && fs.existsSync(path.join(dirWeb, 'index.html'))) return reply.sendFile('index.html');
    return reply.code(404).send('Las pantallas todavía no están armadas. Corré: npm run build');
  });

  if (dirWeb && fs.existsSync(dirWeb)) {
    app.register(fastifyStatic, { root: dirWeb, wildcard: false });
  }
  return app;
}
