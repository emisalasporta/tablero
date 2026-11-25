// Arrastre de tarjetas y de listas, hecho a medida (sin librerías) para que funcione igual con mouse y con el dedo.
// - Mouse: se levanta al mover unos píxeles con el botón apretado.
// - Dedo: se levanta al mantener apretado un momento; si el dedo se mueve antes, es un desplazamiento normal.
// Mientras se arrastra, una copia sigue al puntero, se marca el hueco donde va a caer
// y el tablero se desplaza solo al acercarse a los bordes.

export interface Arrastre {
  tipo: 'tarjeta' | 'lista';
  id: string;
  /** Lista donde caería la tarjeta (vacío cuando se arrastra una lista). */
  lista: string;
  /** Lugar donde caería, contando solo lo que no se está arrastrando. */
  indice: number;
  alto: number;
}

interface Opciones {
  contenedor: () => HTMLElement | null;
  leer: () => Arrastre | null;
  poner: (a: Arrastre | null) => void;
  soltar: (a: Arrastre) => void;
}

interface Sesion {
  tipo: Arrastre['tipo']; id: string; el: HTMLElement; puntero: number; tactil: boolean; activo: boolean;
  x0: number; y0: number; x: number; y: number; dx: number; dy: number; ancho: number; alto: number;
  reloj: number; cuadro: number; copia: HTMLElement | null;
}

const ESPERA_DEDO = 280;
const BORDE = 56;

export function crearMotor(o: Opciones) {
  let s: Sesion | null = null;
  let recien = false;

  const columnas = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(':scope > [data-lista]')].filter((e) => !e.classList.contains('levantada'));
  const hojas = (col: HTMLElement) => [...col.querySelectorAll<HTMLElement>('[data-tarjeta]')].filter((e) => !e.classList.contains('levantada'));

  const cambiar = (lista: string, indice: number) => {
    if (!s) return;
    const a = o.leer();
    if (!a || a.lista !== lista || a.indice !== indice) o.poner({ tipo: s.tipo, id: s.id, lista, indice, alto: s.alto });
  };

  /** Según dónde está el puntero, decide en qué lugar caería lo que se arrastra. */
  const calcular = () => {
    const c = o.contenedor();
    if (!s?.activo || !c) return;
    const cols = columnas(c);
    if (s.tipo === 'lista') {
      let i = cols.length;
      for (let k = 0; k < cols.length; k++) {
        const r = cols[k].getBoundingClientRect();
        if (s.x < r.left + r.width / 2) { i = k; break; }
      }
      cambiar('', i);
      return;
    }
    if (cols.length === 0) return;
    let col = cols[0];
    let mejor = Infinity;
    for (const e of cols) {
      const r = e.getBoundingClientRect();
      const lejos = s.x < r.left ? r.left - s.x : s.x > r.right ? s.x - r.right : 0;
      if (lejos < mejor) { mejor = lejos; col = e; }
    }
    const hs = hojas(col);
    let i = hs.length;
    for (let k = 0; k < hs.length; k++) {
      const r = hs[k].getBoundingClientRect();
      if (s.y < r.top + r.height / 2) { i = k; break; }
    }
    cambiar(col.dataset.lista ?? '', i);
  };

  const colocar = () => {
    if (s?.copia) s.copia.style.transform = `translate3d(${s.x - s.dx}px, ${s.y - s.dy}px, 0) rotate(${s.tipo === 'tarjeta' ? 2 : 1}deg)`;
  };

  /** Desplaza el tablero (y la lista) cuando el puntero se acerca a un borde. */
  const tic = () => {
    const c = o.contenedor();
    if (!s?.activo) return;
    if (c) {
      let movio = false;
      const r = c.getBoundingClientRect();
      const vx = s.x < r.left + BORDE ? -1 : s.x > r.right - BORDE ? 1 : 0;
      if (vx) { const antes = c.scrollLeft; c.scrollLeft += vx * 14; movio = c.scrollLeft !== antes; }
      const a = o.leer();
      const caja = s.tipo === 'tarjeta' && a ? c.querySelector<HTMLElement>(`[data-lista="${a.lista}"] .hojas`) : null;
      if (caja) {
        const q = caja.getBoundingClientRect();
        const vy = s.y < q.top + 40 ? -1 : s.y > q.bottom - 40 ? 1 : 0;
        if (vy) { const antes = caja.scrollTop; caja.scrollTop += vy * 12; movio = movio || caja.scrollTop !== antes; }
      }
      if (movio) calcular();
    }
    s.cuadro = requestAnimationFrame(tic);
  };

  const empezar = () => {
    const c = o.contenedor();
    if (!s || s.activo || !c) return;
    s.activo = true;
    // Lugar de partida, medido antes de levantar nada.
    let lista = '';
    let indice: number;
    if (s.tipo === 'lista') indice = columnas(c).indexOf(s.el);
    else {
      const col = s.el.closest<HTMLElement>('[data-lista]');
      lista = col?.dataset.lista ?? '';
      indice = col ? hojas(col).indexOf(s.el) : 0;
    }
    const copia = s.el.cloneNode(true) as HTMLElement;
    copia.classList.add('fantasma');
    copia.removeAttribute('data-lista'); copia.removeAttribute('data-tarjeta');
    copia.querySelectorAll('[data-tarjeta]').forEach((e) => e.removeAttribute('data-tarjeta'));
    copia.style.width = `${s.ancho}px`;
    copia.style.height = `${Math.min(s.alto, window.innerHeight * 0.7)}px`;
    document.body.appendChild(copia);
    s.copia = copia;
    colocar();
    document.body.classList.add('arrastrando');
    c.classList.add('arrastrando');
    if (s.tactil) { try { navigator.vibrate?.(8); } catch { /* no todos los teléfonos vibran */ } }
    o.poner({ tipo: s.tipo, id: s.id, lista, indice: Math.max(0, indice), alto: s.alto });
    s.cuadro = requestAnimationFrame(tic);
  };

  const terminar = (confirmar: boolean) => {
    if (!s) return;
    const ses = s;
    s = null;
    clearTimeout(ses.reloj);
    cancelAnimationFrame(ses.cuadro);
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', subir);
    window.removeEventListener('pointercancel', cancelar);
    window.removeEventListener('keydown', tecla, true);
    ses.copia?.remove();
    document.body.classList.remove('arrastrando');
    o.contenedor()?.classList.remove('arrastrando');
    if (!ses.activo) return;
    // El clic que el navegador dispara al soltar no tiene que abrir la tarjeta.
    recien = true;
    setTimeout(() => { recien = false; }, 0);
    const a = o.leer();
    o.poner(null);
    if (confirmar && a) o.soltar(a);
  };

  function mover(e: PointerEvent) {
    if (!s || e.pointerId !== s.puntero) return;
    s.x = e.clientX; s.y = e.clientY;
    if (!s.activo) {
      const lejos = Math.hypot(s.x - s.x0, s.y - s.y0);
      if (s.tactil) { if (lejos > 8) terminar(false); return; }
      if (lejos < 5) return;
      empezar();
    }
    colocar();
    calcular();
  }
  function subir(e: PointerEvent) { if (s && e.pointerId === s.puntero) terminar(true); }
  function cancelar(e: PointerEvent) { if (s && e.pointerId === s.puntero) terminar(false); }
  function tecla(e: KeyboardEvent) { if (e.key === 'Escape' && s?.activo) { e.stopPropagation(); terminar(false); } }
  // Con el dedo: mientras se arrastra, la página no se tiene que desplazar por su cuenta.
  const alTocar = (e: TouchEvent) => { if (s?.activo && e.cancelable) e.preventDefault(); };
  const alMenu = (e: Event) => { if (s?.tactil) e.preventDefault(); };
  document.addEventListener('touchmove', alTocar, { passive: false });
  document.addEventListener('contextmenu', alMenu);

  return {
    /** Se llama al apretar sobre una tarjeta o sobre la cabecera de una lista. `el` es lo que se va a mover. */
    apretar(e: { button: number; isPrimary: boolean; pointerId: number; pointerType: string; clientX: number; clientY: number; target: EventTarget }, tipo: Arrastre['tipo'], id: string, el: HTMLElement) {
      if (s || e.button !== 0 || !e.isPrimary) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, button, a')) return;
      const r = el.getBoundingClientRect();
      const tactil = e.pointerType === 'touch';
      s = {
        tipo, id, el, puntero: e.pointerId, tactil, activo: false, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
        dx: e.clientX - r.left, dy: e.clientY - r.top, ancho: r.width, alto: r.height, cuadro: 0, copia: null,
        reloj: tactil ? window.setTimeout(empezar, ESPERA_DEDO) : 0,
      };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', subir);
      window.addEventListener('pointercancel', cancelar);
      window.addEventListener('keydown', tecla, true);
    },
    /** Verdadero justo después de soltar: sirve para ignorar el clic que viene pegado. */
    recien: () => recien,
    destruir() {
      terminar(false);
      document.removeEventListener('touchmove', alTocar);
      document.removeEventListener('contextmenu', alMenu);
    },
  };
}
export type Motor = ReturnType<typeof crearMotor>;
