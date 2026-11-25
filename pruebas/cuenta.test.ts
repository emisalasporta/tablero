import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearMundo, Persona, type Mundo } from './ayuda.ts';

describe('cuentas y sesiones', () => {
  let m: Mundo;
  beforeEach(() => { m = crearMundo(); });
  afterEach(() => m.cerrar());

  it('la primera cuenta no necesita invitación y queda como administradora general', async () => {
    expect((await m.anonimo.get('/api/instalacion')).json.hay_usuarios).toBe(false);
    const emi = await m.registrar('Emiliano Salas');
    const yo = await emi.get('/api/yo');
    expect(yo.json.usuario.es_admin_general).toBe(true);
    expect(yo.json.usuario.iniciales).toBe('ES');
    expect((await m.anonimo.get('/api/instalacion')).json.hay_usuarios).toBe(true);
  });

  it('después de la primera cuenta, sin invitación no se puede crear otra', async () => {
    await m.registrar('Emiliano Salas');
    const r = await m.anonimo.post('/api/cuenta/registro', { nombre: 'Intruso', email: 'intruso@prueba.test', clave: 'clave-larga-1' });
    expect(r.estado).toBe(403);
  });

  it('con un enlace de invitación sí, y no queda como administradora general', async () => {
    await m.registrar('Emiliano Salas');
    const marta = await m.registrar('Marta López');
    expect((await marta.get('/api/yo')).json.usuario.es_admin_general).toBe(false);
  });

  it('un enlace anulado ya no sirve', async () => {
    const emi = await m.registrar('Emiliano Salas');
    const viejo = (await emi.post('/api/admin/invitaciones')).json.token;
    await emi.post('/api/admin/invitaciones'); // crear uno nuevo anula el anterior
    const r = await m.anonimo.post('/api/cuenta/registro', { nombre: 'Tarde', email: 'tarde@prueba.test', clave: 'clave-larga-1', invitacion: viejo });
    expect(r.estado).toBe(410);
  });

  it('rechaza contraseñas cortas, correos inválidos y correos repetidos', async () => {
    const emi = await m.registrar('Emiliano Salas');
    const inv = (await emi.post('/api/admin/invitaciones')).json.token;
    const base = { nombre: 'Juan', invitacion: inv };
    expect((await m.anonimo.post('/api/cuenta/registro', { ...base, email: 'juan@prueba.test', clave: 'corta' })).estado).toBe(400);
    expect((await m.anonimo.post('/api/cuenta/registro', { ...base, email: 'no-es-correo', clave: 'clave-larga-1' })).estado).toBe(400);
    expect((await m.anonimo.post('/api/cuenta/registro', { ...base, email: 'EMILIANO.SALAS@prueba.test', clave: 'clave-larga-1' })).estado).toBe(409);
  });

  it('entrar, salir y volver a entrar', async () => {
    const emi = await m.registrar('Emiliano Salas');
    expect((await emi.del('/api/sesion')).estado).toBe(200);
    expect((await emi.get('/api/yo')).estado).toBe(401);
    const otra = new Persona(m.app);
    expect((await otra.post('/api/sesion', { email: 'emiliano.salas@prueba.test', clave: 'mal' })).estado).toBe(401);
    expect((await otra.post('/api/sesion', { email: 'Emiliano.Salas@prueba.test', clave: 'clave-de-prueba' })).estado).toBe(200);
    expect((await otra.get('/api/yo')).json.usuario.nombre).toBe('Emiliano Salas');
  });

  it('la contraseña no se guarda legible y la sesión no viaja legible en la base', async () => {
    await m.registrar('Emiliano Salas');
    const u = m.db.prepare('SELECT clave_hash FROM usuarios').get() as { clave_hash: string };
    expect(u.clave_hash).not.toContain('clave-de-prueba');
    expect(u.clave_hash.startsWith('scrypt$')).toBe(true);
  });

  it('frena después de muchos intentos fallidos', async () => {
    await m.registrar('Emiliano Salas');
    const p = new Persona(m.app);
    const cuerpo = { email: 'emiliano.salas@prueba.test', clave: 'incorrecta' };
    for (let i = 0; i < 8; i++) expect((await p.post('/api/sesion', cuerpo)).estado).toBe(401);
    expect((await p.post('/api/sesion', cuerpo)).estado).toBe(429);
  });

  it('editar perfil: nombre, nombre de usuario único y zona horaria válida', async () => {
    const emi = await m.registrar('Emiliano Salas');
    const marta = await m.registrar('Marta López');
    const r = await emi.patch('/api/yo', { nombre: 'Emiliano S. Porta', usuario: 'emi', bio: 'Hola', zona_horaria: 'America/Argentina/Catamarca' });
    expect(r.json.usuario).toMatchObject({ nombre: 'Emiliano S. Porta', usuario: 'emi', iniciales: 'EP', bio: 'Hola' });
    expect((await marta.patch('/api/yo', { usuario: 'emi' })).estado).toBe(409);
    expect((await marta.patch('/api/yo', { usuario: 'Con Espacios' })).estado).toBe(400);
    expect((await marta.patch('/api/yo', { zona_horaria: 'Marte/Olimpo' })).estado).toBe(400);
  });

  it('cambiar la contraseña pide la actual y cierra las otras sesiones', async () => {
    const emi = await m.registrar('Emiliano Salas');
    const otroDispositivo = new Persona(m.app);
    await otroDispositivo.post('/api/sesion', { email: 'emiliano.salas@prueba.test', clave: 'clave-de-prueba' });
    expect((await emi.post('/api/yo/clave', { actual: 'mal', nueva: 'nueva-clave-123' })).estado).toBe(401);
    expect((await emi.post('/api/yo/clave', { actual: 'clave-de-prueba', nueva: 'nueva-clave-123' })).estado).toBe(200);
    expect((await emi.get('/api/yo')).estado).toBe(200);
    expect((await otroDispositivo.get('/api/yo')).estado).toBe(401);
  });

  it('contraseña olvidada: la administración general da una temporal; nadie más puede', async () => {
    const emi = await m.registrar('Emiliano Salas');
    const marta = await m.registrar('Marta López');
    expect((await marta.post(`/api/admin/usuarios/${emi.id}/clave-temporal`)).estado).toBe(403);
    const r = await emi.post(`/api/admin/usuarios/${marta.id}/clave-temporal`);
    expect(r.estado).toBe(200);
    expect((await marta.get('/api/yo')).estado).toBe(401); // se cerraron sus sesiones
    const vuelve = new Persona(m.app);
    const entra = await vuelve.post('/api/sesion', { email: 'marta.lópez@prueba.test', clave: r.json.clave_temporal });
    expect(entra.estado).toBe(200);
    expect(entra.json.usuario.debe_cambiar_clave).toBe(true);
  });

  it('buscar personas solo por correo o usuario exacto, y sin mostrar el correo', async () => {
    const emi = await m.registrar('Emiliano Salas');
    await m.registrar('Marta López');
    expect((await m.anonimo.get('/api/usuarios/buscar?q=marta')).estado).toBe(401);
    expect((await emi.get('/api/usuarios/buscar?q=mart')).json.usuario).toBeNull();
    const r = await emi.get('/api/usuarios/buscar?q=' + encodeURIComponent('marta.lópez@prueba.test'));
    expect(r.json.usuario.nombre).toBe('Marta López');
    expect(r.json.usuario.email).toBeUndefined();
  });
});
