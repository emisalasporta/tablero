// Cuentas: crear cuenta, entrar, salir, perfil, contraseña y administración general de personas.
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { hashClave, verificarClave } from '../claves.ts';
import { abrirSesion, aceptarInvitacion, buscarUsuario, cerrarSesion, crearInvitacion, exigirUsuario, fichaPublica, leerInvitacion, leerUsuario } from '../nucleo.ts';
import type { Usuario } from '../permisos.ts';
import { ahora, datoInvalido, ErrorApi, iniciales, nuevoId, sinPermiso, texto, textoAleatorio, textoOpcional } from '../util.ts';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_USUARIO = /^[a-z0-9_]{3,30}$/;

function validarEmail(v: unknown): string {
  const e = texto(v, 'el correo', { max: 200 }).toLowerCase();
  if (!RE_EMAIL.test(e)) throw datoInvalido('Ese correo no parece válido.');
  return e;
}
function validarClave(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8) throw datoInvalido('La contraseña tiene que tener al menos 8 caracteres.');
  if (v.length > 200) throw datoInvalido('La contraseña es demasiado larga.');
  return v;
}
function usuarioLibre(db: DatabaseSync, base: string): string {
  let raiz = base.toLowerCase().normalize('NFD').replace(/[^a-z0-9_]/g, '').slice(0, 24);
  if (raiz.length < 3) raiz = 'usuario';
  let candidato = raiz;
  for (let i = 2; db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(candidato); i++) candidato = `${raiz}${i}`;
  return candidato;
}
/** Lo que una persona ve de sí misma. */
function fichaPropia(u: Usuario) {
  return { ...fichaPublica(u), email: u.email, bio: u.bio, zona_horaria: u.zona_horaria, idioma: u.idioma,
    es_admin_general: u.es_admin_general === 1, debe_cambiar_clave: u.debe_cambiar_clave === 1 };
}

// Freno simple contra adivinar contraseñas: 8 intentos fallidos por correo cada 15 minutos.
const fallos = new Map<string, { n: number; desde: number }>();
function frenoIntentos(clave: string) {
  const f = fallos.get(clave);
  if (f && Date.now() - f.desde > 15 * 60_000) fallos.delete(clave);
  if ((fallos.get(clave)?.n ?? 0) >= 8) throw new ErrorApi(429, 'demasiados_intentos', 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.');
}
function anotarFallo(clave: string) {
  const f = fallos.get(clave) ?? { n: 0, desde: Date.now() };
  f.n++;
  fallos.set(clave, f);
}

export function rutasCuenta(app: FastifyInstance, db: DatabaseSync) {
  const hayUsuarios = () => (db.prepare('SELECT count(*) AS n FROM usuarios WHERE es_robot = 0').get() as { n: number }).n > 0;

  // ¿Es una instalación nueva? La pantalla lo usa para ofrecer "crear la primera cuenta".
  app.get('/api/instalacion', async () => ({ hay_usuarios: hayUsuarios() }));

  app.post('/api/cuenta/registro', async (req, reply) => {
    const c = (req.body ?? {}) as Record<string, unknown>;
    const nombre = texto(c.nombre, 'el nombre', { max: 80 });
    const email = validarEmail(c.email);
    const clave = validarClave(c.clave);
    const primera = !hayUsuarios();
    // La app es privada: salvo la primera cuenta (que queda como administradora general), hace falta una invitación.
    const inv = primera ? null : typeof c.invitacion === 'string' && c.invitacion ? leerInvitacion(db, c.invitacion) : null;
    if (!primera && !inv) throw sinPermiso('Para crear una cuenta necesitás un enlace de invitación.');
    if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) throw new ErrorApi(409, 'email_usado', 'Ya hay una cuenta con ese correo. Iniciá sesión.');
    const id = nuevoId();
    db.prepare('INSERT INTO usuarios (id, email, usuario, nombre, iniciales, clave_hash, es_admin_general, creado_en) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, email, usuarioLibre(db, email.split('@')[0]), nombre, iniciales(nombre), await hashClave(clave), primera ? 1 : 0, ahora());
    const u = leerUsuario(db, id)!;
    const entrada = inv ? aceptarInvitacion(db, inv, u) : null;
    abrirSesion(db, req, reply, id);
    return reply.code(201).send({ usuario: fichaPropia(u), entrada });
  });

  app.post('/api/sesion', async (req, reply) => {
    const c = (req.body ?? {}) as Record<string, unknown>;
    const email = texto(c.email, 'el correo', { max: 200 }).toLowerCase();
    const clave = typeof c.clave === 'string' ? c.clave : '';
    frenoIntentos(email);
    const fila = db.prepare('SELECT id, clave_hash, es_robot FROM usuarios WHERE email = ?').get(email) as { id: string; clave_hash: string; es_robot: number } | undefined;
    if (!fila || fila.es_robot || !(await verificarClave(clave, fila.clave_hash))) {
      anotarFallo(email);
      throw new ErrorApi(401, 'credenciales', 'El correo o la contraseña no coinciden.');
    }
    fallos.delete(email);
    abrirSesion(db, req, reply, fila.id);
    return { usuario: fichaPropia(leerUsuario(db, fila.id)!) };
  });

  app.delete('/api/sesion', async (req, reply) => { cerrarSesion(db, req, reply); return { ok: true }; });

  app.get('/api/yo', async (req) => ({ usuario: fichaPropia(exigirUsuario(req)) }));

  app.patch('/api/yo', async (req) => {
    const u = exigirUsuario(req);
    const c = (req.body ?? {}) as Record<string, unknown>;
    const nombre = c.nombre === undefined ? u.nombre : texto(c.nombre, 'el nombre', { max: 80 });
    let usuario = u.usuario;
    if (c.usuario !== undefined) {
      usuario = texto(c.usuario, 'el nombre de usuario', { max: 30 }).toLowerCase().replace(/^@/, '');
      if (!RE_USUARIO.test(usuario)) throw datoInvalido('El nombre de usuario lleva de 3 a 30 letras minúsculas, números o guion bajo.');
      const otro = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario) as { id: string } | undefined;
      if (otro && otro.id !== u.id) throw new ErrorApi(409, 'usuario_usado', 'Ese nombre de usuario ya está en uso.');
    }
    const bio = textoOpcional(c.bio, 'la biografía', 1000) ?? u.bio;
    let zona = u.zona_horaria;
    if (c.zona_horaria !== undefined) {
      zona = texto(c.zona_horaria, 'la zona horaria', { max: 60 });
      try { new Intl.DateTimeFormat('es', { timeZone: zona }); } catch { throw datoInvalido('Esa zona horaria no existe.'); }
    }
    db.prepare('UPDATE usuarios SET nombre = ?, iniciales = ?, usuario = ?, bio = ?, zona_horaria = ? WHERE id = ?')
      .run(nombre, iniciales(nombre), usuario, bio, zona, u.id);
    return { usuario: fichaPropia(leerUsuario(db, u.id)!) };
  });

  app.post('/api/yo/clave', async (req) => {
    const u = exigirUsuario(req);
    const c = (req.body ?? {}) as Record<string, unknown>;
    const fila = db.prepare('SELECT clave_hash FROM usuarios WHERE id = ?').get(u.id) as { clave_hash: string };
    if (!(await verificarClave(typeof c.actual === 'string' ? c.actual : '', fila.clave_hash))) throw new ErrorApi(401, 'credenciales', 'La contraseña actual no coincide.');
    db.prepare('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 0 WHERE id = ?').run(await hashClave(validarClave(c.nueva)), u.id);
    // Se cierran las demás sesiones: si alguien más estaba adentro, queda afuera.
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND id IS NOT ?').run(u.id, req.sesionId);
    return { ok: true };
  });

  app.post('/api/yo/email', async (req) => {
    const u = exigirUsuario(req);
    const c = (req.body ?? {}) as Record<string, unknown>;
    const email = validarEmail(c.email);
    const fila = db.prepare('SELECT clave_hash FROM usuarios WHERE id = ?').get(u.id) as { clave_hash: string };
    if (!(await verificarClave(typeof c.clave === 'string' ? c.clave : '', fila.clave_hash))) throw new ErrorApi(401, 'credenciales', 'La contraseña no coincide.');
    const otro = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email) as { id: string } | undefined;
    if (otro && otro.id !== u.id) throw new ErrorApi(409, 'email_usado', 'Ya hay una cuenta con ese correo.');
    db.prepare('UPDATE usuarios SET email = ? WHERE id = ?').run(email, u.id);
    return { usuario: fichaPropia(leerUsuario(db, u.id)!) };
  });

  // Buscar una persona para sumarla a un espacio o tablero: por correo exacto o por nombre de usuario exacto.
  // (No se listan personas por aproximación, para no exponer quién tiene cuenta.)
  app.get('/api/usuarios/buscar', async (req) => {
    exigirUsuario(req);
    const q = String((req.query as Record<string, unknown>).q ?? '').trim();
    const u = q ? buscarUsuario(db, q) : null;
    return { usuario: u ? fichaPublica(u) : null };
  });

  // ---------- administración general ----------
  const exigirAdminGeneral = (u: Usuario) => { if (u.es_admin_general !== 1) throw sinPermiso('Solo la administración general puede hacer eso.'); };

  app.get('/api/admin/usuarios', async (req) => {
    exigirAdminGeneral(exigirUsuario(req));
    const filas = db.prepare('SELECT id, email, usuario, nombre, iniciales, avatar, es_admin_general, es_robot, creado_en FROM usuarios ORDER BY creado_en').all() as unknown as Usuario[];
    return { usuarios: filas.map((f) => ({ ...fichaPublica(f), email: f.email, es_admin_general: f.es_admin_general === 1, creado_en: f.creado_en })) };
  });

  // Enlace para que alguien cree su cuenta sin entrar todavía a ningún espacio.
  app.post('/api/admin/invitaciones', async (req, reply) => {
    const u = exigirUsuario(req);
    exigirAdminGeneral(u);
    const { id, token } = crearInvitacion(db, 'instalacion', null, 'normal', u.id);
    return reply.code(201).send({ id, token });
  });

  // Contraseña olvidada sin correo: la administración general genera una temporal y la pasa por otro medio.
  app.post('/api/admin/usuarios/:id/clave-temporal', async (req) => {
    exigirAdminGeneral(exigirUsuario(req));
    const { id } = req.params as { id: string };
    const destino = leerUsuario(db, id);
    if (!destino || destino.es_robot) throw new ErrorApi(404, 'no_existe', 'Esa persona no existe.');
    const temporal = textoAleatorio(12);
    db.prepare('UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 1 WHERE id = ?').run(await hashClave(temporal), id);
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(id);
    return { clave_temporal: temporal };
  });
}
