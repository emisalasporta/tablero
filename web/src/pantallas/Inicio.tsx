// Inicio: mis espacios de trabajo y sus tableros. También el diálogo para crear un tablero.
import { useState } from 'react';
import { api, AYUDA_VIS, Campo, Dialogo, Enlace, Formulario, navegar, NOMBRE_VIS, useCarga } from '../base.tsx';

export interface EspacioResumen { id: string; nombre: string; descripcion: string; visibilidad: string; rol: string | null; invitado: boolean }
export interface TableroResumen { id: string; enlace: string; nombre: string; visibilidad: string; cerrado: boolean; mi_rol: string | null }
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

export function GrillaTableros({ espacio, lista }: { espacio: { id: string; nombre: string }; lista: ListaTableros }) {
  const [creando, setCreando] = useState(false);
  const abiertos = lista.tableros.filter((t) => !t.cerrado);
  const cerrados = lista.tableros.filter((t) => t.cerrado);
  const puede = Object.values(lista.puede_crear).some(Boolean);
  return (
    <>
      {abiertos.length === 0 && !puede ? <p className="suave">Todavía no hay tableros que puedas ver acá.</p> : (
        <div className="grilla">
          {abiertos.map((t) => (
            <Enlace key={t.id} a={`/t/${t.enlace}`} className="ficha"><b>{t.nombre}</b><span className="chapa">{NOMBRE_VIS[t.visibilidad]}</span></Enlace>
          ))}
          {puede && <button type="button" className="ficha nueva" onClick={() => setCreando(true)}><b>+ Tablero nuevo</b></button>}
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
  const [creando, setCreando] = useState(false);
  return (
    <main className="pagina">
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
