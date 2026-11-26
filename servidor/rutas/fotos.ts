// Foto de perfil y logo del espacio de trabajo.
// Las imágenes se piden por un nombre al azar imposible de adivinar; por eso se pueden mostrar
// también en tableros públicos sin revisar la sesión.
import fs from 'node:fs';
import type { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { Archivos } from '../archivos.ts';
import { exigirUsuario, fichaPublica, leerUsuario, registrarActividad } from '../nucleo.ts';
import { contexto, leerEspacio, puedeAdministrarEspacio, puedeVerEspacio } from '../permisos.ts';
import type { Usuario } from '../permisos.ts';
import { datoInvalido, noExiste, sinPermiso } from '../util.ts';

export function rutasFotos(app: FastifyInstance, db: DatabaseSync, archivos: Archivos) {
  const cuerpoCrudo = (req: { headers: Record<string, unknown>; body: unknown }): Readable => {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/octet-stream')) throw datoInvalido('Falta la imagen.');
    return req.body as Readable;
  };

  app.get('/api/fotos/:nombre', async (req, reply) => {
    const f = archivos.rutaFoto((req.params as { nombre: string }).nombre);
    if (!f) throw noExiste();
    return reply.header('content-type', f.mime).header('x-content-type-options', 'nosniff').header('cache-control', 'public, max-age=31536000, immutable').send(fs.createReadStream(f.ruta));
  });

  app.post('/api/yo/avatar', async (req) => {
    const u = exigirUsuario(req);
    const nombre = await archivos.guardarFoto(cuerpoCrudo(req));
    db.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').run(nombre, u.id);
    archivos.borrarFoto(u.avatar);
    return { avatar: nombre, usuario: fichaPublica(leerUsuario(db, u.id) as Usuario) };
  });
  app.delete('/api/yo/avatar', async (req) => {
    const u = exigirUsuario(req);
    db.prepare('UPDATE usuarios SET avatar = NULL WHERE id = ?').run(u.id);
    archivos.borrarFoto(u.avatar);
    return { avatar: null };
  });

  function espacioAdministrable(id: string, u: Usuario) {
    const e = leerEspacio(db, id);
    if (!e) throw noExiste();
    const c = contexto(db, u, e.id);
    if (!puedeVerEspacio(c, e)) throw noExiste();
    if (!puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede cambiar el logo.');
    return e;
  }
  app.post('/api/espacios/:id/logo', async (req) => {
    const u = exigirUsuario(req);
    const e = espacioAdministrable((req.params as { id: string }).id, u);
    const nombre = await archivos.guardarFoto(cuerpoCrudo(req));
    db.prepare('UPDATE espacios SET logo = ? WHERE id = ?').run(nombre, e.id);
    archivos.borrarFoto(e.logo);
    registrarActividad(db, 'espacio_actualizado', u.id, { espacio_id: e.id });
    return { logo: nombre };
  });
  app.delete('/api/espacios/:id/logo', async (req) => {
    const u = exigirUsuario(req);
    const e = espacioAdministrable((req.params as { id: string }).id, u);
    db.prepare('UPDATE espacios SET logo = NULL WHERE id = ?').run(e.id);
    archivos.borrarFoto(e.logo);
    return { logo: null };
  });
}
