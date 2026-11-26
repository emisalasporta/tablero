// La puerta de Alex: permiso desde Claude, llaves, la dirección /mcp y la cobertura de herramientas.
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXCLUIDAS, forma, HERRAMIENTAS } from '../servidor/mcp/herramientas.ts';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

let m: Mundo;
let ana: Persona;
const REGRESO = 'https://claude.ai/api/mcp/auth_callback';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

beforeEach(async () => { m = crearMundo(); ana = await m.registrar('Ana'); });
afterEach(async () => { await m.cerrar(); });

/** Pedido suelto, sin sesión de navegador. */
async function pedir(metodo: 'GET' | 'POST' | 'DELETE', url: string, cuerpo?: unknown, cabeceras: Record<string, string> = {}) {
  const r = await m.app.inject({ method: metodo, url, headers: { ...(cuerpo !== undefined && !cabeceras['content-type'] ? { 'content-type': 'application/json' } : {}), ...cabeceras },
    payload: cuerpo === undefined ? undefined : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) });
  let json: any = null;
  try { json = r.json(); } catch { /* sin cuerpo */ }
  return { estado: r.statusCode, json, cabeceras: r.headers };
}
/** Hace todo el camino del permiso, como lo hace Claude, y devuelve las llaves. */
async function conectar(quien: Persona = ana) {
  const cliente = (await pedir('POST', '/oauth/registro', { client_name: 'Claude', redirect_uris: [REGRESO] })).json;
  const secreto = crypto.randomBytes(32).toString('base64url');
  const desafio = crypto.createHash('sha256').update(secreto).digest('base64url');
  const aprobado = await quien.post('/api/oauth/aprobar', { client_id: cliente.client_id, redirect_uri: REGRESO, response_type: 'code', code_challenge: desafio, code_challenge_method: 'S256', state: 'abc' });
  if (aprobado.estado !== 200) return { aprobado, cliente, secreto, llaves: null as any, codigo: '' };
  const vuelta = new URL(aprobado.json.ir_a);
  const codigo = vuelta.searchParams.get('code')!;
  const forma = new URLSearchParams({ grant_type: 'authorization_code', code: codigo, code_verifier: secreto, client_id: cliente.client_id, redirect_uri: REGRESO }).toString();
  const llaves = (await pedir('POST', '/oauth/token', forma, { 'content-type': 'application/x-www-form-urlencoded' })).json;
  return { aprobado, cliente, secreto, llaves, codigo, vuelta };
}
let n = 0;
async function mcp(llave: string, method: string, params?: unknown) {
  return pedir('POST', '/mcp', { jsonrpc: '2.0', id: ++n, method, params }, { authorization: `Bearer ${llave}` });
}
/** Usa una herramienta y devuelve lo que contestó (ya leído) y si fue un error. */
async function usar(llave: string, nombre: string, args: Record<string, unknown> = {}) {
  const r = (await mcp(llave, 'tools/call', { name: nombre, arguments: args })).json.result;
  const primero = r.content[0];
  let datos: any = primero.text;
  try { datos = JSON.parse(primero.text); } catch { /* texto suelto */ }
  return { datos, error: r.isError === true, contenido: r.content };
}
async function llaveFija() { return (await ana.post('/api/admin/alex/llaves', { nombre: 'Prueba' })).json as { id: string; llave: string }; }

describe('cómo se entra', () => {
  it('sin llave, /mcp responde 401 y dice dónde pedir permiso', async () => {
    const r = await pedir('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(r.estado).toBe(401);
    expect(String(r.cabeceras['www-authenticate'])).toMatch(/^Bearer resource_metadata="http.+\/\.well-known\/oauth-protected-resource"$/);
    const recurso = (await pedir('GET', '/.well-known/oauth-protected-resource')).json;
    expect(recurso.resource).toMatch(/\/mcp$/);
    const servidor = (await pedir('GET', '/.well-known/oauth-authorization-server')).json;
    expect(recurso.authorization_servers).toEqual([servidor.issuer]);
    expect(servidor).toMatchObject({ code_challenge_methods_supported: ['S256'], response_types_supported: ['code'] });
    expect(servidor.registration_endpoint).toMatch(/\/oauth\/registro$/);
    // Una sesión de navegador no alcanza para usar la puerta.
    expect((await ana.post('/mcp', { jsonrpc: '2.0', id: 1, method: 'ping' })).estado).toBe(401);
    expect((await pedir('GET', '/mcp')).estado).toBe(405);
  });

  it('el permiso completo: Claude se presenta, la administradora aprueba y la llave entra como Alex', async () => {
    const c = await conectar();
    expect(c.vuelta!.origin + c.vuelta!.pathname).toBe(REGRESO);
    expect(c.vuelta!.searchParams.get('state')).toBe('abc');
    expect(c.llaves).toMatchObject({ token_type: 'Bearer', expires_in: 3600 });
    const inicio = (await mcp(c.llaves.access_token, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } })).json.result;
    expect(inicio).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'meetmydash' }, capabilities: { tools: {} } });
    // Los avisos no llevan respuesta.
    expect((await pedir('POST', '/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' }, { authorization: `Bearer ${c.llaves.access_token}` })).estado).toBe(202);
    const yo = await usar(c.llaves.access_token, 'yo_ver');
    expect(yo.datos.usuario).toMatchObject({ nombre: 'Alex', es_robot: true, es_admin_general: true });
    // Alex no cuenta como persona: no se puede entrar con contraseña a su cuenta.
    expect((await m.anonimo.post('/api/sesion', { email: yo.datos.usuario.email, clave: 'sin-clave' })).estado).toBe(401);
    const vista = (await ana.get('/api/admin/alex')).json;
    expect(vista.direccion).toMatch(/\/mcp$/);
    expect(vista.llaves).toHaveLength(1);
    expect(vista.llaves[0]).toMatchObject({ nombre: 'Claude', tipo: 'conexion' });
  });

  it('el código sirve una sola vez y necesita la verificación correcta', async () => {
    const c = await conectar();
    const otraVez = new URLSearchParams({ grant_type: 'authorization_code', code: c.codigo, code_verifier: c.secreto, client_id: c.cliente.client_id, redirect_uri: REGRESO }).toString();
    const r = await pedir('POST', '/oauth/token', otraVez, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(r.estado).toBe(400);
    expect(r.json.error).toBe('invalid_grant');
    // Con la verificación equivocada tampoco.
    const cliente = (await pedir('POST', '/oauth/registro', { redirect_uris: [REGRESO] })).json;
    const desafio = crypto.createHash('sha256').update('el-secreto-verdadero-de-mas-de-43-caracteres-000').digest('base64url');
    const ap = (await ana.post('/api/oauth/aprobar', { client_id: cliente.client_id, redirect_uri: REGRESO, response_type: 'code', code_challenge: desafio, code_challenge_method: 'S256' })).json;
    const mal = await pedir('POST', '/oauth/token', { grant_type: 'authorization_code', code: new URL(ap.ir_a).searchParams.get('code'), code_verifier: 'otro-secreto', client_id: cliente.client_id, redirect_uri: REGRESO });
    expect(mal.json.error).toBe('invalid_grant');
  });

  it('la llave se renueva y la anterior deja de servir', async () => {
    const c = await conectar();
    const nuevas = (await pedir('POST', '/oauth/token', { grant_type: 'refresh_token', refresh_token: c.llaves.refresh_token, client_id: c.cliente.client_id })).json;
    expect(nuevas.access_token).not.toBe(c.llaves.access_token);
    expect((await mcp(nuevas.access_token, 'ping')).estado).toBe(200);
    expect((await mcp(c.llaves.access_token, 'ping')).estado).toBe(401);
    expect((await pedir('POST', '/oauth/token', { grant_type: 'refresh_token', refresh_token: c.llaves.refresh_token })).json.error).toBe('invalid_grant');
    expect((await ana.get('/api/admin/alex')).json.llaves).toHaveLength(1);
  });

  it('una llave vencida no entra', async () => {
    const c = await conectar();
    m.db.prepare('UPDATE llaves SET expira_en = ?').run('2020-01-01T00:00:00.000Z');
    expect((await mcp(c.llaves.access_token, 'ping')).estado).toBe(401);
  });

  it('solo la administración general, con su sesión, da acceso; ni otra persona ni el propio Alex', async () => {
    const beto = await m.registrar('Beto');
    expect((await conectar(beto)).aprobado.estado).toBe(403);
    expect((await conectar(m.anonimo)).aprobado.estado).toBe(401);
    expect((await beto.post('/api/admin/alex/llaves', { nombre: 'x' })).estado).toBe(403);
    const { llave } = await llaveFija();
    const comoAlex = { authorization: `Bearer ${llave}` };
    expect((await pedir('POST', '/api/admin/alex/llaves', { nombre: 'otra' }, comoAlex)).estado).toBe(403);
    expect((await pedir('GET', '/api/admin/alex', undefined, comoAlex)).estado).toBe(403);
    const cliente = (await pedir('POST', '/oauth/registro', { redirect_uris: [REGRESO] })).json;
    expect((await pedir('POST', '/api/oauth/aprobar', { client_id: cliente.client_id, redirect_uri: REGRESO, response_type: 'code', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256' }, comoAlex)).estado).toBe(403);
  });

  it('no se aprueba a una aplicación desconocida ni se vuelve a una dirección que no registró', async () => {
    const cliente = (await pedir('POST', '/oauth/registro', { client_name: 'Claude', redirect_uris: [REGRESO] })).json;
    const base = { response_type: 'code', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256' };
    expect((await ana.post('/api/oauth/aprobar', { ...base, client_id: 'inventado', redirect_uri: REGRESO })).estado).toBe(400);
    expect((await ana.post('/api/oauth/aprobar', { ...base, client_id: cliente.client_id, redirect_uri: 'https://malo.example/x' })).estado).toBe(400);
    expect((await ana.post('/api/oauth/aprobar', { ...base, client_id: cliente.client_id, redirect_uri: REGRESO, code_challenge_method: 'plain' })).estado).toBe(400);
    expect((await pedir('POST', '/oauth/registro', { redirect_uris: ['http://malo.example/x'] })).estado).toBe(400);
    expect((await ana.get(`/api/oauth/pedido?client_id=${cliente.client_id}&redirect_uri=${encodeURIComponent(REGRESO)}`)).json).toEqual({ aplicacion: 'Claude', vuelve_a: 'claude.ai', puede_aprobar: true });
  });

  it('llave fija: se muestra una vez, entra, y al anularla deja de entrar', async () => {
    const { id, llave } = await llaveFija();
    expect(llave).toMatch(/^mmd_/);
    expect((await mcp(llave, 'ping')).json.result).toEqual({});
    expect((await ana.get('/api/admin/alex')).json.llaves[0]).toMatchObject({ id, nombre: 'Prueba', tipo: 'fija' });
    expect(JSON.stringify((await ana.get('/api/admin/alex')).json)).not.toContain(llave);
    expect((await ana.del(`/api/admin/alex/llaves/${id}`)).estado).toBe(200);
    expect((await mcp(llave, 'ping')).estado).toBe(401);
  });
});

describe('herramientas', () => {
  it('cada ruta de la app tiene su herramienta, o está excluida con motivo', async () => {
    await m.app.ready();
    const rutas = [...new Set(m.app.rutas.filter((r) => r.includes(' /api/')).map((r) => forma(...(r.split(' ') as [string, string]))))];
    const cubiertas = new Set(HERRAMIENTAS.map((h) => forma(h.metodo, h.ruta)));
    const sinCubrir = rutas.filter((r) => !cubiertas.has(r) && !(r in EXCLUIDAS));
    expect(sinCubrir, 'rutas sin herramienta: sumalas en servidor/mcp/herramientas.ts').toEqual([]);
    // Y al revés: nada apunta a una ruta que ya no existe.
    expect(HERRAMIENTAS.filter((h) => !rutas.includes(forma(h.metodo, h.ruta))).map((h) => h.nombre)).toEqual([]);
    expect(Object.keys(EXCLUIDAS).filter((r) => !rutas.includes(r))).toEqual([]);
    expect(rutas.length).toBeGreaterThan(80);
  });

  it('la lista sale bien formada y sin nombres repetidos', async () => {
    const { llave } = await llaveFija();
    const lista = (await mcp(llave, 'tools/list')).json.result.tools as any[];
    expect(lista).toHaveLength(HERRAMIENTAS.length);
    expect(new Set(lista.map((t) => t.name)).size).toBe(lista.length);
    for (const t of lista) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]{2,50}$/);
      expect(t.description.length).toBeGreaterThan(15);
      expect(t.inputSchema.type).toBe('object');
      for (const r of t.inputSchema.required ?? []) expect(Object.keys(t.inputSchema.properties)).toContain(r);
    }
    expect(lista.find((t) => t.name === 'tablero_ver').annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(lista.find((t) => t.name === 'tablero_borrar').annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect((await mcp(llave, 'tools/call', { name: 'no_existe' })).json.error.code).toBe(-32602);
    expect((await mcp(llave, 'algo/raro')).json.error.code).toBe(-32601);
  });

  it('Alex arma un tablero de punta a punta y todo queda con su nombre', async () => {
    const { llave } = await llaveFija();
    const espacio = (await usar(llave, 'espacio_crear', { nombre: 'Obras' })).datos.espacio.id;
    const tablero = (await usar(llave, 'tablero_crear', { espacio_id: espacio, nombre: 'Casa' })).datos.tablero;
    const pendiente = (await usar(llave, 'lista_crear', { tablero_id: tablero.enlace, nombre: 'Pendiente' })).datos.lista.id;
    const hecho = (await usar(llave, 'lista_crear', { tablero_id: tablero.id, nombre: 'Hecho' })).datos.lista.id;
    const creadas = (await usar(llave, 'tarjeta_crear', { lista_id: pendiente, titulos: ['Pintar', 'Lijar'] })).datos.tarjetas;
    expect(creadas.map((c: any) => c.titulo)).toEqual(['Pintar', 'Lijar']);
    const pintar = creadas[0].id;

    const etiqueta = (await usar(llave, 'etiqueta_crear', { tablero_id: tablero.id, nombre: 'Urgente', color: 'rojo-2' })).datos.etiqueta.id;
    await usar(llave, 'tarjeta_etiqueta_poner', { tarjeta_id: pintar, etiqueta_id: etiqueta });
    await usar(llave, 'tarjeta_cambiar', { tarjeta_id: pintar, descripcion: 'Dos manos', vence: '2026-12-05T18:00:00-03:00', lista_id: hecho });
    const checklist = (await usar(llave, 'checklist_crear', { tarjeta_id: pintar, nombre: 'Pasos' })).datos.checklist_id;
    await usar(llave, 'item_agregar', { checklist_id: checklist, textos: ['Comprar', 'Pintar'] });
    await usar(llave, 'comentario_crear', { tarjeta_id: pintar, texto: 'Listo para el lunes' });
    await usar(llave, 'adjunto_enlace', { tarjeta_id: pintar, url: 'https://ejemplo.com/colores' });
    const nota = (await usar(llave, 'adjunto_subir', { tarjeta_id: pintar, nombre: 'nota.txt', tipo: 'text/plain', base64: Buffer.from('medidas: 3x4').toString('base64') })).datos.adjunto;
    const foto = (await usar(llave, 'adjunto_subir', { tarjeta_id: pintar, nombre: 'pared.png', tipo: 'image/png', base64: PNG.toString('base64') })).datos.adjunto;

    const d = (await usar(llave, 'tarjeta_ver', { tarjeta_id: creadas[0].enlace })).datos;
    expect(d.tarjeta).toMatchObject({ descripcion: 'Dos manos', lista_id: hecho, vence: '2026-12-05T21:00:00.000Z', etiquetas: [etiqueta] });
    expect(d.checklists[0].items.map((i: any) => i.texto)).toEqual(['Comprar', 'Pintar']);
    expect(d.comentarios[0]).toMatchObject({ texto: 'Listo para el lunes', autor: { nombre: 'Alex', es_robot: true } });
    expect(d.adjuntos).toHaveLength(3);
    // Todo lo que pasó en la tarjeta lo hizo Alex.
    expect(new Set(d.actividad.map((a: any) => a.actor.nombre))).toEqual(new Set(['Alex']));

    // Leer adjuntos: el texto vuelve como texto y la imagen como imagen.
    expect((await usar(llave, 'adjunto_leer', { adjunto_id: nota.id })).datos).toBe('medidas: 3x4');
    expect((await usar(llave, 'adjunto_leer', { adjunto_id: foto.id })).contenido[0]).toMatchObject({ type: 'image', mimeType: 'image/png' });

    // Achicar la respuesta del tablero.
    expect((await usar(llave, 'tablero_ver', { tablero_id: tablero.id })).datos.tarjetas).toHaveLength(2);
    expect((await usar(llave, 'tablero_ver', { tablero_id: tablero.id, lista_id: hecho })).datos.tarjetas.map((c: any) => c.titulo)).toEqual(['Pintar']);
    expect((await usar(llave, 'tablero_ver', { tablero_id: tablero.id, sin_tarjetas: true })).datos.tarjetas).toBeUndefined();

    // Un dato que la ruta espera con otro nombre, y uno que viaja en la dirección.
    expect((await usar(llave, 'lista_mover_tarjetas', { lista_id: pendiente, destino_id: hecho })).datos.tarjetas).toHaveLength(1);
    expect((await usar(llave, 'tablero_actividad', { tablero_id: tablero.id, solo: 'comentarios' })).datos.actividad).toHaveLength(1);

    // Ana, como persona, ve en su pantalla lo que hizo Alex.
    const visto = (await ana.get(`/api/tableros/${tablero.id}`)).json;
    expect(visto.tarjetas.filter((c: any) => c.lista_id === hecho)).toHaveLength(2);
    expect(visto.miembros.map((p: any) => p.nombre)).toEqual(['Alex']);
  });

  it('Alex ve y maneja lo que crearon otras personas, sin ser miembro', async () => {
    const espacio = (await ana.post('/api/espacios', { nombre: 'De Ana' })).json.espacio.id;
    const tablero = (await ana.post('/api/tableros', { espacio_id: espacio, nombre: 'Privado', visibilidad: 'privado' })).json.tablero.id;
    const { llave } = await llaveFija();
    expect((await usar(llave, 'espacios_todos')).datos.espacios).toMatchObject([{ id: espacio, nombre: 'De Ana', miembros: 1, tableros_abiertos: 1 }]);
    expect((await usar(llave, 'espacios_mios')).datos.espacios).toEqual([]);
    expect((await usar(llave, 'tableros_editables')).datos.tableros.map((t: any) => t.nombre)).toEqual(['Privado']);
    expect((await usar(llave, 'personas_listar')).datos.usuarios.map((u: any) => u.nombre).sort()).toEqual(['Alex', 'Ana']);
    expect((await usar(llave, 'tablero_cambiar', { tablero_id: tablero, nombre: 'Renombrado', ajustes: { fondo: { valor: 'oceano' } } })).datos.tablero).toMatchObject({ nombre: 'Renombrado', fondo: { tipo: 'color', valor: 'oceano' } });
    expect((await usar(llave, 'espacio_miembro_quitar', { espacio_id: espacio, usuario_id: ana.id })).error).toBe(true);
  });

  it('los errores vuelven como error, con el mensaje de la app', async () => {
    const { llave } = await llaveFija();
    const falta = await usar(llave, 'tablero_crear', { nombre: 'Sin espacio' });
    expect(falta).toMatchObject({ error: true, datos: 'Falta el dato "espacio_id".' });
    const noEsta = await usar(llave, 'tarjeta_ver', { tarjeta_id: 'no-existe' });
    expect(noEsta.error).toBe(true);
    expect(noEsta.datos).toContain('no_existe');
    const espacio = (await usar(llave, 'espacio_crear', { nombre: 'E' })).datos.espacio.id;
    const tablero = (await usar(llave, 'tablero_crear', { espacio_id: espacio, nombre: 'T' })).datos.tablero.id;
    const sinCerrar = await usar(llave, 'tablero_borrar', { tablero_id: tablero });
    expect(sinCerrar.error).toBe(true);
    expect(sinCerrar.datos).toContain('cerrar');
    expect((await usar(llave, 'adjunto_subir', { tarjeta_id: 'x', nombre: 'a.txt', base64: '¡no!' })).datos).toContain('base64');
  });
});
