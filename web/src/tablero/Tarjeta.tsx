// La tarjeta abierta: título, etiquetas, miembros, fechas, portada, descripción, checklists, adjuntos,
// comentarios y actividad. Cada cambio va al servidor y vuelve a leer la tarjeta; si otra persona
// la cambia mientras está abierta, se actualiza sola.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, Avatar, Campo, mensajeDe, subir, useCarga, useSesion } from '../base.tsx';
import { posicionEntre } from './datos.ts';
import type { Datos, Etiqueta, Lista, Ops, Persona, Tarjeta } from './datos.ts';
import { Editor, EMOJIS, Texto } from './formato.tsx';
import { Destino, Flotante } from './Menus.tsx';
import { aCampo, ChipEtiqueta, claseColor, COLORES, describir, estadoVence, fechaCorta, hace, Icono, NOMBRE_ESTADO, nombreColor, peso, TONOS } from './piezas.tsx';
import type { Actividad } from './piezas.tsx';

interface Item { id: string; checklist_id: string; texto: string; hecho: boolean; posicion: number; asignado_id: string | null; vence: string | null }
interface Checklist { id: string; nombre: string; posicion: number; items: Item[] }
interface Adjunto { id: string; tipo: 'archivo' | 'enlace'; nombre: string; url: string; mime: string; tamano: number; posicion: number; creado_en: string; es_imagen: boolean; se_ve: boolean }
interface Comentario { id: string; autor: Persona | null; texto: string; creado_en: string; editado_en: string | null; reacciones: { emoji: string; usuarios: string[] }[] }
interface Detalle { tarjeta: Tarjeta & { descripcion: string }; lista: Lista; tablero: { id: string; enlace: string; nombre: string }; checklists: Checklist[]; adjuntos: Adjunto[]; comentarios: Comentario[]; actividad: Actividad[] }

const archivoDe = (id: string) => `/api/adjuntos/${id}/archivo`;
const recordar = (clave: string, valor?: string): string | null => {
  try { if (valor !== undefined) localStorage.setItem(clave, valor); return localStorage.getItem(clave); } catch { return null; }
};
/** Posición nueva para subir o bajar un lugar algo dentro de su grupo. */
function correr<T extends { id: string; posicion: number }>(grupo: T[], id: string, paso: -1 | 1): number | null {
  const i = grupo.findIndex((x) => x.id === id);
  const nuevo = i + paso;
  if (i < 0 || nuevo < 0 || nuevo >= grupo.length) return null;
  return posicionEntre(grupo.filter((x) => x.id !== id), nuevo);
}

// =====================================================================
// ETIQUETAS: elegir, crear, cambiar y borrar. Sirve en la tarjeta y para administrar las del tablero.
// =====================================================================
export function PanelEtiquetas({ d, puestas, alAlternar, alCambiar }: { d: Datos; puestas?: string[]; alAlternar?: (id: string) => void; alCambiar: () => void }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ id?: string; nombre: string; color: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const puede = d.mi.puede.editar;
  const con = async (f: () => Promise<unknown>) => { setError(null); try { await f(); alCambiar(); setEdit(null); } catch (e) { setError(mensajeDe(e)); } };
  if (edit) return (
    <form className="columna" style={{ gap: 10 }} onSubmit={(e) => {
      e.preventDefault();
      void con(async () => {
        if (edit.id) await api('PATCH', `/api/etiquetas/${edit.id}`, { nombre: edit.nombre, color: edit.color });
        else { const r = await api<{ etiqueta: Etiqueta }>('POST', `/api/tableros/${d.tablero.id}/etiquetas`, { nombre: edit.nombre, color: edit.color }); alAlternar?.(r.etiqueta.id); }
      });
    }}>
      <div className="fila"><button type="button" className="btn plano chico" onClick={() => setEdit(null)}>‹ Volver</button><b>{edit.id ? 'Cambiar etiqueta' : 'Etiqueta nueva'}</b></div>
      <ChipEtiqueta e={{ id: '', nombre: edit.nombre, color: edit.color }} />
      <Campo rotulo="Nombre (opcional)"><input id="et-nombre" type="text" autoFocus value={edit.nombre} maxLength={200} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></Campo>
      <div className="colores" role="radiogroup" aria-label="Color">
        {COLORES.map((c) => <button type="button" key={c} role="radio" aria-checked={edit.color === c} aria-label={nombreColor(c)} title={nombreColor(c)} className={`et ${claseColor(c)}`} onClick={() => setEdit({ ...edit, color: c })} />)}
      </div>
      <div><button type="button" className={'btn chico' + (edit.color === '' ? ' lleno' : '')} onClick={() => setEdit({ ...edit, color: '' })}>Sin color</button></div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="fila"><button type="submit" className="btn lleno">Guardar</button>
        {edit.id && <button type="button" className="btn peligro" onClick={() => void con(() => api('DELETE', `/api/etiquetas/${edit.id}`))}>Borrar</button>}</div>
      {edit.id && <p className="suave" style={{ fontSize: 13 }}>Borrarla la saca de todas las tarjetas del tablero.</p>}
    </form>
  );
  const visibles = d.etiquetas.filter((e) => e.nombre.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="columna" style={{ gap: 8 }}>
      {d.etiquetas.length > 5 && <input type="text" value={q} placeholder="Buscar etiquetas" aria-label="Buscar etiquetas" onChange={(e) => setQ(e.target.value)} />}
      {d.etiquetas.length === 0 && <p className="suave">Este tablero todavía no tiene etiquetas.</p>}
      <ul className="elegir">{visibles.map((e) => (
        <li key={e.id}>
          <button type="button" className="cual" aria-pressed={puestas?.includes(e.id)} disabled={!alAlternar && !puede} onClick={() => (alAlternar ? alAlternar(e.id) : setEdit({ ...e }))}>
            <ChipEtiqueta e={e} />{puestas?.includes(e.id) && <Icono n="tilde" />}
          </button>
          {puede && alAlternar && <button type="button" className="btn plano chico" aria-label={`Cambiar la etiqueta ${e.nombre || nombreColor(e.color)}`} onClick={() => setEdit({ ...e })}>Cambiar</button>}
        </li>
      ))}</ul>
      {puede && <div><button type="button" className="btn chico" onClick={() => setEdit({ nombre: q.trim(), color: 'azul-2' })}>Crear etiqueta nueva</button></div>}
    </div>
  );
}

// =====================================================================
// LA TARJETA
// =====================================================================
type Menu = { tipo: 'etiquetas' | 'miembros' | 'fechas' | 'checklist' | 'adjuntar' | 'portada' | 'mover' | 'copiar'; ancla: DOMRect }
  | { tipo: 'item'; ancla: DOMRect; item: Item } | { tipo: 'reaccion'; ancla: DOMRect; comentario: string };

export function DialogoTarjeta({ d, cual, frente, ops, alCambiarTablero, alCerrar }: {
  d: Datos; /** Código corto (o id) de la tarjeta. */ cual: string; /** La tarjeta como está en el tablero, si está a la vista. */ frente?: Tarjeta;
  ops: Ops; alCambiarTablero: () => void; alCerrar: () => void;
}) {
  const { yo } = useSesion();
  const puede = d.mi.puede.editar;
  const [det, setDet] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [titulo, setTitulo] = useState('');
  const [desc, setDesc] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [detalles, setDetalles] = useState(() => recordar('actividad-detalles') !== 'no');
  const [ocultos, setOcultos] = useState<string[]>(() => (recordar('checklists-ocultos') ?? '').split(',').filter(Boolean));
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [visor, setVisor] = useState<Adjunto | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const vuelta = useRef(0);
  const marcado = useRef(new URLSearchParams(location.search).get('comentario'));

  const cargar = useCallback(async () => {
    const esta = ++vuelta.current;
    try {
      const r = await api<Detalle>('GET', `/api/tarjetas/${cual}`);
      if (esta === vuelta.current) { setDet(r); setTitulo(r.tarjeta.titulo); }
    } catch (e) { if (esta === vuelta.current) setError(mensajeDe(e)); }
  }, [cual]);
  // Se carga al abrir y cada vez que el tablero recibe un cambio de esta tarjeta (mío o de otra persona).
  useEffect(() => { void cargar(); }, [cargar, frente]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [alCerrar]);
  // Si se abrió con el enlace a un comentario, se lo trae a la vista.
  useEffect(() => { if (det && marcado.current) document.getElementById(`comentario-${marcado.current}`)?.scrollIntoView({ block: 'center' }); }, [det === null]);

  /** Hace un cambio en el servidor, lo refleja en el tablero y vuelve a leer la tarjeta. */
  const hacer = async <R,>(f: () => Promise<R>): Promise<R | null> => {
    setError(null);
    try {
      const r = await f() as R & { tarjeta?: Tarjeta; creada?: Tarjeta };
      const tocadas = [r?.tarjeta, r?.creada].filter(Boolean) as Tarjeta[];
      if (tocadas.length) ops.aplicar({ tarjetas: tocadas });
      await cargar();
      return r;
    } catch (e) { setError(mensajeDe(e)); return null; }
  };
  if (!det) return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div className="dialogo" role="dialog" aria-modal="true" aria-label="Tarjeta">{error ? <><p className="error" role="alert">{error}</p><div><button type="button" className="btn" onClick={alCerrar}>Cerrar</button></div></> : <p className="suave">Abriendo…</p>}</div>
    </div>
  );
  const t = det.tarjeta;
  const base = `/api/tarjetas/${t.id}`;
  const cambiar = (cambios: Record<string, unknown>) => hacer(() => api('PATCH', base, cambios));
  const abrir = (tipo: Exclude<Menu['tipo'], 'item' | 'reaccion'>) => (e: { currentTarget: Element }) => setMenu({ tipo, ancla: e.currentTarget.getBoundingClientRect() });
  const cerrarMenu = () => setMenu(null);
  const copiar = async (clave: string, texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(clave); setTimeout(() => setCopiado(null), 1800); } catch { setError(`No se pudo copiar. La dirección es: ${texto}`); }
  };
  const subirArchivos = async (archivos: File[]): Promise<Adjunto | null> => {
    let ultimo: Adjunto | null = null;
    for (const f of archivos) {
      setSubiendo(0);
      const r = await hacer(() => subir<{ adjunto: Adjunto; tarjeta: Tarjeta }>(`${base}/adjuntos?nombre=${encodeURIComponent(f.name || 'imagen')}&tipo=${encodeURIComponent(f.type)}`, f, setSubiendo));
      if (!r) break;
      ultimo = r.adjunto;
    }
    setSubiendo(null);
    return ultimo;
  };
  const subirImagen = async (f: File) => { const a = await subirArchivos([f]); return a ? archivoDe(a.id) : null; };
  const guardarTitulo = () => { const v = titulo.trim(); if (v && v !== t.titulo) void cambiar({ titulo: v }); else setTitulo(t.titulo); };
  const comentar = async () => { const v = comentario.trim(); if (v && await hacer(() => api('POST', `${base}/comentarios`, { texto: v }))) setComentario(''); };

  const etiquetas = d.etiquetas.filter((e) => t.etiquetas.includes(e.id));
  const miembros = d.miembros.filter((m) => t.miembros.includes(m.id));
  const estado = estadoVence(t.vence, t.completada);
  const portada = t.portada;
  const imagenes = det.adjuntos.filter((a) => a.es_imagen);
  const linea: ({ k: 'c'; c: Comentario } | { k: 'a'; a: Actividad })[] = [
    ...det.comentarios.map((c) => ({ k: 'c' as const, c })),
    ...(detalles ? det.actividad.filter((a) => a.tipo !== 'tarjeta_comentada').map((a) => ({ k: 'a' as const, a })) : []),
  ].sort((x, y) => ((x.k === 'c' ? x.c.creado_en : x.a.creado_en) < (y.k === 'c' ? y.c.creado_en : y.a.creado_en) ? 1 : -1));

  return (
    <div className="velo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div className={'dialogo ancho tarjeta' + (encima ? ' encima' : '')} role="dialog" aria-modal="true" aria-label={`Tarjeta ${t.titulo}`}
        onPaste={(e) => { if (puede && !e.defaultPrevented && e.clipboardData.files.length) { e.preventDefault(); void subirArchivos([...e.clipboardData.files]); } }}
        onDragOver={(e) => { if (puede && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setEncima(true); } }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => { if (puede && e.dataTransfer.files.length) { e.preventDefault(); setEncima(false); void subirArchivos([...e.dataTransfer.files]); } }}>
        {portada && (portada.adjunto
          ? <div className="t-portada imagen"><img src={archivoDe(portada.adjunto)} alt="" /></div>
          : <div className={`t-portada et c-${portada.color} i-2`} />)}
        <header>
          <button type="button" className={'circulo' + (t.completada ? ' hecho' : '')} disabled={!puede} aria-pressed={t.completada} title={t.completada ? 'Completada: tocá para marcarla pendiente' : 'Marcar como completada'}
            aria-label={t.completada ? 'Marcar como pendiente' : 'Marcar como completada'} onClick={() => void cambiar({ completada: !t.completada })}>{t.completada && <Icono n="tilde" />}</button>
          {puede
            ? <textarea className="titulo-tarjeta" aria-label="Título de la tarjeta" value={titulo} rows={1} maxLength={16000} onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTitulo}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }} />
            : <h2>{t.titulo}</h2>}
          <button type="button" className="btn plano chico" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </header>
        <p className="rotulo">#{t.numero} · en la lista {det.lista.nombre}{t.archivada ? ' · archivada' : ''}</p>
        {error && <p className="error" role="alert">{error}</p>}
        {t.archivada && puede && <div className="fila"><span className="chapa marcador">Archivada</span><button type="button" className="btn chico" onClick={() => void cambiar({ archivada: false })}>Restaurar al tablero</button></div>}

        {(etiquetas.length > 0 || miembros.length > 0 || t.inicio || t.vence) && (
          <div className="t-datos">
            {etiquetas.length > 0 && <div><p className="rotulo">Etiquetas</p><button type="button" className="suelto" disabled={!puede} onClick={abrir('etiquetas')}>{etiquetas.map((e) => <ChipEtiqueta key={e.id} e={e} />)}</button></div>}
            {miembros.length > 0 && <div><p className="rotulo">Miembros</p><button type="button" className="suelto" disabled={!puede} onClick={abrir('miembros')}>{miembros.map((m) => <Avatar key={m.id} p={m} />)}</button></div>}
            {(t.inicio || t.vence) && <div><p className="rotulo">Fechas</p><button type="button" className={`suelto fecha ${estado}`} disabled={!puede} onClick={abrir('fechas')}>
              <Icono n="reloj" />{t.inicio && fechaCorta(t.inicio)}{t.inicio && t.vence && ' → '}{t.vence && fechaCorta(t.vence)}{estado && <span className="chapa">{NOMBRE_ESTADO[estado]}</span>}</button></div>}
          </div>
        )}

        {puede && (
          <div className="t-acciones">
            <button type="button" className="btn chico" onClick={abrir('etiquetas')}>Etiquetas</button>
            <button type="button" className="btn chico" onClick={abrir('miembros')}>Miembros</button>
            <button type="button" className="btn chico" onClick={abrir('fechas')}>Fechas</button>
            <button type="button" className="btn chico" onClick={abrir('checklist')}>Checklist</button>
            <button type="button" className="btn chico" onClick={abrir('adjuntar')}>Adjuntar</button>
            <button type="button" className="btn chico" onClick={abrir('portada')}>Portada</button>
            <span className="sep" />
            <button type="button" className="btn chico" onClick={abrir('mover')}>Mover</button>
            <button type="button" className="btn chico" onClick={abrir('copiar')}>Copiar</button>
            {!t.archivada && <button type="button" className="btn chico" onClick={() => { void cambiar({ archivada: true }).then(alCerrar); }}>Archivar</button>}
            <button type="button" className="btn chico" onClick={() => void copiar('tarjeta', `${location.origin}/c/${t.enlace}`)}>{copiado === 'tarjeta' ? 'Enlace copiado' : 'Copiar enlace'}</button>
          </div>
        )}

        <section>
          <div className="t-titulo"><h3>Descripción</h3>{puede && desc === null && t.descripcion && <button type="button" className="btn chico" onClick={() => setDesc(t.descripcion)}>Editar</button>}</div>
          {desc !== null ? (
            <div className="columna" style={{ gap: 8 }}>
              <Editor valor={desc} alCambiar={setDesc} personas={d.miembros} rotulo="Descripción" filas={8} auto subirImagen={subirImagen}
                alEnviar={() => { void cambiar({ descripcion: desc }).then((r) => r && setDesc(null)); }} alCancelar={() => setDesc(null)} />
              <div className="fila"><button type="button" className="btn lleno" onClick={() => { void cambiar({ descripcion: desc }).then((r) => r && setDesc(null)); }}>Guardar</button><button type="button" className="btn plano" onClick={() => setDesc(null)}>Cancelar</button></div>
            </div>
          ) : t.descripcion ? <Texto valor={t.descripcion} />
            : puede ? <button type="button" className="vacio-chico" onClick={() => setDesc('')}>Agregar una descripción más detallada…</button> : <p className="suave">Sin descripción.</p>}
        </section>

        {det.checklists.map((k) => <BloqueChecklist key={k.id} k={k} todas={det.checklists} puede={puede} personas={d.miembros} oculto={ocultos.includes(k.id)} hacer={hacer}
          alOcultar={() => { const n = ocultos.includes(k.id) ? ocultos.filter((x) => x !== k.id) : [...ocultos, k.id]; setOcultos(n); recordar('checklists-ocultos', n.slice(-200).join(',')); }}
          alMenuItem={(item, ancla) => setMenu({ tipo: 'item', ancla, item })} />)}

        {(det.adjuntos.length > 0 || subiendo !== null) && (
          <section>
            <div className="t-titulo"><h3>Adjuntos</h3>{puede && <button type="button" className="btn chico" onClick={abrir('adjuntar')}>Agregar</button>}</div>
            {subiendo !== null && <div className="barra-avance" role="progressbar" aria-label="Subiendo archivo" aria-valuenow={Math.round(subiendo * 100)}><i style={{ width: `${subiendo * 100}%` }} /></div>}
            <ul className="adjuntos">{det.adjuntos.map((a) => (
              <li key={a.id}>
                {a.es_imagen ? <button type="button" className="mini" onClick={() => setVisor(a)} aria-label={`Ver ${a.nombre}`}><img src={archivoDe(a.id)} alt="" loading="lazy" /></button>
                  : <span className="mini">{a.tipo === 'enlace' ? '↗' : (a.nombre.split('.').pop() ?? '').slice(0, 4).toUpperCase() || '—'}</span>}
                <div className="cuerpo">
                  {a.tipo === 'enlace' ? <a href={a.url} target="_blank" rel="noopener noreferrer"><b>{a.nombre}</b></a>
                    : a.es_imagen || /^(audio|video)\//.test(a.mime) ? <button type="button" className="como-enlace" onClick={() => setVisor(a)}><b>{a.nombre}</b></button>
                    : <a href={archivoDe(a.id)} target="_blank" rel="noopener noreferrer"><b>{a.nombre}</b></a>}
                  <small className="suave">{a.tipo === 'enlace' ? a.url : peso(a.tamano)} · {hace(a.creado_en)}{portada?.adjunto === a.id ? ' · es la portada' : ''}</small>
                  <div className="fila acc">
                    {a.tipo === 'archivo' && <a href={`${archivoDe(a.id)}?bajar`}>Bajar</a>}
                    {puede && <>
                      <button type="button" className="como-enlace" onClick={() => { const n = window.prompt('Nombre del adjunto', a.nombre)?.trim(); if (n && n !== a.nombre) void hacer(() => api('PATCH', `/api/adjuntos/${a.id}`, { nombre: n })); }}>Renombrar</button>
                      {a.es_imagen && <button type="button" className="como-enlace" onClick={() => void cambiar({ portada: portada?.adjunto === a.id ? null : { adjunto: a.id, tamano: portada?.tamano ?? 'media' } })}>{portada?.adjunto === a.id ? 'Quitar portada' : 'Usar de portada'}</button>}
                      {[-1, 1].map((p) => { const pos = correr(det.adjuntos, a.id, p as -1 | 1); return pos === null ? null : <button type="button" key={p} className="como-enlace" aria-label={p < 0 ? 'Subir' : 'Bajar de lugar'} onClick={() => void hacer(() => api('PATCH', `/api/adjuntos/${a.id}`, { posicion: pos }))}>{p < 0 ? '↑' : '↓'}</button>; })}
                      <button type="button" className="como-enlace peligro" onClick={() => { if (window.confirm(`¿Borrar "${a.nombre}"? No se puede deshacer.`)) void hacer(() => api('DELETE', `/api/adjuntos/${a.id}`)); }}>Borrar</button>
                    </>}
                  </div>
                </div>
              </li>
            ))}</ul>
          </section>
        )}

        <section>
          <div className="t-titulo"><h3>Comentarios y actividad</h3>
            <button type="button" className="btn chico" aria-pressed={detalles} onClick={() => { setDetalles(!detalles); recordar('actividad-detalles', detalles ? 'no' : 'si'); }}>{detalles ? 'Ocultar detalles' : 'Mostrar detalles'}</button></div>
          {d.mi.puede.comentar && yo && (
            <div className="comentar"><Avatar p={yo} />
              <div className="columna" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                <Editor valor={comentario} alCambiar={setComentario} personas={d.miembros} rotulo="Comentario nuevo" placeholder="Escribí un comentario…" filas={2} alEnviar={() => void comentar()} subirImagen={puede ? subirImagen : undefined} />
                {comentario.trim() && <div><button type="button" className="btn lleno chico" onClick={() => void comentar()}>Comentar</button></div>}
              </div>
            </div>
          )}
          <ul className="linea">{linea.map((x) => x.k === 'a' ? (
            <li key={x.a.id} className="hecho-menor">{x.a.actor ? <Avatar p={x.a.actor} chica /> : <span className="per chica" />}<p><b>{x.a.actor?.nombre ?? 'Alguien'}</b> {describir(x.a, true)} <small className="suave" title={new Date(x.a.creado_en).toLocaleString('es-AR')}>· {hace(x.a.creado_en)}</small></p></li>
          ) : (
            <li key={x.c.id} id={`comentario-${x.c.id}`} className={marcado.current === x.c.id ? 'marcado' : ''}>
              {x.c.autor ? <Avatar p={x.c.autor} /> : <span className="per" />}
              <div className="cuerpo">
                <p><b>{x.c.autor?.nombre ?? 'Cuenta borrada'}</b> <small className="suave" title={new Date(x.c.creado_en).toLocaleString('es-AR')}>{hace(x.c.creado_en)}{x.c.editado_en ? ' (editado)' : ''}</small></p>
                {editando?.id === x.c.id ? (
                  <div className="columna" style={{ gap: 8 }}>
                    <Editor valor={editando.texto} alCambiar={(v) => setEditando({ id: x.c.id, texto: v })} personas={d.miembros} rotulo="Editar comentario" auto alCancelar={() => setEditando(null)}
                      alEnviar={() => { void hacer(() => api('PATCH', `/api/comentarios/${x.c.id}`, { texto: editando.texto })).then((r) => r && setEditando(null)); }} />
                    <div className="fila"><button type="button" className="btn lleno chico" onClick={() => { void hacer(() => api('PATCH', `/api/comentarios/${x.c.id}`, { texto: editando.texto })).then((r) => r && setEditando(null)); }}>Guardar</button><button type="button" className="btn plano chico" onClick={() => setEditando(null)}>Cancelar</button></div>
                  </div>
                ) : <div className="globo"><Texto valor={x.c.texto} /></div>}
                <div className="fila acc">
                  {x.c.reacciones.map((r) => <button type="button" key={r.emoji} className={'reaccion' + (yo && r.usuarios.includes(yo.id) ? ' mia' : '')} disabled={!d.mi.puede.comentar}
                    title={r.usuarios.map((u) => d.miembros.find((m) => m.id === u)?.nombre ?? 'Alguien').join(', ')} onClick={() => void hacer(() => api('POST', `/api/comentarios/${x.c.id}/reacciones`, { emoji: r.emoji }))}>{r.emoji} {r.usuarios.length}</button>)}
                  {d.mi.puede.comentar && <button type="button" className="como-enlace" onClick={(e) => setMenu({ tipo: 'reaccion', ancla: e.currentTarget.getBoundingClientRect(), comentario: x.c.id })}>Reaccionar</button>}
                  {yo && x.c.autor?.id === yo.id && d.mi.puede.comentar && <button type="button" className="como-enlace" onClick={() => setEditando({ id: x.c.id, texto: x.c.texto })}>Editar</button>}
                  {yo && (x.c.autor?.id === yo.id || d.mi.puede.administrar) && !d.tablero.cerrado && <button type="button" className="como-enlace peligro" onClick={() => { if (window.confirm('¿Borrar este comentario? No se puede deshacer.')) void hacer(() => api('DELETE', `/api/comentarios/${x.c.id}`)); }}>Borrar</button>}
                  <button type="button" className="como-enlace" onClick={() => void copiar(x.c.id, `${location.origin}/c/${t.enlace}?comentario=${x.c.id}`)}>{copiado === x.c.id ? 'Copiado' : 'Enlace'}</button>
                </div>
              </div>
            </li>
          ))}</ul>
        </section>
      </div>

      {menu?.tipo === 'etiquetas' && <Flotante ancla={menu.ancla} titulo="Etiquetas" alCerrar={cerrarMenu}>
        <PanelEtiquetas d={d} puestas={t.etiquetas} alCambiar={alCambiarTablero} alAlternar={(id) => void hacer(() => (t.etiquetas.includes(id) ? api('DELETE', `${base}/etiquetas/${id}`) : api('POST', `${base}/etiquetas`, { etiqueta_id: id })))} />
      </Flotante>}
      {menu?.tipo === 'miembros' && <Flotante ancla={menu.ancla} titulo="Miembros" alCerrar={cerrarMenu}>
        <ul className="elegir">{d.miembros.map((m) => (
          <li key={m.id}><button type="button" className="cual" aria-pressed={t.miembros.includes(m.id)} onClick={() => void hacer(() => (t.miembros.includes(m.id) ? api('DELETE', `${base}/miembros/${m.id}`) : api('POST', `${base}/miembros`, { usuario_id: m.id })))}>
            <Avatar p={m} chica /><span className="nombre">{m.nombre}</span>{t.miembros.includes(m.id) && <Icono n="tilde" />}</button></li>
        ))}</ul>
        <p className="suave" style={{ fontSize: 13 }}>Se puede asignar a quienes están en el tablero. Para sumar a alguien más, usá "Compartir".</p>
      </Flotante>}
      {menu?.tipo === 'fechas' && <Flotante ancla={menu.ancla} titulo="Fechas" alCerrar={cerrarMenu}><PanelFechas t={t} alGuardar={(c) => { void cambiar(c); cerrarMenu(); }} /></Flotante>}
      {menu?.tipo === 'checklist' && <Flotante ancla={menu.ancla} titulo="Agregar checklist" alCerrar={cerrarMenu}><PanelChecklist d={d} alCrear={(c) => { void hacer(() => api('POST', `${base}/checklists`, c)); cerrarMenu(); }} /></Flotante>}
      {menu?.tipo === 'adjuntar' && <Flotante ancla={menu.ancla} titulo="Adjuntar" alCerrar={cerrarMenu}>
        <PanelAdjuntar alArchivos={(fs) => { cerrarMenu(); void subirArchivos(fs); }} alEnlace={(c) => { void hacer(() => api('POST', `${base}/adjuntos`, c)); cerrarMenu(); }} />
      </Flotante>}
      {menu?.tipo === 'portada' && <Flotante ancla={menu.ancla} titulo="Portada" alCerrar={cerrarMenu}>
        <div className="columna" style={{ gap: 10 }}>
          <p className="rotulo">Color</p>
          <div className="colores" role="radiogroup" aria-label="Color de la portada">{TONOS.map((c) => <button type="button" key={c} role="radio" aria-checked={portada?.color === c} aria-label={c} title={c} className={`et c-${c} i-2`} onClick={() => void cambiar({ portada: { color: c, tamano: portada?.tamano ?? 'media', tono: portada?.tono ?? 'oscuro' } })} />)}</div>
          {imagenes.length > 0 && <><p className="rotulo">Imágenes adjuntas</p>
            <div className="fotos">{imagenes.map((a) => <button type="button" key={a.id} aria-pressed={portada?.adjunto === a.id} aria-label={a.nombre} onClick={() => void cambiar({ portada: { adjunto: a.id, tamano: portada?.tamano ?? 'media' } })}><img src={archivoDe(a.id)} alt="" /></button>)}</div></>}
          <label className="como-boton btn chico">Subir una imagen<input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void subirArchivos([f]).then((a) => a?.es_imagen && cambiar({ portada: { adjunto: a.id, tamano: portada?.tamano ?? 'media' } })); }} /></label>
          {portada && <>
            <p className="rotulo">Tamaño en el tablero</p>
            <div className="fila">{(['media', 'completa'] as const).map((tm) => <button type="button" key={tm} className={'btn chico' + (portada.tamano === tm ? ' lleno' : '')} onClick={() => void cambiar({ portada: { ...portada, tamano: tm } })}>{tm === 'media' ? 'Arriba del título' : 'Toda la tarjeta'}</button>)}</div>
            {portada.tamano === 'completa' && <div className="fila">{(['oscuro', 'claro'] as const).map((tn) => <button type="button" key={tn} className={'btn chico' + (portada.tono === tn ? ' lleno' : '')} onClick={() => void cambiar({ portada: { ...portada, tono: tn } })}>Texto {tn}</button>)}</div>}
            <div><button type="button" className="btn chico peligro" onClick={() => { void cambiar({ portada: null }); cerrarMenu(); }}>Quitar portada</button></div>
          </>}
        </div>
      </Flotante>}
      {(menu?.tipo === 'mover' || menu?.tipo === 'copiar') && <Flotante ancla={menu.ancla} titulo={menu.tipo === 'mover' ? 'Mover tarjeta' : 'Copiar tarjeta'} alCerrar={cerrarMenu}>
        <Destino d={d} tarjeta={t} modo={menu.tipo} ops={ops} alHecho={menu.tipo === 'mover' ? () => { cerrarMenu(); alCerrar(); } : cerrarMenu} />
      </Flotante>}
      {menu?.tipo === 'reaccion' && <Flotante ancla={menu.ancla} titulo="Reaccionar" alCerrar={cerrarMenu}>
        <div className="emojis">{EMOJIS.map(([n, e]) => <button type="button" key={n} title={n} onClick={() => { void hacer(() => api('POST', `/api/comentarios/${menu.comentario}/reacciones`, { emoji: e })); cerrarMenu(); }}>{e}</button>)}</div>
      </Flotante>}
      {menu?.tipo === 'item' && <Flotante ancla={menu.ancla} titulo="Ítem" alCerrar={cerrarMenu}>
        <MenuItem item={det.checklists.flatMap((k) => k.items).find((i) => i.id === menu.item.id) ?? menu.item} todas={det.checklists} personas={d.miembros} hacer={hacer} alCerrar={cerrarMenu} />
      </Flotante>}
      {visor && (
        <div className="visor" role="dialog" aria-label={visor.nombre} onClick={() => setVisor(null)}>
          {visor.es_imagen ? <img src={archivoDe(visor.id)} alt={visor.nombre} />
            : visor.mime.startsWith('video/') ? <video src={archivoDe(visor.id)} controls autoPlay onClick={(e) => e.stopPropagation()} />
            : <audio src={archivoDe(visor.id)} controls autoPlay onClick={(e) => e.stopPropagation()} />}
          <button type="button" className="btn" onClick={() => setVisor(null)}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

type Hacer = <R,>(f: () => Promise<R>) => Promise<R | null>;

function PanelFechas({ t, alGuardar }: { t: Tarjeta; alGuardar: (c: Record<string, unknown>) => void }) {
  const [inicio, setInicio] = useState(t.inicio ?? '');
  const [vence, setVence] = useState(aCampo(t.vence));
  return (
    <form className="columna" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); alGuardar({ inicio: inicio || null, vence: vence ? new Date(vence).toISOString() : null }); }}>
      <Campo rotulo="Empieza"><input id="tf-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
      <Campo rotulo="Vence" ayuda="Día y hora."><input id="tf-vence" type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} /></Campo>
      <div className="fila"><button type="submit" className="btn lleno">Guardar</button>
        {(t.inicio || t.vence) && <button type="button" className="btn peligro" onClick={() => alGuardar({ inicio: null, vence: null })}>Quitar fechas</button>}</div>
    </form>
  );
}

function PanelChecklist({ d, alCrear }: { d: Datos; alCrear: (c: { nombre: string; copiar_de?: string }) => void }) {
  const [nombre, setNombre] = useState('Checklist');
  const [de, setDe] = useState('');
  const otras = useCarga<{ checklists: { id: string; nombre: string; tarjeta: string }[] }>(`/api/tableros/${d.tablero.id}/checklists`);
  return (
    <form className="columna" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) alCrear({ nombre: nombre.trim(), ...(de ? { copiar_de: de } : {}) }); }}>
      <Campo rotulo="Nombre"><input id="tk-nombre" type="text" autoFocus value={nombre} maxLength={500} onFocus={(e) => e.target.select()} onChange={(e) => setNombre(e.target.value)} required /></Campo>
      {(otras.datos?.checklists.length ?? 0) > 0 && (
        <Campo rotulo="Copiar los ítems de…">
          <select id="tk-de" value={de} onChange={(e) => setDe(e.target.value)}><option value="">Ninguna: empezar vacía</option>
            {otras.datos!.checklists.map((k) => <option key={k.id} value={k.id}>{k.nombre} · {k.tarjeta.slice(0, 40)}</option>)}</select>
        </Campo>
      )}
      <div><button type="submit" className="btn lleno">Agregar</button></div>
    </form>
  );
}

function PanelAdjuntar({ alArchivos, alEnlace }: { alArchivos: (fs: File[]) => void; alEnlace: (c: { url: string; nombre: string }) => void }) {
  const [url, setUrl] = useState('');
  const [nombre, setNombre] = useState('');
  return (
    <div className="columna" style={{ gap: 12 }}>
      <label className="como-boton btn lleno">Elegir archivos o sacar una foto<input type="file" multiple hidden onChange={(e) => { const fs = [...(e.target.files ?? [])]; if (fs.length) alArchivos(fs); }} /></label>
      <p className="suave" style={{ fontSize: 13 }}>También podés arrastrar archivos sobre la tarjeta o pegar una imagen copiada.</p>
      <form className="columna" style={{ gap: 10, borderTop: '1px solid var(--linea)', paddingTop: 12 }} onSubmit={(e) => { e.preventDefault(); alEnlace({ url: url.trim(), nombre: nombre.trim() }); }}>
        <Campo rotulo="O pegá un enlace"><input id="ta-url" type="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} required /></Campo>
        <Campo rotulo="Nombre para mostrar (opcional)"><input id="ta-nombre-enlace" type="text" value={nombre} maxLength={300} onChange={(e) => setNombre(e.target.value)} /></Campo>
        <div><button type="submit" className="btn">Adjuntar enlace</button></div>
      </form>
    </div>
  );
}

function MenuItem({ item, todas, personas, hacer, alCerrar }: { item: Item; todas: Checklist[]; personas: Persona[]; hacer: Hacer; alCerrar: () => void }) {
  const propia = todas.find((k) => k.id === item.checklist_id);
  const cambiar = (c: Record<string, unknown>) => hacer(() => api('PATCH', `/api/items/${item.id}`, c));
  const y = (f: () => unknown) => () => { void f(); alCerrar(); };
  return (
    <div className="columna" style={{ gap: 10 }}>
      <Campo rotulo="Asignado a">
        <select id="ti-asignado" value={item.asignado_id ?? ''} onChange={(e) => void cambiar({ asignado_id: e.target.value || null })}><option value="">Nadie</option>{personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
      </Campo>
      <Campo rotulo="Vence"><input id="ti-vence" type="datetime-local" value={aCampo(item.vence)} onChange={(e) => void cambiar({ vence: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Campo>
      {todas.length > 1 && (
        <Campo rotulo="Pasar a otra checklist">
          <select id="ti-checklist" value={item.checklist_id} onChange={(e) => { void cambiar({ checklist_id: e.target.value }); alCerrar(); }}>{todas.map((k) => <option key={k.id} value={k.id}>{k.nombre}</option>)}</select>
        </Campo>
      )}
      <div className="opciones">
        {propia && ([-1, 1] as const).map((p) => { const pos = correr(propia.items, item.id, p); return <button type="button" key={p} disabled={pos === null} onClick={() => void cambiar({ posicion: pos })}>{p < 0 ? 'Subir un lugar' : 'Bajar un lugar'}</button>; })}
        <hr />
        <button type="button" onClick={y(() => hacer(() => api('POST', `/api/items/${item.id}/convertir`)))}>Convertir en tarjeta</button>
        <button type="button" onClick={y(() => hacer(() => api('DELETE', `/api/items/${item.id}`)))}>Borrar ítem</button>
      </div>
    </div>
  );
}

function BloqueChecklist({ k, todas, puede, personas, oculto, hacer, alOcultar, alMenuItem }: {
  k: Checklist; todas: Checklist[]; puede: boolean; personas: Persona[]; oculto: boolean; hacer: Hacer; alOcultar: () => void; alMenuItem: (i: Item, ancla: DOMRect) => void;
}) {
  const [nombre, setNombre] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; texto: string } | null>(null);
  const hechos = k.items.filter((i) => i.hecho).length;
  const parte = k.items.length ? Math.round((hechos / k.items.length) * 100) : 0;
  const agregar = async () => {
    const textos = (nuevo ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (textos.length && await hacer(() => api('POST', `/api/checklists/${k.id}/items`, { textos }))) setNuevo('');
  };
  const guardarItem = () => { if (edit && edit.texto.trim()) void hacer(() => api('PATCH', `/api/items/${edit.id}`, { texto: edit.texto.trim() })); setEdit(null); };
  const visibles: ReactNode[] = [];
  for (const i of k.items) {
    if (oculto && i.hecho) continue;
    const asignado = personas.find((p) => p.id === i.asignado_id);
    const estado = estadoVence(i.vence, i.hecho);
    visibles.push(
      <li key={i.id} className={i.hecho ? 'hecho' : ''}>
        <input type="checkbox" checked={i.hecho} disabled={!puede} aria-label={`Hecho: ${i.texto}`} onChange={() => void hacer(() => api('PATCH', `/api/items/${i.id}`, { hecho: !i.hecho }))} />
        {edit?.id === i.id
          ? <textarea autoFocus rows={2} value={edit.texto} aria-label="Texto del ítem" maxLength={16000} onChange={(e) => setEdit({ id: i.id, texto: e.target.value })} onBlur={guardarItem}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); guardarItem(); } if (e.key === 'Escape') { e.stopPropagation(); setEdit(null); } }} />
          : <div className="cuerpo" onClick={(e) => { if (puede && !(e.target as HTMLElement).closest('a')) setEdit({ id: i.id, texto: i.texto }); }}><Texto valor={i.texto} corto /></div>}
        {i.vence && <span className={`chapa fecha ${estado}`}>{fechaCorta(i.vence)}</span>}
        {asignado && <Avatar p={asignado} chica />}
        {puede && <button type="button" className="mas" aria-label={`Acciones del ítem ${i.texto}`} onClick={(e) => alMenuItem(i, e.currentTarget.getBoundingClientRect())}>···</button>}
      </li>,
    );
  }
  return (
    <section className="checklist">
      <div className="t-titulo">
        {nombre !== null
          ? <input type="text" autoFocus value={nombre} aria-label="Nombre de la checklist" maxLength={500} onChange={(e) => setNombre(e.target.value)} onFocus={(e) => e.target.select()}
              onBlur={() => { const n = nombre.trim(); if (n && n !== k.nombre) void hacer(() => api('PATCH', `/api/checklists/${k.id}`, { nombre: n })); setNombre(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.stopPropagation(); setNombre(null); } }} />
          : <h3 onClick={() => puede && setNombre(k.nombre)} title={puede ? 'Tocá para cambiar el nombre' : undefined}>{k.nombre}</h3>}
        {hechos > 0 && <button type="button" className="btn chico" onClick={alOcultar}>{oculto ? `Mostrar tildados (${hechos})` : 'Ocultar tildados'}</button>}
        {puede && <>
          {([-1, 1] as const).map((p) => { const pos = correr(todas, k.id, p); return pos === null ? null : <button type="button" key={p} className="btn chico plano" aria-label={p < 0 ? 'Subir la checklist' : 'Bajar la checklist'} onClick={() => void hacer(() => api('PATCH', `/api/checklists/${k.id}`, { posicion: pos }))}>{p < 0 ? '↑' : '↓'}</button>; })}
          <button type="button" className="btn chico" onClick={() => { if (k.items.length === 0 || window.confirm(`¿Borrar la checklist "${k.nombre}" con sus ${k.items.length} ítems?`)) void hacer(() => api('DELETE', `/api/checklists/${k.id}`)); }}>Borrar</button>
        </>}
      </div>
      <div className="avance"><span>{parte}%</span><div className="barra-avance"><i className={parte === 100 ? 'lleno' : ''} style={{ width: `${parte}%` }} /></div><span>{hechos}/{k.items.length}</span></div>
      <ul className="items">{visibles}</ul>
      {puede && (nuevo === null
        ? <div><button type="button" className="btn chico" onClick={() => setNuevo('')}>Agregar un ítem</button></div>
        : <div className="columna" style={{ gap: 8 }}>
            <textarea autoFocus rows={2} value={nuevo} placeholder="Agregar un ítem (si pegás varios renglones, cada uno es un ítem)" aria-label="Ítem nuevo" maxLength={16000} onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void agregar(); } if (e.key === 'Escape') { e.stopPropagation(); setNuevo(null); } }} />
            <div className="fila"><button type="button" className="btn lleno chico" onClick={() => void agregar()}>Agregar</button><button type="button" className="btn plano chico" onClick={() => setNuevo(null)}>Listo</button></div>
          </div>)}
    </section>
  );
}
