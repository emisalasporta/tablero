import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

// Elenco fijo para toda la matriz de permisos:
//   emi    = administración general (no pertenece al espacio)
//   marta  = administra el espacio
//   juan   = miembro normal del espacio, creador (y administrador) del tablero
//   carla  = miembro normal del espacio, no está en el tablero
//   pedro  = invitado: está en el tablero pero no en el espacio
//   olga   = observadora del tablero (miembro del espacio)
//   ana    = tiene cuenta pero no tiene nada que ver
describe('tableros: quién puede qué', () => {
  let m: Mundo;
  let emi: Persona, marta: Persona, juan: Persona, carla: Persona, pedro: Persona, olga: Persona, ana: Persona;
  let espacio: string, tablero: string, enlace: string;
  const ver = (p: Persona) => p.get(`/api/tableros/${tablero}`);
  const puede = async (p: Persona) => (await ver(p)).json?.mi?.puede;
  const visibilidad = (v: string) => juan.patch(`/api/tableros/${tablero}`, { visibilidad: v });

  beforeEach(async () => {
    m = crearMundo();
    emi = await m.registrar('Emiliano Salas');
    marta = await m.registrar('Marta López');
    juan = await m.registrar('Juan Paz');
    carla = await m.registrar('Carla Ruiz');
    pedro = await m.registrar('Pedro Gil');
    olga = await m.registrar('Olga Sosa');
    ana = await m.registrar('Ana Vera');
    espacio = (await marta.post('/api/espacios', { nombre: 'Equipo' })).json.espacio.id;
    for (const quien of ['juan.paz', 'carla.ruiz', 'olga.sosa']) await marta.post(`/api/espacios/${espacio}/miembros`, { quien: `${quien}@prueba.test` });
    const t = (await juan.post('/api/tableros', { espacio_id: espacio, nombre: 'Mudanza', visibilidad: 'privado' })).json.tablero;
    tablero = t.id; enlace = t.enlace;
    await juan.post(`/api/tableros/${tablero}/miembros`, { quien: 'pedro.gil@prueba.test' });
    await juan.post(`/api/tableros/${tablero}/miembros`, { quien: 'olga.sosa@prueba.test', rol: 'observador' });
  });
  afterEach(() => m.cerrar());

  it('se abre por código corto igual que por identificador', async () => {
    expect((await juan.get(`/api/tableros/${enlace}`)).json.tablero.id).toBe(tablero);
  });

  it('tablero PRIVADO: lo ven sus miembros, quien administra el espacio y la administración general', async () => {
    for (const p of [juan, pedro, olga, marta, emi]) expect((await ver(p)).estado).toBe(200);
    expect((await ver(carla)).estado).toBe(403); // del espacio pero no del tablero
    expect((await ver(ana)).estado).toBe(403);
    expect((await ver(m.anonimo)).estado).toBe(401);
    // Y no aparece en la lista de tableros del espacio para Carla.
    expect((await carla.get(`/api/espacios/${espacio}/tableros`)).json.tableros).toHaveLength(0);
    expect((await juan.get(`/api/espacios/${espacio}/tableros`)).json.tableros).toHaveLength(1);
  });

  it('tablero DEL ESPACIO: lo ven todos los miembros del espacio, no los de afuera', async () => {
    await visibilidad('espacio');
    expect((await ver(carla)).estado).toBe(200);
    expect((await ver(ana)).estado).toBe(403);
    expect((await ver(m.anonimo)).estado).toBe(401);
  });

  it('tablero PÚBLICO: lo ve cualquiera, incluso sin cuenta, pero sin poder editar ni comentar', async () => {
    await visibilidad('publico');
    const r = await ver(m.anonimo);
    expect(r.estado).toBe(200);
    expect(r.json.mi.puede).toMatchObject({ ver: true, editar: false, comentar: false, invitar: false, administrar: false });
    expect((await puede(ana))).toMatchObject({ ver: true, editar: false, comentar: false });
  });

  it('roles: administra, edita, observa', async () => {
    expect(await puede(juan)).toMatchObject({ administrar: true, editar: true, comentar: true, invitar: true });
    expect(await puede(pedro)).toMatchObject({ administrar: false, editar: true, comentar: true, invitar: true });
    expect(await puede(olga)).toMatchObject({ administrar: false, editar: false, comentar: false, invitar: false });
    expect(await puede(marta)).toMatchObject({ administrar: true, editar: true });
    expect(await puede(emi)).toMatchObject({ administrar: true, editar: true });
  });

  it('en un tablero del espacio, los miembros del espacio editan sin estar en el tablero, salvo que se apague', async () => {
    await visibilidad('espacio');
    expect(await puede(carla)).toMatchObject({ editar: true, unirse: true });
    await juan.patch(`/api/tableros/${tablero}`, { permisos: { edicion_espacio: false, union_libre: false } });
    expect(await puede(carla)).toMatchObject({ ver: true, editar: false, unirse: false });
    expect((await carla.post(`/api/tableros/${tablero}/unirse`)).estado).toBe(403);
  });

  it('sumarse solo: permitido en tableros del espacio, nunca en privados (salvo quien administra el espacio)', async () => {
    expect((await carla.post(`/api/tableros/${tablero}/unirse`)).estado).toBe(403); // privado: ni lo ve
    await visibilidad('espacio');
    expect((await carla.post(`/api/tableros/${tablero}/unirse`)).estado).toBe(200);
    expect((await ver(carla)).json.mi.rol).toBe('normal');
    await visibilidad('privado');
    expect((await marta.post(`/api/tableros/${tablero}/unirse`)).estado).toBe(200);
  });

  it('quién comenta: las cinco opciones', async () => {
    await visibilidad('publico');
    const con = async (opcion: string) => { await juan.patch(`/api/tableros/${tablero}`, { permisos: { comentar: opcion } }); };
    const comenta = async (p: Persona) => (await puede(p)).comentar;
    await con('nadie');        expect([await comenta(juan), await comenta(pedro), await comenta(olga)]).toEqual([false, false, false]);
    await con('miembros');     expect([await comenta(pedro), await comenta(olga), await comenta(carla), await comenta(ana)]).toEqual([true, false, false, false]);
    await con('observadores'); expect([await comenta(pedro), await comenta(olga), await comenta(carla), await comenta(ana)]).toEqual([true, true, false, false]);
    await con('espacio');      expect([await comenta(olga), await comenta(carla), await comenta(ana)]).toEqual([true, true, false]);
    await con('cualquiera');   expect([await comenta(carla), await comenta(ana), await comenta(m.anonimo)]).toEqual([true, true, false]);
  });

  it('quién suma gente: miembros o solo quien administra', async () => {
    expect((await pedro.post(`/api/tableros/${tablero}/miembros`, { quien: 'carla.ruiz@prueba.test' })).estado).toBe(201);
    await juan.patch(`/api/tableros/${tablero}`, { permisos: { invitar: 'admins' } });
    expect((await pedro.post(`/api/tableros/${tablero}/miembros`, { quien: 'ana.vera@prueba.test' })).estado).toBe(403);
    expect((await juan.post(`/api/tableros/${tablero}/miembros`, { quien: 'ana.vera@prueba.test' })).estado).toBe(201);
    // La observadora nunca suma gente.
    await juan.patch(`/api/tableros/${tablero}`, { permisos: { invitar: 'miembros' } });
    expect((await olga.post(`/api/tableros/${tablero}/miembros`, { quien: 'emiliano.salas@prueba.test' })).estado).toBe(403);
  });

  it('si el espacio reserva los invitados a quien administra, un miembro no puede traer gente de afuera', async () => {
    await marta.patch(`/api/espacios/${espacio}`, { ajustes: { invitados: 'admins' } });
    expect((await juan.post(`/api/tableros/${tablero}/miembros`, { quien: 'ana.vera@prueba.test' })).estado).toBe(403);
    expect((await juan.post(`/api/tableros/${tablero}/miembros`, { quien: 'carla.ruiz@prueba.test' })).estado).toBe(201); // del espacio: sí
    expect((await juan.post(`/api/tableros/${tablero}/invitacion`)).estado).toBe(403); // un enlace puede traer gente de afuera
    expect((await marta.post(`/api/tableros/${tablero}/miembros`, { quien: 'ana.vera@prueba.test' })).estado).toBe(201);
  });

  it('solo quien administra nombra administradores y cambia roles', async () => {
    expect((await pedro.post(`/api/tableros/${tablero}/miembros`, { quien: 'carla.ruiz@prueba.test', rol: 'admin' })).estado).toBe(403);
    expect((await pedro.patch(`/api/tableros/${tablero}/miembros/${olga.id}`, { rol: 'normal' })).estado).toBe(403);
    expect((await juan.patch(`/api/tableros/${tablero}/miembros/${olga.id}`, { rol: 'normal' })).estado).toBe(200);
    expect((await puede(olga)).editar).toBe(true);
  });

  it('el tablero no puede quedarse sin administración', async () => {
    expect((await juan.patch(`/api/tableros/${tablero}/miembros/${juan.id}`, { rol: 'normal' })).estado).toBe(409);
    expect((await juan.del(`/api/tableros/${tablero}/miembros/${juan.id}`)).estado).toBe(409);
    await juan.patch(`/api/tableros/${tablero}/miembros/${pedro.id}`, { rol: 'admin' });
    expect((await juan.del(`/api/tableros/${tablero}/miembros/${juan.id}`)).estado).toBe(200);
  });

  it('un miembro puede salir solo; un miembro normal no puede quitar a quien administra', async () => {
    expect((await pedro.del(`/api/tableros/${tablero}/miembros/${juan.id}`)).estado).toBe(403);
    expect((await pedro.del(`/api/tableros/${tablero}/miembros/${olga.id}`)).estado).toBe(200);
    expect((await pedro.del(`/api/tableros/${tablero}/miembros/${pedro.id}`)).estado).toBe(200);
    expect((await ver(pedro)).estado).toBe(403);
  });

  it('el invitado aparece marcado, ve el espacio en su lista como invitado y solo sus tableros', async () => {
    const miembros = (await ver(juan)).json.miembros;
    expect(miembros.find((x: any) => x.id === pedro.id).invitado).toBe(true);
    expect(miembros.find((x: any) => x.id === olga.id).invitado).toBe(false);
    expect((await pedro.get('/api/espacios')).json.espacios[0]).toMatchObject({ invitado: true, rol: null });
    await juan.post('/api/tableros', { espacio_id: espacio, nombre: 'Otro del espacio', visibilidad: 'espacio' });
    expect((await pedro.get(`/api/espacios/${espacio}/tableros`)).json.tableros.map((t: any) => t.nombre)).toEqual(['Mudanza']);
    expect((await pedro.get(`/api/espacios/${espacio}/miembros`)).estado).toBe(403);
    const invitados = (await marta.get(`/api/espacios/${espacio}/miembros`)).json.invitados;
    expect(invitados).toHaveLength(1);
    expect(invitados[0]).toMatchObject({ nombre: 'Pedro Gil', tableros: 1 });
  });

  it('un invitado no puede crear tableros en el espacio', async () => {
    expect((await pedro.post('/api/tableros', { espacio_id: espacio, nombre: 'Colado' })).estado).toBe(403);
    expect((await ana.post('/api/tableros', { espacio_id: espacio, nombre: 'Colado' })).estado).toBe(404);
  });

  it('el espacio decide quién crea tableros de cada visibilidad', async () => {
    await marta.patch(`/api/espacios/${espacio}`, { ajustes: { crear: { publico: 'nadie', privado: 'admins' } } });
    expect((await carla.post('/api/tableros', { espacio_id: espacio, nombre: 'A', visibilidad: 'privado' })).estado).toBe(403);
    expect((await marta.post('/api/tableros', { espacio_id: espacio, nombre: 'A', visibilidad: 'privado' })).estado).toBe(201);
    expect((await marta.post('/api/tableros', { espacio_id: espacio, nombre: 'B', visibilidad: 'publico' })).estado).toBe(403);
    expect((await carla.post('/api/tableros', { espacio_id: espacio, nombre: 'C', visibilidad: 'espacio' })).estado).toBe(201);
    // Tampoco se puede llegar a "público" cambiando la visibilidad después.
    expect((await visibilidad('publico')).estado).toBe(403);
    const lista = await carla.get(`/api/espacios/${espacio}/tableros`);
    expect(lista.json.puede_crear).toEqual({ privado: false, espacio: true, publico: false });
  });

  it('cambiar visibilidad y permisos es solo de quien administra; renombrar, de quien edita', async () => {
    expect((await pedro.patch(`/api/tableros/${tablero}`, { visibilidad: 'publico' })).estado).toBe(403);
    expect((await pedro.patch(`/api/tableros/${tablero}`, { permisos: { comentar: 'cualquiera' } })).estado).toBe(403);
    expect((await pedro.patch(`/api/tableros/${tablero}`, { nombre: 'Mudanza 2026' })).estado).toBe(200);
    expect((await olga.patch(`/api/tableros/${tablero}`, { nombre: 'No' })).estado).toBe(403);
    expect((await juan.patch(`/api/tableros/${tablero}`, { permisos: { comentar: 'gritando' } })).estado).toBe(400);
  });

  it('cerrar, reabrir y borrar', async () => {
    expect((await juan.del(`/api/tableros/${tablero}`)).estado).toBe(409); // primero hay que cerrarlo
    expect((await pedro.patch(`/api/tableros/${tablero}`, { cerrado: true })).estado).toBe(403);
    expect((await juan.patch(`/api/tableros/${tablero}`, { cerrado: true })).estado).toBe(200);
    expect(await puede(pedro)).toMatchObject({ ver: true, editar: false, comentar: false, invitar: false });
    expect((await pedro.patch(`/api/tableros/${tablero}`, { nombre: 'x' })).estado).toBe(403);
    expect((await juan.patch(`/api/tableros/${tablero}`, { cerrado: false })).estado).toBe(200);
    expect((await puede(pedro)).editar).toBe(true);
    await juan.patch(`/api/tableros/${tablero}`, { cerrado: true });
    expect((await pedro.del(`/api/tableros/${tablero}`)).estado).toBe(403);
    expect((await juan.del(`/api/tableros/${tablero}`)).estado).toBe(200);
    expect((await ver(juan)).estado).toBe(404);
  });

  it('el espacio decide quién borra tableros', async () => {
    await juan.patch(`/api/tableros/${tablero}`, { cerrado: true });
    await marta.patch(`/api/espacios/${espacio}`, { ajustes: { borrar: { privado: 'admins' } } });
    expect((await juan.del(`/api/tableros/${tablero}`)).estado).toBe(403);
    await marta.patch(`/api/espacios/${espacio}`, { ajustes: { borrar: { privado: 'nadie' } } });
    expect((await marta.del(`/api/tableros/${tablero}`)).estado).toBe(403);
    expect((await emi.del(`/api/tableros/${tablero}`)).estado).toBe(200); // la administración general siempre puede
  });

  it('enlace de invitación al tablero: entra como invitada, con el rol del enlace', async () => {
    const token = (await juan.post(`/api/tableros/${tablero}/invitacion`, { rol: 'observador' })).json.token;
    expect((await m.anonimo.get(`/api/invitaciones/${token}`)).json).toMatchObject({ tipo: 'tablero', destino: 'Mudanza' });
    expect((await ana.post(`/api/invitaciones/${token}/aceptar`)).json.entrada.tablero_enlace).toBe(enlace);
    const r = await ver(ana);
    expect(r.json.mi.rol).toBe('observador');
    expect(r.json.mi.rol_espacio).toBeNull();
  });

  it('pedir acceso a un tablero que no veo, y que lo aprueben', async () => {
    expect((await m.anonimo.post(`/api/tableros/${tablero}/pedidos`)).estado).toBe(401);
    expect((await ana.post(`/api/tableros/${tablero}/pedidos`)).estado).toBe(201);
    expect((await ana.post(`/api/tableros/${tablero}/pedidos`)).estado).toBe(409);
    const pedidos = (await ver(juan)).json.pedidos;
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].persona.nombre).toBe('Ana Vera');
    expect((await ver(pedro)).json.pedidos).toHaveLength(0); // solo quien administra ve los pedidos
    expect((await olga.patch(`/api/pedidos/${pedidos[0].id}`, { estado: 'aprobado' })).estado).toBe(403);
    expect((await juan.patch(`/api/pedidos/${pedidos[0].id}`, { estado: 'aprobado' })).estado).toBe(200);
    expect((await ver(ana)).json.mi.rol).toBe('normal');
  });

  it('un miembro desactivado del espacio pierde también sus tableros de ese espacio', async () => {
    await marta.patch(`/api/espacios/${espacio}/miembros/${olga.id}`, { desactivado: true });
    expect((await ver(olga)).estado).toBe(403);
  });

  it('cada acción queda en la actividad con el nombre de quien la hizo', async () => {
    const filas = m.db.prepare(`SELECT a.tipo, u.nombre FROM actividad a JOIN usuarios u ON u.id = a.actor_id WHERE a.tablero_id = ? ORDER BY a.creado_en`).all(tablero) as { tipo: string; nombre: string }[];
    expect(filas.map((f) => f.tipo)).toEqual(['tablero_creado', 'tablero_miembro_sumado', 'tablero_miembro_sumado']);
    expect(new Set(filas.map((f) => f.nombre))).toEqual(new Set(['Juan Paz']));
  });
});
