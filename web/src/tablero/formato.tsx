// Texto con formato para descripciones, comentarios e ítems.
// Se escribe con marcas simples (las mismas de Markdown: **negrita**, # título, - lista…) o con los botones,
// y se muestra ya armado. Nunca se inserta HTML escrito por la gente: todo se arma pieza por pieza.
import { useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, ReactNode } from 'react';
import type { Persona } from './datos.ts';

export const EMOJIS: [string, string][] = [
  ['pulgar', '👍'], ['pulgar_abajo', '👎'], ['aplauso', '👏'], ['corazon', '❤️'], ['fuego', '🔥'], ['fiesta', '🎉'], ['risa', '😂'], ['sonrisa', '🙂'],
  ['guino', '😉'], ['pensando', '🤔'], ['ojos', '👀'], ['triste', '😢'], ['enojo', '😠'], ['sorpresa', '😮'], ['gracias', '🙏'], ['fuerza', '💪'],
  ['ok', '👌'], ['saludo', '👋'], ['cohete', '🚀'], ['estrella', '⭐'], ['idea', '💡'], ['tilde', '✅'], ['cruz', '❌'], ['alerta', '⚠️'],
  ['pregunta', '❓'], ['reloj', '⏰'], ['calendario', '📅'], ['clip', '📎'], ['nota', '📝'], ['telefono', '📞'], ['correo', '✉️'], ['plata', '💰'],
  ['grafico', '📈'], ['llave', '🔑'], ['candado', '🔒'], ['herramienta', '🔧'], ['bicho', '🐛'], ['cafe', '☕'], ['mate', '🧉'], ['cien', '💯'],
];
const POR_NOMBRE = new Map(EMOJIS);

const RE_LINEA = /(?<codigo>`[^`\n]+`)|(?<imagen>!\[(?<alt>[^\]\n]*)\]\((?<src>https?:\/\/[^\s)]+|\/api\/adjuntos\/[A-Za-z0-9]+\/archivo)\))|(?<enlace>\[(?<texto>[^\]\n]+)\]\((?<url>(?:https?:\/\/|mailto:)[^\s)]+)\))|(?<negrita>\*\*(?<n>[^*\n]+?)\*\*)|(?<tachado>~~(?<t>[^~\n]+?)~~)|(?<cursiva>(?<![\w*])\*(?<c1>[^*\n]+?)\*(?!\w)|(?<![\w_])_(?<c2>[^_\n]+?)_(?!\w))|(?<suelto>https?:\/\/[^\s<]*[^\s<.,;:!?)\]])|(?<mencion>(?<![\w@])@(?:[a-z0-9_]{3,30}|tarjeta|tablero)\b)|(?<emoji>:(?<e>[a-z0-9_]{2,30}):)/g;

/** Una línea: negrita, cursiva, tachado, código, enlaces, imágenes, menciones y emojis. */
function linea(texto: string, clave: string): ReactNode[] {
  const piezas: ReactNode[] = [];
  let desde = 0;
  let n = 0;
  for (const m of texto.matchAll(RE_LINEA)) {
    const g = m.groups!;
    if (m.index > desde) piezas.push(texto.slice(desde, m.index));
    const k = `${clave}.${n++}`;
    if (g.codigo) piezas.push(<code key={k}>{g.codigo.slice(1, -1)}</code>);
    else if (g.imagen) piezas.push(<img key={k} src={g.src} alt={g.alt} loading="lazy" />);
    else if (g.enlace) piezas.push(<a key={k} href={g.url} target="_blank" rel="noopener noreferrer">{linea(g.texto, k)}</a>);
    else if (g.negrita) piezas.push(<strong key={k}>{linea(g.n, k)}</strong>);
    else if (g.tachado) piezas.push(<s key={k}>{linea(g.t, k)}</s>);
    else if (g.cursiva) piezas.push(<em key={k}>{linea(g.c1 ?? g.c2, k)}</em>);
    else if (g.suelto) piezas.push(<a key={k} href={g.suelto} target="_blank" rel="noopener noreferrer">{g.suelto}</a>);
    else if (g.mencion) piezas.push(<span key={k} className="mencion">{g.mencion}</span>);
    else if (g.emoji) piezas.push(POR_NOMBRE.get(g.e) ?? g.emoji);
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) piezas.push(texto.slice(desde));
  return piezas;
}

interface Renglon { sangria: number; ordenada: boolean; texto: string }
/** Arma una lista con sus niveles (cada dos espacios de sangría es un nivel más). */
function lista(items: Renglon[], clave: string): ReactNode {
  const base = items[0].sangria;
  const hijos: ReactNode[] = [];
  for (let i = 0; i < items.length;) {
    const propio = items[i];
    let j = i + 1;
    while (j < items.length && items[j].sangria > base) j++;
    hijos.push(<li key={i}>{linea(propio.texto, `${clave}.${i}`)}{j > i + 1 && lista(items.slice(i + 1, j), `${clave}.${i}s`)}</li>);
    i = j;
  }
  return items[0].ordenada ? <ol key={clave}>{hijos}</ol> : <ul key={clave}>{hijos}</ul>;
}

/** Muestra un texto escrito con marcas, ya con formato. */
export function Texto({ valor, corto }: { valor: string; corto?: boolean }) {
  const lineas = valor.replace(/\r/g, '').split('\n');
  const bloques: ReactNode[] = [];
  let parrafo: string[] = [];
  const cerrar = () => {
    if (!parrafo.length) return;
    const k = `p${bloques.length}`;
    bloques.push(<p key={k}>{parrafo.flatMap((l, i) => (i ? [<br key={`b${i}`} />, ...linea(l, `${k}.${i}`)] : linea(l, `${k}.${i}`)))}</p>);
    parrafo = [];
  };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const k = `b${bloques.length}`;
    if (/^```/.test(l)) {
      cerrar();
      const cuerpo: string[] = [];
      for (i++; i < lineas.length && !/^```/.test(lineas[i]); i++) cuerpo.push(lineas[i]);
      bloques.push(<pre key={k}><code>{cuerpo.join('\n')}</code></pre>);
      continue;
    }
    const titulo = /^(#{1,6})\s+(.+)$/.exec(l);
    if (titulo) { cerrar(); const T = `h${Math.min(6, titulo[1].length + 2)}` as 'h3'; bloques.push(<T key={k} className={`n${titulo[1].length}`}>{linea(titulo[2], k)}</T>); continue; }
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(l)) { cerrar(); bloques.push(<hr key={k} />); continue; }
    if (/^>\s?/.test(l)) {
      cerrar();
      const cita: string[] = [];
      for (; i < lineas.length && /^>\s?/.test(lineas[i]); i++) cita.push(lineas[i].replace(/^>\s?/, ''));
      i--;
      bloques.push(<blockquote key={k}><Texto valor={cita.join('\n')} /></blockquote>);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      cerrar();
      const items: Renglon[] = [];
      for (; i < lineas.length; i++) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lineas[i]);
        if (!m) break;
        items.push({ sangria: Math.floor(m[1].replace(/\t/g, '  ').length / 2), ordenada: /\d/.test(m[2]), texto: m[3] });
      }
      i--;
      bloques.push(lista(items, k));
      continue;
    }
    if (!l.trim()) { cerrar(); continue; }
    parrafo.push(l);
  }
  cerrar();
  return <div className={'texto' + (corto ? ' corto' : '')}>{bloques}</div>;
}

/** Caja para escribir con botones de formato, atajos de teclado, emojis y menciones con @. */
export function Editor({ valor, alCambiar, alEnviar, alCancelar, personas, placeholder, rotulo, filas = 4, auto, subirImagen }: {
  valor: string; alCambiar: (v: string) => void; alEnviar?: () => void; alCancelar?: () => void; personas: Persona[];
  placeholder?: string; rotulo: string; filas?: number; auto?: boolean; subirImagen?: (archivo: File) => Promise<string | null>;
}) {
  const caja = useRef<HTMLTextAreaElement>(null);
  const [emojis, setEmojis] = useState(false);
  const [buscando, setBuscando] = useState<string | null>(null);

  /** Cambia el texto y deja el cursor (o la selección) donde corresponde. */
  const poner = (texto: string, desde: number, hasta = desde) => {
    alCambiar(texto);
    requestAnimationFrame(() => { caja.current?.focus(); caja.current?.setSelectionRange(desde, hasta); });
  };
  const envolver = (antes: string, despues = antes, relleno = 'texto') => {
    const c = caja.current;
    if (!c) return;
    const [a, b] = [c.selectionStart, c.selectionEnd];
    const medio = valor.slice(a, b) || relleno;
    poner(valor.slice(0, a) + antes + medio + despues + valor.slice(b), a + antes.length, a + antes.length + medio.length);
  };
  /** Pone una marca al principio de cada renglón seleccionado (títulos, listas, citas). */
  const prefijo = (marca: string | ((i: number) => string)) => {
    const c = caja.current;
    if (!c) return;
    const ini = valor.lastIndexOf('\n', c.selectionStart - 1) + 1;
    const corte = valor.indexOf('\n', c.selectionEnd);
    const fin = corte === -1 ? valor.length : corte;
    const nuevo = valor.slice(ini, fin).split('\n').map((l, i) => (typeof marca === 'string' ? marca : marca(i)) + l).join('\n');
    poner(valor.slice(0, ini) + nuevo + valor.slice(fin), ini + nuevo.length);
  };
  const insertar = (texto: string, reemplazarDesde?: number) => {
    const c = caja.current;
    const b = c?.selectionEnd ?? valor.length;
    const a = reemplazarDesde ?? c?.selectionStart ?? valor.length;
    poner(valor.slice(0, a) + texto + valor.slice(b), a + texto.length);
  };
  const enlazar = () => {
    const c = caja.current;
    if (!c) return;
    const [a, b] = [c.selectionStart, c.selectionEnd];
    const medio = valor.slice(a, b) || 'texto del enlace';
    poner(`${valor.slice(0, a)}[${medio}](https://)${valor.slice(b)}`, a + medio.length + 3, a + medio.length + 11);
  };
  /** Si lo último escrito antes del cursor es "@algo", devuelve dónde empieza y qué se escribió. */
  const arroba = (): { desde: number; q: string } | null => {
    const c = caja.current;
    if (!c) return null;
    const m = /(?:^|[\s(])@([a-z0-9_]*)$/i.exec(valor.slice(0, c.selectionStart));
    return m ? { desde: c.selectionStart - m[1].length - 1, q: m[1].toLowerCase() } : null;
  };
  const tecla = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'Enter' && alEnviar) { e.preventDefault(); alEnviar(); return; }
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (buscando !== null || emojis) { setBuscando(null); setEmojis(false); } else alCancelar?.();
      return;
    }
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); envolver('**'); }
    else if (k === 'i') { e.preventDefault(); envolver('*'); }
    else if (k === 'k') { e.preventDefault(); enlazar(); }
    else if (k === 's' && e.shiftKey) { e.preventDefault(); envolver('~~'); }
  };
  const pegar = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const imagen = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'));
    if (!imagen || !subirImagen) return;
    e.preventDefault();
    const url = await subirImagen(imagen);
    if (url) insertar(`![${imagen.name || 'imagen'}](${url})`);
  };
  const sugeridas = buscando === null ? [] : [
    ...personas.filter((p) => p.usuario.includes(buscando) || p.nombre.toLowerCase().includes(buscando)).map((p) => ({ clave: p.usuario, texto: p.nombre })),
    ...[{ clave: 'tarjeta', texto: 'Quienes están en la tarjeta' }, { clave: 'tablero', texto: 'Todo el tablero' }].filter((x) => x.clave.startsWith(buscando)),
  ].slice(0, 6);
  const B = ({ t, a, children }: { t: string; a: () => void; children: ReactNode }) => <button type="button" title={t} aria-label={t} onMouseDown={(e) => e.preventDefault()} onClick={a}>{children}</button>;
  return (
    <div className="editor">
      <div className="barrita" role="toolbar" aria-label="Formato">
        <B t="Título" a={() => prefijo('## ')}>T</B>
        <B t="Negrita (Ctrl+B)" a={() => envolver('**')}><b>N</b></B>
        <B t="Cursiva (Ctrl+I)" a={() => envolver('*')}><i>C</i></B>
        <B t="Tachado (Ctrl+Mayús+S)" a={() => envolver('~~')}><s>T</s></B>
        <span className="sep" />
        <B t="Lista con viñetas" a={() => prefijo('- ')}>•—</B>
        <B t="Lista numerada" a={() => prefijo((i) => `${i + 1}. `)}>1.</B>
        <B t="Cita" a={() => prefijo('> ')}>“”</B>
        <B t="Código" a={() => envolver('`')}>{'</>'}</B>
        <B t="Enlace (Ctrl+K)" a={enlazar}>↗</B>
        <span className="sep" />
        <B t="Mencionar a alguien" a={() => { insertar('@'); setBuscando(''); }}>@</B>
        <B t="Emoji" a={() => setEmojis(!emojis)}>☺</B>
      </div>
      <textarea ref={caja} value={valor} rows={filas} autoFocus={auto} placeholder={placeholder} aria-label={rotulo} maxLength={16000}
        onChange={(e) => { alCambiar(e.target.value); requestAnimationFrame(() => setBuscando(arroba()?.q ?? null)); }}
        onKeyDown={tecla} onPaste={pegar} />
      {emojis && <div className="emojis" role="listbox" aria-label="Emojis">{EMOJIS.map(([n, e]) => <button type="button" key={n} title={`:${n}:`} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { insertar(e); setEmojis(false); }}>{e}</button>)}</div>}
      {sugeridas.length > 0 && (
        <div className="opciones sugerencias" role="listbox" aria-label="Personas para mencionar">
          {sugeridas.map((s) => <button type="button" key={s.clave} onMouseDown={(e) => e.preventDefault()} onClick={() => { const a = arroba(); insertar(`@${s.clave} `, a?.desde); setBuscando(null); }}><b>@{s.clave}</b> <span className="suave">{s.texto}</span></button>)}
        </div>
      )}
    </div>
  );
}
