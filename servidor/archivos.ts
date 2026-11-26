// Archivos que sube la gente: adjuntos de las tarjetas, fotos de perfil y logos de espacios.
// Viven en la carpeta de datos (el volumen), nunca en el repositorio. El nombre en disco es siempre
// un código al azar generado por el servidor: lo que escribe la persona nunca se usa como ruta.
import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { DatabaseSync } from 'node:sqlite';
import { ErrorApi, textoAleatorio } from './util.ts';

export const TIPOS_FOTO = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' } as const;
export type ExtFoto = keyof typeof TIPOS_FOTO;
const MAX_FOTO = 5 * 1024 * 1024;
const RE_ID = /^[A-Za-z0-9]{20}$/;
const RE_FOTO = /^[A-Za-z0-9]{20}\.(png|jpg|gif|webp)$/;

/** Mira los primeros bytes para saber si de verdad es una imagen (no se confía en lo que dice quien sube). */
export function tipoImagen(b: Buffer): ExtFoto | null {
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 6 && b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

export class Archivos {
  dirAdjuntos: string;
  dirFotos: string;
  maxAdjunto: number;

  constructor(dir: string, maxMb = 100) {
    this.dirAdjuntos = path.join(dir, 'adjuntos');
    this.dirFotos = path.join(dir, 'fotos');
    this.maxAdjunto = maxMb * 1024 * 1024;
    fs.mkdirSync(this.dirAdjuntos, { recursive: true });
    fs.mkdirSync(this.dirFotos, { recursive: true });
  }

  rutaAdjunto(id: string): string {
    if (!RE_ID.test(id)) throw new ErrorApi(404, 'no_existe', 'No existe o no tenés acceso.');
    return path.join(this.dirAdjuntos, id);
  }

  /** Guarda lo que va llegando directo al disco (sin cargarlo entero en memoria) y corta si pasa el tope. */
  async guardarAdjunto(id: string, flujo: Readable): Promise<{ tamano: number; cabeza: Buffer }> {
    const ruta = this.rutaAdjunto(id);
    const salida = fs.createWriteStream(ruta);
    let tamano = 0;
    let cabeza = Buffer.alloc(0);
    try {
      for await (const trozo of flujo) {
        const b = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo as string);
        tamano += b.length;
        if (tamano > this.maxAdjunto) throw new ErrorApi(413, 'muy_grande', `El archivo supera el tope de ${Math.round(this.maxAdjunto / 1048576)} MB.`);
        if (cabeza.length < 16) cabeza = Buffer.concat([cabeza, b]).subarray(0, 16);
        if (!salida.write(b)) await new Promise((ok) => salida.once('drain', ok));
      }
      await new Promise<void>((ok, mal) => { salida.once('error', mal); salida.end(ok); });
    } catch (e) {
      salida.destroy();
      fs.rmSync(ruta, { force: true });
      throw e;
    }
    if (tamano === 0) { fs.rmSync(ruta, { force: true }); throw new ErrorApi(400, 'dato_invalido', 'El archivo está vacío.'); }
    return { tamano, cabeza };
  }
  copiarAdjunto(de: string, a: string) { fs.copyFileSync(this.rutaAdjunto(de), this.rutaAdjunto(a)); }
  borrarAdjunto(id: string) { fs.rmSync(this.rutaAdjunto(id), { force: true }); }

  /** Foto de perfil o logo: tiene que ser una imagen de verdad y pesar poco. Devuelve el nombre con que quedó guardada. */
  async guardarFoto(flujo: Readable): Promise<string> {
    const partes: Buffer[] = [];
    let total = 0;
    for await (const trozo of flujo) {
      const b = Buffer.isBuffer(trozo) ? trozo : Buffer.from(trozo as string);
      total += b.length;
      if (total > MAX_FOTO) throw new ErrorApi(413, 'muy_grande', 'La imagen no puede pesar más de 5 MB.');
      partes.push(b);
    }
    const todo = Buffer.concat(partes);
    const ext = tipoImagen(todo);
    if (!ext) throw new ErrorApi(400, 'dato_invalido', 'Tiene que ser una imagen PNG, JPG, GIF o WebP.');
    const nombre = `${textoAleatorio(20)}.${ext}`;
    fs.writeFileSync(path.join(this.dirFotos, nombre), todo);
    return nombre;
  }
  rutaFoto(nombre: string): { ruta: string; mime: string } | null {
    if (!RE_FOTO.test(nombre)) return null;
    const ruta = path.join(this.dirFotos, nombre);
    return fs.existsSync(ruta) ? { ruta, mime: TIPOS_FOTO[nombre.split('.')[1] as ExtFoto] } : null;
  }
  borrarFoto(nombre: string | null) { if (nombre && RE_FOTO.test(nombre)) fs.rmSync(path.join(this.dirFotos, nombre), { force: true }); }

  /** Borra del disco los adjuntos que ya no tienen tarjeta (por ejemplo, después de borrar un tablero entero). */
  barrer(db: DatabaseSync) {
    const vivos = new Set((db.prepare("SELECT id FROM adjuntos WHERE tipo = 'archivo'").all() as { id: string }[]).map((f) => f.id));
    for (const nombre of fs.readdirSync(this.dirAdjuntos)) if (!vivos.has(nombre)) fs.rmSync(path.join(this.dirAdjuntos, nombre), { force: true });
  }
}
