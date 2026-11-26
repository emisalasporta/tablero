// Inicio: mis espacios de trabajo y sus tableros. También el diálogo para crear un tablero.
import { useState } from 'react';
import { api, AYUDA_VIS, Campo, Dialogo, Enlace, ErrorServidor, Formulario, navegar, NOMBRE_VIS, pintarFondo, subir, useCarga } from '../base.tsx';
import type { Fondo } from '../base.tsx';

export interface EspacioResumen { id: string; nombre: string; descripcion: string; visibilidad: string; rol: string | null; invitado: boolean }
export interface TableroResumen { id: string; enlace: string; nombre: string; visibilidad: string; cerrado: boolean; mi_rol: string | null; fondo?: Fondo; espacio?: string }

/** La ficha de un tablero, pintada con su fondo. */
export function Ficha({ t, abajo }: { t: TableroResumen; abajo: string }) {
  const f = pintarFondo(t.fondo);
  return <Enlace a={`/t/${t.enlace}`} className={'ficha' + f.clase} estilo={f.estilo}><b>{t.nombre}</b><span className="chapa">{abajo}</span></Enlace>;
}
export interface ListaTableros { tableros: TableroResumen[]; puede_crear: Record<string, boolean> }

export function CrearTablero({ espacio, puedeCrear, alCerrar }: { espacio: { id: string; nombre: string }; puedeCrear: Record<string, boolean>; alCerrar: () => void }) {
  const opciones = ['espacio', 'privado', 'publico'].filter((v) => puedeCrear[v]);
  const [nombre, setNombre] = useState('');
  const [vis, setVis] = useState(opciones[0] ?? 'espacio');
  return (
    <Dialogo titulo="Tablero nuevo" alCerrar={alCerrar}>
      <Formulario boton="Crear tablero" alEnviar={async () => {
        const r = await api<{ tablero: TableroResumen }>('POST', '/api/tableros', { espacio_id: espacio.id, nombre, visibilidad: vis });
        navegar(`/t/${r.tablero.enlace}`);
      }}>
        <p className="suave">En el espacio {espacio.nombre}.</p>
        <Campo rotulo="Nombre"><input id="tab-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required maxLength={200} /></Campo>
        <Campo rotulo="Quién lo ve" ayuda={AYUDA_VIS[vis]}>
          <select id="tab-vis" value={vis} onChange={(e) => setVis(e.target.value)}>{opciones.map((v) => <option key={v} value={v}>{NOMBRE_VIS[v]}</option>)}</select>
        </Campo>
      </Formulario>
    </Dialogo>
  );
}

interface Informe { tablero: { enlace: string; nombre: string }; entraron: Record<string, number>; personas_sin_cuenta: string[]; no_entro: string[]; avisos: string[] }
const QUE: [string, string, string][] = [['listas', 'lista', 'listas'], ['tarjetas', 'tarjeta', 'tarjetas'], ['etiquetas', 'etiqueta', 'etiquetas'], ['checklists', 'checklist', 'checklists'], ['items', 'ítem de checklist', 'ítems de checklist'], ['comentarios', 'comentario', 'comentarios'], ['adjuntos', 'adjunto', 'adjuntos'], ['actividad', 'movimiento del historial', 'movimientos del historial'], ['miembros', 'persona sumada al tablero', 'personas sumadas al tablero']];

/** Traer un tablero desde el archivo JSON que exporta Trello. Al terminar muestra qué entró y qué no. */
export function ImportarTrello({ espacio, puedeCrear, alCerrar }: { espacio: { id: string; nombre: string }; puedeCrear: Record<string, boolean>; alCerrar: () => void }) {
  const opciones = ['espacio', 'privado', 'publico'].filter((v) => puedeCrear[v]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vis, setVis] = useState(opciones[0] ?? 'espacio');
  const [repetir, setRepetir] = useState(false);
  const [informe, setInforme] = useState<Informe | null>(null);
  if (informe) {
    const e = informe.entraron;
    return (
      <Dialogo titulo="Tablero importado" alCerrar={alCerrar}>
        <div className="columna">
          <p>Se creó el tablero <b>{informe.tablero.nombre}</b> con:</p>
          <ul className="informe">{QUE.filter(([k]) => e[k] > 0).map(([k, uno, varios]) => <li key={k}><b>{e[k]}</b> {e[k] === 1 ? uno : varios}</li>)}</ul>
          {informe.no_entro.length > 0 && <><h3>Lo que no entró</h3><ul className="informe">{informe.no_entro.map((t) => <li key={t}>{t}</li>)}</ul></>}
          {informe.personas_sin_cuenta.length > 0 && <><h3>Personas sin cuenta acá</h3><p className="suave">{informe.personas_sin_cuenta.join(', ')}</p></>}
          {informe.avisos.map((t) => <p key={t} className="suave">{t}</p>)}
          <div className="fila"><button type="button" className="btn lleno" onClick={() => navegar(`/t/${informe.tablero.enlace}`)}>Abrir el tablero</button></div>
        </div>
      </Dialogo>
    );
  }
  return (
    <Dialogo titulo="Traer un tablero de Trello" alCerrar={alCerrar}>
      <Formulario boton={repetir ? 'Traerlo otra vez' : 'Importar'} alEnviar={async () => {
        if (!archivo) throw new Error('Elegí el archivo que exportaste de Trello.');
        try {
          const r = await subir<{ informe: Informe }>(`/api/espacios/${espacio.id}/importar/trello?visibilidad=${vis}${repetir ? '&repetir=1' : ''}`, archivo);
          setInforme(r.informe);
        } catch (err) {
          if (err instanceof ErrorServidor && err.codigo === 'ya_importado') setRepetir(true);
          throw err;
        }
      }}>
        <p className="suave">En Trello, abrí el tablero y andá a: menú (•••) → Imprimir, exportar y compartir → Exportar como JSON. Guardá el archivo y elegilo acá. Entra al espacio {espacio.nombre}.</p>
        <Campo rotulo="Archivo de Trello (.json)"><input id="imp-archivo" type="file" accept=".json,application/json" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setRepetir(false); }} required /></Campo>
        <Campo rotulo="Quién lo ve" ayuda={AYUDA_VIS[vis]}>
          <select id="imp-vis" value={vis} onChange={(e) => setVis(e.target.value)}>{opciones.map((v) => <option key={v} value={v}>{NOMBRE_VIS[v]}</option>)}</select>
        </Campo>
      </Formulario>
    </Dialogo>
  );
}

export function GrillaTableros({ espacio, lista }: { espacio: { id: string; nombre: string }; lista: ListaTableros }) {
  const [creando, setCreando] = useState(false);
  const [importando, setImportando] = useState(false);
  const abiertos = lista.tableros.filter((t) => !t.cerrado);
  const cerrados = lista.tableros.filter((t) => t.cerrado);
  const puede = Object.values(lista.puede_crear).some(Boolean);
  return (
    <>
      {abiertos.length === 0 && !puede ? <p className="suave">Todavía no hay tableros que puedas ver acá.</p> : (
        <div className="grilla">
          {abiertos.map((t) => (
            <Ficha key={t.id} t={t} abajo={NOMBRE_VIS[t.visibilidad]} />
          ))}
          {puede && <button type="button" className="ficha nueva" onClick={() => setCreando(true)}><b>+ Tablero nuevo</b></button>}
          {puede && <button type="button" className="ficha nueva" onClick={() => setImportando(true)}><b>Traer de Trello</b><span className="suave">Desde un archivo exportado</span></button>}
        </div>
      )}
      {cerrados.length > 0 && (
        <details>
          <summary className="suave" style={{ cursor: 'pointer' }}>Tableros cerrados ({cerrados.length})</summary>
          <div className="grilla" style={{ marginTop: 12 }}>
            {cerrados.map((t) => <Enlace key={t.id} a={`/t/${t.enlace}`} className="ficha cerrada"><b>{t.nombre}</b><span className="chapa">Cerrado</span></Enlace>)}
          </div>
        </details>
      )}
      {creando && <CrearTablero espacio={espacio} puedeCrear={lista.puede_crear} alCerrar={() => setCreando(false)} />}
      {importando && <ImportarTrello espacio={espacio} puedeCrear={lista.puede_crear} alCerrar={() => setImportando(false)} />}
    </>
  );
}

function BloqueEspacio({ e }: { e: EspacioResumen }) {
  const lista = useCarga<ListaTableros>(`/api/espacios/${e.id}/tableros`);
  return (
    <section className="columna">
      <div className="encabezado">
        <h2><Enlace a={`/e/${e.id}`}>{e.nombre}</Enlace></h2>
        {e.invitado ? <span className="chapa">Invitado</span> : e.rol === 'admin' ? <span className="chapa acento">Administrás</span> : null}
        <span className="hueco" />
        {!e.invitado && <Enlace a={`/e/${e.id}?ver=miembros`} className="btn chico">Miembros</Enlace>}
        {e.rol === 'admin' && <Enlace a={`/e/${e.id}?ver=ajustes`} className="btn chico">Ajustes</Enlace>}
      </div>
      {lista.datos && <GrillaTableros espacio={e} lista={lista.datos} />}
      {lista.error && <p className="error">{lista.error.message}</p>}
    </section>
  );
}

export function CrearEspacio({ alCerrar }: { alCerrar: () => void }) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  return (
    <Dialogo titulo="Espacio de trabajo nuevo" alCerrar={alCerrar}>
      <Formulario boton="Crear espacio" alEnviar={async () => {
        const r = await api<{ espacio: EspacioResumen }>('POST', '/api/espacios', { nombre, descripcion });
        navegar(`/e/${r.espacio.id}`);
      }}>
        <p className="suave">Un espacio de trabajo agrupa los tableros de un equipo o de un tema, con su propia gente.</p>
        <Campo rotulo="Nombre"><input id="esp-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus required maxLength={100} /></Campo>
        <Campo rotulo="Descripción (opcional)"><textarea id="esp-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={2000} /></Campo>
      </Formulario>
    </Dialogo>
  );
}

export function Inicio() {
  const espacios = useCarga<{ espacios: EspacioResumen[] }>('/api/espacios');
  const mios = useCarga<{ favoritos: TableroResumen[]; recientes: TableroResumen[] }>('/api/yo/tableros');
  const [creando, setCreando] = useState(false);
  const recientes = mios.datos?.recientes.filter((t) => !mios.datos!.favoritos.some((f) => f.id === t.id)) ?? [];
  return (
    <main className="pagina">
      {(mios.datos?.favoritos.length ?? 0) > 0 && <section className="columna"><h2>★ Favoritos</h2><div className="grilla">{mios.datos!.favoritos.map((t) => <Ficha key={t.id} t={t} abajo={t.espacio ?? ''} />)}</div></section>}
      {recientes.length > 0 && <section className="columna"><h2>Vistos hace poco</h2><div className="grilla">{recientes.slice(0, 4).map((t) => <Ficha key={t.id} t={t} abajo={t.espacio ?? ''} />)}</div></section>}
      <div className="encabezado"><h1>Tus espacios de trabajo</h1><span className="hueco" /><button type="button" className="btn" onClick={() => setCreando(true)}>Espacio nuevo</button></div>
      {espacios.error && <p className="error">{espacios.error.message}</p>}
      {espacios.datos?.espacios.length === 0 && (
        <div className="vacio">
          <p>Todavía no estás en ningún espacio de trabajo.</p>
          <button type="button" className="btn lleno" onClick={() => setCreando(true)}>Crear el primero</button>
        </div>
      )}
      {espacios.datos?.espacios.map((e) => <BloqueEspacio key={e.id} e={e} />)}
      {creando && <CrearEspacio alCerrar={() => setCreando(false)} />}
    </main>
  );
}
