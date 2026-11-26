// Espacios de trabajo: crear, ajustes, miembros, invitados, invitaciones y pedidos de acceso.
import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import type { Archivos } from '../archivos.ts';
import { aceptarInvitacion, buscarUsuario, cantidadAdminsEspacio, crearInvitacion, exigirUsuario, fichaPublica, leerInvitacion, leerUsuario, registrarActividad, sumarAEspacio } from '../nucleo.ts';
import { AJUSTES_ESPACIO_INICIALES, contexto, leerEspacio, puedeAdministrarEspacio, puedeVerEspacio, QUIEN, VIS_TABLERO } from '../permisos.ts';
import type { AjustesEspacio, Espacio, RolEspacio, Usuario } from '../permisos.ts';
import { ahora, datoInvalido, ErrorApi, noExiste, nuevoId, opcion, sinPermiso, texto, textoOpcional } from '../util.ts';

function validarAjustes(v: unknown, actuales: AjustesEspacio): AjustesEspacio {
  if (typeof v !== 'object' || v === null) throw datoInvalido('Los ajustes no tienen el formato esperado.');
  const a = v as Record<string, unknown>;
  const nuevo: AjustesEspacio = { crear: { ...actuales.crear }, borrar: { ...actuales.borrar }, invitados: actuales.invitados };
  for (const grupo of ['crear', 'borrar'] as const) {
    const g = a[grupo];
    if (g === undefined) continue;
    if (typeof g !== 'object' || g === null) throw datoInvalido(`Ajuste "${grupo}" inválido.`);
    for (const vis of VIS_TABLERO) {
      const valor = (g as Record<string, unknown>)[vis];
      if (valor !== undefined) nuevo[grupo][vis] = opcion(valor, `${grupo}.${vis}`, QUIEN);
    }
  }
  if (a.invitados !== undefined) nuevo.invitados = opcion(a.invitados, 'invitados', ['miembros', 'admins'] as const);
  return nuevo;
}

export function rutasEspacios(app: FastifyInstance, db: DatabaseSync, archivos: Archivos) {
  /** Trae el espacio y verifica que la persona pueda verlo. Si no puede, responde como si no existiera. */
  function abrir(id: string, u: Usuario | null) {
    const e = leerEspacio(db, id);
    if (!e) throw noExiste();
    const c = contexto(db, u, e.id);
    if (!puedeVerEspacio(c, e)) throw noExiste();
    return { e, c };
  }
  const resumen = (e: Espacio) => ({ id: e.id, nombre: e.nombre, descripcion: e.descripcion, sitio_web: e.sitio_web, logo: e.logo, visibilidad: e.visibilidad });

  // Mis espacios: donde soy miembro y donde soy invitado (estoy en algún tablero).
  app.get('/api/espacios', async (req) => {
    const u = exigirUsuario(req);
    const propios = db.prepare(`SELECT e.id, m.rol FROM espacios e JOIN espacio_miembros m ON m.espacio_id = e.id
                                WHERE m.usuario_id = ? AND m.desactivado = 0 ORDER BY e.nombre COLLATE NOCASE`).all(u.id) as { id: string; rol: RolEspacio }[];
    const deInvitado = db.prepare(`SELECT DISTINCT t.espacio_id AS id FROM tablero_miembros tm JOIN tableros t ON t.id = tm.tablero_id
                                   WHERE tm.usuario_id = ? AND t.espacio_id NOT IN (SELECT espacio_id FROM espacio_miembros WHERE usuario_id = ?)`).all(u.id, u.id) as { id: string }[];
    return {
      espacios: [
        ...propios.map((p) => ({ ...resumen(leerEspacio(db, p.id)!), rol: p.rol, invitado: false })),
        ...deInvitado.map((p) => ({ ...resumen(leerEspacio(db, p.id)!), rol: null, invitado: true })),
      ],
    };
  });

  app.post('/api/espacios', async (req, reply) => {
    const u = exigirUsuario(req);
    const c = (req.body ?? {}) as Record<string, unknown>;
    const id = nuevoId();
    db.prepare('INSERT INTO espacios (id, nombre, descripcion, ajustes, creado_por, creado_en) VALUES (?,?,?,?,?,?)')
      .run(id, texto(c.nombre, 'el nombre del espacio', { max: 100 }), textoOpcional(c.descripcion, 'la descripción') ?? '', JSON.stringify(AJUSTES_ESPACIO_INICIALES), u.id, ahora());
    sumarAEspacio(db, id, u.id, 'admin');
    registrarActividad(db, 'espacio_creado', u.id, { espacio_id: id });
    return reply.code(201).send({ espacio: { ...resumen(leerEspacio(db, id)!), rol: 'admin', invitado: false } });
  });

  app.get('/api/espacios/:id', async (req) => {
    const { e, c } = abrir((req.params as { id: string }).id, req.usuario);
    const miembro = c.rolEspacio !== null || c.adminGeneral;
    return {
      espacio: { ...resumen(e), ajustes: miembro ? e.ajustes : undefined },
      mi: { rol: c.rolEspacio, invitado: c.esInvitado, administra: puedeAdministrarEspacio(c) },
    };
  });

  app.patch('/api/espacios/:id', async (req) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede cambiar sus ajustes.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const nombre = b.nombre === undefined ? e.nombre : texto(b.nombre, 'el nombre del espacio', { max: 100 });
    const descripcion = textoOpcional(b.descripcion, 'la descripción') ?? e.descripcion;
    const sitio = textoOpcional(b.sitio_web, 'el sitio web', 300) ?? e.sitio_web;
    if (sitio && !/^https?:\/\//i.test(sitio)) throw datoInvalido('El sitio web tiene que empezar con http:// o https://');
    const vis = b.visibilidad === undefined ? e.visibilidad : opcion(b.visibilidad, 'la visibilidad', ['privado', 'publico'] as const);
    const ajustes = b.ajustes === undefined ? e.ajustes : validarAjustes(b.ajustes, e.ajustes);
    db.prepare('UPDATE espacios SET nombre = ?, descripcion = ?, sitio_web = ?, visibilidad = ?, ajustes = ? WHERE id = ?')
      .run(nombre, descripcion, sitio, vis, JSON.stringify(ajustes), e.id);
    registrarActividad(db, 'espacio_actualizado', u.id, { espacio_id: e.id });
    const nuevo = leerEspacio(db, e.id)!;
    return { espacio: { ...resumen(nuevo), ajustes: nuevo.ajustes } };
  });

  app.delete('/api/espacios/:id', async (req) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede borrarlo.');
    const abiertos = (db.prepare('SELECT count(*) AS n FROM tableros WHERE espacio_id = ? AND cerrado = 0').get(e.id) as { n: number }).n;
    if (abiertos > 0) throw new ErrorApi(409, 'tiene_tableros', `El espacio tiene ${abiertos} tablero(s) abierto(s). Cerralos o movelos antes de borrarlo.`);
    db.prepare('DELETE FROM espacios WHERE id = ?').run(e.id);
    archivos.borrarFoto(e.logo);
    archivos.barrer(db);
    return { ok: true };
  });

  // ---------- miembros e invitados ----------
  app.get('/api/espacios/:id/miembros', async (req) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (c.rolEspacio === null && !c.adminGeneral) throw sinPermiso('Solo los miembros del espacio ven esta lista.');
    const administra = puedeAdministrarEspacio(c);
    const miembros = db.prepare(`SELECT u.id, u.usuario, u.nombre, u.iniciales, u.avatar, u.es_robot, u.email, m.rol, m.desactivado, m.creado_en
                                 FROM espacio_miembros m JOIN usuarios u ON u.id = m.usuario_id WHERE m.espacio_id = ? ORDER BY u.nombre COLLATE NOCASE`).all(e.id) as unknown as (Usuario & { rol: RolEspacio; desactivado: number })[];
    const invitados = db.prepare(`SELECT u.id, u.usuario, u.nombre, u.iniciales, u.avatar, u.es_robot, u.email, count(*) AS tableros
                                  FROM tablero_miembros tm JOIN tableros t ON t.id = tm.tablero_id JOIN usuarios u ON u.id = tm.usuario_id
                                  WHERE t.espacio_id = ? AND u.id NOT IN (SELECT usuario_id FROM espacio_miembros WHERE espacio_id = ?)
                                  GROUP BY u.id ORDER BY u.nombre COLLATE NOCASE`).all(e.id, e.id) as unknown as (Usuario & { tableros: number })[];
    const pedidos = !administra ? [] : db.prepare(`SELECT p.id, p.creado_en, u.id AS uid, u.usuario, u.nombre, u.iniciales, u.avatar, u.es_robot
                                 FROM pedidos_acceso p JOIN usuarios u ON u.id = p.usuario_id WHERE p.tipo = 'espacio' AND p.destino_id = ? AND p.estado = 'pendiente' ORDER BY p.creado_en`).all(e.id) as unknown as (Usuario & { uid: string })[];
    return {
      // El correo de los demás solo lo ve quien administra.
      miembros: miembros.map((m) => ({ ...fichaPublica(m), email: administra ? m.email : undefined, rol: m.rol, desactivado: m.desactivado === 1 })),
      invitados: invitados.map((m) => ({ ...fichaPublica(m), email: administra ? m.email : undefined, tableros: m.tableros })),
      pedidos: pedidos.map((p) => ({ id: p.id, creado_en: p.creado_en, persona: fichaPublica({ ...p, id: p.uid }) })),
    };
  });

  // Sumar a alguien que ya tiene cuenta (por correo o nombre de usuario). También convierte un invitado en miembro.
  app.post('/api/espacios/:id/miembros', async (req, reply) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede sumar miembros.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const persona = typeof b.usuario_id === 'string' ? leerUsuario(db, b.usuario_id) : buscarUsuario(db, texto(b.quien, 'el correo o nombre de usuario'));
    if (!persona) throw new ErrorApi(404, 'persona_no_encontrada', 'No hay ninguna cuenta con ese correo o nombre de usuario. Pasale un enlace de invitación.');
    const rol = b.rol === undefined ? 'normal' : opcion(b.rol, 'el rol', ['admin', 'normal'] as const);
    if (db.prepare('SELECT 1 FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ?').get(e.id, persona.id)) throw new ErrorApi(409, 'ya_es_miembro', `${persona.nombre} ya es miembro del espacio.`);
    sumarAEspacio(db, e.id, persona.id, rol);
    db.prepare("UPDATE pedidos_acceso SET estado = 'aprobado', resuelto_por = ?, resuelto_en = ? WHERE tipo = 'espacio' AND destino_id = ? AND usuario_id = ? AND estado = 'pendiente'").run(u.id, ahora(), e.id, persona.id);
    registrarActividad(db, 'espacio_miembro_sumado', u.id, { espacio_id: e.id, datos: { usuario_id: persona.id, nombre: persona.nombre, rol } });
    return reply.code(201).send({ miembro: { ...fichaPublica(persona), rol, desactivado: false } });
  });

  app.patch('/api/espacios/:id/miembros/:uid', async (req) => {
    const u = exigirUsuario(req);
    const { id, uid } = req.params as { id: string; uid: string };
    const { e, c } = abrir(id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede cambiar roles.');
    const actual = db.prepare('SELECT rol, desactivado FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ?').get(e.id, uid) as { rol: RolEspacio; desactivado: number } | undefined;
    if (!actual) throw noExiste('Esa persona no es miembro del espacio.');
    const b = (req.body ?? {}) as Record<string, unknown>;
    const rol = b.rol === undefined ? actual.rol : opcion(b.rol, 'el rol', ['admin', 'normal'] as const);
    const desactivado = b.desactivado === undefined ? actual.desactivado : b.desactivado ? 1 : 0;
    const dejaDeAdministrar = actual.rol === 'admin' && !actual.desactivado && (rol !== 'admin' || desactivado === 1);
    if (dejaDeAdministrar && cantidadAdminsEspacio(db, e.id) <= 1) throw new ErrorApi(409, 'ultimo_admin', 'El espacio tiene que tener al menos una persona que lo administre.');
    db.prepare('UPDATE espacio_miembros SET rol = ?, desactivado = ? WHERE espacio_id = ? AND usuario_id = ?').run(rol, desactivado, e.id, uid);
    registrarActividad(db, 'espacio_miembro_cambiado', u.id, { espacio_id: e.id, datos: { usuario_id: uid, rol, desactivado: desactivado === 1 } });
    return { ok: true, rol, desactivado: desactivado === 1 };
  });

  // Quitar a alguien (o salir uno mismo). Con ?de_tableros=1 también se lo quita de los tableros del espacio.
  app.delete('/api/espacios/:id/miembros/:uid', async (req) => {
    const u = exigirUsuario(req);
    const { id, uid } = req.params as { id: string; uid: string };
    const { e, c } = abrir(id, u);
    if (uid !== u.id && !puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede quitar miembros.');
    const actual = db.prepare('SELECT rol, desactivado FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ?').get(e.id, uid) as { rol: RolEspacio; desactivado: number } | undefined;
    const deTableros = String((req.query as Record<string, unknown>).de_tableros ?? '') === '1';
    if (!actual && !deTableros) throw noExiste('Esa persona no es miembro del espacio.');
    if (actual?.rol === 'admin' && !actual.desactivado && cantidadAdminsEspacio(db, e.id) <= 1) throw new ErrorApi(409, 'ultimo_admin', 'El espacio tiene que tener al menos una persona que lo administre.');
    db.prepare('DELETE FROM espacio_miembros WHERE espacio_id = ? AND usuario_id = ?').run(e.id, uid);
    if (deTableros) db.prepare('DELETE FROM tablero_miembros WHERE usuario_id = ? AND tablero_id IN (SELECT id FROM tableros WHERE espacio_id = ?)').run(uid, e.id);
    registrarActividad(db, 'espacio_miembro_quitado', u.id, { espacio_id: e.id, datos: { usuario_id: uid, de_tableros: deTableros } });
    return { ok: true };
  });

  // ---------- enlace de invitación ----------
  app.get('/api/espacios/:id/invitacion', async (req) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso();
    const inv = db.prepare("SELECT id, creada_en, usos FROM invitaciones WHERE tipo = 'espacio' AND destino_id = ? AND revocada = 0").get(e.id);
    return { invitacion: inv ?? null };
  });
  app.post('/api/espacios/:id/invitacion', async (req, reply) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso('Solo quien administra el espacio puede crear enlaces de invitación.');
    return reply.code(201).send(crearInvitacion(db, 'espacio', e.id, 'normal', u.id));
  });
  app.delete('/api/espacios/:id/invitacion', async (req) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (!puedeAdministrarEspacio(c)) throw sinPermiso();
    db.prepare("UPDATE invitaciones SET revocada = 1 WHERE tipo = 'espacio' AND destino_id = ?").run(e.id);
    return { ok: true };
  });

  // Qué ofrece un enlace de invitación (se puede mirar sin cuenta, para decidir si crear una).
  app.get('/api/invitaciones/:token', async (req) => {
    const inv = leerInvitacion(db, (req.params as { token: string }).token);
    let destino: string | null = null;
    if (inv.tipo === 'espacio') destino = leerEspacio(db, inv.destino_id!)?.nombre ?? null;
    if (inv.tipo === 'tablero') destino = (db.prepare('SELECT nombre FROM tableros WHERE id = ?').get(inv.destino_id) as { nombre: string } | undefined)?.nombre ?? null;
    const quien = inv.creada_por ? leerUsuario(db, inv.creada_por)?.nombre ?? null : null;
    return { tipo: inv.tipo, destino, invita: quien };
  });
  app.post('/api/invitaciones/:token/aceptar', async (req) => {
    const u = exigirUsuario(req);
    return { entrada: aceptarInvitacion(db, leerInvitacion(db, (req.params as { token: string }).token), u) };
  });

  // ---------- pedidos de acceso ----------
  // Pedir sumarse a un espacio. Sirve para invitados (ya están en un tablero) o para espacios públicos.
  app.post('/api/espacios/:id/pedidos', async (req, reply) => {
    const u = exigirUsuario(req);
    const { e, c } = abrir((req.params as { id: string }).id, u);
    if (c.rolEspacio !== null) throw new ErrorApi(409, 'ya_es_miembro', 'Ya sos miembro de este espacio.');
    try {
      db.prepare("INSERT INTO pedidos_acceso (id, tipo, destino_id, usuario_id, creado_en) VALUES (?, 'espacio', ?, ?, ?)").run(nuevoId(), e.id, u.id, ahora());
    } catch { throw new ErrorApi(409, 'ya_pedido', 'Ya pediste sumarte. Falta que alguien que administra lo apruebe.'); }
    return reply.code(201).send({ ok: true });
  });
}
