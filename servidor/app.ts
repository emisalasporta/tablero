// Arma el servidor: las rutas /api y las pantallas ya construidas (dist/web).
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Archivos } from './archivos.ts';
import { identificar } from './nucleo.ts';
import { contexto, leerTablero, puedeVerTablero } from './permisos.ts';
import { rutasContenido } from './rutas/contenido.ts';
import { rutasCuenta } from './rutas/cuenta.ts';
import { rutasEspacios } from './rutas/espacios.ts';
import { rutasFotos } from './rutas/fotos.ts';
import { rutasTarjeta } from './rutas/tarjeta.ts';
import { rutasTableros } from './rutas/tableros.ts';
import { ErrorApi, noAutenticado, noExiste } from './util.ts';
import { leerVersion } from './version.ts';
import { Vivo } from './vivo.ts';

export interface Dependencias {
  db: DatabaseSync;
  zonaHoraria: string;
  dirWeb?: string;
  /** Carpeta donde se guardan los archivos subidos (adjuntos, fotos). */
  dirArchivos: string;
  /** Tope de cada adjunto, en MB. */
  maxAdjuntoMb?: number;
}

export function crearApp({ db, zonaHoraria, dirWeb, dirArchivos, maxAdjuntoMb }: Dependencias): FastifyInstance {
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

  // Los archivos subidos llegan "crudos" y se pasan tal cual a la ruta, que los va guardando en disco.
  app.addContentTypeParser('application/octet-stream', (_req, cuerpo, listo) => listo(null, cuerpo));
  const archivos = new Archivos(dirArchivos, maxAdjuntoMb);
  archivos.barrer(db);

  rutasCuenta(app, db);
  rutasEspacios(app, db, archivos);
  const vivo = new Vivo(db);
  app.addHook('onClose', async () => vivo.cerrar());
  rutasTableros(app, db, vivo, archivos);
  const ayuda = rutasContenido(app, db, vivo, archivos);
  rutasTarjeta(app, db, vivo, archivos, ayuda);
  rutasFotos(app, db, archivos);

  // Línea en vivo de un tablero. Solo se abre si la persona puede ver ese tablero.
  app.register(fastifyWebsocket, { options: { maxPayload: 4096 } });
  app.register(async (f) => {
    f.get('/api/tableros/:id/vivo', {
      websocket: true,
      preValidation: async (req) => {
        const t = leerTablero(db, (req.params as { id: string }).id);
        if (!t) throw noExiste();
        if (!puedeVerTablero(contexto(db, req.usuario, t.espacio_id, t.id), t)) throw req.usuario ? noExiste() : noAutenticado();
      },
    }, (socket, req) => {
      const t = leerTablero(db, (req.params as { id: string }).id);
      if (!t) return socket.close(4404, 'no existe');
      vivo.entrar(t.id, socket, req.usuario?.id ?? null);
    });
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'no_existe', mensaje: 'Esa dirección no existe.' });
    // Cualquier otra dirección la resuelve la pantalla (para que /t/xxxx funcione al recargar).
    if (dirWeb && fs.existsSync(path.join(dirWeb, 'index.html'))) return reply.sendFile('index.html', dirWeb);
    return reply.code(404).send('Las pantallas todavía no están armadas. Corré: npm run build');
  });

  if (dirWeb && fs.existsSync(dirWeb)) {
    app.register(fastifyStatic, { root: dirWeb, wildcard: false });
  }
  return app;
}
