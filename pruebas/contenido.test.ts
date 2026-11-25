// Listas y tarjetas: crear, ordenar, mover, copiar, archivar, y quién puede hacerlo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

let m: Mundo;
let ana: Persona;
let espacio: string;
let tablero: string;

const nuevoTablero = async (p: Persona, nombre: string, visibilidad = 'espacio') =>
  (await p.post('/api/tableros', { espacio_id: espacio, nombre, visibilidad })).json.tablero.id as string;
const nuevaLista = async (nombre: string, enTablero = tablero, extra: object = {}) =>
  (await ana.post(`/api/tableros/${enTablero}/listas`, { nombre, ...extra })).json.lista;
const nuevaTarjeta = async (lista: string, titulo: string, extra: object = {}) =>
  (await ana.post(`/api/listas/${lista}/tarjetas`, { titulo, ...extra })).json.tarjeta;
/** El tablero como lo ve la pantalla: nombres de listas en orden y, por lista, los títulos en orden. */
const foto = async (p: Persona = ana, enTablero = tablero) => {
  const d = (await p.get(`/api/tableros/${enTablero}`)).json;
  return Object.fromEntries(d.listas.map((l: any) => [l.nombre, d.tarjetas.filter((c: any) => c.lista_id === l.id).map((c: any) => c.titulo)]));
};

beforeEach(async () => {
  m = crearMundo();
  ana = await m.registrar('Ana');
  espacio = (await ana.post('/api/espacios', { nombre: 'Equipo' })).json.espacio.id;
  tablero = await nuevoTablero(ana, 'Obra');
});
afterEach(async () => { await m.cerrar(); });

describe('listas', () => {
  it('se crean al final, o arriba si se pide, y el tablero las devuelve en orden', async () => {
    await nuevaLista('Uno');
    await nuevaLista('Dos');
    await nuevaLista('Cero', tablero, { posicion: 'arriba' });
    expect(Object.keys(await foto())).toEqual(['Cero', 'Uno', 'Dos']);
  });

  it('se renombran y se reordenan poniendo una posición entre dos vecinas', async () => {
    const a = await nuevaLista('A');
    const b = await nuevaLista('B');
    const c = await nuevaLista('C');
    await ana.patch(`/api/listas/${c.id}`, { posicion: (a.posicion + b.posicion) / 2, nombre: 'C2' });
    expect(Object.keys(await foto())).toEqual(['A', 'C2', 'B']);
  });

  it('si dos posiciones quedan iguales se vuelve a numerar y el orden sigue firme', async () => {
    const a = await nuevaLista('A');
    const b = await nuevaLista('B');
    await ana.patch(`/api/listas/${b.id}`, { posicion: a.posicion });
    const d = (await ana.get(`/api/tableros/${tablero}`)).json;
    const posiciones = d.listas.map((l: any) => l.posicion);
    expect(new Set(posiciones).size).toBe(2);
    expect(posiciones[1] - posiciones[0]).toBeGreaterThan(1000);
  });

  it('archivar la saca de la vista con sus tarjetas; restaurar las trae de vuelta', async () => {
    const a = await nuevaLista('A');
    await nuevaTarjeta(a.id, 'uno');
    await ana.patch(`/api/listas/${a.id}`, { archivada: true });
    expect(await foto()).toEqual({});
    const arch = (await ana.get(`/api/tableros/${tablero}/archivados`)).json;
    expect(arch.listas.map((l: any) => l.nombre)).toEqual(['A']);
    expect((await ana.post(`/api/listas/${a.id}/tarjetas`, { titulo: 'x' })).estado).toBe(409);
    await ana.patch(`/api/listas/${a.id}`, { archivada: false });
    expect(await foto()).toEqual({ A: ['uno'] });
  });

  it('copiar deja la copia al lado, con las mismas tarjetas y números nuevos', async () => {
    const a = await nuevaLista('A');
    await nuevaLista('B');
    await nuevaTarjeta(a.id, 'uno');
    await nuevaTarjeta(a.id, 'dos');
    const r = await ana.post(`/api/listas/${a.id}/copiar`, { nombre: 'A copia' });
    expect(r.estado).toBe(201);
    expect(await foto()).toEqual({ A: ['uno', 'dos'], 'A copia': ['uno', 'dos'], B: [] });
    expect(r.json.tarjetas.map((c: any) => c.numero)).toEqual([3, 4]);
  });

  it('mover todas las tarjetas las agrega al final de la otra lista, en el mismo orden', async () => {
    const a = await nuevaLista('A');
    const b = await nuevaLista('B');
    await nuevaTarjeta(a.id, 'a1');
    await nuevaTarjeta(a.id, 'a2');
    await nuevaTarjeta(b.id, 'b1');
    await ana.post(`/api/listas/${a.id}/mover-tarjetas`, { lista_id: b.id });
    expect(await foto()).toEqual({ A: [], B: ['b1', 'a1', 'a2'] });
  });

  it('archivar todas las tarjetas vacía la lista y quedan en archivados', async () => {
    const a = await nuevaLista('A');
    await nuevaTarjeta(a.id, 'a1');
    await nuevaTarjeta(a.id, 'a2');
    await ana.post(`/api/listas/${a.id}/archivar-tarjetas`);
    expect(await foto()).toEqual({ A: [] });
    expect((await ana.get(`/api/tableros/${tablero}/archivados`)).json.tarjetas).toHaveLength(2);
  });

  it('ordenar por nombre o por fecha deja el orden guardado', async () => {
    const a = await nuevaLista('A');
    for (const t of ['pera', 'Banana', 'ananá']) await nuevaTarjeta(a.id, t);
    await ana.post(`/api/listas/${a.id}/ordenar`, { por: 'nombre' });
    expect((await foto()).A).toEqual(['ananá', 'Banana', 'pera']);
    await ana.post(`/api/listas/${a.id}/ordenar`, { por: 'nuevas' });
    expect((await foto()).A).toEqual(['ananá', 'Banana', 'pera']);
    await ana.post(`/api/listas/${a.id}/ordenar`, { por: 'viejas' });
    expect((await foto()).A).toEqual(['pera', 'Banana', 'ananá']);
    expect((await ana.post(`/api/listas/${a.id}/ordenar`, { por: 'votos' })).estado).toBe(400);
  });

  it('se puede mandar a otro tablero con sus tarjetas, que reciben número nuevo', async () => {
    const otro = await nuevoTablero(ana, 'Otro');
    const a = await nuevaLista('A');
    await nuevaTarjeta(a.id, 'uno');
    const yaEstaba = await nuevaLista('Ya estaba', otro);
    await nuevaTarjeta(yaEstaba.id, 'previa');
    await ana.patch(`/api/listas/${a.id}`, { tablero_id: otro });
    expect(await foto()).toEqual({});
    expect(await foto(ana, otro)).toEqual({ 'Ya estaba': ['previa'], A: ['uno'] });
    const d = (await ana.get(`/api/tableros/${otro}`)).json;
    expect(d.tarjetas.map((c: any) => c.numero).sort()).toEqual([1, 2]);
  });
});

describe('tarjetas', () => {
  it('se crean abajo, arriba o en una posición, con número correlativo por tablero', async () => {
    const a = await nuevaLista('A');
    const uno = await nuevaTarjeta(a.id, 'uno');
    const dos = await nuevaTarjeta(a.id, 'dos');
    await nuevaTarjeta(a.id, 'cero', { posicion: 'arriba' });
    await nuevaTarjeta(a.id, 'medio', { posicion: (uno.posicion + dos.posicion) / 2 });
    expect((await foto()).A).toEqual(['cero', 'uno', 'medio', 'dos']);
    expect([uno.numero, dos.numero]).toEqual([1, 2]);
    expect(uno.enlace).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('pegar varios renglones crea varias tarjetas juntas y en orden, también arriba', async () => {
    const a = await nuevaLista('A');
    await nuevaTarjeta(a.id, 'vieja');
    const r = await ana.post(`/api/listas/${a.id}/tarjetas`, { titulos: ['x', 'y', 'z'], posicion: 'arriba' });
    expect(r.json.tarjetas).toHaveLength(3);
    await ana.post(`/api/listas/${a.id}/tarjetas`, { titulos: ['p', 'q'] });
    expect((await foto()).A).toEqual(['x', 'y', 'z', 'vieja', 'p', 'q']);
    expect((await ana.post(`/api/listas/${a.id}/tarjetas`, { titulos: Array(101).fill('t') })).estado).toBe(400);
    expect((await ana.post(`/api/listas/${a.id}/tarjetas`, { titulo: '   ' })).estado).toBe(400);
  });

  it('se edita el título y la descripción', async () => {
    const a = await nuevaLista('A');
    const c = await nuevaTarjeta(a.id, 'uno');
    const r = await ana.patch(`/api/tarjetas/${c.id}`, { titulo: 'Uno mejor', descripcion: 'Detalle' });
    expect(r.json.tarjeta).toMatchObject({ titulo: 'Uno mejor', tiene_descripcion: true });
    const det = (await ana.get(`/api/tarjetas/${c.enlace}`)).json;
    expect(det.tarjeta.descripcion).toBe('Detalle');
    expect(det.lista.nombre).toBe('A');
  });

  it('se mueve dentro de la lista y a otra lista (queda abajo si no se dice dónde)', async () => {
    const a = await nuevaLista('A');
    const b = await nuevaLista('B');
    const a1 = await nuevaTarjeta(a.id, 'a1');
    const a2 = await nuevaTarjeta(a.id, 'a2');
    const a3 = await nuevaTarjeta(a.id, 'a3');
    const b1 = await nuevaTarjeta(b.id, 'b1');
    await ana.patch(`/api/tarjetas/${a3.id}`, { posicion: (a1.posicion + a2.posicion) / 2 });
    expect((await foto()).A).toEqual(['a1', 'a3', 'a2']);
    await ana.patch(`/api/tarjetas/${a1.id}`, { lista_id: b.id });
    await ana.patch(`/api/tarjetas/${a2.id}`, { lista_id: b.id, posicion: b1.posicion / 2 });
    expect(await foto()).toEqual({ A: ['a3'], B: ['a2', 'b1', 'a1'] });
  });

  it('muchas inserciones en el mismo hueco no rompen el orden (se vuelve a numerar sola)', async () => {
    const a = await nuevaLista('A');
    const primera = await nuevaTarjeta(a.id, 'primera');
    await nuevaTarjeta(a.id, 'ultima');
    let piso = primera.posicion;
    for (let i = 0; i < 40; i++) {
      const d = (await ana.get(`/api/tableros/${tablero}`)).json;
      const orden = d.tarjetas.filter((c: any) => c.lista_id === a.id);
      piso = orden[0].posicion;
      const techo = orden[1].posicion;
      await nuevaTarjeta(a.id, `m${i}`, { posicion: (piso + techo) / 2 });
    }
    const titulos = (await foto()).A;
    expect(titulos[0]).toBe('primera');
    expect(titulos[1]).toBe('m39');
    expect(titulos[40]).toBe('m0');
    expect(titulos[41]).toBe('ultima');
  });

  it('se mueve a otro tablero: desaparece del primero y recibe número del segundo', async () => {
    const otro = await nuevoTablero(ana, 'Otro');
    const a = await nuevaLista('A');
    const z = await nuevaLista('Z', otro);
    await nuevaTarjeta(z.id, 'previa');
    const c = await nuevaTarjeta(a.id, 'viajera');
    const r = await ana.patch(`/api/tarjetas/${c.id}`, { lista_id: z.id, posicion: 'arriba' });
    expect(r.json.tarjeta).toMatchObject({ tablero_id: otro, numero: 2 });
    expect(await foto()).toEqual({ A: [] });
    expect(await foto(ana, otro)).toEqual({ Z: ['viajera', 'previa'] });
  });

  it('archivar la saca de la vista y restaurar la devuelve a su lugar', async () => {
    const a = await nuevaLista('A');
    await nuevaTarjeta(a.id, 'uno');
    const c = await nuevaTarjeta(a.id, 'dos');
    await nuevaTarjeta(a.id, 'tres');
    await ana.patch(`/api/tarjetas/${c.id}`, { archivada: true });
    expect((await foto()).A).toEqual(['uno', 'tres']);
    expect((await ana.get(`/api/tableros/${tablero}/archivados`)).json.tarjetas[0]).toMatchObject({ titulo: 'dos', lista_nombre: 'A' });
    await ana.patch(`/api/tarjetas/${c.id}`, { archivada: false });
    expect((await foto()).A).toEqual(['uno', 'dos', 'tres']);
  });

  it('copiar crea otra tarjeta, con o sin la descripción, en la lista elegida', async () => {
    const a = await nuevaLista('A');
    const b = await nuevaLista('B');
    const c = await nuevaTarjeta(a.id, 'uno');
    await ana.patch(`/api/tarjetas/${c.id}`, { descripcion: 'Detalle' });
    const con = await ana.post(`/api/tarjetas/${c.id}/copiar`, { lista_id: b.id, titulo: 'copia' });
    const sin = await ana.post(`/api/tarjetas/${c.id}/copiar`, { conservar: { descripcion: false } });
    expect(con.json.tarjeta).toMatchObject({ lista_id: b.id, tiene_descripcion: true, numero: 2 });
    expect(sin.json.tarjeta).toMatchObject({ lista_id: a.id, tiene_descripcion: false, titulo: 'uno' });
    expect(await foto()).toEqual({ A: ['uno', 'uno'], B: ['copia'] });
  });

  it('rechaza posiciones que no son válidas', async () => {
    const a = await nuevaLista('A');
    const c = await nuevaTarjeta(a.id, 'uno');
    for (const posicion of [0, -5, 'medio', null]) expect((await ana.patch(`/api/tarjetas/${c.id}`, { posicion })).estado).toBe(400);
  });

  it('cada cambio queda en la actividad con quién lo hizo', async () => {
    const a = await nuevaLista('A');
    const b = await nuevaLista('B');
    const c = await nuevaTarjeta(a.id, 'uno');
    await ana.patch(`/api/tarjetas/${c.id}`, { lista_id: b.id });
    await ana.patch(`/api/tarjetas/${c.id}`, { posicion: 5 });
    await ana.patch(`/api/tarjetas/${c.id}`, { archivada: true });
    const filas = m.db.prepare("SELECT tipo, actor_id, datos FROM actividad WHERE tablero_id = ? AND tipo LIKE 'tarjeta_%' ORDER BY rowid").all(tablero) as { tipo: string; actor_id: string; datos: string }[];
    expect(filas.map((f) => f.tipo)).toEqual(['tarjeta_creada', 'tarjeta_movida', 'tarjeta_archivada']);
    expect(filas.every((f) => f.actor_id === ana.id)).toBe(true);
    expect(JSON.parse(filas[1].datos)).toMatchObject({ de_lista: { nombre: 'A' }, a_lista: { nombre: 'B' } });
  });
});

describe('quién puede tocar listas y tarjetas', () => {
  it('observador y visitante sin cuenta ven pero no editan; miembro sí; ajeno no ve nada', async () => {
    const privado = await nuevoTablero(ana, 'Privado', 'privado');
    const publico = await nuevoTablero(ana, 'Público', 'publico');
    const lp = await nuevaLista('L', privado);
    const cp = await nuevaTarjeta(lp.id, 'secreta');
    const lpub = await nuevaLista('L', publico);
    await nuevaTarjeta(lpub.id, 'abierta');
    const obs = await m.registrar('Olga');
    const miembro = await m.registrar('Mario');
    const ajeno = await m.registrar('Zoe');
    await ana.post(`/api/tableros/${privado}/miembros`, { usuario_id: obs.id, rol: 'observador' });
    await ana.post(`/api/tableros/${privado}/miembros`, { usuario_id: miembro.id, rol: 'normal' });

    expect(await foto(obs, privado)).toEqual({ L: ['secreta'] });
    expect((await obs.post(`/api/listas/${lp.id}/tarjetas`, { titulo: 'x' })).estado).toBe(403);
    expect((await obs.patch(`/api/tarjetas/${cp.id}`, { titulo: 'x' })).estado).toBe(403);
    expect((await obs.post(`/api/tableros/${privado}/listas`, { nombre: 'x' })).estado).toBe(403);

    expect((await miembro.post(`/api/listas/${lp.id}/tarjetas`, { titulo: 'de mario' })).estado).toBe(201);

    expect((await ajeno.get(`/api/tarjetas/${cp.id}`)).estado).toBe(403);
    expect((await ajeno.patch(`/api/tarjetas/${cp.id}`, { titulo: 'x' })).estado).toBe(404);
    expect((await ajeno.patch(`/api/listas/${lp.id}`, { nombre: 'x' })).estado).toBe(404);
    expect((await ajeno.get(`/api/tableros/${privado}/archivados`)).estado).toBe(403);

    expect(await foto(m.anonimo, publico)).toEqual({ L: ['abierta'] });
    expect((await m.anonimo.post(`/api/listas/${lpub.id}/tarjetas`, { titulo: 'x' })).estado).toBe(401);
    expect((await ajeno.post(`/api/listas/${lpub.id}/tarjetas`, { titulo: 'x' })).estado).toBe(403);
  });

  it('no se puede mover a un tablero donde no puedo editar, ni editar un tablero cerrado', async () => {
    const privado = await nuevoTablero(ana, 'Privado', 'privado');
    const lp = await nuevaLista('L', privado);
    const mario = await m.registrar('Mario');
    await ana.post(`/api/espacios/${espacio}/miembros`, { usuario_id: mario.id });
    const a = await nuevaLista('A');
    const c = await nuevaTarjeta(a.id, 'uno');
    expect((await mario.patch(`/api/tarjetas/${c.id}`, { titulo: 'de mario' })).estado).toBe(200);
    expect((await mario.patch(`/api/tarjetas/${c.id}`, { lista_id: lp.id })).estado).toBe(404);
    expect((await mario.patch(`/api/listas/${a.id}`, { tablero_id: privado })).estado).toBe(404);
    expect((await mario.get('/api/yo/tableros-editables')).json.tableros.map((t: any) => t.nombre)).toEqual(['Obra']);

    await ana.patch(`/api/tableros/${tablero}`, { cerrado: true });
    expect((await ana.patch(`/api/tarjetas/${c.id}`, { titulo: 'x' })).estado).toBe(403);
    expect((await ana.post(`/api/tableros/${tablero}/listas`, { nombre: 'x' })).estado).toBe(403);
    expect(await foto()).toEqual({ A: ['de mario'] });
  });
});
