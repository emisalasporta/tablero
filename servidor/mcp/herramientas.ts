// La puerta de Alex, parte 2: la lista de herramientas.
// Cada herramienta es una acción de la app, y por dentro llama a la misma ruta /api que usan las pantallas:
// mismas reglas, mismos permisos, misma actividad. Acá no se decide nada: solo se describe.
//
// REGLA DEL PROYECTO: ruta nueva en /api = herramienta nueva acá, en la misma tanda.
// La prueba pruebas/puerta.test.ts falla si una ruta queda sin herramienta y sin estar en EXCLUIDAS.

type Esquema = Record<string, unknown>;
export interface Herramienta {
  nombre: string;
  titulo: string;
  descripcion: string;
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Ruta de la app, con los datos que van en la dirección entre llaves: /api/tarjetas/{tarjeta_id} */
  ruta: string;
  /** Datos que viajan como ?clave=valor. */
  consulta: string[];
  props: Record<string, Esquema>;
  requeridos: string[];
  /** Solo mira, no cambia nada. */
  lee: boolean;
  /** Borra o anula algo que no se puede recuperar. */
  borra: boolean;
  /** Sube un archivo: llega en `base64` y se manda crudo. */
  sube?: boolean;
  /** Baja un archivo: se devuelve como texto o imagen si es chico. */
  baja?: boolean;
  /** Datos que la ruta espera con otro nombre: { como_lo_dice_la_herramienta: como_lo_espera_la_ruta }. */
  renombrar?: Record<string, string>;
  /** Recorta la respuesta antes de devolverla. */
  despues?: (json: any, args: Record<string, unknown>) => unknown;
}

const s = (description: string, extra: Esquema = {}): Esquema => ({ type: 'string', description, ...extra });
const b = (description: string): Esquema => ({ type: 'boolean', description });
const o = (description: string, valores: readonly string[]): Esquema => ({ type: 'string', enum: [...valores], description });
const obj = (description: string, properties: Record<string, Esquema> = {}): Esquema => ({ type: 'object', description, properties });
const POS: Esquema = { description: 'Dónde queda: "arriba", "abajo" o un número de posición. Cada elemento informa su `posicion`; para ponerlo entre dos, usá un número intermedio.', anyOf: [{ type: 'string', enum: ['arriba', 'abajo'] }, { type: 'number' }] };
const B64 = s('Contenido del archivo en base64.');

const TABLERO = s('Identificador del tablero, o el código corto de su dirección (/t/código).');
const TARJETA = s('Identificador de la tarjeta, o el código corto de su dirección (/c/código).');
const ESPACIO = s('Identificador del espacio de trabajo.');
const LISTA = s('Identificador de la lista.');
const PERSONA = s('Identificador de la persona.');
const QUIEN = s('Correo o nombre de usuario de la persona (alternativa a usuario_id).');
const VIS = ['privado', 'espacio', 'publico'] as const;
const TRES = ['miembros', 'admins', 'nadie'] as const;
const porVis = (d: string) => obj(d, { privado: o('', TRES), espacio: o('', TRES), publico: o('', TRES) });
const COLORES = 'rojo, naranja, amarillo, lima, verde, turquesa, celeste, azul, violeta, rosa';

export const HERRAMIENTAS: Herramienta[] = [];
function h(nombre: string, donde: string, titulo: string, descripcion: string, props: Record<string, Esquema> = {}, extra: Partial<Herramienta> = {}) {
  const [metodo, ruta] = donde.split(' ') as [Herramienta['metodo'], string];
  const enRuta = [...ruta.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  for (const p of [...enRuta, ...(extra.requeridos ?? [])]) if (!props[p]) throw new Error(`${nombre}: falta describir ${p}`);
  HERRAMIENTAS.push({
    nombre, titulo, descripcion, metodo, ruta, consulta: [], props, lee: metodo === 'GET', borra: metodo === 'DELETE',
    ...extra, requeridos: [...enRuta, ...(extra.requeridos ?? [])],
  });
}

// ---------- la app y la cuenta de Alex ----------
h('estado', 'GET /api/salud', 'Estado de la app', 'Dice si la app responde, qué versión está publicada y la hora del servidor.');
h('yo_ver', 'GET /api/yo', 'Mi cuenta', 'Los datos de la cuenta con la que estás actuando (Alex).');
h('yo_cambiar', 'PATCH /api/yo', 'Cambiar mi cuenta', 'Cambia el nombre, el nombre de usuario, la biografía o la zona horaria de la cuenta de Alex.',
  { nombre: s('Nombre a mostrar.'), usuario: s('Nombre de usuario para menciones: 3 a 30 letras minúsculas, números o guion bajo.'), bio: s('Biografía.'), zona_horaria: s('Zona horaria, como America/Argentina/Buenos_Aires.') });
h('yo_foto_subir', 'POST /api/yo/avatar', 'Poner mi foto', 'Pone una foto de perfil a la cuenta de Alex (PNG, JPG, GIF o WebP, hasta 5 MB).', { base64: B64 }, { sube: true, requeridos: ['base64'] });
h('yo_foto_quitar', 'DELETE /api/yo/avatar', 'Quitar mi foto', 'Quita la foto de perfil de la cuenta de Alex.');
h('mis_tableros', 'GET /api/yo/tableros', 'Mis favoritos y recientes', 'Los tableros que Alex marcó como favoritos y los últimos que abrió.');
h('tableros_editables', 'GET /api/yo/tableros-editables', 'Todos los tableros abiertos', 'Lista TODOS los tableros abiertos de la instalación (con su espacio). Es la forma más rápida de encontrar un tablero por nombre.');

// ---------- cuidar la instalación ----------
h('respaldos_ver', 'GET /api/admin/respaldos', 'Ver los respaldos', 'Lista los respaldos guardados en el servidor, cuál fue el último y cómo está la copia fuera del servidor (si está encendida, cuándo salió bien por última vez y el último error).');
h('respaldo_hacer', 'POST /api/admin/respaldos', 'Hacer un respaldo ahora', 'Hace en el momento una copia de la base de datos (y la sube afuera si la copia externa está encendida). Conviene antes de un cambio grande.');
h('servidor_ver', 'GET /api/admin/servidor', 'Estado del servidor', 'Qué versión está corriendo y desde cuándo, las últimas publicaciones en Dokploy (con su estado: done, error, running) y los últimos errores que tuvo la app.');
h('servidor_publicar', 'POST /api/admin/servidor/publicar', 'Volver a publicar', 'Le pide a Dokploy que arme y publique de nuevo lo que hay en la rama main. La app se reinicia al terminar. Usalo solo si una publicación quedó trabada o falló por algo pasajero.');

// ---------- personas (administración general) ----------
h('personas_listar', 'GET /api/admin/usuarios', 'Todas las cuentas', 'Lista todas las cuentas de la instalación, con correo.');
h('persona_buscar', 'GET /api/usuarios/buscar', 'Buscar una persona', 'Busca una cuenta por correo exacto o nombre de usuario exacto.', { q: s('Correo o nombre de usuario.') }, { consulta: ['q'], requeridos: ['q'] });
h('invitacion_cuenta_crear', 'POST /api/admin/invitaciones', 'Enlace para crear cuenta', 'Crea un enlace para que alguien cree su cuenta sin entrar todavía a ningún espacio. Devuelve `token`: el enlace es <dirección de la app>/invitacion/<token>. Crear uno nuevo anula el anterior.');
h('persona_clave_temporal', 'POST /api/admin/usuarios/{usuario_id}/clave-temporal', 'Dar contraseña temporal', 'Para quien olvidó su contraseña: genera una temporal, cierra sus sesiones y la obliga a cambiarla al entrar. Hacelo solo si Emiliano lo pide expresamente.', { usuario_id: PERSONA }, { borra: true });

// ---------- espacios de trabajo ----------
h('espacios_todos', 'GET /api/admin/espacios', 'Todos los espacios', 'Lista TODOS los espacios de trabajo de la instalación, con cuántos miembros y tableros tiene cada uno.');
h('espacios_mios', 'GET /api/espacios', 'Espacios donde está Alex', 'Los espacios donde la cuenta de Alex es miembro o invitada.');
h('espacio_crear', 'POST /api/espacios', 'Crear un espacio', 'Crea un espacio de trabajo. Alex queda como administrador.', { nombre: s('Nombre del espacio.'), descripcion: s('Descripción.') }, { requeridos: ['nombre'] });
h('espacio_ver', 'GET /api/espacios/{espacio_id}', 'Ver un espacio', 'Datos y ajustes de un espacio de trabajo.', { espacio_id: ESPACIO });
h('espacio_cambiar', 'PATCH /api/espacios/{espacio_id}', 'Cambiar un espacio', 'Cambia nombre, descripción, sitio web, visibilidad o ajustes de un espacio. Solo se cambia lo que se manda.',
  { espacio_id: ESPACIO, nombre: s('Nombre.'), descripcion: s('Descripción.'), sitio_web: s('Sitio web (http:// o https://).'), visibilidad: o('Quién puede ver el espacio.', ['privado', 'publico']),
    ajustes: obj('Reglas del espacio.', { crear: porVis('Quién puede crear tableros de cada visibilidad.'), borrar: porVis('Quién puede borrar tableros de cada visibilidad ("miembros" = quien administra ese tablero).'), invitados: o('Quién puede sumar a un tablero a gente de afuera del espacio.', ['miembros', 'admins']) }) });
h('espacio_borrar', 'DELETE /api/espacios/{espacio_id}', 'Borrar un espacio', 'Borra un espacio para siempre. Solo si no tiene tableros abiertos.', { espacio_id: ESPACIO });
h('espacio_tableros', 'GET /api/espacios/{espacio_id}/tableros', 'Tableros de un espacio', 'Lista los tableros de un espacio (abiertos y cerrados).', { espacio_id: ESPACIO });
h('espacio_miembros', 'GET /api/espacios/{espacio_id}/miembros', 'Gente de un espacio', 'Miembros, invitados y pedidos de acceso pendientes de un espacio.', { espacio_id: ESPACIO });
h('espacio_miembro_sumar', 'POST /api/espacios/{espacio_id}/miembros', 'Sumar al espacio', 'Suma al espacio a alguien que ya tiene cuenta.', { espacio_id: ESPACIO, usuario_id: PERSONA, quien: QUIEN, rol: o('Rol en el espacio.', ['admin', 'normal']) });
h('espacio_miembro_cambiar', 'PATCH /api/espacios/{espacio_id}/miembros/{usuario_id}', 'Cambiar a un miembro del espacio', 'Cambia el rol de un miembro o lo desactiva (conserva su historial pero no entra).', { espacio_id: ESPACIO, usuario_id: PERSONA, rol: o('Rol.', ['admin', 'normal']), desactivado: b('Desactivado.') });
h('espacio_miembro_quitar', 'DELETE /api/espacios/{espacio_id}/miembros/{usuario_id}', 'Quitar del espacio', 'Quita a alguien del espacio.', { espacio_id: ESPACIO, usuario_id: PERSONA, de_tableros: o('Con "1" también lo quita de todos los tableros del espacio.', ['1']) }, { consulta: ['de_tableros'] });
h('espacio_invitacion_ver', 'GET /api/espacios/{espacio_id}/invitacion', 'Ver enlace de invitación del espacio', 'Dice si el espacio tiene un enlace de invitación vivo y cuántas veces se usó (no muestra el enlace).', { espacio_id: ESPACIO });
h('espacio_invitacion_crear', 'POST /api/espacios/{espacio_id}/invitacion', 'Crear enlace de invitación al espacio', 'Crea el enlace de invitación del espacio (anula el anterior). Devuelve `token`: el enlace es <dirección de la app>/invitacion/<token>.', { espacio_id: ESPACIO });
h('espacio_invitacion_anular', 'DELETE /api/espacios/{espacio_id}/invitacion', 'Anular enlace de invitación del espacio', 'Anula el enlace de invitación del espacio.', { espacio_id: ESPACIO });
h('espacio_logo_subir', 'POST /api/espacios/{espacio_id}/logo', 'Poner logo al espacio', 'Pone el logo del espacio (PNG, JPG, GIF o WebP, hasta 5 MB).', { espacio_id: ESPACIO, base64: B64 }, { sube: true, requeridos: ['base64'] });
h('espacio_logo_quitar', 'DELETE /api/espacios/{espacio_id}/logo', 'Quitar logo del espacio', 'Quita el logo del espacio.', { espacio_id: ESPACIO });
h('pedido_responder', 'PATCH /api/pedidos/{pedido_id}', 'Responder un pedido de acceso', 'Aprueba o rechaza un pedido de acceso a un espacio o a un tablero. Los pedidos pendientes se ven con espacio_miembros o tablero_ver.', { pedido_id: s('Identificador del pedido.'), estado: o('Respuesta.', ['aprobado', 'rechazado']) }, { requeridos: ['estado'] });

// ---------- tableros ----------
h('tablero_importar_trello', 'POST /api/espacios/{espacio_id}/importar/trello', 'Traer un tablero de Trello', 'Crea un tablero nuevo a partir del archivo JSON que exporta Trello (menú del tablero → Imprimir, exportar y compartir → Exportar como JSON). Trae listas, tarjetas, etiquetas, checklists, fechas, comentarios, historial y enlaces adjuntos, y devuelve un informe de qué entró y qué no. El archivo viaja en base64: sirve para tableros chicos o medianos; los grandes conviene subirlos desde la pantalla del espacio. No habla con Trello.', { espacio_id: ESPACIO, base64: s('El archivo JSON exportado de Trello, en base64.'), visibilidad: o('Quién ve el tablero nuevo. Por omisión: espacio.', VIS), repetir: o('Poner "1" para traerlo aunque ese tablero ya se haya importado antes.', ['1']), emparejar: s('Para decir a mano quién es quién: usuarioDeTrello:usuarioDeAca, separados por coma.') }, { sube: true, consulta: ['visibilidad', 'repetir', 'emparejar'], requeridos: ['base64'] });
h('tablero_de_trello_ver', 'GET /api/tableros/{tablero_id}/de-trello', 'Ver quién quedó con nombre de Trello', 'En un tablero traído de Trello, lista a las personas que figuran solo con su nombre de Trello porque no se las pudo emparejar con una cuenta de acá.', { tablero_id: TABLERO });
h('tablero_de_trello_reconocer', 'POST /api/tableros/{tablero_id}/de-trello/reconocer', 'Reconocer a alguien de Trello', 'En un tablero traído de Trello, dice qué cuenta de acá es alguien que figura solo con su nombre de Trello. Sus comentarios y movimientos de ese tablero pasan a esa cuenta. Hay que administrar el tablero.', { tablero_id: TABLERO, nombre: s('El nombre tal como figura (sin el "(en Trello)").'), usuario_id: PERSONA, quien: QUIEN }, { requeridos: ['nombre'] });
h('tablero_crear', 'POST /api/tableros', 'Crear un tablero', 'Crea un tablero en un espacio. Alex queda como administrador del tablero.', { espacio_id: ESPACIO, nombre: s('Nombre del tablero.'), descripcion: s('Descripción ("Acerca de este tablero"), con formato Markdown.'), visibilidad: o('Quién lo ve. Por omisión: espacio.', VIS) }, { requeridos: ['espacio_id', 'nombre'] });
h('tablero_ver', 'GET /api/tableros/{tablero_id}', 'Ver un tablero', 'El tablero completo: ajustes, permisos, listas, tarjetas (el frente de cada una), etiquetas, miembros y pedidos de acceso. En tableros grandes usá `lista_id` o `sin_tarjetas` para achicar la respuesta. El detalle de una tarjeta (descripción, checklists, comentarios) se pide con tarjeta_ver.',
  { tablero_id: TABLERO, lista_id: s('Si se indica, solo trae las tarjetas de esa lista.'), sin_tarjetas: b('Si es verdadero, no trae tarjetas (solo listas, etiquetas y gente).') },
  { despues: (j, a) => (j && Array.isArray(j.tarjetas) ? { ...j, tarjetas: a.sin_tarjetas ? undefined : typeof a.lista_id === 'string' ? j.tarjetas.filter((c: any) => c.lista_id === a.lista_id) : j.tarjetas } : j) });
h('tablero_cambiar', 'PATCH /api/tableros/{tablero_id}', 'Cambiar un tablero', 'Cambia nombre, descripción, visibilidad, permisos, ajustes de aspecto, o lo cierra/reabre. Solo se cambia lo que se manda.',
  { tablero_id: TABLERO, nombre: s('Nombre.'), descripcion: s('Descripción (Markdown).'), visibilidad: o('Quién lo ve.', VIS), cerrado: b('Cerrado: se ve pero no se edita. Hay que cerrarlo antes de borrarlo.'),
    permisos: obj('Permisos del tablero.', { comentar: o('Quién comenta.', ['nadie', 'miembros', 'observadores', 'espacio', 'cualquiera']), invitar: o('Quién suma y quita gente.', ['admins', 'miembros']), union_libre: b('Los miembros del espacio pueden sumarse solos.'), edicion_espacio: b('Los miembros del espacio pueden editar sin ser del tablero.') }),
    ajustes: obj('Aspecto.', { portadas: b('Mostrar portadas en el frente.'), tilde: b('Mostrar el círculo de completada.'), conteo: b('Mostrar cuántas tarjetas tiene cada lista.'), fondo: { description: 'Fondo: { "valor": uno de oceano, atardecer, bosque, uva, grafito, arena, aurora, coral } o null para quitarlo.', anyOf: [{ type: 'object', properties: { valor: { type: 'string' } } }, { type: 'null' }] } }) });
h('tablero_fondo_foto', 'POST /api/tableros/{tablero_id}/fondo', 'Poner foto de fondo', 'Pone una foto propia como fondo del tablero (hasta 5 MB).', { tablero_id: TABLERO, base64: B64 }, { sube: true, requeridos: ['base64'] });
h('tablero_borrar', 'DELETE /api/tableros/{tablero_id}', 'Borrar un tablero', 'Borra un tablero para siempre, con todo lo que tiene adentro. Solo si ya está cerrado.', { tablero_id: TABLERO });
h('tablero_favorito', 'POST /api/tableros/{tablero_id}/favorito', 'Marcar favorito', 'Marca o desmarca el tablero como favorito de Alex (no cambia nada para las demás personas).', { tablero_id: TABLERO, favorito: b('Falso para desmarcar.') });
h('tablero_unirse', 'POST /api/tableros/{tablero_id}/unirse', 'Sumarme al tablero', 'Suma a Alex como miembro del tablero. Hace falta para poder asignarle tarjetas a Alex.', { tablero_id: TABLERO });
h('tablero_miembro_sumar', 'POST /api/tableros/{tablero_id}/miembros', 'Sumar al tablero', 'Suma al tablero a alguien que ya tiene cuenta. Si no es del espacio, queda como invitado.', { tablero_id: TABLERO, usuario_id: PERSONA, quien: QUIEN, rol: o('Rol en el tablero.', ['admin', 'normal', 'observador']) });
h('tablero_miembro_cambiar', 'PATCH /api/tableros/{tablero_id}/miembros/{usuario_id}', 'Cambiar rol en el tablero', 'Cambia el rol de alguien en el tablero.', { tablero_id: TABLERO, usuario_id: PERSONA, rol: o('Rol.', ['admin', 'normal', 'observador']) }, { requeridos: ['rol'] });
h('tablero_miembro_quitar', 'DELETE /api/tableros/{tablero_id}/miembros/{usuario_id}', 'Quitar del tablero', 'Quita a alguien del tablero.', { tablero_id: TABLERO, usuario_id: PERSONA });
h('tablero_invitacion_ver', 'GET /api/tableros/{tablero_id}/invitacion', 'Ver enlace de invitación del tablero', 'Dice si el tablero tiene un enlace de invitación vivo (no muestra el enlace).', { tablero_id: TABLERO });
h('tablero_invitacion_crear', 'POST /api/tableros/{tablero_id}/invitacion', 'Crear enlace de invitación al tablero', 'Crea el enlace de invitación del tablero (anula el anterior). Devuelve `token`: el enlace es <dirección de la app>/invitacion/<token>.', { tablero_id: TABLERO, rol: o('Con qué rol entra quien lo use.', ['normal', 'observador']) });
h('tablero_invitacion_anular', 'DELETE /api/tableros/{tablero_id}/invitacion', 'Anular enlace de invitación del tablero', 'Anula el enlace de invitación del tablero.', { tablero_id: TABLERO });
h('tablero_archivados', 'GET /api/tableros/{tablero_id}/archivados', 'Ver lo archivado', 'Listas y tarjetas archivadas del tablero.', { tablero_id: TABLERO });
h('tablero_actividad', 'GET /api/tableros/{tablero_id}/actividad', 'Actividad del tablero', 'Lo que pasó en el tablero, de lo más nuevo a lo más viejo, de a 50.', { tablero_id: TABLERO, solo: o('Con "comentarios" trae solo comentarios.', ['comentarios']), antes: s('Para la tanda siguiente: el `creado_en` del último renglón recibido.') }, { consulta: ['solo', 'antes'] });
h('tablero_checklists', 'GET /api/tableros/{tablero_id}/checklists', 'Checklists del tablero', 'Lista las checklists del tablero (sirve para copiar los ítems de una a otra).', { tablero_id: TABLERO });

// ---------- etiquetas ----------
const COLOR = s(`Color: un tono (${COLORES}) seguido de -1 (claro), -2 (medio) o -3 (oscuro). Ejemplo: azul-2. Vacío: sin color.`);
h('etiqueta_crear', 'POST /api/tableros/{tablero_id}/etiquetas', 'Crear una etiqueta', 'Crea una etiqueta en el tablero. Necesita nombre o color.', { tablero_id: TABLERO, nombre: s('Nombre.'), color: COLOR });
h('etiqueta_cambiar', 'PATCH /api/etiquetas/{etiqueta_id}', 'Cambiar una etiqueta', 'Cambia el nombre o el color de una etiqueta.', { etiqueta_id: s('Identificador de la etiqueta.'), nombre: s('Nombre.'), color: COLOR });
h('etiqueta_borrar', 'DELETE /api/etiquetas/{etiqueta_id}', 'Borrar una etiqueta', 'Borra la etiqueta del tablero y la saca de todas las tarjetas.', { etiqueta_id: s('Identificador de la etiqueta.') });

// ---------- listas ----------
h('lista_crear', 'POST /api/tableros/{tablero_id}/listas', 'Crear una lista', 'Crea una lista en el tablero.', { tablero_id: TABLERO, nombre: s('Nombre de la lista.'), posicion: POS }, { requeridos: ['nombre'] });
h('lista_cambiar', 'PATCH /api/listas/{lista_id}', 'Cambiar una lista', 'Renombra, mueve de lugar, archiva/restaura o manda la lista (con sus tarjetas) a otro tablero.', { lista_id: LISTA, nombre: s('Nombre.'), posicion: POS, archivada: b('Archivada.'), tablero_id: s('Identificador del tablero de destino, para mudarla.') });
h('lista_copiar', 'POST /api/listas/{lista_id}/copiar', 'Copiar una lista', 'Copia la lista con sus tarjetas, al lado de la original.', { lista_id: LISTA, nombre: s('Nombre de la copia.') });
h('lista_mover_tarjetas', 'POST /api/listas/{lista_id}/mover-tarjetas', 'Mover todas las tarjetas', 'Pasa todas las tarjetas de la lista al final de otra lista del mismo tablero.', { lista_id: LISTA, destino_id: s('Identificador de la lista de destino.') }, { requeridos: ['destino_id'], renombrar: { destino_id: 'lista_id' } });
h('lista_archivar_tarjetas', 'POST /api/listas/{lista_id}/archivar-tarjetas', 'Archivar todas las tarjetas', 'Archiva todas las tarjetas de la lista.', { lista_id: LISTA });
h('lista_ordenar', 'POST /api/listas/{lista_id}/ordenar', 'Ordenar una lista', 'Ordena las tarjetas de la lista y deja ese orden guardado.', { lista_id: LISTA, por: o('Criterio.', ['nombre', 'nuevas', 'viejas', 'vence']) }, { requeridos: ['por'] });
h('lista_borrar', 'DELETE /api/listas/{lista_id}', 'Borrar una lista', 'Borra para siempre una lista con sus tarjetas. Solo si ya está archivada.', { lista_id: LISTA });

// ---------- tarjetas ----------
h('tarjeta_crear', 'POST /api/listas/{lista_id}/tarjetas', 'Crear tarjetas', 'Crea una tarjeta en la lista, o varias de una vez con `titulos`.', { lista_id: LISTA, titulo: s('Título de la tarjeta.'), titulos: { type: 'array', items: { type: 'string' }, description: 'Para crear varias: un título por tarjeta (hasta 100).' }, descripcion: s('Descripción, con formato Markdown.'), posicion: POS });
h('tarjeta_ver', 'GET /api/tarjetas/{tarjeta_id}', 'Ver una tarjeta', 'La tarjeta por dentro: descripción, lista, checklists con sus ítems, adjuntos, comentarios y actividad.', { tarjeta_id: TARJETA });
h('tarjeta_cambiar', 'PATCH /api/tarjetas/{tarjeta_id}', 'Cambiar o mover una tarjeta', 'Cambia título, descripción, fechas, completada o portada; la mueve a otra posición, otra lista u otro tablero (con `lista_id`); la archiva o restaura. Solo se cambia lo que se manda.',
  { tarjeta_id: TARJETA, titulo: s('Título.'), descripcion: s('Descripción (Markdown).'), lista_id: s('Lista de destino, para moverla (puede ser de otro tablero).'), posicion: POS, archivada: b('Archivada.'), completada: b('Marcada como completada.'),
    inicio: { description: 'Fecha de inicio como día (2026-11-30), o null para quitarla.', type: ['string', 'null'] }, vence: { description: 'Vencimiento como fecha y hora ISO con zona (2026-12-05T18:00:00-03:00), o null para quitarlo.', type: ['string', 'null'] },
    portada: { description: `Portada: { "color": uno de ${COLORES} } o { "adjunto": id de una imagen adjunta a la tarjeta }, con "tamano" (media | completa) y "tono" (claro | oscuro) opcionales. null la quita.`, type: ['object', 'null'] } });
h('tarjeta_copiar', 'POST /api/tarjetas/{tarjeta_id}/copiar', 'Copiar una tarjeta', 'Copia la tarjeta a la misma lista o a otra (también de otro tablero).', { tarjeta_id: TARJETA, titulo: s('Título de la copia.'), lista_id: s('Lista de destino.'), posicion: POS,
  conservar: obj('Qué se lleva la copia. Lo que no se nombra se conserva; poné false para dejarlo afuera.', { descripcion: b(''), etiquetas: b(''), miembros: b(''), checklists: b(''), adjuntos: b('') }) });
h('tarjeta_borrar', 'DELETE /api/tarjetas/{tarjeta_id}', 'Borrar una tarjeta', 'Borra la tarjeta para siempre. Solo si ya está archivada.', { tarjeta_id: TARJETA });
h('tarjeta_etiqueta_poner', 'POST /api/tarjetas/{tarjeta_id}/etiquetas', 'Poner una etiqueta', 'Le pone a la tarjeta una etiqueta del tablero.', { tarjeta_id: TARJETA, etiqueta_id: s('Identificador de la etiqueta.') }, { requeridos: ['etiqueta_id'] });
h('tarjeta_etiqueta_quitar', 'DELETE /api/tarjetas/{tarjeta_id}/etiquetas/{etiqueta_id}', 'Quitar una etiqueta', 'Le saca una etiqueta a la tarjeta (la etiqueta sigue existiendo en el tablero).', { tarjeta_id: TARJETA, etiqueta_id: s('Identificador de la etiqueta.') }, { borra: false });
h('tarjeta_miembro_sumar', 'POST /api/tarjetas/{tarjeta_id}/miembros', 'Asignar una persona', 'Asigna a la tarjeta a alguien que ya es miembro del tablero.', { tarjeta_id: TARJETA, usuario_id: PERSONA }, { requeridos: ['usuario_id'] });
h('tarjeta_miembro_quitar', 'DELETE /api/tarjetas/{tarjeta_id}/miembros/{usuario_id}', 'Desasignar una persona', 'Saca a una persona de la tarjeta.', { tarjeta_id: TARJETA, usuario_id: PERSONA }, { borra: false });

// ---------- checklists ----------
const CHECKLIST = s('Identificador de la checklist.');
const ITEM = s('Identificador del ítem.');
h('checklist_crear', 'POST /api/tarjetas/{tarjeta_id}/checklists', 'Crear una checklist', 'Agrega una checklist a la tarjeta. Con `copiar_de` trae los ítems de otra checklist (sin tildes). Devuelve `checklist_id`.', { tarjeta_id: TARJETA, nombre: s('Nombre de la checklist.'), copiar_de: s('Identificador de la checklist de la que se copian los ítems.') }, { requeridos: ['nombre'] });
h('checklist_cambiar', 'PATCH /api/checklists/{checklist_id}', 'Cambiar una checklist', 'Renombra la checklist o la mueve de lugar dentro de la tarjeta.', { checklist_id: CHECKLIST, nombre: s('Nombre.'), posicion: POS });
h('checklist_borrar', 'DELETE /api/checklists/{checklist_id}', 'Borrar una checklist', 'Borra la checklist con sus ítems.', { checklist_id: CHECKLIST });
h('item_agregar', 'POST /api/checklists/{checklist_id}/items', 'Agregar ítems', 'Agrega un ítem a la checklist, o varios de una vez con `textos`.', { checklist_id: CHECKLIST, texto: s('Texto del ítem.'), textos: { type: 'array', items: { type: 'string' }, description: 'Para agregar varios (hasta 100).' } });
h('item_cambiar', 'PATCH /api/items/{item_id}', 'Cambiar un ítem', 'Edita el texto, tilda o destilda, mueve de lugar o a otra checklist de la misma tarjeta, asigna una persona o pone fecha.',
  { item_id: ITEM, texto: s('Texto.'), hecho: b('Tildado.'), posicion: POS, checklist_id: s('Otra checklist de la misma tarjeta, para mudarlo.'), asignado_id: { description: 'Persona asignada (miembro del tablero), o null para quitarla.', type: ['string', 'null'] }, vence: { description: 'Fecha y hora ISO, o null para quitarla.', type: ['string', 'null'] } });
h('item_borrar', 'DELETE /api/items/{item_id}', 'Borrar un ítem', 'Borra un ítem de su checklist.', { item_id: ITEM });
h('item_convertir', 'POST /api/items/{item_id}/convertir', 'Convertir ítem en tarjeta', 'Convierte el ítem en una tarjeta nueva, al final de la misma lista.', { item_id: ITEM });

// ---------- adjuntos ----------
const ADJUNTO = s('Identificador del adjunto.');
h('adjunto_enlace', 'POST /api/tarjetas/{tarjeta_id}/adjuntos', 'Adjuntar un enlace', 'Adjunta un enlace a la tarjeta.', { tarjeta_id: TARJETA, url: s('Dirección (http:// o https://).'), nombre: s('Nombre a mostrar.') }, { requeridos: ['url'] });
h('adjunto_subir', 'POST /api/tarjetas/{tarjeta_id}/adjuntos', 'Adjuntar un archivo', 'Sube un archivo a la tarjeta. Pensado para archivos chicos (el contenido viaja en base64). La primera imagen pasa a ser la portada.', { tarjeta_id: TARJETA, nombre: s('Nombre del archivo, con extensión.'), tipo: s('Tipo del archivo, como application/pdf o image/png.'), base64: B64 }, { sube: true, consulta: ['nombre', 'tipo'], requeridos: ['nombre', 'base64'] });
h('adjunto_cambiar', 'PATCH /api/adjuntos/{adjunto_id}', 'Cambiar un adjunto', 'Renombra el adjunto o lo mueve de lugar.', { adjunto_id: ADJUNTO, nombre: s('Nombre.'), posicion: POS });
h('adjunto_borrar', 'DELETE /api/adjuntos/{adjunto_id}', 'Borrar un adjunto', 'Borra el adjunto (y el archivo, si era un archivo).', { adjunto_id: ADJUNTO });
h('adjunto_leer', 'GET /api/adjuntos/{adjunto_id}/archivo', 'Leer un archivo adjunto', 'Trae el contenido de un archivo adjunto: como texto si es texto, como imagen si es una imagen chica. De lo demás informa tipo y peso.', { adjunto_id: ADJUNTO }, { baja: true });

// ---------- comentarios ----------
const COMENTARIO = s('Identificador del comentario.');
h('comentario_crear', 'POST /api/tarjetas/{tarjeta_id}/comentarios', 'Comentar', 'Escribe un comentario en la tarjeta, firmado por Alex. Admite Markdown y menciones con @usuario.', { tarjeta_id: TARJETA, texto: s('Texto del comentario.') }, { requeridos: ['texto'] });
h('comentario_cambiar', 'PATCH /api/comentarios/{comentario_id}', 'Editar un comentario', 'Edita un comentario escrito por Alex.', { comentario_id: COMENTARIO, texto: s('Texto nuevo.') }, { requeridos: ['texto'] });
h('comentario_borrar', 'DELETE /api/comentarios/{comentario_id}', 'Borrar un comentario', 'Borra un comentario (propio, o de cualquiera por administrar el tablero).', { comentario_id: COMENTARIO });
h('comentario_reaccionar', 'POST /api/comentarios/{comentario_id}/reacciones', 'Reaccionar a un comentario', 'Pone la reacción de Alex (un emoji) en un comentario; si ya estaba, la saca.', { comentario_id: COMENTARIO, emoji: s('Un emoji.') }, { requeridos: ['emoji'] });

/** Rutas de /api que a propósito NO tienen herramienta, con el motivo. */
export const EXCLUIDAS: Record<string, string> = {
  'GET /api/instalacion': 'es para la pantalla de entrada',
  'POST /api/cuenta/registro': 'crear cuenta es de personas; Alex ya tiene la suya',
  'POST /api/sesion': 'entrar con contraseña es de personas',
  'DELETE /api/sesion': 'salir es de personas',
  'POST /api/yo/clave': 'Alex no tiene contraseña',
  'POST /api/yo/email': 'pide contraseña; Alex no tiene',
  'GET /api/invitaciones/*': 'es para quien recibe un enlace',
  'POST /api/invitaciones/*/aceptar': 'Alex ya entra a todo: no necesita invitaciones',
  'POST /api/espacios/*/pedidos': 'Alex ya entra a todo: no pide acceso',
  'POST /api/tableros/*/pedidos': 'Alex ya entra a todo: no pide acceso',
  'GET /api/fotos/*': 'es la imagen misma; su dirección ya viene en los datos',
  'GET /api/tableros/*/vivo': 'es la línea en vivo de las pantallas',
  'GET /api/oauth/pedido': 'dar acceso a un asistente solo lo hace una persona',
  'POST /api/oauth/aprobar': 'dar acceso a un asistente solo lo hace una persona',
  'GET /api/admin/alex': 'las llaves de Alex solo las maneja una persona',
  'POST /api/admin/alex/llaves': 'las llaves de Alex solo las maneja una persona',
  'DELETE /api/admin/alex/llaves/*': 'las llaves de Alex solo las maneja una persona',
};

/** Forma comparable de una ruta: "PATCH /api/tarjetas/*". */
export const forma = (metodo: string, ruta: string): string => `${metodo} ${ruta.replace(/\{\w+\}|:\w+/g, '*')}`;
