// Dibuja los íconos de la app (los que se ven en la pantalla de inicio del teléfono) sin depender de ningún programa.
// Uso: node scripts/iconos.mjs   → deja los PNG en web/public/
import fs from 'node:fs';
import zlib from 'node:zlib';

const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
const trozo = (tipo, datos) => { const t = Buffer.concat([Buffer.from(tipo), datos]); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(t)); return Buffer.concat([l, t, c]); };

function icono(lado) {
  const FONDO = [0x0a, 0x0b, 0x10], AZUL = [0x2f, 0xb8, 0xff], ROSA = [0xff, 0x2e, 0x9a], HOJA = [0x1c, 0x21, 0x30];
  const px = Buffer.alloc(lado * (lado * 3 + 1));
  const u = lado / 16; // el dibujo está pensado en una grilla de 16
  // Tres listas (columnas) de distinta altura y, arriba, la barra azul de la marca.
  const cajas = [[3, 3.2, 13, 4.4, AZUL], [3, 6, 5.8, 13, HOJA], [6.6, 6, 9.4, 10.6, HOJA], [10.2, 6, 13, 12, HOJA], [3.6, 6.7, 5.2, 7.6, ROSA]];
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let c = FONDO;
      for (const [x0, y0, x1, y1, color] of cajas) if (x >= x0 * u && x < x1 * u && y >= y0 * u && y < y1 * u) c = color;
      px.set(c, y * (lado * 3 + 1) + 1 + x * 3);
    }
  }
  const cab = Buffer.alloc(13); cab.writeUInt32BE(lado, 0); cab.writeUInt32BE(lado, 4); cab[8] = 8; cab[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', cab), trozo('IDAT', zlib.deflateSync(px, { level: 9 })), trozo('IEND', Buffer.alloc(0))]);
}
for (const [nombre, lado] of [['icono-180.png', 180], ['icono-192.png', 192], ['icono-512.png', 512]]) fs.writeFileSync(new URL(`../web/public/${nombre}`, import.meta.url), icono(lado));
console.log('Íconos listos en web/public/');
