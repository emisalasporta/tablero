// La tarjeta por dentro: etiquetas, miembros, fechas, checklists, comentarios, adjuntos, portada y fotos.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

let m: Mundo;
let ana: Persona;
let espacio: string;
let tablero: string;
let lista: string;
let tarjeta: string;

/** Un PNG mínimo de verdad (1×1). */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const detalle = async (p: Persona = ana, id = tarjeta) => (await p.get(`/api/tarjetas/${id}`)).json;
const frente = async (id = tarjeta) => (await ana.get(`/api/tableros/${tablero}`)).json.tarjetas.find((c: any) => c.id === id);
const tipos = async () => (await detalle()).actividad.map((x: any) => x.tipo);

beforeEach(async () => {
  m = crearMundo();
  ana = await m.registrar('Ana');
  espacio = (await ana.post('/api/espacios', { nombre: 'Equipo' })).json.espacio.id;
  tablero = (await ana.post('/api/tableros', { espacio_id: espacio, nombre: 'Obra' })).json.tablero.id;
  lista = (await ana.post(`/api/tableros/${tablero}/listas`, { nombre: 'Pendiente' })).json.lista.id;
  tarjeta = (await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'Pintar' })).json.tarjeta.id;
});
afterEach(async () => { await m.cerrar(); });

describe('etiquetas', () => {
  it('se crean en el tablero, se ponen y se sacan de la tarjeta, y el frente las lleva', async () => {
    const e = (await ana.post(`/api/tableros/${tablero}/etiquetas`, { nombre: 'Urgente', color: 'rojo-2' })).json.etiqueta;
    expect((await ana.get(`/api/tableros/${tablero}`)).json.etiquetas).toEqual([{ id: e.id, nombre: 'Urgente', color: 'rojo-2' }]);
    expect((await ana.post(`/api/tarjetas/${tarjeta}/etiquetas`, { etiqueta_id: e.id })).json.tarjeta.etiquetas).toEqual([e.id]);
    expect((await frente()).etiquetas).toEqual([e.id]);
    await ana.patch(`/api/etiquetas/${e.id}`, { nombre: 'Ya', color: 'azul-3' });
    expect((await ana.get(`/api/tableros/${tablero}`)).json.etiquetas[0]).toMatchObject({ nombre: 'Ya', color: 'azul-3' });
    await ana.del(`/api/tarjetas/${tarjeta}/etiquetas/${e.id}`);
    expect((await frente()).etiquetas).toEqual([]);
  });

  it('rechaza colores inventados y etiquetas vacías; al borrarla sale de las tarjetas', async () => {
    expect((await ana.post(`/api/tableros/${tablero}/etiquetas`, { nombre: 'X', color: 'fucsia' })).estado).toBe(400);
    expect((await ana.post(`/api/tableros/${tablero}/etiquetas`, { nombre: '', color: '' })).estado).toBe(400);
    const e = (await ana.post(`/api/tableros/${tablero}/etiquetas`, { color: 'verde-1' })).json.etiqueta;
    await ana.post(`/api/tarjetas/${tarjeta}/etiquetas`, { etiqueta_id: e.id });
    await ana.del(`/api/etiquetas/${e.id}`);
    expect((await frente()).etiquetas).toEqual([]);
  });

  it('al mover la tarjeta a otro tablero, la etiqueta se busca o se crea allá', async () => {
    const otro = (await ana.post('/api/tableros', { espacio_id: espacio, nombre: 'Otro' })).json.tablero.id;
    const listaOtro = (await ana.post(`/api/tableros/${otro}/listas`, { nombre: 'Allá' })).json.lista.id;
    const e = (await ana.post(`/api/tableros/${tablero}/etiquetas`, { nombre: 'Urgente', color: 'rojo-2' })).json.etiqueta;
    await ana.post(`/api/tarjetas/${tarjeta}/etiquetas`, { etiqueta_id: e.id });
    await ana.patch(`/api/tarjetas/${tarjeta}`, { lista_id: listaOtro });
    const d = (await ana.get(`/api/tableros/${otro}`)).json;
    expect(d.etiquetas).toHaveLength(1);
    expect(d.etiquetas[0]).toMatchObject({ nombre: 'Urgente', color: 'rojo-2' });
    expect(d.tarjetas[0].etiquetas).toEqual([d.etiquetas[0].id]);
    expect(d.etiquetas[0].id).not.toBe(e.id);
  });
});

describe('miembros y fechas', () => {
  it('solo se asigna a gente del tablero; queda en la actividad', async () => {
    const beto = await m.registrar('Beto');
    expect((await ana.post(`/api/tarjetas/${tarjeta}/miembros`, { usuario_id: beto.id })).estado).toBe(400);
    await ana.post(`/api/tableros/${tablero}/miembros`, { quien: 'beto@prueba.test', rol: 'normal' });
    expect((await ana.post(`/api/tarjetas/${tarjeta}/miembros`, { usuario_id: beto.id })).json.tarjeta.miembros).toEqual([beto.id]);
    expect(await tipos()).toContain('tarjeta_miembro_sumado');
    await ana.del(`/api/tarjetas/${tarjeta}/miembros/${beto.id}`);
    expect((await frente()).miembros).toEqual([]);
  });

  it('inicio, vencimiento y completada se guardan, se quitan y se validan', async () => {
    const r = await ana.patch(`/api/tarjetas/${tarjeta}`, { inicio: '2026-11-30', vence: '2026-12-05T15:00:00-03:00', completada: true });
    expect(r.json.tarjeta).toMatchObject({ inicio: '2026-11-30', vence: '2026-12-05T18:00:00.000Z', completada: true });
    expect(await tipos()).toEqual(expect.arrayContaining(['tarjeta_vence', 'tarjeta_completada']));
    expect((await ana.patch(`/api/tarjetas/${tarjeta}`, { vence: null, inicio: null })).json.tarjeta).toMatchObject({ inicio: null, vence: null });
    expect((await ana.patch(`/api/tarjetas/${tarjeta}`, { vence: 'mañana' })).estado).toBe(400);
    expect((await ana.patch(`/api/tarjetas/${tarjeta}`, { inicio: '30/11/2026' })).estado).toBe(400);
  });

  it('la lista se puede ordenar por vencimiento, con las sin fecha al final', async () => {
    const b = (await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'B' })).json.tarjeta.id;
    const c = (await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'C' })).json.tarjeta.id;
    await ana.patch(`/api/tarjetas/${b}`, { vence: '2026-12-10T12:00:00Z' });
    await ana.patch(`/api/tarjetas/${c}`, { vence: '2026-12-01T12:00:00Z' });
    const r = await ana.post(`/api/listas/${lista}/ordenar`, { por: 'vence' });
    expect(r.json.tarjetas.map((x: any) => x.titulo)).toEqual(['C', 'B', 'Pintar']);
  });
});

describe('checklists', () => {
  it('ítems: varios de una vez, tildar, contar en el frente, mover y borrar', async () => {
    const k = (await ana.post(`/api/tarjetas/${tarjeta}/checklists`, { nombre: 'Materiales' })).json.checklist_id;
    await ana.post(`/api/checklists/${k}/items`, { textos: ['Pintura', 'Rodillo', 'Lija'] });
    let d = await detalle();
    expect(d.checklists[0].items.map((i: any) => i.texto)).toEqual(['Pintura', 'Rodillo', 'Lija']);
    const [pintura, rodillo, lija] = d.checklists[0].items;
    expect((await ana.patch(`/api/items/${rodillo.id}`, { hecho: true })).json.tarjeta).toMatchObject({ n_items: 3, n_hechos: 1 });
    // Lija pasa al primer lugar.
    await ana.patch(`/api/items/${lija.id}`, { posicion: pintura.posicion / 2 });
    // Pintura se va a otra checklist.
    const k2 = (await ana.post(`/api/tarjetas/${tarjeta}/checklists`, { nombre: 'Después' })).json.checklist_id;
    await ana.patch(`/api/items/${pintura.id}`, { checklist_id: k2 });
    d = await detalle();
    expect(d.checklists.map((x: any) => [x.nombre, x.items.map((i: any) => i.texto)])).toEqual([['Materiales', ['Lija', 'Rodillo']], ['Después', ['Pintura']]]);
    await ana.del(`/api/items/${lija.id}`);
    await ana.del(`/api/checklists/${k2}`);
    expect(await frente()).toMatchObject({ n_items: 1, n_hechos: 1 });
  });

  it('copia los ítems de otra checklist sin tildes, y convierte un ítem en tarjeta', async () => {
    const k = (await ana.post(`/api/tarjetas/${tarjeta}/checklists`, { nombre: 'Base' })).json.checklist_id;
    await ana.post(`/api/checklists/${k}/items`, { textos: ['Uno', 'Dos'] });
    const uno = (await detalle()).checklists[0].items[0];
    await ana.patch(`/api/items/${uno.id}`, { hecho: true });
    const otra = (await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'Otra' })).json.tarjeta.id;
    await ana.post(`/api/tarjetas/${otra}/checklists`, { nombre: 'Copia', copiar_de: k });
    expect((await detalle(ana, otra)).checklists[0].items.map((i: any) => [i.texto, i.hecho])).toEqual([['Uno', false], ['Dos', false]]);
    const r = await ana.post(`/api/items/${uno.id}/convertir`);
    expect(r.estado).toBe(201);
    expect(r.json.creada.titulo).toBe('Uno');
    expect(r.json.tarjeta.n_items).toBe(1);
  });

  it('un ítem puede tener persona asignada y fecha', async () => {
    const k = (await ana.post(`/api/tarjetas/${tarjeta}/checklists`, { nombre: 'Base' })).json.checklist_id;
    await ana.post(`/api/checklists/${k}/items`, { texto: 'Llamar' });
    const item = (await detalle()).checklists[0].items[0];
    await ana.patch(`/api/items/${item.id}`, { asignado_id: ana.id, vence: '2026-12-01T12:00:00Z' });
    expect((await detalle()).checklists[0].items[0]).toMatchObject({ asignado_id: ana.id, vence: '2026-12-01T12:00:00.000Z' });
    expect((await ana.patch(`/api/items/${item.id}`, { asignado_id: 'nadie' })).estado).toBe(400);
  });
});

describe('comentarios', () => {
  it('se escribe, se edita solo el propio, reacciona cualquiera que pueda comentar y borra quien administra', async () => {
    const beto = await m.registrar('Beto');
    await ana.post(`/api/tableros/${tablero}/miembros`, { quien: 'beto@prueba.test', rol: 'normal' });
    const cid = (await beto.post(`/api/tarjetas/${tarjeta}/comentarios`, { texto: 'Falta pintura @ana' })).json.comentario_id;
    expect((await frente()).n_comentarios).toBe(1);
    expect((await ana.patch(`/api/comentarios/${cid}`, { texto: 'cambiado' })).estado).toBe(403);
    await beto.patch(`/api/comentarios/${cid}`, { texto: 'Falta pintura blanca' });
    await ana.post(`/api/comentarios/${cid}/reacciones`, { emoji: '👍' });
    let c = (await detalle()).comentarios[0];
    expect(c).toMatchObject({ texto: 'Falta pintura blanca', reacciones: [{ emoji: '👍', usuarios: [ana.id] }] });
    expect(c.editado_en).toBeTruthy();
    expect(c.autor.nombre).toBe('Beto');
    await ana.post(`/api/comentarios/${cid}/reacciones`, { emoji: '👍' });
    c = (await detalle()).comentarios[0];
    expect(c.reacciones).toEqual([]);
    expect((await ana.del(`/api/comentarios/${cid}`)).estado).toBe(200);
    expect((await detalle()).comentarios).toEqual([]);
    expect(await tipos()).not.toContain('tarjeta_comentada');
  });

  it('quien observa no comenta salvo que el tablero lo permita; sin cuenta, nunca', async () => {
    const olga = await m.registrar('Olga');
    await ana.post(`/api/tableros/${tablero}/miembros`, { quien: 'olga@prueba.test', rol: 'observador' });
    expect((await olga.post(`/api/tarjetas/${tarjeta}/comentarios`, { texto: 'hola' })).estado).toBe(403);
    await ana.patch(`/api/tableros/${tablero}`, { permisos: { comentar: 'observadores' } });
    expect((await olga.post(`/api/tarjetas/${tarjeta}/comentarios`, { texto: 'hola' })).estado).toBe(201);
    expect((await olga.post(`/api/tarjetas/${tarjeta}/checklists`, { nombre: 'x' })).estado).toBe(403);
    expect((await m.anonimo.post(`/api/tarjetas/${tarjeta}/comentarios`, { texto: 'hola' })).estado).toBe(401);
  });

  it('la actividad del tablero se puede pedir entera o solo comentarios', async () => {
    await ana.post(`/api/tarjetas/${tarjeta}/comentarios`, { texto: 'Primero' });
    const todo = (await ana.get(`/api/tableros/${tablero}/actividad`)).json;
    expect(todo.actividad.map((x: any) => x.tipo)).toEqual(expect.arrayContaining(['tarjeta_comentada', 'tarjeta_creada', 'lista_creada']));
    const solo = (await ana.get(`/api/tableros/${tablero}/actividad?solo=comentarios`)).json;
    expect(solo.actividad.map((x: any) => x.tipo)).toEqual(['tarjeta_comentada']);
    expect(solo.actividad[0].tarjeta_enlace).toBeTruthy();
    expect(solo.hay_mas).toBe(false);
  });
});

describe('adjuntos y portada', () => {
  it('un archivo se sube, se baja igual, se renombra y se borra del disco', async () => {
    const contenido = Buffer.from('hola, soy un archivo de texto');
    const r = await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=${encodeURIComponent('nota año.txt')}&tipo=text/plain`, contenido);
    expect(r.estado).toBe(201);
    expect(r.json.adjunto).toMatchObject({ tipo: 'archivo', nombre: 'nota año.txt', tamano: contenido.length, es_imagen: false });
    expect(r.json.tarjeta.n_adjuntos).toBe(1);
    const b = await ana.bajar(`/api/adjuntos/${r.json.adjunto.id}/archivo`);
    expect(b.estado).toBe(200);
    expect(b.cuerpo.equals(contenido)).toBe(true);
    expect(b.cabeceras['x-content-type-options']).toBe('nosniff');
    const parte = await ana.bajar(`/api/adjuntos/${r.json.adjunto.id}/archivo`, { range: 'bytes=0-3' });
    expect(parte.estado).toBe(206);
    expect(parte.cuerpo.toString()).toBe('hola');
    await ana.patch(`/api/adjuntos/${r.json.adjunto.id}`, { nombre: 'apunte.txt' });
    expect((await detalle()).adjuntos[0].nombre).toBe('apunte.txt');
    await ana.del(`/api/adjuntos/${r.json.adjunto.id}`);
    expect((await ana.bajar(`/api/adjuntos/${r.json.adjunto.id}/archivo`)).estado).toBe(404);
    expect((await frente()).n_adjuntos).toBe(0);
  });

  it('una página web subida nunca se muestra adentro de la app: se baja como archivo', async () => {
    const r = await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=pagina.html&tipo=text/html`, Buffer.from('<script>alert(1)</script>'));
    const b = await ana.bajar(`/api/adjuntos/${r.json.adjunto.id}/archivo`);
    expect(b.cabeceras['content-type']).toBe('application/octet-stream');
    expect(String(b.cabeceras['content-disposition'])).toMatch(/^attachment/);
    // Y algo que dice ser imagen sin serlo, tampoco.
    const falsa = await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=foto.png&tipo=image/png`, Buffer.from('<svg onload=alert(1)>'));
    expect(falsa.json.adjunto.es_imagen).toBe(false);
  });

  it('respeta el tope de tamaño y no deja restos', async () => {
    const r = await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=grande.bin`, Buffer.alloc(1024 * 1024 + 10, 1));
    expect(r.estado).toBe(413);
    expect((await detalle()).adjuntos).toEqual([]);
  });

  it('solo baja el archivo quien puede ver la tarjeta', async () => {
    await ana.patch(`/api/tableros/${tablero}`, { visibilidad: 'privado' });
    const r = await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=a.txt&tipo=text/plain`, Buffer.from('secreto'));
    const beto = await m.registrar('Beto');
    expect((await beto.bajar(`/api/adjuntos/${r.json.adjunto.id}/archivo`)).estado).toBe(404);
    expect((await m.anonimo.bajar(`/api/adjuntos/${r.json.adjunto.id}/archivo`)).estado).toBe(404);
    expect((await beto.get(`/api/tarjetas/${tarjeta}`)).estado).toBe(403);
  });

  it('la primera imagen pasa a ser portada; se cambia por un color y se quita; borrar la imagen la quita', async () => {
    const r = await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=foto.png&tipo=image/png`, PNG);
    expect(r.json.adjunto.es_imagen).toBe(true);
    expect(r.json.tarjeta.portada).toMatchObject({ adjunto: r.json.adjunto.id, tamano: 'media' });
    expect((await ana.patch(`/api/tarjetas/${tarjeta}`, { portada: { color: 'azul', tamano: 'completa', tono: 'claro' } })).json.tarjeta.portada).toEqual({ color: 'azul', adjunto: null, tamano: 'completa', tono: 'claro' });
    expect((await ana.patch(`/api/tarjetas/${tarjeta}`, { portada: { color: 'fucsia' } })).estado).toBe(400);
    expect((await ana.patch(`/api/tarjetas/${tarjeta}`, { portada: null })).json.tarjeta.portada).toBeNull();
    await ana.patch(`/api/tarjetas/${tarjeta}`, { portada: { adjunto: r.json.adjunto.id } });
    expect((await ana.del(`/api/adjuntos/${r.json.adjunto.id}`)).json.tarjeta.portada).toBeNull();
  });

  it('un enlace se adjunta con su nombre; tiene que ser http o https', async () => {
    const r = await ana.post(`/api/tarjetas/${tarjeta}/adjuntos`, { url: 'https://ejemplo.com/plano', nombre: 'Plano' });
    expect(r.json.adjunto).toMatchObject({ tipo: 'enlace', nombre: 'Plano', url: 'https://ejemplo.com/plano' });
    expect((await ana.post(`/api/tarjetas/${tarjeta}/adjuntos`, { url: 'javascript:alert(1)' })).estado).toBe(400);
  });

  it('copiar la tarjeta se lleva etiquetas, checklists y adjuntos, salvo que se pida que no', async () => {
    const e = (await ana.post(`/api/tableros/${tablero}/etiquetas`, { nombre: 'Urgente', color: 'rojo-2' })).json.etiqueta;
    await ana.post(`/api/tarjetas/${tarjeta}/etiquetas`, { etiqueta_id: e.id });
    const k = (await ana.post(`/api/tarjetas/${tarjeta}/checklists`, { nombre: 'Base' })).json.checklist_id;
    await ana.post(`/api/checklists/${k}/items`, { texto: 'Uno' });
    await ana.subir(`/api/tarjetas/${tarjeta}/adjuntos?nombre=foto.png&tipo=image/png`, PNG);
    const copia = (await ana.post(`/api/tarjetas/${tarjeta}/copiar`, { titulo: 'Copia' })).json.tarjeta;
    expect(copia).toMatchObject({ etiquetas: [e.id], n_items: 1, n_adjuntos: 1 });
    const d = await detalle(ana, copia.id);
    expect(copia.portada.adjunto).toBe(d.adjuntos[0].id);
    expect((await ana.bajar(`/api/adjuntos/${d.adjuntos[0].id}/archivo`)).cuerpo.equals(PNG)).toBe(true);
    const pelada = (await ana.post(`/api/tarjetas/${tarjeta}/copiar`, { titulo: 'Pelada', conservar: { etiquetas: false, checklists: false, adjuntos: false } })).json.tarjeta;
    expect(pelada).toMatchObject({ etiquetas: [], n_items: 0, n_adjuntos: 0, portada: null });
  });
});

describe('fotos y ajustes de vista', () => {
  it('la foto de perfil tiene que ser una imagen de verdad; se ve sin sesión y se puede quitar', async () => {
    expect((await ana.subir('/api/yo/avatar', Buffer.from('no soy una imagen'))).estado).toBe(400);
    const r = await ana.subir('/api/yo/avatar', PNG);
    expect(r.estado).toBe(200);
    expect((await ana.get('/api/yo')).json.usuario.avatar).toBe(r.json.avatar);
    const foto = await m.anonimo.bajar(`/api/fotos/${r.json.avatar}`);
    expect(foto.estado).toBe(200);
    expect(foto.cabeceras['content-type']).toBe('image/png');
    expect((await m.anonimo.bajar('/api/fotos/..%2F..%2Ftablero.db')).estado).toBe(404);
    await ana.del('/api/yo/avatar');
    expect((await m.anonimo.bajar(`/api/fotos/${r.json.avatar}`)).estado).toBe(404);
  });

  it('el logo del espacio lo cambia solo quien lo administra', async () => {
    const beto = await m.registrar('Beto');
    await ana.post(`/api/espacios/${espacio}/miembros`, { quien: 'beto@prueba.test' });
    expect((await beto.subir(`/api/espacios/${espacio}/logo`, PNG)).estado).toBe(403);
    const r = await ana.subir(`/api/espacios/${espacio}/logo`, PNG);
    expect((await ana.get(`/api/espacios/${espacio}`)).json.espacio.logo).toBe(r.json.logo);
  });

  it('el tablero guarda si muestra portadas y el tilde de completada', async () => {
    expect((await ana.get(`/api/tableros/${tablero}`)).json.tablero.ajustes).toEqual({ portadas: true, tilde: true });
    await ana.patch(`/api/tableros/${tablero}`, { ajustes: { portadas: false } });
    expect((await ana.get(`/api/tableros/${tablero}`)).json.tablero.ajustes).toEqual({ portadas: false, tilde: true });
  });
});
