// Tiempo real: cada pantalla que mira un tablero deja una línea abierta con el servidor (WebSocket).
// Cuando alguien cambia algo, el servidor manda por esa línea solo lo que cambió a todos los que miran ese tablero.
import type { DatabaseSync } from 'node:sqlite';
import type { WebSocket } from 'ws';
import { leerUsuario } from './nucleo.ts';
import { contexto, leerTablero, puedeVerTablero } from './permisos.ts';

interface Conexion { socket: WebSocket; usuarioId: string | null }
export type Evento = { tipo: string; [clave: string]: unknown };

export class Vivo {
  db: DatabaseSync;
  salas = new Map<string, Set<Conexion>>();
  reloj: ReturnType<typeof setInterval>;

  constructor(db: DatabaseSync) {
    this.db = db;
    // "Latido": cada 25 segundos se manda un aviso vacío, para que la línea no se corte por inactividad
    // y para que la pantalla note enseguida si se cayó la conexión.
    this.reloj = setInterval(() => {
      for (const sala of this.salas.values()) for (const c of sala) this.mandar(c, '{"tipo":"latido"}');
    }, 25_000);
    this.reloj.unref();
  }

  entrar(tableroId: string, socket: WebSocket, usuarioId: string | null) {
    const c: Conexion = { socket, usuarioId };
    let sala = this.salas.get(tableroId);
    if (!sala) this.salas.set(tableroId, (sala = new Set()));
    sala.add(c);
    const salir = () => {
      sala.delete(c);
      if (sala.size === 0 && this.salas.get(tableroId) === sala) this.salas.delete(tableroId);
    };
    socket.on('close', salir);
    socket.on('error', salir);
    this.mandar(c, '{"tipo":"hola"}');
  }

  /** Avisa un cambio a todos los que miran el tablero. `origen` identifica a la pantalla que lo hizo (para que no lo aplique dos veces). */
  emitir(tableroId: string, evento: Evento, origen: string | null = null) {
    const sala = this.salas.get(tableroId);
    if (!sala || sala.size === 0) return;
    const t = leerTablero(this.db, tableroId);
    const texto = JSON.stringify({ ...evento, origen });
    for (const c of [...sala]) {
      // Antes de cada aviso se vuelve a revisar el permiso: si a alguien lo sacaron del tablero, deja de recibir.
      const u = c.usuarioId ? leerUsuario(this.db, c.usuarioId) : null;
      const puede = !!t && (c.usuarioId === null || u !== null) && puedeVerTablero(contexto(this.db, u, t.espacio_id, t.id), t);
      if (!puede) { c.socket.close(4403, 'sin acceso'); sala.delete(c); continue; }
      this.mandar(c, texto);
    }
  }

  cantidad(tableroId: string): number { return this.salas.get(tableroId)?.size ?? 0; }

  cerrar() {
    clearInterval(this.reloj);
    for (const sala of this.salas.values()) for (const c of sala) c.socket.close(1001, 'el servidor se reinicia');
    this.salas.clear();
  }

  private mandar(c: Conexion, texto: string) {
    if (c.socket.readyState === 1) c.socket.send(texto);
  }
}
