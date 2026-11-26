// Respaldo de los datos.
//  · Base: una copia consistente por día en DATA_DIR/respaldos/diario-AAAA-MM-DD.db (la app no se frena para hacerla).
//  · Archivos subidos: en DATA_DIR/respaldos/archivos queda un "segundo nombre" de cada archivo (enlace duro):
//    no ocupa espacio extra y, si la app borra el original por error, el archivo sigue ahí 30 días.
//  · Copia fuera del servidor (opcional, se enciende con variables): sube la base comprimida y los archivos nuevos
//    a un depósito compatible con S3 (Cloudflare R2). Es lo único que protege si se pierde el servidor entero.
//  · Restaurar: con la variable RESTAURAR=<nombre del respaldo> la app, al arrancar, guarda una copia de lo actual
//    y pone el respaldo en su lugar. Lo hace una sola vez por nombre.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { anotarError } from './registro.ts';

export interface ConfigExterno { endpoint: string; deposito: string; clave: string; secreto: string }
export interface Respaldo { nombre: string; tipo: 'diario' | 'manual' | 'antes'; tamano: number; fecha: string }
export interface EstadoExterno { activo: boolean; ultimo_ok: string | null; ultimo_error: string | null; error: string | null }

const DIARIOS = 14;
const SEMANALES = 8;
const OTROS = 10;
const DIAS_ARCHIVO_BORRADO = 30;
const DIAS_EXTERNO = 30;
const RE_NOMBRE = /^(diario|manual|antes)-[A-Za-z0-9_.:-]+\.db$/;
const sello = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Fecha y hora "de pared" en una zona horaria: { dia: '2026-11-26', hora: '03:31' }. */
export function relojEn(zona: string, cuando = new Date()): { dia: string; hora: string } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(cuando).map((x) => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}

/** Si se pidió restaurar un respaldo, lo pone en lugar de la base actual. Se llama ANTES de abrir la base. */
export function restaurarSiSePide(dirDatos: string, nombre: string | undefined): { restaurado: string; copiaDeLoAnterior: string | null } | null {
  if (!nombre) return null;
  const dir = path.join(dirDatos, 'respaldos');
  const marca = path.join(dir, '.restaurado');
  if (fs.existsSync(marca) && fs.readFileSync(marca, 'utf8').trim() === nombre) return null;
  const origen = path.join(dir, nombre);
  if (!RE_NOMBRE.test(nombre) || !fs.existsSync(origen)) throw new Error(`RESTAURAR pide "${nombre}", pero ese respaldo no existe en ${dir}. Quitá la variable o corregí el nombre.`);
  // Se comprueba que el respaldo abre y está sano antes de tocar nada.
  const prueba = new DatabaseSync(origen, { readOnly: true });
  const sano = (prueba.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check;
  prueba.close();
  if (sano !== 'ok') throw new Error(`El respaldo "${nombre}" está dañado (${sano}). No se restauró nada.`);
  const actual = path.join(dirDatos, 'tablero.db');
  let copia: string | null = null;
  if (fs.existsSync(actual)) {
    copia = path.join(dir, `antes-de-restaurar-${sello()}.db`);
    const db = new DatabaseSync(actual);
    db.exec(`VACUUM INTO '${copia.replace(/'/g, "''")}'`);
    db.close();
  }
  for (const f of [actual, `${actual}-wal`, `${actual}-shm`]) fs.rmSync(f, { force: true });
  fs.copyFileSync(origen, actual);
  fs.writeFileSync(marca, nombre);
  return { restaurado: nombre, copiaDeLoAnterior: copia };
}

export class Respaldos {
  db: DatabaseSync;
  dir: string;
  dirArchivos: string;
  zona: string;
  externo: ConfigExterno | null;
  pedir: typeof fetch;
  private reloj: NodeJS.Timeout | null = null;
  private ocupado = false;

  constructor(db: DatabaseSync, dirDatos: string, zona: string, externo: ConfigExterno | null = null, pedir: typeof fetch = fetch) {
    this.db = db;
    this.dir = path.join(dirDatos, 'respaldos');
    this.dirArchivos = path.join(dirDatos, 'archivos');
    this.zona = zona;
    this.externo = externo;
    this.pedir = pedir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  listar(): Respaldo[] {
    return fs.readdirSync(this.dir).filter((n) => RE_NOMBRE.test(n)).map((nombre) => {
      const s = fs.statSync(path.join(this.dir, nombre));
      return { nombre, tipo: nombre.split('-')[0] as Respaldo['tipo'], tamano: s.size, fecha: s.mtime.toISOString() };
    }).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }

  private leerEstado(): Omit<EstadoExterno, 'activo'> {
    const f = this.db.prepare("SELECT valor FROM ajustes WHERE clave = 'respaldo_externo'").get() as { valor: string } | undefined;
    return f ? JSON.parse(f.valor) : { ultimo_ok: null, ultimo_error: null, error: null };
  }
  private guardarEstado(e: Omit<EstadoExterno, 'activo'>) {
    this.db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('respaldo_externo', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(JSON.stringify(e));
  }
  estado() {
    const lista = this.listar();
    return { ultimo: lista.find((r) => r.tipo !== 'antes') ?? null, respaldos: lista, externo: { activo: !!this.externo, ...this.leerEstado() } as EstadoExterno, hora_diaria: '03:30', zona: this.zona };
  }

  /** Hace un respaldo ahora. `tipo` diario: uno por día (si ya está el de hoy, lo reemplaza). */
  async hacer(tipo: 'diario' | 'manual'): Promise<Respaldo> {
    if (this.ocupado) throw new Error('Ya hay un respaldo en curso.');
    this.ocupado = true;
    try {
      const nombre = tipo === 'diario' ? `diario-${relojEn(this.zona).dia}.db` : `manual-${sello()}.db`;
      const destino = path.join(this.dir, nombre);
      const temporal = `${destino}.tmp`;
      fs.rmSync(temporal, { force: true });
      this.db.exec(`VACUUM INTO '${temporal.replace(/'/g, "''")}'`);
      fs.renameSync(temporal, destino);
      this.guardarArchivos();
      this.limpiar();
      if (this.externo) await this.subirAfuera(destino, nombre);
      return this.listar().find((r) => r.nombre === nombre)!;
    } finally { this.ocupado = false; }
  }

  /** Deja un segundo nombre de cada archivo subido, y suelta los que la app borró hace más de 30 días. */
  private guardarArchivos() {
    const base = path.join(this.dir, 'archivos');
    const registro = path.join(base, 'borrados.json');
    fs.mkdirSync(base, { recursive: true });
    let borrados: Record<string, string> = {};
    try { borrados = JSON.parse(fs.readFileSync(registro, 'utf8')); } catch { /* todavía no hay */ }
    for (const sub of ['adjuntos', 'fotos']) {
      const origen = path.join(this.dirArchivos, sub);
      const copia = path.join(base, sub);
      fs.mkdirSync(copia, { recursive: true });
      const vivos = new Set(fs.existsSync(origen) ? fs.readdirSync(origen) : []);
      for (const n of vivos) {
        const a = path.join(copia, n);
        if (fs.existsSync(a)) continue;
        try { fs.linkSync(path.join(origen, n), a); } catch { fs.copyFileSync(path.join(origen, n), a); }
      }
      for (const n of fs.readdirSync(copia)) {
        const clave = `${sub}/${n}`;
        if (vivos.has(n)) { delete borrados[clave]; continue; }
        borrados[clave] ??= new Date().toISOString();
        if (Date.now() - Date.parse(borrados[clave]) > DIAS_ARCHIVO_BORRADO * 86400_000) { fs.rmSync(path.join(copia, n), { force: true }); delete borrados[clave]; }
      }
    }
    fs.writeFileSync(registro, JSON.stringify(borrados));
  }

  /** Cuánto se guarda: 14 diarios, más 8 semanales (los de domingo) y los últimos 10 de cada otro tipo. */
  private limpiar() {
    const todos = this.listar();
    const diarios = todos.filter((r) => r.tipo === 'diario').sort((a, b) => (a.nombre < b.nombre ? 1 : -1));
    const viejos = diarios.slice(DIARIOS);
    const semanales = viejos.filter((r) => new Date(`${r.nombre.slice(7, 17)}T12:00:00Z`).getUTCDay() === 0).slice(0, SEMANALES);
    const sobran = [
      ...viejos.filter((r) => !semanales.includes(r)),
      ...todos.filter((r) => r.tipo === 'manual').slice(OTROS),
      ...todos.filter((r) => r.tipo === 'antes').slice(OTROS),
    ];
    for (const r of sobran) fs.rmSync(path.join(this.dir, r.nombre), { force: true });
  }

  // ---------- copia fuera del servidor (S3 / Cloudflare R2) ----------
  private async s3(metodo: 'PUT' | 'GET' | 'DELETE', clave: string, cuerpo?: Buffer | Blob, consulta = ''): Promise<Response> {
    const x = this.externo!;
    const url = new URL(`${x.endpoint.replace(/\/+$/, '')}/${x.deposito}/${clave.split('/').map(encodeURIComponent).join('/')}${consulta ? `?${consulta}` : ''}`);
    const ahora = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const dia = ahora.slice(0, 8);
    const huella = Buffer.isBuffer(cuerpo) ? crypto.createHash('sha256').update(cuerpo).digest('hex') : cuerpo ? 'UNSIGNED-PAYLOAD' : crypto.createHash('sha256').update('').digest('hex');
    const cab: Record<string, string> = { host: url.host, 'x-amz-content-sha256': huella, 'x-amz-date': ahora };
    const firmadas = Object.keys(cab).sort().join(';');
    const consultaOrdenada = [...url.searchParams].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const canonico = [metodo, url.pathname, consultaOrdenada, ...Object.keys(cab).sort().map((k) => `${k}:${cab[k]}`), '', firmadas, huella].join('\n');
    const ambito = `${dia}/auto/s3/aws4_request`;
    const aFirmar = ['AWS4-HMAC-SHA256', ahora, ambito, crypto.createHash('sha256').update(canonico).digest('hex')].join('\n');
    const hmac = (k: crypto.BinaryLike, d: string) => crypto.createHmac('sha256', k).update(d).digest();
    const firma = crypto.createHmac('sha256', hmac(hmac(hmac(hmac(`AWS4${x.secreto}`, dia), 'auto'), 's3'), 'aws4_request')).update(aFirmar).digest('hex');
    const r = await this.pedir(url, {
      method: metodo, body: cuerpo as BodyInit | undefined,
      headers: { 'x-amz-content-sha256': huella, 'x-amz-date': ahora, authorization: `AWS4-HMAC-SHA256 Credential=${x.clave}/${ambito}, SignedHeaders=${firmadas}, Signature=${firma}` },
    });
    if (!r.ok && !(metodo === 'DELETE' && r.status === 404)) throw new Error(`El depósito externo respondió ${r.status} al ${metodo} de ${clave}: ${(await r.text()).slice(0, 200)}`);
    return r;
  }

  private async subirAfuera(archivoDb: string, nombre: string) {
    const estado = this.leerEstado();
    try {
      await this.s3('PUT', `base/${nombre}.gz`, zlib.gzipSync(fs.readFileSync(archivoDb)));
      // Archivos subidos por la gente: solo los que todavía no están afuera.
      const ya = new Set((this.db.prepare('SELECT ruta FROM respaldo_externo').all() as { ruta: string }[]).map((f) => f.ruta));
      for (const sub of ['adjuntos', 'fotos']) {
        const origen = path.join(this.dirArchivos, sub);
        for (const n of fs.existsSync(origen) ? fs.readdirSync(origen) : []) {
          const ruta = `${sub}/${n}`;
          if (ya.has(ruta)) continue;
          await this.s3('PUT', `archivos/${ruta}`, await fs.openAsBlob(path.join(origen, n)));
          this.db.prepare('INSERT OR IGNORE INTO respaldo_externo (ruta, subido_en) VALUES (?, ?)').run(ruta, new Date().toISOString());
        }
      }
      // Afuera se guardan 30 días de bases.
      const lista = await (await this.s3('GET', '', undefined, 'list-type=2&prefix=base%2F')).text();
      const limite = relojEn(this.zona, new Date(Date.now() - DIAS_EXTERNO * 86400_000)).dia;
      for (const m of lista.matchAll(/<Key>(base\/diario-(\d{4}-\d{2}-\d{2})\.db\.gz)<\/Key>/g)) if (m[2] < limite) await this.s3('DELETE', m[1]);
      this.guardarEstado({ ...estado, ultimo_ok: new Date().toISOString(), error: null });
    } catch (e) {
      anotarError('respaldo externo', e);
      this.guardarEstado({ ...estado, ultimo_error: new Date().toISOString(), error: (e as Error).message.slice(0, 300) });
    }
  }

  // ---------- reloj ----------
  /** Revisa cada 10 minutos: pasadas las 03:30 (hora de la zona), si falta el respaldo de hoy, lo hace. */
  async revisar(cuando = new Date()): Promise<boolean> {
    const { dia, hora } = relojEn(this.zona, cuando);
    if (hora < '03:30' || fs.existsSync(path.join(this.dir, `diario-${dia}.db`)) || this.ocupado) return false;
    await this.hacer('diario');
    return true;
  }
  iniciar() {
    const vuelta = () => { this.revisar().catch((e) => anotarError('respaldo diario', e)); };
    this.reloj = setInterval(vuelta, 600_000);
    this.reloj.unref();
    setTimeout(vuelta, 30_000).unref();
  }
  parar() { if (this.reloj) clearInterval(this.reloj); }
}
