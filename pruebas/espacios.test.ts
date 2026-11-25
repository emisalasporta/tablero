import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

describe('espacios de trabajo', () => {
  let m: Mundo;
  let emi: Persona, marta: Persona, juan: Persona, carla: Persona;
  let espacio: string;

  beforeEach(async () => {
    m = crearMundo();
    emi = await m.registrar('Emiliano Salas');
    marta = await m.registrar('Marta López');
    juan = await m.registrar('Juan Paz');
    carla = await m.registrar('Carla Ruiz');
    espacio = (await marta.post('/api/espacios', { nombre: 'Equipo Marta' })).json.espacio.id;
  });
  afterEach(() => m.cerrar());

  it('quien crea el espacio queda como administradora y lo ve en su lista', async () => {
    const lista = (await marta.get('/api/espacios')).json.espacios;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nombre: 'Equipo Marta', rol: 'admin', invitado: false });
  });

  it('un espacio privado no existe para quien no es miembro', async () => {
    expect((await juan.get(`/api/espacios/${espacio}`)).estado).toBe(404);
    expect((await m.anonimo.get(`/api/espacios/${espacio}`)).estado).toBe(404);
    expect((await juan.get('/api/espacios')).json.espacios).toHaveLength(0);
  });

  it('la administración general entra a cualquier espacio', async () => {
    const r = await emi.get(`/api/espacios/${espacio}`);
    expect(r.estado).toBe(200);
    expect(r.json.mi.administra).toBe(true);
  });

  it('un espacio público se puede ver sin ser miembro, pero no su lista de miembros ni sus ajustes', async () => {
    await marta.patch(`/api/espacios/${espacio}`, { visibilidad: 'publico' });
    const r = await juan.get(`/api/espacios/${espacio}`);
    expect(r.estado).toBe(200);
    expect(r.json.espacio.ajustes).toBeUndefined();
    expect((await juan.get(`/api/espacios/${espacio}/miembros`)).estado).toBe(403);
  });

  it('solo quien administra suma miembros; la persona tiene que tener cuenta', async () => {
    expect((await juan.post(`/api/espacios/${espacio}/miembros`, { quien: 'carla.ruiz@prueba.test' })).estado).toBe(404);
    expect((await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'nadie@prueba.test' })).estado).toBe(404);
    expect((await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'juan.paz@prueba.test' })).estado).toBe(201);
    expect((await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'juan.paz@prueba.test' })).estado).toBe(409);
    // Juan ahora es miembro normal: ve el espacio pero no puede sumar gente ni cambiar ajustes.
    expect((await juan.get(`/api/espacios/${espacio}`)).json.mi).toMatchObject({ rol: 'normal', administra: false });
    expect((await juan.post(`/api/espacios/${espacio}/miembros`, { quien: 'carla.ruiz@prueba.test' })).estado).toBe(403);
    expect((await juan.patch(`/api/espacios/${espacio}`, { nombre: 'Tomado' })).estado).toBe(403);
  });

  it('un miembro normal ve la lista de miembros pero no los correos', async () => {
    await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'juan.paz@prueba.test' });
    const comoJuan = (await juan.get(`/api/espacios/${espacio}/miembros`)).json.miembros;
    expect(comoJuan.map((x: any) => x.nombre).sort()).toEqual(['Juan Paz', 'Marta López']);
    expect(comoJuan.every((x: any) => x.email === undefined)).toBe(true);
    const comoMarta = (await marta.get(`/api/espacios/${espacio}/miembros`)).json.miembros;
    expect(comoMarta.every((x: any) => typeof x.email === 'string')).toBe(true);
  });

  it('el espacio no puede quedarse sin administración', async () => {
    await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'juan.paz@prueba.test' });
    expect((await marta.patch(`/api/espacios/${espacio}/miembros/${marta.id}`, { rol: 'normal' })).estado).toBe(409);
    expect((await marta.del(`/api/espacios/${espacio}/miembros/${marta.id}`)).estado).toBe(409);
    expect((await marta.patch(`/api/espacios/${espacio}/miembros/${marta.id}`, { desactivado: true })).estado).toBe(409);
    // Con otra administradora, sí puede bajar de rol.
    expect((await marta.patch(`/api/espacios/${espacio}/miembros/${juan.id}`, { rol: 'admin' })).estado).toBe(200);
    expect((await marta.patch(`/api/espacios/${espacio}/miembros/${marta.id}`, { rol: 'normal' })).estado).toBe(200);
  });

  it('un miembro puede irse solo; quitar a otro es de quien administra', async () => {
    await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'juan.paz@prueba.test' });
    await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'carla.ruiz@prueba.test' });
    expect((await juan.del(`/api/espacios/${espacio}/miembros/${carla.id}`)).estado).toBe(403);
    expect((await juan.del(`/api/espacios/${espacio}/miembros/${juan.id}`)).estado).toBe(200);
    expect((await juan.get(`/api/espacios/${espacio}`)).estado).toBe(404);
  });

  it('un miembro desactivado pierde el acceso pero sigue en la lista', async () => {
    await marta.post(`/api/espacios/${espacio}/miembros`, { quien: 'juan.paz@prueba.test' });
    await marta.patch(`/api/espacios/${espacio}/miembros/${juan.id}`, { desactivado: true });
    expect((await juan.get(`/api/espacios/${espacio}`)).estado).toBe(404);
    expect((await juan.get('/api/espacios')).json.espacios).toHaveLength(0);
    const fila = (await marta.get(`/api/espacios/${espacio}/miembros`)).json.miembros.find((x: any) => x.id === juan.id);
    expect(fila.desactivado).toBe(true);
    await marta.patch(`/api/espacios/${espacio}/miembros/${juan.id}`, { desactivado: false });
    expect((await juan.get(`/api/espacios/${espacio}`)).estado).toBe(200);
  });

  it('enlace de invitación: suma como miembro normal a quien ya tiene cuenta y a quien se registra con él', async () => {
    expect((await juan.post(`/api/espacios/${espacio}/invitacion`)).estado).toBe(404);
    const token = (await marta.post(`/api/espacios/${espacio}/invitacion`)).json.token;
    expect((await m.anonimo.get(`/api/invitaciones/${token}`)).json).toMatchObject({ tipo: 'espacio', destino: 'Equipo Marta', invita: 'Marta López' });
    expect((await juan.post(`/api/invitaciones/${token}/aceptar`)).json.entrada.espacio_id).toBe(espacio);
    expect((await juan.get(`/api/espacios/${espacio}`)).json.mi.rol).toBe('normal');
    const nuevo = await m.anonimo.post('/api/cuenta/registro', { nombre: 'Nueva Persona', email: 'nueva@prueba.test', clave: 'clave-larga-1', invitacion: token });
    expect(nuevo.estado).toBe(201);
    expect(nuevo.json.entrada.espacio_id).toBe(espacio);
    // Anulado el enlace, deja de servir.
    await marta.del(`/api/espacios/${espacio}/invitacion`);
    expect((await carla.post(`/api/invitaciones/${token}/aceptar`)).estado).toBe(410);
  });

  it('ajustes del espacio: se validan y solo los cambia quien administra', async () => {
    const r = await marta.patch(`/api/espacios/${espacio}`, { ajustes: { crear: { publico: 'nadie', privado: 'admins' }, invitados: 'admins' } });
    expect(r.json.espacio.ajustes.crear).toEqual({ privado: 'admins', espacio: 'miembros', publico: 'nadie' });
    expect(r.json.espacio.ajustes.invitados).toBe('admins');
    expect((await marta.patch(`/api/espacios/${espacio}`, { ajustes: { crear: { publico: 'cualquiera' } } })).estado).toBe(400);
    expect((await marta.patch(`/api/espacios/${espacio}`, { sitio_web: 'javascript:alert(1)' })).estado).toBe(400);
  });

  it('pedir sumarse a un espacio público y que lo aprueben', async () => {
    await marta.patch(`/api/espacios/${espacio}`, { visibilidad: 'publico' });
    expect((await juan.post(`/api/espacios/${espacio}/pedidos`)).estado).toBe(201);
    expect((await juan.post(`/api/espacios/${espacio}/pedidos`)).estado).toBe(409);
    const pedidos = (await marta.get(`/api/espacios/${espacio}/miembros`)).json.pedidos;
    expect(pedidos).toHaveLength(1);
    expect((await carla.patch(`/api/pedidos/${pedidos[0].id}`, { estado: 'aprobado' })).estado).toBe(403);
    expect((await marta.patch(`/api/pedidos/${pedidos[0].id}`, { estado: 'aprobado' })).estado).toBe(200);
    expect((await juan.get(`/api/espacios/${espacio}`)).json.mi.rol).toBe('normal');
  });

  it('no se borra un espacio con tableros abiertos', async () => {
    const t = (await marta.post('/api/tableros', { espacio_id: espacio, nombre: 'Tablero' })).json.tablero;
    expect((await marta.del(`/api/espacios/${espacio}`)).estado).toBe(409);
    await marta.patch(`/api/tableros/${t.id}`, { cerrado: true });
    expect((await marta.del(`/api/espacios/${espacio}`)).estado).toBe(200);
    expect((await marta.get(`/api/espacios/${espacio}`)).estado).toBe(404);
  });
});
