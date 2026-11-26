// El cuerpo del tablero: las listas una al lado de la otra, cada una con sus tarjetas.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { crearMotor } from './arrastre.ts';
import type { Arrastre, Motor } from './arrastre.ts';
import { posicionEntre } from './datos.ts';
import type { Datos, Lista, Ops, Tarjeta } from './datos.ts';
import { Avatar } from '../base.tsx';
import { MenuLista } from './Menus.tsx';
import { ChipEtiqueta, estadoVence, fechaCorta, Icono } from './piezas.tsx';

/** El frente de una tarjeta: portada, etiquetas, título e insignias. */
function Frente({ t, d, nombres, alAlternarNombres, alCompletar }: { t: Tarjeta; d: Datos; nombres: boolean; alAlternarNombres: () => void; alCompletar?: () => void }) {
  const portada = d.tablero.ajustes.portadas ? t.portada : null;
  const etiquetas = d.etiquetas.filter((e) => t.etiquetas.includes(e.id));
  const miembros = d.miembros.filter((m) => t.miembros.includes(m.id));
  const estado = estadoVence(t.vence, t.completada);
  const completa = portada?.tamano === 'completa';
  const circulo = (d.tablero.ajustes.tilde || t.completada) && (
    <button type="button" className={'circulo' + (t.completada ? ' hecho' : '')} disabled={!alCompletar} aria-pressed={t.completada} aria-label={t.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); alCompletar?.(); }}>{t.completada && <Icono n="tilde" />}</button>
  );
  const titulo = <div className="tit-fila">{circulo}<span className="tit">{t.titulo}</span></div>;
  if (portada && completa) return (
    <div className={`cubierta ${portada.adjunto ? 'imagen' : `et c-${portada.color} i-2`} tono-${portada.tono}`} style={portada.adjunto ? { backgroundImage: `url(/api/adjuntos/${portada.adjunto}/archivo)` } : undefined}>{titulo}</div>
  );
  const hayInsignias = t.vence || t.inicio || t.tiene_descripcion || t.n_comentarios > 0 || t.n_adjuntos > 0 || t.n_items > 0 || miembros.length > 0;
  return (
    <>
      {portada && (portada.adjunto ? <img className="portada" src={`/api/adjuntos/${portada.adjunto}/archivo`} alt="" loading="lazy" draggable={false} /> : <div className={`portada et c-${portada.color} i-2`} />)}
      {etiquetas.length > 0 && <div className="ets" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); alAlternarNombres(); }} title="Tocá para mostrar u ocultar los nombres">{etiquetas.map((e) => <ChipEtiqueta key={e.id} e={e} conNombre={nombres} />)}</div>}
      {titulo}
      {hayInsignias && (
        <div className="insignias">
          {(t.vence || t.inicio) && <span className={`ins fecha ${estado}`} title={estado ? `Vencimiento: ${estado}` : 'Fechas'}><Icono n="reloj" />{t.vence ? fechaCorta(t.vence).split(',')[0] : fechaCorta(t.inicio!)}</span>}
          {t.tiene_descripcion && <span className="ins" title="Tiene descripción"><Icono n="texto" /></span>}
          {t.n_comentarios > 0 && <span className="ins" title="Comentarios"><Icono n="burbuja" />{t.n_comentarios}</span>}
          {t.n_adjuntos > 0 && <span className="ins" title="Adjuntos"><Icono n="clip" />{t.n_adjuntos}</span>}
          {t.n_items > 0 && <span className={'ins' + (t.n_hechos === t.n_items ? ' fecha hecha' : '')} title="Ítems de checklist hechos"><Icono n="lista" />{t.n_hechos}/{t.n_items}</span>}
          {miembros.length > 0 && <span className="pila">{miembros.slice(0, 4).map((m) => <Avatar key={m.id} p={m} chica />)}</span>}
        </div>
      )}
    </>
  );
}

/** Caja para escribir tarjetas nuevas. Queda abierta para seguir cargando; si se pegan varios renglones ofrece crear una por renglón. */
function Componer({ alCrear, alCerrar }: { alCrear: (titulos: string[]) => void; alCerrar: () => void }) {
  const [texto, setTexto] = useState('');
  const caja = useRef<HTMLTextAreaElement>(null);
  const renglones = texto.split('\n').map((r) => r.trim()).filter(Boolean);
  const crear = (titulos: string[]) => {
    if (titulos.length === 0) return;
    alCrear(titulos);
    setTexto('');
    caja.current?.focus();
  };
  useEffect(() => { caja.current?.scrollIntoView({ block: 'nearest' }); }, []);
  return (
    <form className="componer" onSubmit={(e) => { e.preventDefault(); crear(renglones.length > 1 ? [renglones.join(' ')] : renglones); }}>
      <textarea ref={caja} autoFocus rows={2} value={texto} placeholder="Título de la tarjeta" aria-label="Título de la tarjeta nueva" maxLength={16000}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && renglones.length <= 1) { e.preventDefault(); crear(renglones); }
          if (e.key === 'Escape') { e.stopPropagation(); alCerrar(); }
        }}
        onBlur={() => { if (!texto.trim()) alCerrar(); }} />
      <div className="fila">
        {renglones.length > 1 ? (
          <>
            <button type="button" className="btn chico lleno" onClick={() => crear(renglones)}>Crear {renglones.length} tarjetas</button>
            <button type="submit" className="btn chico">Una sola</button>
          </>
        ) : <button type="submit" className="btn chico lleno">Agregar</button>}
        <button type="button" className="btn chico plano" onClick={alCerrar} aria-label="Cancelar">✕</button>
      </div>
    </form>
  );
}

/** Título de la lista: se toca para cambiarlo. */
function TituloLista({ l, puede, motor, alGuardar }: { l: Lista; puede: boolean; motor: Motor; alGuardar: (nombre: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(l.nombre);
  if (!editando) {
    return puede
      ? <h3 tabIndex={0} role="button" title="Tocá para cambiar el nombre" onClick={() => { if (!motor.recien()) { setValor(l.nombre); setEditando(true); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { setValor(l.nombre); setEditando(true); } }}>{l.nombre}</h3>
      : <h3>{l.nombre}</h3>;
  }
  const guardar = () => { setEditando(false); const n = valor.trim(); if (n && n !== l.nombre) alGuardar(n); };
  return <input type="text" className="titulo-lista" autoFocus value={valor} aria-label="Nombre de la lista" maxLength={16000} onFocus={(e) => e.target.select()}
    onChange={(e) => setValor(e.target.value)} onBlur={guardar}
    onKeyDown={(e) => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') { e.stopPropagation(); setEditando(false); } }} />;
}

function NuevaLista({ alCrear }: { alCrear: (nombre: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [nombre, setNombre] = useState('');
  if (!abierta) return <button type="button" className="lista nueva" onClick={() => setAbierta(true)}>+ Agregar lista</button>;
  return (
    <form className="lista nueva abierta" onSubmit={(e) => { e.preventDefault(); const n = nombre.trim(); if (n) { alCrear(n); setNombre(''); } }}>
      <input type="text" autoFocus value={nombre} placeholder="Nombre de la lista" aria-label="Nombre de la lista nueva" maxLength={16000} onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setAbierta(false); } }} onBlur={() => { if (!nombre.trim()) setAbierta(false); }} />
      <div className="fila"><button type="submit" className="btn chico lleno">Agregar lista</button><button type="button" className="btn chico plano" onClick={() => setAbierta(false)} aria-label="Cancelar">✕</button></div>
    </form>
  );
}

export function Listas({ d, ops, alAbrir }: { d: Datos; ops: Ops; alAbrir: (t: Tarjeta) => void }) {
  const puede = d.mi.puede.editar;
  const cont = useRef<HTMLDivElement>(null);
  const [arr, setArr] = useState<Arrastre | null>(null);
  const arrRef = useRef<Arrastre | null>(null);
  const [menu, setMenu] = useState<{ lista: string; ancla: DOMRect } | null>(null);
  const [componer, setComponer] = useState<{ lista: string; arriba: boolean } | null>(null);
  // Mostrar u ocultar los nombres de las etiquetas en los frentes: es una preferencia de cada persona en su dispositivo.
  const [nombres, setNombres] = useState(() => { try { return localStorage.getItem('etiquetas-nombres') !== 'no'; } catch { return true; } });
  const alternarNombres = () => setNombres((v) => { try { localStorage.setItem('etiquetas-nombres', v ? 'no' : 'si'); } catch { /* vale para esta visita */ } return !v; });

  const porLista = useMemo(() => {
    const m = new Map<string, Tarjeta[]>();
    for (const l of d.listas) m.set(l.id, []);
    for (const t of d.tarjetas) m.get(t.lista_id)?.push(t);
    return m;
  }, [d.listas, d.tarjetas]);

  // Al soltar: se calcula la posición nueva entre los vecinos y se manda un solo cambio.
  const soltar = useRef<(a: Arrastre) => void>(() => {});
  soltar.current = (a) => {
    if (a.tipo === 'tarjeta') {
      const t = d.tarjetas.find((x) => x.id === a.id);
      if (!t || !porLista.has(a.lista)) return;
      if (a.lista === t.lista_id && (porLista.get(t.lista_id) ?? []).indexOf(t) === a.indice) return;
      const otras = (porLista.get(a.lista) ?? []).filter((x) => x.id !== a.id);
      void ops.cambiarTarjeta(a.id, { lista_id: a.lista, posicion: posicionEntre(otras, a.indice) });
    } else {
      const l = d.listas.find((x) => x.id === a.id);
      if (!l || d.listas.indexOf(l) === a.indice) return;
      void ops.cambiarLista(a.id, { posicion: posicionEntre(d.listas.filter((x) => x.id !== a.id), a.indice) });
    }
  };
  const motor = useMemo(() => crearMotor({
    contenedor: () => cont.current,
    leer: () => arrRef.current,
    poner: (a) => { arrRef.current = a; setArr(a); },
    soltar: (a) => soltar.current(a),
  }), []);
  useEffect(() => () => motor.destruir(), [motor]);

  const columnas: ReactNode[] = [];
  let lugar = 0;
  const huecoLista = () => columnas.push(<div key="hueco" className="hueco-lista" style={{ height: arr!.alto }} />);
  for (const l of d.listas) {
    const levantada = arr?.tipo === 'lista' && arr.id === l.id;
    if (arr?.tipo === 'lista' && !levantada && lugar++ === arr.indice) huecoLista();
    const tarjetas = porLista.get(l.id) ?? [];
    const hojas: ReactNode[] = [];
    let sitio = 0;
    const aca = arr?.tipo === 'tarjeta' && arr.lista === l.id;
    const hueco = () => hojas.push(<div key="hueco" className="hueco-hoja" style={{ height: arr!.alto }} />);
    for (const t of tarjetas) {
      const arriba = arr?.tipo === 'tarjeta' && arr.id === t.id;
      if (aca && !arriba && sitio++ === arr.indice) hueco();
      hojas.push(
        <div key={t.id} className={'hoja' + (arriba ? ' levantada' : '') + (t.completada ? ' completada' : '')} data-tarjeta={t.id} role="button" tabIndex={0}
          onPointerDown={puede ? (e) => motor.apretar(e, 'tarjeta', t.id, e.currentTarget) : undefined}
          onClick={() => { if (!motor.recien()) alAbrir(t); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alAbrir(t); } }}>
          <Frente t={t} d={d} nombres={nombres} alAlternarNombres={alternarNombres} alCompletar={puede ? () => void ops.cambiarTarjeta(t.id, { completada: !t.completada }) : undefined} />
        </div>,
      );
    }
    if (aca && sitio <= arr.indice) hueco();
    const componiendo = componer?.lista === l.id ? componer : null;
    const caja = componiendo && <Componer key={componiendo.arriba ? 'arriba' : 'abajo'} alCerrar={() => setComponer(null)}
      alCrear={(titulos) => void ops.crearTarjetas(l.id, titulos, componiendo.arriba ? 'arriba' : 'abajo')} />;
    columnas.push(
      <section key={l.id} className={'lista' + (levantada ? ' levantada' : '')} data-lista={l.id} aria-label={`Lista ${l.nombre}`}>
        <header onPointerDown={puede ? (e) => motor.apretar(e, 'lista', l.id, e.currentTarget.parentElement!) : undefined}>
          <TituloLista l={l} puede={puede} motor={motor} alGuardar={(nombre) => void ops.cambiarLista(l.id, { nombre })} />
          {d.tablero.ajustes.conteo && <span className="n" title="Cantidad de tarjetas">{tarjetas.length}</span>}
          {puede && <button type="button" className="mas" aria-label={`Acciones de la lista ${l.nombre}`} onClick={(e) => setMenu({ lista: l.id, ancla: e.currentTarget.getBoundingClientRect() })}>···</button>}
        </header>
        {componiendo?.arriba && caja}
        <div className="hojas">{hojas}</div>
        {componiendo && !componiendo.arriba && caja}
        {puede && !componiendo && <button type="button" className="agregar" onClick={() => setComponer({ lista: l.id, arriba: false })}>+ Agregar tarjeta</button>}
      </section>,
    );
  }
  if (arr?.tipo === 'lista' && lugar <= arr.indice) huecoLista();

  const listaMenu = menu ? d.listas.find((l) => l.id === menu.lista) : undefined;
  return (
    <div className="listas" ref={cont}>
      {columnas}
      {puede && <NuevaLista alCrear={(nombre) => void ops.crearLista(nombre)} />}
      {d.listas.length === 0 && !puede && <p className="sin-listas">Este tablero todavía no tiene listas.</p>}
      {menu && listaMenu && <MenuLista d={d} lista={listaMenu} tarjetas={porLista.get(listaMenu.id) ?? []} ops={ops} ancla={menu.ancla} alCerrar={() => setMenu(null)}
        alAgregarArriba={() => { setComponer({ lista: listaMenu.id, arriba: true }); setMenu(null); }} />}
    </div>
  );
}
