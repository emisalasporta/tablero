// La puerta de Alex, parte 1: quién puede entrar.
// Alex es una cuenta "robot" con administración general. No tiene contraseña: entra con llaves.
// Hay dos formas de darle una llave, las dos reservadas a una persona con administración general y sesión abierta:
//   1. Permiso desde Claude (el estándar OAuth 2.1): Claude se presenta, la persona aprueba en una pantalla
//      de la app y Claude recibe una llave que se renueva sola.
//   2. Llave fija: se crea a mano en "Mi cuenta" y se copia una sola vez (sirve para Claude Code o programas propios).
// Una llave nunca puede crear ni anular otras llaves: eso solo lo hace una persona.
import crypto from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { exigirUsuario, fichaPublica, leerUsuario } from '../nucleo.ts';
import type { Usuario } from '../permisos.ts';
import { ahora, datoInvalido, ErrorApi, hashToken, noExiste, nuevoId, nuevoToken, sinPermiso, texto } from '../util.ts';

const MINUTOS_CODIGO = 5;
const HORAS_ACCESO = 1;
const MAX_CLIENTES = 300;

/** Dirección pública de la app (sin barra final). Sale de la configuración o del pedido mismo. */
export function direccionBase(req: FastifyRequest, urlPublica?: string): string {
  return (urlPublica || `${req.protocol}://${req.host}`).replace(/\/+$/, '');
}

/** La cuenta de Alex. Se crea la primera vez que hace falta. */
export function asegurarAlex(db: DatabaseSync): Usuario {
  const f = db.prepare('SELECT id FROM usuarios WHERE es_robot = 1 ORDER BY creado_en LIMIT 1').get() as { id: string } | undefined;
  if (f) return leerUsuario(db, f.id)!;
  const id = nuevoId();
  let usuario = 'alex';
  for (let i = 2; db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario); i++) usuario = `alex${i}`;
  db.prepare(`INSERT INTO usuarios (id, email, usuario, nombre, iniciales, bio, clave_hash, es_admin_general, es_robot, creado_en)
              VALUES (?,?,?,?,?,?,?,1,1,?)`).run(id, `${usuario}@robot.meetmydash`, usuario, 'Alex', 'AX', 'Asistente (Claude). Entra por la puerta para asistentes, sin contraseña.', 'sin-clave', ahora());
  return leerUsuario(db, id)!;
}

const errorOauth = (codigo: string, descripcion: string, estado = 400) => Object.assign(new ErrorApi(estado, codigo, descripcion), { oauth: true });
const direccionValida = (u: unknown): u is string => {
  if (typeof u !== 'string' || u.length > 500) return false;
  try {
    const d = new URL(u);
    if (d.hash) return false;
    return d.protocol === 'https:' || (d.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(d.hostname));
  } catch { return false; }
};

export function rutasPuerta(app: FastifyInstance, db: DatabaseSync, urlPublica?: string) {
  // ---------- lo que Claude lee para saber cómo pedir permiso ----------
  const recurso = (req: FastifyRequest) => {
    const base = direccionBase(req, urlPublica);
    return { resource: `${base}/mcp`, authorization_servers: [base], bearer_methods_supported: ['header'], resource_name: 'meetmydash' };
  };
  app.get('/.well-known/oauth-protected-resource', async (req) => recurso(req));
  app.get('/.well-known/oauth-protected-resource/mcp', async (req) => recurso(req));
  app.get('/.well-known/oauth-authorization-server', async (req) => {
    const base = direccionBase(req, urlPublica);
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/autorizar`,
      token_endpoint: `${base}/oauth/token`,
      registration_endpoint: `${base}/oauth/registro`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    };
  });

  // Los errores de estas rutas salen con la forma que espera el estándar: { error, error_description }.
  const comoOauth = async <T>(reply: { code: (n: number) => { send: (c: unknown) => unknown }; header: (a: string, b: string) => unknown }, f: () => Promise<T> | T) => {
    reply.header('cache-control', 'no-store');
    try { return await f(); } catch (e) {
      if (e instanceof ErrorApi) return reply.code(e.estado).send({ error: (e as ErrorApi & { oauth?: boolean }).oauth ? e.codigo : 'invalid_request', error_description: e.message });
      throw e;
    }
  };

  // ---------- Claude se presenta (registro automático de la aplicación que pide permiso) ----------
  app.post('/oauth/registro', async (req, reply) => comoOauth(reply, () => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const redirecciones = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
    if (redirecciones.length === 0 || redirecciones.length > 10 || !redirecciones.every(direccionValida)) throw errorOauth('invalid_redirect_uri', 'redirect_uris tiene que traer direcciones https (o http://localhost).');
    // Limpieza: presentaciones viejas que nunca llegaron a tener una llave.
    db.prepare('DELETE FROM clientes_oauth WHERE creado_en < ? AND id NOT IN (SELECT cliente_id FROM llaves WHERE cliente_id IS NOT NULL)').run(new Date(Date.now() - 86400_000).toISOString());
    if ((db.prepare('SELECT count(*) AS n FROM clientes_oauth').get() as { n: number }).n >= MAX_CLIENTES) throw errorOauth('temporarily_unavailable', 'Demasiados registros. Probá más tarde.', 429);
    const id = nuevoId();
    const nombre = typeof b.client_name === 'string' && b.client_name.trim() ? b.client_name.trim().slice(0, 80) : 'Aplicación sin nombre';
    db.prepare('INSERT INTO clientes_oauth (id, nombre, redirecciones, creado_en) VALUES (?,?,?,?)').run(id, nombre, JSON.stringify(redirecciones), ahora());
    return reply.code(201).send({
      client_id: id, client_name: nombre, redirect_uris: redirecciones, client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    });
  }));

  // ---------- la persona aprueba (la pantalla /oauth/autorizar usa estas dos rutas) ----------
  function pedidoValido(c: Record<string, unknown>) {
    const cliente = db.prepare('SELECT id, nombre, redirecciones FROM clientes_oauth WHERE id = ?').get(String(c.client_id ?? '')) as { id: string; nombre: string; redirecciones: string } | undefined;
    if (!cliente) throw datoInvalido('La aplicación que pide permiso no está registrada. Volvé a conectar desde Claude.');
    const redireccion = String(c.redirect_uri ?? '');
    if (!(JSON.parse(cliente.redirecciones) as string[]).includes(redireccion)) throw datoInvalido('La dirección de regreso no coincide con la que registró la aplicación.');
    return { cliente, redireccion };
  }
  const exigirPersonaAdmin = (req: FastifyRequest): Usuario => {
    const u = exigirUsuario(req);
    if (!req.sesionId) throw sinPermiso('Esto solo lo puede hacer una persona con su sesión abierta.');
    if (u.es_admin_general !== 1) throw sinPermiso('Solo la administración general puede darle acceso a un asistente.');
    return u;
  };

  // Qué aplicación pide permiso (para mostrarlo antes de aprobar).
  app.get('/api/oauth/pedido', async (req) => {
    const u = exigirUsuario(req);
    const { cliente, redireccion } = pedidoValido(req.query as Record<string, unknown>);
    return { aplicacion: cliente.nombre, vuelve_a: new URL(redireccion).host, puede_aprobar: !!req.sesionId && u.es_admin_general === 1 };
  });

  app.post('/api/oauth/aprobar', async (req) => {
    const u = exigirPersonaAdmin(req);
    const b = (req.body ?? {}) as Record<string, unknown>;
    const { cliente, redireccion } = pedidoValido(b);
    if (b.response_type !== 'code') throw datoInvalido('Tipo de permiso no soportado.');
    const desafio = texto(b.code_challenge, 'el desafío', { min: 43, max: 128 });
    if (b.code_challenge_method !== 'S256') throw datoInvalido('La aplicación tiene que usar el método S256.');
    const codigo = nuevoToken();
    db.prepare('DELETE FROM codigos_oauth WHERE expira_en < ?').run(ahora());
    db.prepare('INSERT INTO codigos_oauth (codigo_hash, cliente_id, usuario_id, aprobado_por, redireccion, desafio, expira_en) VALUES (?,?,?,?,?,?,?)')
      .run(hashToken(codigo), cliente.id, asegurarAlex(db).id, u.id, redireccion, desafio, new Date(Date.now() + MINUTOS_CODIGO * 60_000).toISOString());
    const destino = new URL(redireccion);
    destino.searchParams.set('code', codigo);
    if (typeof b.state === 'string') destino.searchParams.set('state', b.state);
    return { ir_a: destino.toString() };
  });

  // ---------- Claude cambia el código por la llave, o renueva la que tiene ----------
  const nuevaPareja = () => ({ acceso: `mmd_${nuevoToken()}`, refresco: `mmr_${nuevoToken()}`, expira: new Date(Date.now() + HORAS_ACCESO * 3600_000).toISOString() });
  const respuestaLlave = (p: ReturnType<typeof nuevaPareja>) => ({ access_token: p.acceso, token_type: 'Bearer', expires_in: HORAS_ACCESO * 3600, refresh_token: p.refresco });

  app.post('/oauth/token', async (req, reply) => comoOauth(reply, () => {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.grant_type === 'authorization_code') {
      const fila = db.prepare('SELECT * FROM codigos_oauth WHERE codigo_hash = ?').get(hashToken(String(b.code ?? ''))) as
        { codigo_hash: string; cliente_id: string; usuario_id: string; aprobado_por: string; redireccion: string; desafio: string; expira_en: string } | undefined;
      // El código sirve una sola vez: se borra apenas se presenta, salga bien o mal.
      if (fila) db.prepare('DELETE FROM codigos_oauth WHERE codigo_hash = ?').run(fila.codigo_hash);
      if (!fila || fila.expira_en < ahora()) throw errorOauth('invalid_grant', 'El código no sirve o ya venció.');
      if (b.client_id !== fila.cliente_id || b.redirect_uri !== fila.redireccion) throw errorOauth('invalid_grant', 'El código no corresponde a esta aplicación.');
      const prueba = crypto.createHash('sha256').update(String(b.code_verifier ?? '')).digest('base64url');
      if (prueba !== fila.desafio) throw errorOauth('invalid_grant', 'La verificación del código no coincide.');
      const cliente = db.prepare('SELECT nombre FROM clientes_oauth WHERE id = ?').get(fila.cliente_id) as { nombre: string };
      const p = nuevaPareja();
      db.prepare('INSERT INTO llaves (id, usuario_id, nombre, token_hash, refresco_hash, cliente_id, creada_por, creada_en, expira_en) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(nuevoId(), fila.usuario_id, cliente.nombre, hashToken(p.acceso), hashToken(p.refresco), fila.cliente_id, fila.aprobado_por, ahora(), p.expira);
      return respuestaLlave(p);
    }
    if (b.grant_type === 'refresh_token') {
      const l = db.prepare('SELECT id, cliente_id FROM llaves WHERE refresco_hash = ?').get(hashToken(String(b.refresh_token ?? ''))) as { id: string; cliente_id: string | null } | undefined;
      if (!l || (b.client_id !== undefined && b.client_id !== l.cliente_id)) throw errorOauth('invalid_grant', 'La llave de renovación no sirve. Hay que volver a conectar.');
      const p = nuevaPareja();
      db.prepare('UPDATE llaves SET token_hash = ?, refresco_hash = ?, expira_en = ? WHERE id = ?').run(hashToken(p.acceso), hashToken(p.refresco), p.expira, l.id);
      return respuestaLlave(p);
    }
    throw errorOauth('unsupported_grant_type', 'Solo se aceptan authorization_code y refresh_token.');
  }));

  // ---------- administración de las llaves de Alex (solo una persona con administración general) ----------
  app.get('/api/admin/alex', async (req) => {
    exigirPersonaAdmin(req);
    const alex = db.prepare('SELECT id FROM usuarios WHERE es_robot = 1 ORDER BY creado_en LIMIT 1').get() as { id: string } | undefined;
    const llaves = !alex ? [] : db.prepare('SELECT id, nombre, cliente_id, creada_en, ultima_vez FROM llaves WHERE usuario_id = ? ORDER BY creada_en DESC').all(alex.id) as { id: string; nombre: string; cliente_id: string | null; creada_en: string; ultima_vez: string | null }[];
    return {
      alex: alex ? fichaPublica(leerUsuario(db, alex.id)!) : null,
      direccion: `${direccionBase(req, urlPublica)}/mcp`,
      llaves: llaves.map((l) => ({ id: l.id, nombre: l.nombre, tipo: l.cliente_id ? 'conexion' : 'fija', creada_en: l.creada_en, ultima_vez: l.ultima_vez })),
    };
  });
  app.post('/api/admin/alex/llaves', async (req, reply) => {
    const u = exigirPersonaAdmin(req);
    const nombre = texto(((req.body ?? {}) as Record<string, unknown>).nombre, 'el nombre de la llave', { max: 80 });
    const llave = `mmd_${nuevoToken()}`;
    const id = nuevoId();
    db.prepare('INSERT INTO llaves (id, usuario_id, nombre, token_hash, creada_por, creada_en) VALUES (?,?,?,?,?,?)').run(id, asegurarAlex(db).id, nombre, hashToken(llave), u.id, ahora());
    return reply.code(201).send({ id, llave });
  });
  app.delete('/api/admin/alex/llaves/:id', async (req) => {
    exigirPersonaAdmin(req);
    const r = db.prepare('DELETE FROM llaves WHERE id = ?').run((req.params as { id: string }).id);
    if (!r.changes) throw noExiste();
    return { ok: true };
  });
}
