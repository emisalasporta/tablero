// Tiempo real: lo que cambia una persona le llega al instante a las demás que miran el mismo tablero.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WebSocket } from 'ws';
import { crearMundo, type Mundo, type Persona } from './ayuda.ts';

let m: Mundo;
let ana: Persona;
let espacio: string;
let tablero: string;
let lista: string;

/** Una pantalla abierta en un tablero: junta los avisos que le llegan. */
class Pantalla {
  avisos: any[] = [];
  cerrada = false;
  socket: WebSocket;
  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on('message', (d) => this.avisos.push(JSON.parse(String(d))));
    socket.on('close', () => { this.cerrada = true; });
  }
  /** Espera hasta que llegue un aviso de ese tipo (o falla al segundo). */
  async esperar(tipo: string): Promise<any> {
    for (let i = 0; i < 100; i++) {
      const j = this.avisos.findIndex((a) => a.tipo === tipo);
      if (j >= 0) return this.avisos.splice(j, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`No llegó ningún aviso "${tipo}". Llegaron: ${JSON.stringify(this.avisos)}`);
  }
}
const abrir = async (p: Persona, enTablero = tablero) => {
  await m.app.ready();
  const pantalla = new Pantalla(await m.app.injectWS(`/api/tableros/${enTablero}/vivo`, { headers: p.galleta ? { cookie: p.galleta } : {} }));
  return pantalla;
};
const pausa = () => new Promise((r) => setTimeout(r, 60));

beforeEach(async () => {
  m = crearMundo();
  ana = await m.registrar('Ana');
  espacio = (await ana.post('/api/espacios', { nombre: 'Equipo' })).json.espacio.id;
  tablero = (await ana.post('/api/tableros', { espacio_id: espacio, nombre: 'Obra', visibilidad: 'privado' })).json.tablero.id;
  lista = (await ana.post(`/api/tableros/${tablero}/listas`, { nombre: 'A' })).json.lista.id;
});
afterEach(async () => { await m.cerrar(); });

describe('tiempo real', () => {
  it('lo que crea o mueve una persona le llega a la otra, con la marca de quién lo originó', async () => {
    const beto = await m.registrar('Beto');
    await ana.post(`/api/tableros/${tablero}/miembros`, { usuario_id: beto.id });
    const pantallaBeto = await abrir(beto);

    const r = await m.app.inject({ method: 'POST', url: `/api/listas/${lista}/tarjetas`, headers: { cookie: ana.galleta, 'content-type': 'application/json', 'x-cliente': 'pantalla-de-ana' }, payload: JSON.stringify({ titulo: 'Comprar cemento' }) });
    const aviso = await pantallaBeto.esperar('cambio');
    expect(aviso.origen).toBe('pantalla-de-ana');
    expect(aviso.tarjetas).toHaveLength(1);
    expect(aviso.tarjetas[0]).toMatchObject({ titulo: 'Comprar cemento', lista_id: lista, archivada: false });

    const otra = (await ana.post(`/api/tableros/${tablero}/listas`, { nombre: 'B' })).json.lista;
    expect((await pantallaBeto.esperar('cambio')).listas[0].nombre).toBe('B');
    await ana.patch(`/api/tarjetas/${r.json().tarjeta.id}`, { lista_id: otra.id });
    expect((await pantallaBeto.esperar('cambio')).tarjetas[0].lista_id).toBe(otra.id);
  });

  it('al mover una tarjeta a otro tablero se enteran las pantallas de los dos', async () => {
    const otro = (await ana.post('/api/tableros', { espacio_id: espacio, nombre: 'Otro' })).json.tablero.id;
    const destino = (await ana.post(`/api/tableros/${otro}/listas`, { nombre: 'Z' })).json.lista.id;
    const c = (await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'viajera' })).json.tarjeta;
    const aca = await abrir(ana);
    const alla = await abrir(ana, otro);
    await ana.patch(`/api/tarjetas/${c.id}`, { lista_id: destino });
    expect((await aca.esperar('cambio')).tarjetas[0].tablero_id).toBe(otro);
    expect((await alla.esperar('cambio')).tarjetas[0]).toMatchObject({ titulo: 'viajera', lista_id: destino });
  });

  it('quien no puede ver el tablero no puede abrir la línea', async () => {
    const zoe = await m.registrar('Zoe');
    await m.app.ready();
    await expect(m.app.injectWS(`/api/tableros/${tablero}/vivo`, { headers: { cookie: zoe.galleta } })).rejects.toThrow();
    await expect(m.app.injectWS(`/api/tableros/${tablero}/vivo`)).rejects.toThrow();
  });

  it('a quien sacan del tablero se le corta la línea y no recibe nada más', async () => {
    const beto = await m.registrar('Beto');
    await ana.post(`/api/tableros/${tablero}/miembros`, { usuario_id: beto.id });
    const pantallaBeto = await abrir(beto);
    await ana.del(`/api/tableros/${tablero}/miembros/${beto.id}`);
    await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'secreta' });
    await pausa();
    expect(pantallaBeto.cerrada).toBe(true);
    expect(pantallaBeto.avisos.filter((a) => a.tipo === 'cambio')).toEqual([]);
  });

  it('un tablero público se puede mirar en vivo sin cuenta', async () => {
    await ana.patch(`/api/tableros/${tablero}`, { visibilidad: 'publico' });
    const visita = await abrir(m.anonimo);
    await ana.post(`/api/listas/${lista}/tarjetas`, { titulo: 'a la vista' });
    expect((await visita.esperar('cambio')).tarjetas[0].titulo).toBe('a la vista');
  });

  it('cambiar el nombre o la gente del tablero avisa para que la cabecera se actualice', async () => {
    const pantalla = await abrir(ana);
    await ana.patch(`/api/tableros/${tablero}`, { nombre: 'Obra nueva' });
    await pantalla.esperar('tablero');
  });
});
