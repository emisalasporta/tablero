// Respaldo diario, copia fuera del servidor, restauración y estado del servidor.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { abrirDb } from '../servidor/db.ts';
import { relojEn, restaurarSiSePide } from '../servidor/respaldo.ts';
import { carpetaTemporal, crearMundo, type Mundo } from './ayuda.ts';

let m: Mundo | null = null;
afterEach(async () => { await m?.cerrar().catch(() => {}); m = null; });
const dirResp = (mundo: Mundo) => path.join(mundo.dir, 'respaldos');
const nombres = (mundo: Mundo) => fs.readdirSync(dirResp(mundo)).filter((n) => n.endsWith('.db')).sort();
const contar = (archivo: string, tabla: string) => { const d = new DatabaseSync(archivo, { readOnly: true }); const n = (d.prepare(`SELECT count(*) AS n FROM ${tabla}`).get() as { n: number }).n; d.close(); return n; };

/** Un depósito S3 de mentira: guarda lo que le suben y anota cada pedido. */
function deposito(falla = false) {
  const objetos = new Map<string, Buffer>();
  const pedidos: { metodo: string; clave: string; autorizacion: string }[] = [];
  const pedir = (async (url: URL | string, o: RequestInit = {}) => {
    const u = new URL(String(url));
    const clave = decodeURIComponent(u.pathname.replace(/^\/mi-deposito\/?/, ''));
    pedidos.push({ metodo: o.method ?? 'GET', clave, autorizacion: String((o.headers as Record<string, string>).authorization) });
    if (falla) return new Response('AccessDenied', { status: 403 });
    if (o.method === 'PUT') { objetos.set(clave, Buffer.from(await new Response(o.body as BodyInit).arrayBuffer())); return new Response(''); }
    if (o.method === 'DELETE') { objetos.delete(clave); return new Response(null, { status: 204 }); }
    return new Response(`<ListBucketResult>${[...objetos.keys()].filter((k) => k.startsWith('base/')).map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}</ListBucketResult>`);
  }) as typeof fetch;
  return { objetos, pedidos, pedir, config: { endpoint: 'https://cuenta.r2.ejemplo', deposito: 'mi-deposito', clave: 'CLAVE', secreto: 'SECRETO' } };
}

describe('respaldo en el servidor', () => {
  it('copia la base sin frenar la app, y la copia abre con los datos', async () => {
    m = crearMundo();
    const ana = await m.registrar('Ana');
    await ana.post('/api/espacios', { nombre: 'Equipo' });
    const r = await ana.post('/api/admin/respaldos');
    expect(r.estado).toBe(201);
    expect(r.json.respaldo).toMatchObject({ tipo: 'manual' });
    expect(contar(path.join(dirResp(m), r.json.respaldo.nombre), 'espacios')).toBe(1);
    const estado = (await ana.get('/api/admin/respaldos')).json;
    expect(estado.ultimo.nombre).toBe(r.json.respaldo.nombre);
    expect(estado.externo).toMatchObject({ activo: false });
  });

  it('solo la administración general ve y hace respaldos', async () => {
    m = crearMundo();
    await m.registrar('Ana');
    const beto = await m.registrar('Beto');
    expect((await beto.get('/api/admin/respaldos')).estado).toBe(403);
    expect((await beto.post('/api/admin/respaldos')).estado).toBe(403);
    expect((await beto.get('/api/admin/servidor')).estado).toBe(403);
    expect((await m.anonimo.post('/api/admin/servidor/publicar')).estado).toBe(401);
  });

  it('el diario se hace una vez por día, pasadas las 03:30 de Argentina', async () => {
    m = crearMundo();
    // 05:00 UTC = 02:00 en Argentina: todavía no. 07:00 UTC = 04:00: ya sí.
    expect(await m.app.respaldos.revisar(new Date('2026-11-26T05:00:00Z'))).toBe(false);
    expect(relojEn('America/Argentina/Buenos_Aires', new Date('2026-11-26T02:10:00Z'))).toEqual({ dia: '2026-11-25', hora: '23:10' });
    const hoy = relojEn('America/Argentina/Buenos_Aires').dia;
    const tarde = new Date(`${hoy}T12:00:00-03:00`);
    expect(await m.app.respaldos.revisar(tarde)).toBe(true);
    expect(nombres(m)).toEqual([`diario-${hoy}.db`]);
    expect(await m.app.respaldos.revisar(tarde)).toBe(false);
  });

  it('guarda 14 diarios y 8 semanales (domingos); lo demás se va', async () => {
    m = crearMundo();
    const dia = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86400_000).toISOString().slice(0, 10);
    for (let i = 0; i < 120; i++) fs.writeFileSync(path.join(dirResp(m), `diario-${dia(i)}.db`), 'x');
    await m.app.respaldos.hacer('manual');
    const quedan = nombres(m).filter((n) => n.startsWith('diario-')).map((n) => n.slice(7, 17));
    expect(quedan).toHaveLength(22);
    expect(quedan.slice(-14)).toEqual(Array.from({ length: 14 }, (_, k) => dia(106 + k)));
    for (const d of quedan.slice(0, 8)) expect(new Date(`${d}T12:00:00Z`).getUTCDay()).toBe(0);
  });

  it('los archivos subidos quedan con un segundo nombre que sobrevive si la app borra el original', async () => {
    m = crearMundo();
    const ana = await m.registrar('Ana');
    const r = await ana.subir('/api/yo/avatar', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
    await m.app.respaldos.hacer('manual');
    const copia = path.join(dirResp(m), 'archivos', 'fotos', r.json.avatar);
    expect(fs.existsSync(copia)).toBe(true);
    await ana.del('/api/yo/avatar');
    await m.app.respaldos.hacer('manual');
    expect(fs.existsSync(path.join(m.dir, 'archivos', 'fotos', r.json.avatar))).toBe(false);
    expect(fs.existsSync(copia)).toBe(true);
  });
});

describe('restaurar', () => {
  it('pone el respaldo en lugar de la base, guarda lo que había y no lo repite', async () => {
    m = crearMundo();
    const ana = await m.registrar('Ana');
    await ana.post('/api/espacios', { nombre: 'Uno' });
    const respaldo = (await ana.post('/api/admin/respaldos')).json.respaldo.nombre;
    await ana.post('/api/espacios', { nombre: 'Dos' });
    const dir = m.dir;
    await m.cerrar(); m = null;

    const r = restaurarSiSePide(dir, respaldo)!;
    expect(r.restaurado).toBe(respaldo);
    expect(contar(path.join(dir, 'tablero.db'), 'espacios')).toBe(1);
    expect(contar(r.copiaDeLoAnterior!, 'espacios')).toBe(2);
    // La app arranca sobre lo restaurado y la cuenta sigue sirviendo.
    const { db } = abrirDb(dir);
    expect((db.prepare('SELECT count(*) AS n FROM usuarios').get() as { n: number }).n).toBe(1);
    db.close();
    // Con la variable todavía puesta, el arranque siguiente no vuelve a restaurar.
    expect(restaurarSiSePide(dir, respaldo)).toBeNull();
    expect(restaurarSiSePide(dir, undefined)).toBeNull();
  });

  it('si el respaldo no existe o está roto, no toca nada y avisa', () => {
    const dir = carpetaTemporal();
    abrirDb(dir).db.close();
    fs.mkdirSync(path.join(dir, 'respaldos'), { recursive: true });
    expect(() => restaurarSiSePide(dir, 'manual-no-esta.db')).toThrow(/no existe/);
    expect(() => restaurarSiSePide(dir, '../tablero.db')).toThrow(/no existe/);
    fs.writeFileSync(path.join(dir, 'respaldos', 'manual-roto.db'), 'esto no es una base');
    expect(() => restaurarSiSePide(dir, 'manual-roto.db')).toThrow();
    expect(contar(path.join(dir, 'tablero.db'), 'migraciones')).toBeGreaterThan(0);
  });
});

describe('copia fuera del servidor', () => {
  it('sube la base comprimida y cada archivo una sola vez, y borra las bases de más de 30 días', async () => {
    const d = deposito();
    d.objetos.set('base/diario-2020-01-01.db.gz', Buffer.from('vieja'));
    m = crearMundo({ externo: d.config, pedirAfuera: d.pedir });
    const ana = await m.registrar('Ana');
    const foto = (await ana.subir('/api/yo/avatar', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))).json.avatar;
    const r = (await ana.post('/api/admin/respaldos')).json;
    expect(r.externo).toMatchObject({ activo: true, error: null });
    expect(r.externo.ultimo_ok).toBeTruthy();
    const subida = d.objetos.get(`base/${r.respaldo.nombre}.gz`)!;
    const archivo = path.join(m.dir, 'vuelta.db');
    fs.writeFileSync(archivo, zlib.gunzipSync(subida));
    expect(contar(archivo, 'usuarios')).toBe(1);
    expect(d.objetos.has(`archivos/fotos/${foto}`)).toBe(true);
    expect(d.objetos.has('base/diario-2020-01-01.db.gz')).toBe(false);
    expect(d.pedidos[0].autorizacion).toMatch(/^AWS4-HMAC-SHA256 Credential=CLAVE\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
    await ana.post('/api/admin/respaldos');
    expect(d.pedidos.filter((p) => p.metodo === 'PUT' && p.clave.startsWith('archivos/'))).toHaveLength(1);
  });

  it('si el depósito falla, el respaldo local se hace igual y el error queda a la vista', async () => {
    const d = deposito(true);
    m = crearMundo({ externo: d.config, pedirAfuera: d.pedir });
    const ana = await m.registrar('Ana');
    const r = await ana.post('/api/admin/respaldos');
    expect(r.estado).toBe(201);
    expect(r.json.externo.error).toContain('403');
    expect(r.json.externo.ultimo_ok).toBeNull();
    expect((await ana.get('/api/admin/servidor')).json.errores[0]).toMatchObject({ donde: 'respaldo externo' });
  });
});

describe('estado del servidor', () => {
  it('sin Dokploy configurado lo dice; publicar responde que no se puede', async () => {
    m = crearMundo();
    const ana = await m.registrar('Ana');
    const e = (await ana.get('/api/admin/servidor')).json;
    expect(e.publicacion).toEqual({ configurado: false });
    expect(e.app.arranco_en).toBeTruthy();
    expect((await ana.post('/api/admin/servidor/publicar')).estado).toBe(503);
  });

  it('con Dokploy: muestra las últimas publicaciones y pide publicar con la clave', async () => {
    const pedidos: { url: string; metodo: string; clave: string; cuerpo: string }[] = [];
    const pedir = (async (url: URL | string, o: RequestInit = {}) => {
      pedidos.push({ url: String(url), metodo: o.method ?? 'GET', clave: (o.headers as Record<string, string>)['x-api-key'], cuerpo: String(o.body ?? '') });
      if (String(url).includes('application.one')) return Response.json({ applicationStatus: 'done' });
      if (String(url).includes('deployment.all')) return Response.json([
        { deploymentId: 'a', title: 'Primero\n\nmás texto', description: 'Commit: 1111111111111111', status: 'done', createdAt: '2026-11-25T10:00:00Z', finishedAt: '2026-11-25T10:01:00Z', errorMessage: null },
        { deploymentId: 'b', title: 'Segundo', description: 'Commit: 2222222222222222', status: 'error', createdAt: '2026-11-26T10:00:00Z', finishedAt: null, errorMessage: 'falló' },
      ]);
      return Response.json({});
    }) as typeof fetch;
    m = crearMundo({ dokploy: { url: 'http://dokploy.ejemplo:3000/', clave: 'CLAVE-DOKPLOY', app: 'app1' }, pedirAfuera: pedir });
    const ana = await m.registrar('Ana');
    const e = (await ana.get('/api/admin/servidor')).json;
    expect(e.publicacion).toMatchObject({ configurado: true, estado: 'done' });
    expect(e.publicacion.ultimas).toEqual([
      { que: 'Segundo', cambio: '222222222222', estado: 'error', cuando: '2026-11-26T10:00:00Z', termino: null, error: 'falló' },
      { que: 'Primero', cambio: '111111111111', estado: 'done', cuando: '2026-11-25T10:00:00Z', termino: '2026-11-25T10:01:00Z', error: null },
    ]);
    // La clave nunca sale en la respuesta.
    expect(JSON.stringify(e)).not.toContain('CLAVE-DOKPLOY');
    expect((await ana.post('/api/admin/servidor/publicar')).estado).toBe(200);
    expect(pedidos.at(-1)).toEqual({ url: 'http://dokploy.ejemplo:3000/api/application.deploy', metodo: 'POST', clave: 'CLAVE-DOKPLOY', cuerpo: '{"applicationId":"app1"}' });
  });

  it('Alex lo ve y hace un respaldo por su puerta', async () => {
    m = crearMundo();
    const ana = await m.registrar('Ana');
    const { llave } = (await ana.post('/api/admin/alex/llaves', { nombre: 'Prueba' })).json;
    const usar = async (name: string) => {
      const r = await m!.app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${llave}`, 'content-type': 'application/json' }, payload: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } }) });
      return JSON.parse(r.json().result.content[0].text);
    };
    expect((await usar('respaldo_hacer')).respaldo.tipo).toBe('manual');
    expect((await usar('respaldos_ver')).respaldos).toHaveLength(1);
    expect((await usar('servidor_ver')).publicacion).toEqual({ configurado: false });
  });
});
