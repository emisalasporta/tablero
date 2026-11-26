// Página de un tablero: cabecera (quién lo ve, su gente, sus permisos) y, abajo, las listas con sus tarjetas.
import { useEffect, useState } from 'react';
import { api, Avatar, AYUDA_VIS, Campo, CopiarEnlace, Dialogo, Enlace, ErrorServidor, Formulario, navegar, NOMBRE_ROL, NOMBRE_VIS, useAccion, useSesion } from '../base.tsx';
import { useTablero } from '../tablero/datos.ts';
import type { Datos, Permisos } from '../tablero/datos.ts';
import { Listas } from '../tablero/Listas.tsx';
import { DialogoArchivados } from '../tablero/Menus.tsx';
import { describir, hace } from '../tablero/piezas.tsx';
import type { Actividad } from '../tablero/piezas.tsx';
import { DialogoTarjeta, PanelEtiquetas } from '../tablero/Tarjeta.tsx';
import { Entrar } from './Entrar.tsx';

function Compartir({ d, alCambiar, alCerrar }: { d: Datos; alCambiar: () => void; alCerrar: () => void }) {
  const { yo } = useSesion();
  const t = d.tablero;
  const accion = useAccion();
  const [quien, setQuien] = useState('');
  const [rol, setRol] = useState('normal');
  const [rolEnlace, setRolEnlace] = useState('normal');
  const [enlace, setEnlace] = useState<string | null>(null);
  const con = (f: () => Promise<unknown>) => accion.hacer(async () => { await f(); alCambiar(); });
  return (
    <Dialogo titulo="Compartir el tablero" alCerrar={alCerrar}>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      {d.pedidos.length > 0 && (
        <div className="columna" style={{ gap: 6 }}>
          <p className="rotulo">Pidieron acceso</p>
          <ul className="renglones">{d.pedidos.map((p) => (
            <li key={p.id}><Avatar p={p.persona} /><span className="quien"><b>{p.persona.nombre}</b><small>@{p.persona.usuario}</small></span>
              <button type="button" className="btn chico lleno" onClick={() => con(() => api('PATCH', `/api/pedidos/${p.id}`, { estado: 'aprobado' }))}>Aprobar</button>
              <button type="button" className="btn chico" onClick={() => con(() => api('PATCH', `/api/pedidos/${p.id}`, { estado: 'rechazado' }))}>Rechazar</button></li>
          ))}</ul>
        </div>
      )}
      {d.mi.puede.invitar && (
        <Formulario boton="Sumar al tablero" alEnviar={async () => { await api('POST', `/api/tableros/${t.id}/miembros`, { quien, rol }); setQuien(''); alCambiar(); }}>
          <Campo rotulo="Sumar a alguien que ya tiene cuenta" ayuda="Su correo o su nombre de usuario exacto."><input id="comp-quien" type="text" value={quien} onChange={(e) => setQuien(e.target.value)} required /></Campo>
          <Campo rotulo="Como">
            <select id="comp-rol" value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="normal">Miembro: ve y edita</option><option value="observador">Observa: ve, no edita</option>{d.mi.puede.administrar && <option value="admin">Administra</option>}
            </select>
          </Campo>
        </Formulario>
      )}
      {d.mi.puede.invitar_de_afuera && (
        <div className="columna" style={{ gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
          <p><b>Enlace de invitación</b></p>
          <p className="suave">Quien lo abra entra a este tablero (si no tiene cuenta, la crea). Crear uno nuevo anula el anterior.</p>
          {enlace && <CopiarEnlace url={enlace} />}
          <div className="fila">
            <select aria-label="Rol del enlace" value={rolEnlace} onChange={(e) => setRolEnlace(e.target.value)}><option value="normal">Entra como miembro</option><option value="observador">Entra como observador</option></select>
            <button type="button" className="btn" onClick={() => accion.hacer(async () => { const r = await api<{ token: string }>('POST', `/api/tableros/${t.id}/invitacion`, { rol: rolEnlace }); setEnlace(`${location.origin}/invitacion/${r.token}`); })}>Crear enlace</button>
            <button type="button" className="btn peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/tableros/${t.id}/invitacion`); setEnlace(null); })}>Anular enlace</button>
          </div>
        </div>
      )}
      <div className="columna" style={{ gap: 6, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
        <p className="rotulo">En el tablero ({d.miembros.length})</p>
        <ul className="renglones">{d.miembros.map((m) => (
          <li key={m.id}>
            <Avatar p={m} />
            <span className="quien"><b>{m.nombre}{m.id === yo?.id ? ' (vos)' : ''}</b><small>@{m.usuario}{m.invitado ? ' · invitado' : ''}</small></span>
            {d.mi.puede.administrar ? (
              <select aria-label={`Rol de ${m.nombre}`} value={m.rol} onChange={(e) => con(() => api('PATCH', `/api/tableros/${t.id}/miembros/${m.id}`, { rol: e.target.value }))}>
                <option value="admin">Administra</option><option value="normal">Miembro</option><option value="observador">Observa</option>
              </select>
            ) : <span className="chapa">{NOMBRE_ROL[m.rol]}</span>}
            {(m.id === yo?.id || d.mi.puede.administrar || (d.mi.puede.invitar && m.rol !== 'admin')) && (
              <button type="button" className="btn chico peligro" onClick={() => con(() => api('DELETE', `/api/tableros/${t.id}/miembros/${m.id}`))}>{m.id === yo?.id ? 'Salir' : 'Quitar'}</button>
            )}
          </li>
        ))}</ul>
      </div>
    </Dialogo>
  );
}

const COMENTAR: [string, string][] = [['nadie', 'Nadie'], ['miembros', 'Miembros del tablero'], ['observadores', 'Miembros y observadores'], ['espacio', 'Miembros del espacio de trabajo'], ['cualquiera', 'Cualquier persona con cuenta']];

function Ajustes({ d, alCambiar, alCerrar }: { d: Datos; alCambiar: () => void; alCerrar: () => void }) {
  const t = d.tablero;
  const [nombre, setNombre] = useState(t.nombre);
  const [vis, setVis] = useState(t.visibilidad);
  const [p, setP] = useState<Permisos>(t.permisos);
  const [aj, setAj] = useState(t.ajustes);
  const accion = useAccion();
  return (
    <Dialogo titulo="Ajustes del tablero" alCerrar={alCerrar}>
      <Formulario boton="Guardar" alEnviar={async () => { await api('PATCH', `/api/tableros/${t.id}`, { nombre, visibilidad: vis, permisos: p, ajustes: aj }); alCambiar(); alCerrar(); }}>
        <Campo rotulo="Nombre"><input id="ta-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={200} /></Campo>
        <Campo rotulo="Quién lo ve" ayuda={AYUDA_VIS[vis]}>
          <select id="ta-vis" value={vis} onChange={(e) => setVis(e.target.value)}>{['privado', 'espacio', 'publico'].map((v) => <option key={v} value={v}>{NOMBRE_VIS[v]}</option>)}</select>
        </Campo>
        <Campo rotulo="Quién puede comentar">
          <select id="ta-comentar" value={p.comentar} onChange={(e) => setP({ ...p, comentar: e.target.value })}>{COMENTAR.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </Campo>
        <Campo rotulo="Quién puede sumar y quitar gente">
          <select id="ta-invitar" value={p.invitar} onChange={(e) => setP({ ...p, invitar: e.target.value })}><option value="miembros">Cualquier miembro del tablero</option><option value="admins">Solo quien administra</option></select>
        </Campo>
        <label className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input id="ta-edicion" type="checkbox" checked={p.edicion_espacio} onChange={(e) => setP({ ...p, edicion_espacio: e.target.checked })} /><span>Los miembros del espacio pueden editar sin estar sumados al tablero <small className="suave">(no aplica si es privado)</small></span></label>
        <label className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input id="ta-union" type="checkbox" checked={p.union_libre} onChange={(e) => setP({ ...p, union_libre: e.target.checked })} /><span>Los miembros del espacio pueden sumarse solos <small className="suave">(no aplica si es privado)</small></span></label>
        <label className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input id="ta-portadas" type="checkbox" checked={aj.portadas} onChange={(e) => setAj({ ...aj, portadas: e.target.checked })} /><span>Mostrar las portadas en las tarjetas del tablero</span></label>
        <label className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><input id="ta-tilde" type="checkbox" checked={aj.tilde} onChange={(e) => setAj({ ...aj, tilde: e.target.checked })} /><span>Mostrar el círculo para marcar como completada en cada tarjeta</span></label>
      </Formulario>
      <div className="columna" style={{ gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 14 }}>
        <p><b>{t.cerrado ? 'Tablero cerrado' : 'Cerrar el tablero'}</b></p>
        <p className="suave">{t.cerrado ? 'Podés reabrirlo o borrarlo para siempre.' : 'Queda guardado sin que nadie pueda editarlo. Se puede reabrir cuando quieras.'}</p>
        {accion.error && <p className="error" role="alert">{accion.error}</p>}
        <div className="fila">
          <button type="button" className="btn" onClick={() => accion.hacer(async () => { await api('PATCH', `/api/tableros/${t.id}`, { cerrado: !t.cerrado }); alCambiar(); alCerrar(); })}>{t.cerrado ? 'Reabrir' : 'Cerrar tablero'}</button>
          {t.cerrado && d.mi.puede.borrar && <button type="button" className="btn peligro" onClick={() => accion.hacer(async () => { await api('DELETE', `/api/tableros/${t.id}`); navegar(`/e/${d.espacio.id}`); })}>Borrar para siempre</button>}
        </div>
      </div>
    </Dialogo>
  );
}

/** Actividad del tablero: todo lo que pasó, o solo los comentarios. Se carga de a 50. */
function DialogoActividad({ d, alAbrir, alCerrar }: { d: Datos; alAbrir: (enlace: string) => void; alCerrar: () => void }) {
  const [solo, setSolo] = useState(false);
  const [filas, setFilas] = useState<Actividad[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const accion = useAccion();
  const traer = (desde: Actividad[]) => accion.hacer(async () => {
    const antes = desde.length ? `&antes=${encodeURIComponent(desde[desde.length - 1].creado_en)}` : '';
    const r = await api<{ actividad: Actividad[]; hay_mas: boolean }>('GET', `/api/tableros/${d.tablero.id}/actividad?${solo ? 'solo=comentarios' : ''}${antes}`);
    setFilas([...desde, ...r.actividad]); setHayMas(r.hay_mas);
  });
  useEffect(() => { void traer([]); }, [solo]);
  return (
    <Dialogo titulo="Actividad del tablero" alCerrar={alCerrar}>
      <div className="pestanas" role="tablist"><button type="button" role="tab" aria-selected={!solo} onClick={() => setSolo(false)}>Todo</button><button type="button" role="tab" aria-selected={solo} onClick={() => setSolo(true)}>Solo comentarios</button></div>
      {accion.error && <p className="error" role="alert">{accion.error}</p>}
      {!accion.ocupado && filas.length === 0 && <p className="suave">Todavía no hay nada.</p>}
      <ul className="linea">{filas.map((a) => (
        <li key={a.id} className="hecho-menor">{a.actor ? <Avatar p={a.actor} chica /> : <span className="per chica" />}
          <p><b>{a.actor?.nombre ?? 'Alguien'}</b> {describir(a, false)} <small className="suave" title={new Date(a.creado_en).toLocaleString('es-AR')}>· {hace(a.creado_en)}</small>
            {a.tarjeta_enlace && <> · <button type="button" className="como-enlace" onClick={() => alAbrir(a.tarjeta_enlace!)}>abrir tarjeta</button></>}</p></li>
      ))}</ul>
      {hayMas && <div><button type="button" className="btn" disabled={accion.ocupado} onClick={() => void traer(filas)}>Cargar más</button></div>}
    </Dialogo>
  );
}

export function Tablero({ enlace, deTarjeta }: { enlace?: string; /** Código de una tarjeta: se abre sobre su tablero. */ deTarjeta?: string }) {
  const { yo } = useSesion();
  // Cuál es el tablero: viene en la dirección, o se averigua a partir de la tarjeta.
  const [tableroDe, setTableroDe] = useState<string | null>(enlace ?? null);
  const [errorTarjeta, setErrorTarjeta] = useState<ErrorServidor | null>(null);
  useEffect(() => { if (enlace) { setTableroDe(enlace); setErrorTarjeta(null); } }, [enlace]);
  useEffect(() => {
    if (!deTarjeta) return;
    let vigente = true;
    api<{ tablero: { enlace: string } }>('GET', `/api/tarjetas/${deTarjeta}`)
      .then((r) => { if (vigente) { setTableroDe(r.tablero.enlace); setErrorTarjeta(null); } })
      .catch((e) => { if (vigente) setErrorTarjeta(e instanceof ErrorServidor ? e : new ErrorServidor(0, 'error', 'No se pudo abrir la tarjeta.')); });
    return () => { vigente = false; };
  }, [deTarjeta]);
  const datos = useTablero(tableroDe);
  const accion = useAccion();
  const [abierto, setAbierto] = useState<'compartir' | 'ajustes' | 'archivados' | 'actividad' | 'etiquetas' | null>(null);
  const [pedido, setPedido] = useState(false);
  const aca = enlace ? `/t/${enlace}` : `/c/${deTarjeta}`;
  const falla = datos.error ?? (tableroDe ? null : errorTarjeta);

  if (falla) {
    if (falla.estado === 401) return <Entrar volverA={aca} />;
    if (falla.codigo === 'sin_acceso' && !enlace) return <main className="pagina"><h1>Esta tarjeta está en un tablero privado</h1><p className="suave">Pedile a quien te pasó el enlace que te sume al tablero.</p><Enlace a="/">Volver al inicio</Enlace></main>;
    if (falla.codigo === 'sin_acceso') return (
      <main className="pagina angosta"><div className="panel angosto">
        <h1>Este tablero es privado</h1>
        <p className="suave">Estás como {yo?.nombre}. Podés pedir acceso y alguien del tablero lo va a ver.</p>
        {accion.error && <p className="error" role="alert">{accion.error}</p>}
        {pedido ? <p className="ok">Pedido enviado. Cuando lo aprueben vas a poder entrar.</p> : <div><button type="button" className="btn lleno" onClick={() => accion.hacer(async () => { await api('POST', `/api/tableros/${enlace}/pedidos`); setPedido(true); })}>Pedir acceso</button></div>}
        <Enlace a="/">Volver al inicio</Enlace>
      </div></main>
    );
    if (falla.estado !== 404) return <main className="pagina"><h1>No se pudo abrir el tablero</h1><p className="suave">{falla.message}</p><div><button type="button" className="btn lleno" onClick={() => void datos.recargar()}>Probar de nuevo</button></div></main>;
    return <main className="pagina"><h1>{enlace ? 'No encontramos ese tablero' : 'No encontramos esa tarjeta'}</h1><p className="suave">Puede que lo hayan borrado o que el enlace esté mal.</p><Enlace a="/">Volver al inicio</Enlace></main>;
  }
  if (!datos.datos) return null;
  const d = datos.datos;
  const t = d.tablero;
  const abrirTarjeta = (codigo: string) => navegar(`/c/${codigo}`);
  const cerrarTarjeta = () => navegar(`/t/${t.enlace}`);
  return (
    <div className="tablero">
      {t.cerrado && <div className="franja">Este tablero está cerrado: se puede ver pero no editar.{d.mi.puede.administrar && <button type="button" className="btn chico" onClick={() => accion.hacer(async () => { await api('PATCH', `/api/tableros/${t.id}`, { cerrado: false }); datos.recargar(); })}>Reabrir</button>}</div>}
      <div className="cab">
        <h1>{t.nombre}</h1>
        <span className="chapa" title={AYUDA_VIS[t.visibilidad]}>{NOMBRE_VIS[t.visibilidad]}</span>
        {yo && <Enlace a={`/e/${d.espacio.id}`} className="suave">{d.espacio.nombre}</Enlace>}
        {!datos.enLinea && <span className="chapa marcador" title="Lo que cambien otras personas no se ve hasta que vuelva la conexión">Sin conexión · reintentando</span>}
        <span className="hueco" />
        <span className="pila">{d.miembros.slice(0, 6).map((m) => <Avatar key={m.id} p={m} chica />)}</span>
        {d.miembros.length > 6 && <span className="chapa">+{d.miembros.length - 6}</span>}
        {d.mi.puede.unirse && <button type="button" className="btn" onClick={() => accion.hacer(async () => { await api('POST', `/api/tableros/${t.id}/unirse`); datos.recargar(); })}>Sumarme</button>}
        {yo && d.mi.rol !== null && <button type="button" className="btn lleno" onClick={() => setAbierto('compartir')}>Compartir{d.pedidos.length > 0 ? ` (${d.pedidos.length})` : ''}</button>}
        {yo && d.mi.rol === null && d.mi.puede.invitar && <button type="button" className="btn lleno" onClick={() => setAbierto('compartir')}>Compartir</button>}
        <button type="button" className="btn" onClick={() => setAbierto('etiquetas')}>Etiquetas</button>
        <button type="button" className="btn" onClick={() => setAbierto('actividad')}>Actividad</button>
        <button type="button" className="btn" onClick={() => setAbierto('archivados')}>Archivados</button>
        {d.mi.puede.administrar && <button type="button" className="btn" onClick={() => setAbierto('ajustes')}>Ajustes</button>}
        {!yo && <Enlace a="/entrar" className="btn">Entrar</Enlace>}
      </div>
      {accion.error && <p className="error en-tablero" role="alert">{accion.error}</p>}
      <Listas d={d} ops={datos.ops} alAbrir={(c) => abrirTarjeta(c.enlace)} />
      {datos.aviso && <div className="aviso-flotante" role="alert"><span>{datos.aviso}</span><button type="button" className="btn chico" onClick={datos.cerrarAviso}>Entendido</button></div>}
      {deTarjeta && <DialogoTarjeta key={deTarjeta} d={d} cual={deTarjeta} frente={d.tarjetas.find((c) => c.enlace === deTarjeta || c.id === deTarjeta)} ops={datos.ops} alCambiarTablero={datos.recargar} alCerrar={cerrarTarjeta} />}
      {abierto === 'actividad' && <DialogoActividad d={d} alAbrir={(c) => { setAbierto(null); abrirTarjeta(c); }} alCerrar={() => setAbierto(null)} />}
      {abierto === 'etiquetas' && <Dialogo titulo="Etiquetas del tablero" alCerrar={() => setAbierto(null)}><PanelEtiquetas d={d} alCambiar={datos.recargar} /></Dialogo>}
      {abierto === 'archivados' && <DialogoArchivados d={d} alCambiar={datos.recargar} alCerrar={() => setAbierto(null)} />}
      {abierto === 'compartir' && <Compartir d={d} alCambiar={datos.recargar} alCerrar={() => setAbierto(null)} />}
      {abierto === 'ajustes' && <Ajustes d={d} alCambiar={datos.recargar} alCerrar={() => setAbierto(null)} />}
    </div>
  );
}
