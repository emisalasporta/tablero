// Menús y diálogos del tablero: acciones de una lista, la tarjeta abierta (por ahora título, mover, copiar y archivar)
// y los elementos archivados.
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, Campo, Dialogo, useAccion, useCarga } from '../base.tsx';
import { posicionEntre } from './datos.ts';
import type { Datos, Lista, Ops, Tarjeta } from './datos.ts';

/** Menú que se abre pegado al botón que lo llamó. En el teléfono sube desde abajo. */
export function Flotante({ ancla, titulo, alCerrar, alVolver, children }: { ancla: DOMRect; titulo: string; alCerrar: () => void; alVolver?: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [alCerrar]);
  const ANCHO = 300;
  const left = Math.max(8, Math.min(ancla.left, window.innerWidth - ANCHO - 8));
  const top = Math.min(ancla.bottom + 6, window.innerHeight - 220);
  return (
    <div className="flotante-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar(); }}>
      <div className="flotante" role="dialog" aria-label={titulo} style={{ left, top, width: ANCHO, maxHeight: `calc(100dvh - ${top + 8}px)` }}>
        <header>
          {alVolver && <button type="button" className="btn plano chico" onClick={alVolver} aria-label="Volver">‹</button>}
          <b>{titulo}</b>
          <button type="button" className="btn plano chico" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

interface TableroEditable { id: string; nombre: string; espacio: string }
/** Tableros donde puedo editar (para elegir destino) y, si elijo otro tablero, sus listas y tarjetas. */
function useDestino(d: Datos, tableroId: string) {
  const mios = useCarga<{ tableros: TableroEditable[] }>('/api/yo/tableros-editables');
  const otro = useCarga<Datos>(tableroId === d.tablero.id ? null : `/api/tableros/${tableroId}`);
  const fuente = tableroId === d.tablero.id ? d : otro.datos;
  const tableros = mios.datos?.tableros ?? [{ id: d.tablero.id, nombre: d.tablero.nombre, espacio: d.espacio.nombre }];
  return { tableros, listas: fuente?.listas ?? [], tarjetas: fuente?.tarjetas ?? [], cargando: !fuente };
}
function ElegirTablero({ id, valor, tableros, alCambiar }: { id: string; valor: string; tableros: TableroEditable[]; alCambiar: (v: string) => void }) {
  return (
    <Campo rotulo="Tablero">
      <select id={id} value={valor} onChange={(e) => alCambiar(e.target.value)}>
        {tableros.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {t.espacio}</option>)}
      </select>
    </Campo>
  );
}
function ElegirLugar({ id, cantidad, valor, alCambiar }: { id: string; cantidad: number; valor: number; alCambiar: (v: number) => void }) {
  return (
    <Campo rotulo="Posición">
      <select id={id} value={Math.min(valor, cantidad)} onChange={(e) => alCambiar(Number(e.target.value))}>
        {Array.from({ length: cantidad + 1 }, (_, i) => <option key={i} value={i}>{i + 1}{i === 0 ? ' (primera)' : i === cantidad ? ' (última)' : ''}</option>)}
      </select>
    </Campo>
  );
}

// =====================================================================
// MENÚ DE UNA LISTA
// =====================================================================
type VistaLista = 'raiz' | 'copiar' | 'mover' | 'ordenar' | 'pasar' | 'vaciar';

export function MenuLista({ d, lista, tarjetas, ops, ancla, alCerrar, alAgregarArriba }: { d: Datos; lista: Lista; tarjetas: Tarjeta[]; ops: Ops; ancla: DOMRect; alCerrar: () => void; alAgregarArriba: () => void }) {
  const [vista, setVista] = useState<VistaLista>('raiz');
  const [nombre, setNombre] = useState(lista.nombre);
  const [tableroId, setTableroId] = useState(d.tablero.id);
  const destino = useDestino(d, tableroId);
  const otras = useMemo(() => destino.listas.filter((l) => l.id !== lista.id), [destino.listas, lista.id]);
  const [lugar, setLugar] = useState(() => d.listas.indexOf(lista));
  const y = (f: () => unknown) => () => { void f(); alCerrar(); };
  const volver = vista === 'raiz' ? undefined : () => setVista('raiz');
  const TITULOS: Record<VistaLista, string> = { raiz: lista.nombre, copiar: 'Copiar lista', mover: 'Mover lista', ordenar: 'Ordenar tarjetas', pasar: 'Mover todas las tarjetas', vaciar: 'Archivar todas las tarjetas' };
  return (
    <Flotante ancla={ancla} titulo={TITULOS[vista]} alCerrar={alCerrar} alVolver={volver}>
      {vista === 'raiz' && (
        <div className="opciones">
          <button type="button" onClick={alAgregarArriba}>Agregar tarjeta arriba</button>
          <button type="button" onClick={() => setVista('copiar')}>Copiar lista…</button>
          <button type="button" onClick={() => setVista('mover')}>Mover lista…</button>
          <hr />
          <button type="button" disabled={tarjetas.length < 2} onClick={() => setVista('ordenar')}>Ordenar tarjetas…</button>
          <button type="button" disabled={tarjetas.length === 0 || d.listas.length < 2} onClick={() => setVista('pasar')}>Mover todas las tarjetas…</button>
          <button type="button" disabled={tarjetas.length === 0} onClick={() => setVista('vaciar')}>Archivar todas las tarjetas…</button>
          <hr />
          <button type="button" onClick={y(() => ops.cambiarLista(lista.id, { archivada: true }))}>Archivar esta lista</button>
        </div>
      )}
      {vista === 'copiar' && (
        <form className="columna" onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) { void ops.copiarLista(lista.id, nombre.trim()); alCerrar(); } }}>
          <Campo rotulo="Nombre de la copia" ayuda={`Se copia con sus ${tarjetas.length} tarjetas, al lado de la original.`}><input id="ml-nombre" type="text" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} onFocus={(e) => e.target.select()} required maxLength={16000} /></Campo>
          <div><button type="submit" className="btn lleno">Crear copia</button></div>
        </form>
      )}
      {vista === 'mover' && (
        <form className="columna" onSubmit={(e) => {
          e.preventDefault();
          if (destino.cargando) return;
          const posicion = posicionEntre(otras, Math.min(lugar, otras.length));
          void ops.cambiarLista(lista.id, tableroId === d.tablero.id ? { posicion } : { posicion, tablero_id: tableroId });
          alCerrar();
        }}>
          <ElegirTablero id="ml-tablero" valor={tableroId} tableros={destino.tableros} alCambiar={(v) => { setTableroId(v); setLugar(v === d.tablero.id ? d.listas.indexOf(lista) : 9999); }} />
          <ElegirLugar id="ml-lugar" cantidad={otras.length} valor={lugar} alCambiar={setLugar} />
          {tableroId !== d.tablero.id && <p className="suave">La lista se va con todas sus tarjetas.</p>}
          <div><button type="submit" className="btn lleno" disabled={destino.cargando}>Mover</button></div>
        </form>
      )}
      {vista === 'ordenar' && (
        <div className="opciones">
          <button type="button" onClick={y(() => ops.ordenarLista(lista.id, 'nombre'))}>Por nombre (A a Z)</button>
          <button type="button" onClick={y(() => ops.ordenarLista(lista.id, 'nuevas'))}>Las más nuevas primero</button>
          <button type="button" onClick={y(() => ops.ordenarLista(lista.id, 'viejas'))}>Las más viejas primero</button>
        </div>
      )}
      {vista === 'pasar' && (
        <div className="opciones">
          <p className="suave">Pasan al final de la lista que elijas.</p>
          {d.listas.filter((l) => l.id !== lista.id).map((l) => <button type="button" key={l.id} onClick={y(() => ops.pasarTarjetas(lista.id, l.id))}>{l.nombre}</button>)}
        </div>
      )}
      {vista === 'vaciar' && (
        <div className="columna">
          <p>Se archivan las {tarjetas.length} tarjetas de esta lista. No se borran: se pueden restaurar desde "Archivados".</p>
          <div><button type="button" className="btn lleno" onClick={y(() => ops.archivarTarjetas(lista.id))}>Archivar todas</button></div>
        </div>
      )}
    </Flotante>
  );
}

// =====================================================================
// TARJETA ABIERTA
// =====================================================================
function Destino({ d, tarjeta, modo, ops, alHecho }: { d: Datos; tarjeta: Tarjeta; modo: 'mover' | 'copiar'; ops: Ops; alHecho: () => void }) {
  const [tableroId, setTableroId] = useState(d.tablero.id);
  const destino = useDestino(d, tableroId);
  const [listaId, setListaId] = useState(tarjeta.lista_id);
  const lista = destino.listas.find((l) => l.id === listaId) ?? destino.listas[0];
  const otras = useMemo(() => destino.tarjetas.filter((t) => t.lista_id === lista?.id && (modo === 'copiar' || t.id !== tarjeta.id)), [destino.tarjetas, lista?.id, modo, tarjeta.id]);
  const [lugar, setLugar] = useState<number | null>(null);
  const [titulo, setTitulo] = useState(tarjeta.titulo);
  const [conDescripcion, setConDescripcion] = useState(true);
  // Por defecto: donde está ahora (al mover dentro de su lista) o al final.
  const propio = modo === 'mover' && lista?.id === tarjeta.lista_id ? d.tarjetas.filter((t) => t.lista_id === tarjeta.lista_id).findIndex((t) => t.id === tarjeta.id) : otras.length;
  const indice = Math.min(lugar ?? propio, otras.length);
  return (
    <form className="columna" onSubmit={(e) => {
      e.preventDefault();
      if (!lista || destino.cargando) return;
      const posicion = posicionEntre(otras, indice);
      if (modo === 'mover') void ops.cambiarTarjeta(tarjeta.id, { lista_id: lista.id, posicion }, tableroId);
      else if (titulo.trim()) void ops.copiarTarjeta(tarjeta.id, { titulo: titulo.trim(), lista_id: lista.id, posicion, conservar: { descripcion: conDescripcion } });
      alHecho();
    }}>
      {modo === 'copiar' && <Campo rotulo="Título de la copia"><textarea id="dt-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={16000} rows={2} /></Campo>}
      {modo === 'copiar' && tarjeta.tiene_descripcion && <label className="fila" style={{ flexWrap: 'nowrap' }}><input type="checkbox" checked={conDescripcion} onChange={(e) => setConDescripcion(e.target.checked)} /><span>Conservar la descripción</span></label>}
      <ElegirTablero id="dt-tablero" valor={tableroId} tableros={destino.tableros} alCambiar={(v) => { setTableroId(v); setLugar(null); }} />
      <Campo rotulo="Lista">
        <select id="dt-lista" value={lista?.id ?? ''} onChange={(e) => { setListaId(e.target.value); setLugar(null); }}>
          {destino.listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Campo>
      <ElegirLugar id="dt-lugar" cantidad={otras.length} valor={indice} alCambiar={setLugar} />
      {!destino.cargando && !lista && <p className="error">Ese tablero no tiene listas. Creá una primero.</p>}
      <div><button type="submit" className="btn lleno" disabled={destino.cargando || !lista}>{modo === 'mover' ? 'Mover' : 'Crear copia'}</button></div>
    </form>
  );
}

export function DialogoTarjeta({ d, tarjeta, ops, alCerrar }: { d: Datos; tarjeta: Tarjeta; ops: Ops; alCerrar: () => void }) {
  const puede = d.mi.puede.editar;
  const lista = d.listas.find((l) => l.id === tarjeta.lista_id);
  const [titulo, setTitulo] = useState(tarjeta.titulo);
  const [vista, setVista] = useState<'mover' | 'copiar' | null>(null);
  // Si otra persona le cambia el título mientras la tengo abierta, se actualiza.
  useEffect(() => { setTitulo(tarjeta.titulo); }, [tarjeta.titulo]);
  const guardar = () => { const t = titulo.trim(); if (t && t !== tarjeta.titulo) void ops.cambiarTarjeta(tarjeta.id, { titulo: t }); else setTitulo(tarjeta.titulo); };
  return (
    <Dialogo titulo="Tarjeta" alCerrar={alCerrar}>
      <p className="rotulo">#{tarjeta.numero} · en la lista {lista?.nombre ?? '—'}</p>
      {puede
        ? <textarea className="titulo-tarjeta" aria-label="Título de la tarjeta" value={titulo} rows={2} maxLength={16000} onChange={(e) => setTitulo(e.target.value)} onBlur={guardar}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } }} />
        : <h3 style={{ overflowWrap: 'anywhere' }}>{tarjeta.titulo}</h3>}
      {puede && (
        <div className="fila">
          <button type="button" className={'btn' + (vista === 'mover' ? ' lleno' : '')} onClick={() => setVista(vista === 'mover' ? null : 'mover')}>Mover…</button>
          <button type="button" className={'btn' + (vista === 'copiar' ? ' lleno' : '')} onClick={() => setVista(vista === 'copiar' ? null : 'copiar')}>Copiar…</button>
          <button type="button" className="btn" onClick={() => { void ops.cambiarTarjeta(tarjeta.id, { archivada: true }); alCerrar(); }}>Archivar</button>
        </div>
      )}
      {vista && <div className="sub"><Destino key={vista} d={d} tarjeta={tarjeta} modo={vista} ops={ops} alHecho={vista === 'mover' ? alCerrar : () => setVista(null)} /></div>}
      <p className="suave">La descripción, las etiquetas, las fechas, los checklists y los comentarios llegan en la próxima tanda.</p>
    </Dialogo>
  );
}

// =====================================================================
// ARCHIVADOS
// =====================================================================
interface Archivados { listas: Lista[]; tarjetas: (Tarjeta & { lista_nombre: string; lista_archivada: boolean })[] }

export function DialogoArchivados({ d, alCambiar, alCerrar }: { d: Datos; alCambiar: () => void; alCerrar: () => void }) {
  const lista = useCarga<Archivados>(`/api/tableros/${d.tablero.id}/archivados`);
  const accion = useAccion();
  const puede = d.mi.puede.editar;
  const restaurar = (url: string) => accion.hacer(async () => { await api('PATCH', url, { archivada: false }); lista.recargar(); alCambiar(); });
  const a = lista.datos;
  return (
    <Dialogo titulo="Archivados" alCerrar={alCerrar}>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      {a && a.listas.length === 0 && a.tarjetas.length === 0 && <p className="suave">No hay nada archivado en este tablero.</p>}
      {a && a.listas.length > 0 && (
        <div className="columna" style={{ gap: 6 }}>
          <p className="rotulo">Listas ({a.listas.length})</p>
          <ul className="renglones">{a.listas.map((l) => (
            <li key={l.id}><span className="quien"><b>{l.nombre}</b></span>{puede && <button type="button" className="btn chico" disabled={accion.ocupado} onClick={() => restaurar(`/api/listas/${l.id}`)}>Restaurar</button>}</li>
          ))}</ul>
        </div>
      )}
      {a && a.tarjetas.length > 0 && (
        <div className="columna" style={{ gap: 6 }}>
          <p className="rotulo">Tarjetas ({a.tarjetas.length})</p>
          <ul className="renglones">{a.tarjetas.map((t) => (
            <li key={t.id}><span className="quien"><b>{t.titulo}</b><small>en {t.lista_nombre}{t.lista_archivada ? ' (lista archivada: restaurala para verla)' : ''}</small></span>
              {puede && <button type="button" className="btn chico" disabled={accion.ocupado} onClick={() => restaurar(`/api/tarjetas/${t.id}`)}>Restaurar</button>}</li>
          ))}</ul>
        </div>
      )}
    </Dialogo>
  );
}
