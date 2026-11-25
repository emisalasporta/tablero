// Piezas comunes a todas las rutas: quién está pidiendo (sesión), registro de actividad e invitaciones.
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { ahora, ErrorApi, hashToken, noAutenticado, nuevoId, nuevoToken } from './util.ts';
import type { RolEspacio, RolTablero, Usuario } from './permisos.ts';

export const GALLETA = 'mmd_sesion';
const DIAS_SESION = 60;

declare module 'fastify' {
  interface FastifyRequest { usuario: Usuario | null; sesionId: string | null }
}

export function leerGalleta(req: FastifyRequest, nombre: string): string | null {
  const cab = req.headers.cookie;
  if (!cab) return null;
  for (const parte of cab.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

function ponerGalleta(req: FastifyRequest, reply: FastifyReply, valor: string, segundos: number) {
  const segura = req.protocol === 'https' ? '; Secure' : '';
  reply.header('set-cookie', `${GALLETA}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${segundos}${segura}`);
}

export function abrirSesion(db: DatabaseSync, req: FastifyRequest, reply: FastifyReply, usuarioId: string) {
  const token = nuevoToken();
  const t = ahora();
  const expira = new Date(Date.now() + DIAS_SESION * 86400_000).toISOString();
  db.prepare('INSERT INTO sesiones (id, usuario_id, token_hash, creada_en, ultima_vez, expira_en, dispositivo) VALUES (?,?,?,?,?,?,?)')
    .run(nuevoId(), usuarioId, hashToken(token), t, t, expira, String(req.headers['user-agent'] ?? '').slice(0, 200));
  ponerGalleta(req, reply, token, DIAS_SESION * 86400);
}

export function cerrarSesion(db: DatabaseSync, req: FastifyRequest, reply: FastifyReply) {
  if (req.sesionId) db.prepare('DELETE FROM sesiones WHERE id = ?').run(req.sesionId);
  ponerGalleta(req, reply, '', 0);
}

/** Lee la sesión del pedido y deja en `req.usuario` a la persona (o null si no inició sesión). */
export function identificar(db: DatabaseSync, req: FastifyRequest) {
  req.usuario = null;
  req.sesionId = null;
  const token = leerGalleta(req, GALLETA);
  if (!token) return;
  const s = db.prepare('SELECT id, usuario_id, expira_en, ultima_vez FROM sesiones WHERE token_hash = ?').get(hashToken(token)) as
    { id: string; usuario_id: string; expira_en: string; ultima_vez: string } | undefined;
  if (!s) return;
  if (s.expira_en < ahora()) { db.prepare('DELETE FROM sesiones WHERE id = ?').run(s.id); return; }
  const u = leerUsuario(db, s.usuario_id);
  if (!u) return;
  req.usuario = u;
  req.sesionId = s.id;
  // Se anota el último uso como mucho una vez por hora, para no escribir en cada pedido.
  if (Date.now() - Date.parse(s.ultima_vez) > 3600_000) db.prepare('UPDATE sesiones SET ultima_vez = ? WHERE id = ?').run(ahora(), s.id);
}

export function exigirUsuario(req: FastifyRequest): Usuario {
  if (!req.usuario) throw noAutenticado();
  return req.usuario;
}

const CAMPOS_USUARIO = 'id, email, usuario, nombre, iniciales, bio, avatar, es_admin_general, es_robot, zona_horaria, idioma, debe_cambiar_clave, creado_en';
export function leerUsuario(db: DatabaseSync, id: string): Usuario | null {
  return (db.prepare(`SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE id = ?`).get(id) as Usuario | undefined) ?? null;
}
export function buscarUsuario(db: DatabaseSync, emailOUsuario: string): Usuario | null {
  const v = emailOUsuario.trim().replace(/^@/, '');
  return (db.prepare(`SELECT ${CAMPOS_USUARIO} FROM usuarios WHERE email = ? OR usuario = ?`).get(v, v) as Usuario | undefined) ?? null;
}
/** Lo que los demás pueden ver de una persona (sin correo). */
export function fichaPublica(u: Pick<Usuario, 'id' | 'usuario' | 'nombre' | 'iniciales' | 'avatar' | 'es_robot'>) {
  return { id: u.id, usuario: u.usuario, nombre: u.nombre, iniciales: u.iniciales, avatar: u.avatar, es_robot: u.es_robot === 1 };
}

export interface DatosActividad { espacio_id?: string | null; tablero_id?: string | null; tarjeta_id?: string | null; datos?: Record<string, unknown> }
export function registrarActividad(db: DatabaseSync, tipo: string, actorId: string | null, d: DatosActividad = {}) {
  db.prepare('INSERT INTO actividad (id, tipo, actor_id, espacio_id, tablero_id, tarjeta_id, datos, creado_en) VALUES (?,?,?,?,?,?,?,?)')
    .run(nuevoId(), tipo, actorId, d.espacio_id ?? null, d.tablero_id ?? null, d.tarjeta_id ?? null, JSON.stringify(d.datos ?? {}), ahora());
}

// ---------- membresías ----------
export function sumarAEspacio(db: DatabaseSync, espacioId: string, usuarioId: string, rol: RolEspacio) {
  db.prepare(`INSERT INTO espacio_miembros (espacio_id, usuario_id, rol, creado_en) VALUES (?,?,?,?)
              ON CONFLICT(espacio_id, usuario_id) DO UPDATE SET desactivado = 0`).run(espacioId, usuarioId, rol, ahora());
}
export function sumarATablero(db: DatabaseSync, tableroId: string, usuarioId: string, rol: RolTablero) {
  db.prepare('INSERT INTO tablero_miembros (tablero_id, usuario_id, rol, creado_en) VALUES (?,?,?,?) ON CONFLICT(tablero_id, usuario_id) DO NOTHING')
    .run(tableroId, usuarioId, rol, ahora());
}
export function cantidadAdminsEspacio(db: DatabaseSync, espacioId: string): number {
  return (db.prepare("SELECT count(*) AS n FROM espacio_miembros WHERE espacio_id = ? AND rol = 'admin' AND desactivado = 0").get(espacioId) as { n: number }).n;
}
export function cantidadAdminsTablero(db: DatabaseSync, tableroId: string): number {
  return (db.prepare("SELECT count(*) AS n FROM tablero_miembros WHERE tablero_id = ? AND rol = 'admin'").get(tableroId) as { n: number }).n;
}

// ---------- invitaciones por enlace ----------
export interface Invitacion { id: string; tipo: 'instalacion' | 'espacio' | 'tablero'; destino_id: string | null; rol: string; creada_por: string | null; creada_en: string; usos: number; revocada: number }

/** Crea un enlace de invitación. Deja un solo enlace vivo por destino: el anterior se anula. Devuelve el código una única vez. */
export function crearInvitacion(db: DatabaseSync, tipo: Invitacion['tipo'], destinoId: string | null, rol: string, creadaPor: string): { id: string; token: string } {
  db.prepare('UPDATE invitaciones SET revocada = 1 WHERE tipo = ? AND destino_id IS ? AND revocada = 0').run(tipo, destinoId);
  const id = nuevoId();
  const token = nuevoToken();
  db.prepare('INSERT INTO invitaciones (id, tipo, destino_id, rol, token_hash, creada_por, creada_en) VALUES (?,?,?,?,?,?,?)')
    .run(id, tipo, destinoId, rol, hashToken(token), creadaPor, ahora());
  return { id, token };
}
export function leerInvitacion(db: DatabaseSync, token: string): Invitacion {
  const inv = db.prepare('SELECT id, tipo, destino_id, rol, creada_por, creada_en, usos, revocada FROM invitaciones WHERE token_hash = ?').get(hashToken(token)) as Invitacion | undefined;
  if (!inv || inv.revocada) throw new ErrorApi(410, 'invitacion_vencida', 'Este enlace de invitación ya no sirve. Pedí uno nuevo a quien te invitó.');
  return inv;
}
/** Aplica la invitación a una persona ya registrada. Devuelve a dónde entró. */
export function aceptarInvitacion(db: DatabaseSync, inv: Invitacion, usuario: Usuario): { tipo: Invitacion['tipo']; espacio_id: string | null; tablero_enlace: string | null } {
  let espacioId: string | null = null;
  let enlace: string | null = null;
  if (inv.tipo === 'espacio' && inv.destino_id) {
    sumarAEspacio(db, inv.destino_id, usuario.id, 'normal');
    espacioId = inv.destino_id;
    registrarActividad(db, 'espacio_miembro_sumado', usuario.id, { espacio_id: espacioId, datos: { usuario_id: usuario.id, nombre: usuario.nombre, por_enlace: true } });
  } else if (inv.tipo === 'tablero' && inv.destino_id) {
    const t = db.prepare('SELECT espacio_id, enlace FROM tableros WHERE id = ?').get(inv.destino_id) as { espacio_id: string; enlace: string } | undefined;
    if (!t) throw new ErrorApi(410, 'invitacion_vencida', 'El tablero de esta invitación ya no existe.');
    const rol: RolTablero = inv.rol === 'observador' ? 'observador' : 'normal';
    sumarATablero(db, inv.destino_id, usuario.id, rol);
    espacioId = t.espacio_id;
    enlace = t.enlace;
    registrarActividad(db, 'tablero_miembro_sumado', usuario.id, { espacio_id: espacioId, tablero_id: inv.destino_id, datos: { usuario_id: usuario.id, nombre: usuario.nombre, rol, por_enlace: true } });
  }
  db.prepare('UPDATE invitaciones SET usos = usos + 1 WHERE id = ?').run(inv.id);
  return { tipo: inv.tipo, espacio_id: espacioId, tablero_enlace: enlace };
}
