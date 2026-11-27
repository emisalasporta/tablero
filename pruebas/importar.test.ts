// Fase 5: traer un tablero desde la exportación JSON de Trello.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { colorEtiqueta, importarTrello } from '../servidor/importar.ts';
import { leerUsuario } from '../servidor/nucleo.ts';
import { leerEspacio } from '../servidor/permisos.ts';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

// Un tablero de Trello de mentira, con la misma forma que su exportación.
const id = (n: number) => (0x65000000 + n).toString(16) + '0'.repeat(16);
function exportacion(): any {
  return {
    id: id(1), name: 'Obra Belgrano', desc: 'Seguimiento de la obra', closed: false, prefs: { background: 'blue' },
    members: [
      { id: 'm-emi', fullName: 'Emiliano', username: 'emiliano' },
      { id: 'm-marta', fullName: 'Marta Ruiz', username: 'martaruiz' },
      { id: 'm-fantasma', fullName: 'Pedro Sinnada', username: 'pedros' },
    ],
    memberships: [{ idMember: 'm-emi', memberType: 'admin' }, { idMember: 'm-marta', memberType: 'observer' }, { idMember: 'm-fantasma', memberType: 'normal' }],
    labels: [{ id: 'e1', name: 'Urgente', color: 'red' }, { id: 'e2', name: '', color: 'blue_dark' }, { id: 'e3', name: 'Sin color', color: null }, { id: 'e4', name: 'Negra', color: 'black' }],
    lists: [{ id: 'l2', name: 'Hecho', closed: false, pos: 200 }, { id: 'l1', name: 'Para hacer', closed: false, pos: 100 }, { id: 'l3', name: 'Vieja', closed: true, pos: 300 }],
    cards: [
      { id: id(20), name: 'Segunda', desc: '', closed: false, idList: 'l1', pos: 20, idShort: 7, idLabels: [], idMembers: ['m-fantasma'], cover: { idAttachment: 'a9' }, attachments: [] },
      { id: id(10), name: 'Comprar cemento', desc: 'Son **20 bolsas**', closed: false, idList: 'l1', pos: 10, idShort: 3, due: '2026-12-01T15:00:00.000Z', start: '2026-11-28T03:00:00.000Z', dueComplete: true,
        idLabels: ['e1', 'e2'], idMembers: ['m-emi', 'm-marta'], cover: { color: 'green', size: 'full', brightness: 'light' },
        attachments: [{ id: 'a1', name: 'Presupuesto', url: 'https://ejemplo.com/presu', isUpload: false, pos: 1, date: '2026-11-20T10:00:00.000Z' }, { id: 'a2', name: 'foto.jpg', url: 'https://trello.com/1/cards/x/attachments/a2/download/foto.jpg', isUpload: true, pos: 2 }, { id: 'a3', name: 'malo', url: 'javascript:alert(1)', pos: 3 }],
        stickers: [{ id: 's1' }] },
      { id: id(30), name: 'Archivada', desc: '', closed: true, idList: 'l2', pos: 5, idShort: 9, idLabels: [], idMembers: [] },
      { id: id(40), name: 'Huérfana', idList: 'no-existe', pos: 1, idShort: 11 },
    ],
    checklists: [{ id: 'k1', name: 'Pasos', idCard: id(10), pos: 1, checkItems: [{ id: 'i2', name: 'Pagar', state: 'incomplete', pos: 2, due: '2026-11-30T12:00:00.000Z', idMember: 'm-marta' }, { id: 'i1', name: 'Pedir precio', state: 'complete', pos: 1 }] }],
    customFields: [{ id: 'cf1', name: 'Costo' }],
    actions: [
      { id: 'x1', type: 'createCard', date: '2026-11-10T12:00:00.000Z', idMemberCreator: 'm-emi', data: { card: { id: id(10), name: 'Comprar cemento' }, list: { id: 'l1', name: 'Para hacer' } } },
      { id: 'x2', type: 'commentCard', date: '2026-11-11T12:00:00.000Z', idMemberCreator: 'm-emi', data: { card: { id: id(10) }, text: 'Ya pedí precio' } },
      { id: 'x3', type: 'commentCard', date: '2026-11-12T12:00:00.000Z', idMemberCreator: 'm-fantasma', memberCreator: { fullName: 'Pedro Sinnada' }, data: { card: { id: id(10) }, text: 'Yo lo retiro' } },
      { id: 'x4', type: 'updateCard', date: '2026-11-13T12:00:00.000Z', idMemberCreator: 'm-marta', data: { card: { id: id(30), closed: true }, old: { closed: false } } },
      { id: 'x5', type: 'updateCard', date: '2026-11-14T12:00:00.000Z', idMemberCreator: 'm-emi', data: { card: { id: id(20) }, listBefore: { id: 'l2', name: 'Hecho' }, listAfter: { id: 'l1', name: 'Para hacer' }, old: { idList: 'l2' } } },
      { id: 'x6', type: 'enablePlugin', date: '2026-11-15T12:00:00.000Z', idMemberCreator: 'm-emi', data: {} },
      { id: 'x7', type: 'commentCard', date: '2026-11-16T12:00:00.000Z', idMemberCreator: 'm-emi', data: { card: { id: 'tarjeta-borrada' }, text: 'perdido' } },
    ],
  };
}

describe('importar de Trello', () => {
  let m: Mundo; let emi: Persona; let marta: Persona; let espacio: string;
  const subir = (p: Persona, cuerpo: unknown, extra = '') => p.subir(`/api/espacios/${espacio}/importar/trello${extra}`, Buffer.from(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)));
  beforeEach(async () => {
    m = crearMundo();
    emi = await m.registrar('Emiliano');
    marta = await m.registrar('Marta Ruiz');
    espacio = (await emi.post('/api/espacios', { nombre: 'Obras' })).json.espacio.id;
  });
  afterEach(async () => { await m.cerrar(); });

  it('traduce los colores de Trello a los de la casa', () => {
    expect(colorEtiqueta('red')).toBe('rojo-2');
    expect(colorEtiqueta('blue_dark')).toBe('azul-3');
    expect(colorEtiqueta('sky_light')).toBe('celeste-1');
    expect(colorEtiqueta('black')).toBe('');
    expect(colorEtiqueta(null)).toBe('');
  });

  it('arma el tablero completo y cuenta qué entró y qué no', async () => {
    const r = await subir(emi, exportacion());
    expect(r.estado).toBe(201);
    const inf = r.json.informe;
    expect(inf.entraron).toMatchObject({ listas: 3, tarjetas: 3, etiquetas: 4, checklists: 1, items: 2, comentarios: 2, adjuntos: 2, miembros: 1 });
    expect(inf.personas_sin_cuenta).toEqual(['Pedro Sinnada']);
    const todo = inf.no_entro.join(' | ');
    expect(todo).toContain('1 archivo adjunto quedó como enlace a Trello');
    expect(todo).toContain('1 portada con foto');
    expect(todo).toContain('1 campo personalizado');
    expect(todo).toContain('1 pegatina');
    expect(todo).toContain('1 asignación');
    expect(todo).toContain('1 tarjeta cuya lista no viene');
    expect(todo).toContain('1 movimiento');

    const t = (await emi.get(`/api/tableros/${inf.tablero.enlace}`)).json;
    expect(t.tablero.nombre).toBe('Obra Belgrano');
    expect(t.tablero.fondo).toEqual({ tipo: 'color', valor: 'oceano' });
    // Las listas quedan en el orden de Trello, y la cerrada entra archivada.
    expect(t.listas.map((l: any) => l.nombre)).toEqual(['Para hacer', 'Hecho']);
    const lista = t.listas[0].id;
    const deLista = t.tarjetas.filter((c: any) => c.lista_id === lista);
    expect(deLista.map((c: any) => c.titulo)).toEqual(['Comprar cemento', 'Segunda']);
    const cemento = deLista[0];
    expect(cemento).toMatchObject({ numero: 3, completada: true, vence: '2026-12-01T15:00:00.000Z', inicio: '2026-11-28', n_comentarios: 2, n_adjuntos: 2, n_items: 2, n_hechos: 1 });
    expect(cemento.portada).toEqual({ color: 'verde', adjunto: null, tamano: 'completa', tono: 'claro' });
    expect(cemento.etiquetas).toHaveLength(2);
    expect(cemento.miembros.sort()).toEqual([emi.id, marta.id].sort());
    expect(cemento.creada_en).toBe('2026-11-10T12:00:00.000Z');
    expect(t.etiquetas.map((e: any) => e.color).sort()).toEqual(['', '', 'azul-3', 'rojo-2']);
    // Marta entra con el rol que tenía en Trello.
    expect(t.miembros.find((x: any) => x.id === marta.id).rol).toBe('observador');
    expect(t.miembros.find((x: any) => x.id === emi.id).rol).toBe('admin');

    const d = (await emi.get(`/api/tarjetas/${cemento.id}`)).json;
    expect(d.descripcion ?? d.tarjeta?.descripcion).toBe('Son **20 bolsas**');
    const coms = d.comentarios.map((c: any) => ({ t: c.texto, a: c.autor?.id ?? c.autor_externo, f: c.creado_en }));
    expect(coms).toContainEqual({ t: 'Ya pedí precio', a: emi.id, f: '2026-11-11T12:00:00.000Z' });
    expect(coms).toContainEqual({ t: 'Yo lo retiro', a: 'Pedro Sinnada', f: '2026-11-12T12:00:00.000Z' });
    expect(d.adjuntos.map((a: any) => a.nombre)).toEqual(['Presupuesto', 'foto.jpg']);
    expect(d.adjuntos.every((a: any) => a.tipo === 'enlace')).toBe(true);
    expect(d.checklists[0].items.map((i: any) => [i.texto, i.hecho])).toEqual([['Pedir precio', true], ['Pagar', false]]);
    const deTrello = d.actividad.find((a: any) => a.tipo === 'tarjeta_comentada' && a.actor === null);
    expect(deTrello.datos.de_trello).toBe('Pedro Sinnada');

    // El número siguiente sigue después del más alto que vino de Trello.
    const nueva = (await emi.post(`/api/listas/${lista}/tarjetas`, { titulo: 'Nueva' })).json.tarjeta;
    expect(nueva.numero).toBe(10);
    // La archivada está en archivados.
    const arch = (await emi.get(`/api/tableros/${t.tablero.id}/archivados`)).json;
    expect(arch.tarjetas.map((c: any) => c.titulo)).toEqual(['Archivada']);
    expect(arch.listas.map((l: any) => l.nombre)).toEqual(['Vieja']);
  });

  it('no trae dos veces el mismo tablero salvo que se confirme', async () => {
    expect((await subir(emi, exportacion())).estado).toBe(201);
    const otra = await subir(emi, exportacion());
    expect(otra.estado).toBe(409);
    expect(otra.json.error).toBe('ya_importado');
    expect((await subir(emi, exportacion(), '?repetir=1')).estado).toBe(201);
    expect((await emi.get(`/api/espacios/${espacio}/tableros`)).json.tableros).toHaveLength(2);
  });

  it('permite decir a mano quién es quién', async () => {
    const r = await subir(emi, exportacion(), '?emparejar=pedros:marta.ruiz@prueba.test');
    expect(r.json.informe.personas_sin_cuenta).toEqual([]);
  });

  it('reconoce nombres parecidos y al único dueño de un tablero personal', async () => {
    // "Marta Ruiz" acá, "Marta Ruiz Díaz" en Trello: una sola cuenta parecida, se empareja y se avisa.
    const e = exportacion();
    e.members[1].fullName = 'Marta Ruiz Díaz';
    e.members[1].username = 'mruizdiaz';
    e.actions.push({ id: 'x8', type: 'commentCard', date: '2026-11-17T12:00:00.000Z', idMemberCreator: 'm-marta', data: { card: { id: id(10) }, text: 'Soy Marta' } });
    const inf = (await subir(emi, e)).json.informe;
    expect(inf.personas_sin_cuenta).toEqual(['Pedro Sinnada']);
    expect(inf.avisos.join(' ')).toContain('"Marta Ruiz Díaz" de Trello quedó como Marta Ruiz.');
    // Tablero de una sola persona con otro nombre: es de quien lo trae.
    const solo = exportacion();
    solo.id = id(2);
    solo.members = [{ id: 'm-emi', fullName: 'Otro Nombre Distinto', username: 'otro' }];
    solo.memberships = [{ idMember: 'm-emi', memberType: 'admin' }];
    solo.cards.forEach((c: any) => { c.idMembers = []; });
    solo.checklists = [];
    solo.actions = solo.actions.filter((a: any) => a.idMemberCreator === 'm-emi');
    const inf2 = (await subir(emi, solo)).json.informe;
    expect(inf2.personas_sin_cuenta).toEqual([]);
    const act = (await emi.get(`/api/tableros/${inf2.tablero.enlace}/actividad`)).json.actividad;
    expect(act.every((a: any) => a.actor?.id === emi.id)).toBe(true);
    // Si dos cuentas se parecen, no adivina.
    await m.registrar('Pedro');
    await m.registrar('Sinnada');
    const dudoso = exportacion();
    dudoso.id = id(3);
    expect((await subir(emi, dudoso)).json.informe.personas_sin_cuenta).toEqual(['Pedro Sinnada']);
  });

  it('deja decir después quién es alguien que entró con su nombre de Trello', async () => {
    const inf = (await subir(emi, exportacion())).json.informe;
    const ruta = `/api/tableros/${inf.tablero.enlace}/de-trello`;
    expect((await emi.get(ruta)).json.nombres).toEqual(['Pedro Sinnada']);
    const pedro = await m.registrar('Pedrito');
    expect((await pedro.post(`${ruta}/reconocer`, { nombre: 'Pedro Sinnada', usuario_id: pedro.id })).estado).toBe(404);
    expect((await emi.post(`${ruta}/reconocer`, { nombre: 'Nadie', usuario_id: pedro.id })).estado).toBe(404);
    const r = await emi.post(`${ruta}/reconocer`, { nombre: 'Pedro Sinnada', usuario_id: pedro.id });
    expect(r.estado).toBe(200);
    expect(r.json.cambios).toEqual({ comentarios: 1, actividad: 1 });
    expect(r.json.quedan).toEqual([]);
    const t = (await emi.get(`/api/tableros/${inf.tablero.enlace}`)).json;
    const cemento = t.tarjetas.find((c: any) => c.titulo === 'Comprar cemento');
    const d = (await emi.get(`/api/tarjetas/${cemento.id}`)).json;
    expect(d.comentarios.find((c: any) => c.texto === 'Yo lo retiro').autor.id).toBe(pedro.id);
    expect(d.actividad.find((a: any) => a.tipo === 'tarjeta_comentada' && a.datos.texto === 'Yo lo retiro').actor.id).toBe(pedro.id);
  });

  it('rechaza archivos que no son de Trello y no deja nada a medias', async () => {
    expect((await subir(emi, 'esto no es json')).estado).toBe(400);
    expect((await subir(emi, { hola: 1 })).estado).toBe(400);
    expect((await subir(emi, [1, 2])).estado).toBe(400);
    // Un dato roto a mitad de camino deshace todo: no queda ni el tablero ni sus listas.
    const rota = exportacion();
    Object.defineProperty(rota, 'customFields', { get() { throw new Error('roto a propósito'); } });
    const contar = () => (m.db.prepare('SELECT (SELECT count(*) FROM tableros) + (SELECT count(*) FROM listas) + (SELECT count(*) FROM tarjetas) AS n').get() as { n: number }).n;
    const antes = contar();
    expect(() => importarTrello(m.db, rota, { espacio: leerEspacio(m.db, espacio)!, usuario: leerUsuario(m.db, emi.id)!, zona: 'America/Argentina/Buenos_Aires', visibilidad: 'espacio' })).toThrow('roto a propósito');
    expect(contar()).toBe(antes);
    // Y después de ese fallo se puede seguir importando.
    expect((await subir(emi, exportacion())).estado).toBe(201);
  });

  it('respeta los permisos del espacio', async () => {
    expect((await subir(m.anonimo, exportacion())).estado).toBe(401);
    expect((await subir(marta, exportacion())).estado).toBe(404);
    expect((await subir(emi, exportacion(), '?visibilidad=cualquiera')).estado).toBe(400);
  });

  it('Alex puede traerlo por su puerta', async () => {
    const llave = (await emi.post('/api/admin/alex/llaves', { nombre: 'prueba' })).json.llave;
    const r = await m.app.inject({ method: 'POST', url: '/mcp', headers: { authorization: `Bearer ${llave}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'tablero_importar_trello', arguments: { espacio_id: espacio, base64: Buffer.from(JSON.stringify(exportacion())).toString('base64'), visibilidad: 'privado' } } } });
    const res = r.json().result;
    expect(res.isError).toBeFalsy();
    const inf = JSON.parse(res.content[0].text).informe;
    expect(inf.entraron.tarjetas).toBe(3);
    const fila = m.db.prepare('SELECT visibilidad, creado_por FROM tableros WHERE id = ?').get(inf.tablero.id) as { visibilidad: string; creado_por: string };
    expect(fila.visibilidad).toBe('privado');
    expect((m.db.prepare('SELECT es_robot FROM usuarios WHERE id = ?').get(fila.creado_por) as { es_robot: number }).es_robot).toBe(1);
  });
});
