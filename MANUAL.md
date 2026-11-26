# MANUAL — cómo se prueba, se publica, se respalda y se vuelve atrás

Este archivo es para cualquier sesión de Claude (o persona) que retome el proyecto.
Se actualiza al terminar cada tanda. Estado: **tanda 2.2** hecha (lo de la 2.1 más listas, tarjetas, arrastre y tiempo real). Publicado en https://meetmydash.emilianosalasporta.cloud.

## Qué hay en cada carpeta
| Carpeta / archivo | Qué es |
|---|---|
| `servidor/` | El programa que corre en el servidor (Node + TypeScript, sin compilar: Node lo ejecuta directo). |
| `servidor/migraciones/` | Cambios de estructura de la base, numerados (`001_…sql`). Nunca se edita uno ya publicado: se agrega otro. |
| `servidor/mcp/` | La puerta de Alex: `herramientas.ts` (la lista de herramientas) y `puerta.ts` (la dirección `/mcp`). |
| `servidor/respaldo.ts` | Respaldo diario, copia fuera del servidor y restauración. |
| `servidor/rutas/servidor.ts`, `servidor/registro.ts` | Estado del servidor, publicaciones de Dokploy y memoria corta de errores. |
| `.github/workflows/` | En GitHub: las pruebas en cada cambio y el botón de emergencia "Volver a publicar". |
| `servidor/rutas/puerta.ts` | Quién entra por la puerta: el permiso desde Claude (OAuth), las llaves y la cuenta Alex. |
| `web/` | Las pantallas (React + Vite). Se arman a `dist/web`. |
| `pruebas/` | Pruebas automáticas (Vitest). |
| `scripts/version.mjs` | Anota qué cambio se armó, para verlo en `/api/salud`. |
| `scripts/iconos.mjs` | Dibuja los íconos de la app instalada (`web/public/icono-*.png`). Solo hace falta correrlo si cambia el dibujo. |
| `web/public/` | Lo que se publica tal cual: los íconos y `app.webmanifest` (los datos para instalar la app en el teléfono). |
| `scripts/paridad.mjs` | Recalcula el resumen de PARIDAD.md después de cambiar el estado de una fila: `node scripts/paridad.mjs`. |
| `diseno/` | Muestras de diseño. No se publican. |
| `Dockerfile` | Receta con la que Dokploy arma y publica. Corre las pruebas adentro. |
| `PRIVADO.md` | Datos del servidor y claves. **Ignorado por git. No subir nunca.** |

## Cómo está armado
| Archivo | Qué hace |
|---|---|
| `servidor/permisos.ts` | **Único lugar** donde se decide quién puede qué (instalación → espacio → tablero). Si cambia una regla, se cambia acá y en `pruebas/tableros-permisos.test.ts`. |
| `servidor/nucleo.ts` | Sesiones (galleta `mmd_sesion`), registro de actividad, membresías e invitaciones por enlace. |
| `servidor/rutas/cuenta.ts` | Crear cuenta, entrar, perfil, contraseña, administración general. |
| `servidor/rutas/espacios.ts` | Espacios de trabajo, miembros, invitados, enlaces, pedidos. |
| `servidor/rutas/tableros.ts` | Tableros: visibilidad, miembros, permisos, cerrar/borrar. |
| `servidor/rutas/contenido.ts` | Listas y tarjetas: crear, renombrar, ordenar, mover (también a otro tablero), copiar, archivar. Acá están las reglas de posición. |
| `servidor/rutas/tarjeta.ts` | La tarjeta por dentro: etiquetas, miembros, checklists, adjuntos, comentarios, reacciones y actividad. Las fechas, la portada y "completada" se cambian con `PATCH /api/tarjetas/:id` (en `contenido.ts`). |
| `servidor/rutas/fotos.ts` | Foto de perfil y logo del espacio. |
| `servidor/archivos.ts` | Guardar, copiar, entregar y borrar archivos subidos. Único lugar que toca el disco. |
| `servidor/vivo.ts` | Tiempo real: una línea abierta (WebSocket) por pantalla que mira un tablero, en `/api/tableros/:id/vivo`. |
| `web/src/base.tsx` | Base de las pantallas: pedidos al servidor, navegación, sesión, piezas comunes. |
| `web/src/estilos.css` | Todos los colores y letras, como variables. Sale de `diseno/muestra.html` (diseño aprobado). |
| `web/src/pantallas/` | Una pantalla por archivo. |
| `web/src/tablero/datos.ts` | Los datos del tablero abierto: carga, avisos en vivo, reconexión y cambios que se ven al instante. |
| `web/src/tablero/arrastre.ts` | El arrastre con mouse y con dedo (hecho a medida, sin librerías). |
| `web/src/tablero/Listas.tsx`, `Menus.tsx` | Las listas y el frente de cada tarjeta; menú de lista, mover/copiar y archivados. |
| `web/src/tablero/Tarjeta.tsx` | La tarjeta abierta, con todos sus menús. |
| `web/src/tablero/formato.tsx` | Texto con formato: cómo se muestra (`Texto`) y la caja para escribirlo (`Editor`). |
| `web/src/tablero/piezas.tsx` | Íconos, colores de etiquetas, fechas y el texto de cada renglón de actividad. |

Reglas de la casa:
- La app es privada: la **primera cuenta** que se crea queda como administración general; las demás entran con enlace de invitación.
- Contraseñas y códigos de sesión o invitación se guardan solo como huella (no legibles).
- Toda acción que cambia algo llama a `registrarActividad` con quién la hizo.
- Los errores salen siempre como `{ error: código, mensaje: texto para la persona }`.
- **Orden de listas y tarjetas:** cada una guarda un número `posicion`, separado de a 65.536. Para meter algo entre dos se manda el número del medio; `"arriba"` y `"abajo"` también valen. Si dos quedan pegados, el servidor vuelve a numerar ese grupo solo.
- **Tiempo real:** todo cambio de listas o tarjetas llama a `vivo.emitir(tablero, { tipo: 'cambio', listas, tarjetas })` con las filas completas ya cambiadas. La pantalla las reemplaza; lo archivado o lo que pasó a otro tablero sale de la vista. Cambios de cabecera (nombre, gente, permisos) mandan `{ tipo: 'tablero' }` y la pantalla vuelve a pedir todo. Antes de cada aviso se revisa de nuevo el permiso de cada pantalla conectada. Hay un latido cada 25 segundos; si la pantalla pasa un minuto sin recibirlo, se reconecta y vuelve a cargar.
- Cada pedido de la pantalla lleva la cabecera `x-cliente` (un código por pestaña) y el aviso la devuelve en `origen`: así la pantalla reconoce el eco de sus propios cambios.
- **Tarjeta por dentro:** cada cambio termina en `listo(req, tarjetaId)`, que vuelve a leer la tarjeta y la avisa en vivo con sus cuentas (comentarios, adjuntos, ítems). La tarjeta abierta se vuelve a pedir entera (`GET /api/tarjetas/:id`) cada vez que llega un aviso de ella. Los cambios en las etiquetas del tablero mandan `{ tipo: 'tablero' }`.
- **Archivos subidos:** viven en `DATA_DIR/archivos/` (`adjuntos/` y `fotos/`), nunca en el repositorio. El nombre en disco es un código al azar del servidor; lo que escribe la persona nunca se usa como ruta. Se suben como cuerpo crudo (`content-type: application/octet-stream`; nombre y tipo en la dirección) y se van guardando en disco sin cargarlos en memoria.
- **Seguridad de adjuntos:** solo los baja quien puede ver la tarjeta. Dentro de la app solo se muestran imágenes (comprobadas mirando sus primeros bytes), PDF, audio, video y texto plano; cualquier otra cosa (una página web, por ejemplo) se entrega siempre como descarga. Las fotos de perfil y logos se piden por un nombre al azar y son visibles sin sesión.
- **Texto con formato:** nunca se inserta HTML escrito por la gente. `formato.tsx` arma el texto pieza por pieza y solo acepta enlaces `http`, `https` y `mailto`.
- **Fondos:** viven en los ajustes del tablero (`ajustes.fondo`): uno de los degradados de `FONDOS` (en `permisos.ts`, con su clase `.fondo-…` en `estilos.css`) o una foto subida a `POST /api/tableros/:id/fondo`.
- **Favoritos y recientes:** tabla `tablero_usuario`, una fila por persona y tablero. Abrir un tablero con sesión anota la fecha. `GET /api/yo/tableros` solo devuelve los que la persona todavía puede ver.
- **Borrar para siempre:** `DELETE /api/tarjetas/:id` y `DELETE /api/listas/:id` solo aceptan cosas ya archivadas.
- **Dirección de una tarjeta:** `/c/<código>`. Es la misma pantalla del tablero con la tarjeta abierta encima.
- Después de `npm run build` hay que reiniciar el servidor: solo conoce los archivos de pantallas que había al arrancar.
- Las letras están dentro de la app (`@fontsource`): no se pide nada a servidores de terceros.

## Probar
```bash
npm install
```
```bash
npm test
```
`npm test` revisa los tipos (TypeScript) y corre todas las pruebas. Cada prueba usa una carpeta de datos temporal: nunca toca datos reales.

## Levantar la app en la Mac
```bash
npm run build
```
```bash
DATA_DIR=./datos PORT=3000 npm start
```
Abre en http://localhost:3000. Para trabajar en las pantallas con recarga automática: `npm run dev` en una terminal y `npm run dev:web` en otra.

## Variables de entorno
| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto | `3000` |
| `DATA_DIR` | Carpeta de datos (base, adjuntos, respaldos) | `./datos` (en Docker: `/app/data`) |
| `TZ` | Zona horaria | `America/Argentina/Buenos_Aires` |
| `URL_PUBLICA` | Dirección pública de la app (`https://…`), para la puerta de Alex. Solo hace falta si la app no logra deducirla de los pedidos | se deduce |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Depósito para la copia del respaldo fuera del servidor. Con las cuatro, se enciende | apagada |
| `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APP_ID` | Para que Alex vea las publicaciones y pueda volver a publicar | sin acceso |
| `RESTAURAR` | Nombre de un respaldo a poner en lugar de la base al arrancar (ver "Volver atrás") | — |
| `MAX_ADJUNTO_MB` | Tope de cada archivo adjunto, en MB. Cloudflare (plan gratis) no deja pasar más de 100 | `100` |

## La puerta de Alex (MCP)
Alex es Claude manejando la app. Entra por `https://<dirección de la app>/mcp` con la cuenta robot **Alex** (administración general, sin contraseña). Todo lo que hace queda en la actividad con ese nombre.

**Cómo está hecha**
- `/mcp` habla el protocolo MCP en su forma simple: cada pedido es un POST con una pregunta y su respuesta. No guarda estado ni deja nada abierto.
- Cada herramienta llama por dentro a la misma ruta `/api` que usan las pantallas (con `app.inject`), así que valen las mismas reglas, permisos, actividad y avisos en vivo. En `servidor/mcp/herramientas.ts` solo se describe cada herramienta; ahí no se decide nada.
- **Regla: ruta nueva en `/api` = herramienta nueva en `herramientas.ts`, en la misma tanda.** La prueba "cada ruta de la app tiene su herramienta" (`pruebas/puerta.test.ts`) falla si falta, y como las pruebas corren al armar, no se publica. Si una ruta no debe tener herramienta, va en `EXCLUIDAS` con el motivo.
- Subir archivos: la herramienta recibe el contenido en `base64` (sirve para archivos chicos). Las respuestas de más de 140.000 caracteres se rechazan con un aviso (Claude corta las largas).

**Cómo se entra** (las llaves se guardan solo como huella; tabla `llaves`)
1. *Permiso desde Claude (OAuth 2.1 con PKCE y registro automático).* Claude lee `/.well-known/oauth-protected-resource` y `/.well-known/oauth-authorization-server`, se presenta en `/oauth/registro`, abre `/oauth/autorizar` (una pantalla de la app: pide sesión y administración general) y cambia el código en `/oauth/token`. La llave dura 1 hora y se renueva sola con otra de renovación (que rota en cada uso).
2. *Llave fija.* En Tu cuenta → Alex → "Crear llave". Se muestra una sola vez. Va en el encabezado `Authorization: Bearer mmd_…`. Sirve para Claude Code (`claude mcp add --transport http meetmydash https://…/mcp --header "Authorization: Bearer mmd_…"`) y también para llamar directo a `/api`.
- Una llave nunca puede crear ni anular llaves, ni aprobar permisos: eso exige la sesión de una persona con administración general.
- Cortar un acceso: Tu cuenta → Alex → "Cortar". Deja de entrar en el momento.

**Sumarla en Claude (lo hace Emiliano, una vez):** claude.ai → Conectores → Agregar → Agregar conector personalizado → nombre `meetmydash`, dirección `https://meetmydash.emilianosalasporta.cloud/mcp` → Continuar → Agregar → Conectar → en la pantalla de meetmydash, "Permitir".

**Probarla a mano:** `curl -X POST <dirección>/mcp -H "Authorization: Bearer mmd_…" -H "content-type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`

## Traer tableros de Trello

En la página de un espacio (o en el inicio) hay una ficha **"Traer de Trello"**. Se elige el archivo que exporta Trello (en el tablero: menú → Imprimir, exportar y compartir → Exportar como JSON) y la app arma un tablero nuevo. Al terminar muestra un informe de qué entró y qué no. Alex hace lo mismo con la herramienta `tablero_importar_trello` (el archivo viaja en base64: para tableros grandes conviene la pantalla). La app nunca habla con Trello: trabaja solo con el archivo.

- **Entra:** nombre y descripción del tablero, color de fondo, listas (las cerradas, archivadas), tarjetas con su número, descripción, fechas, completada, etiquetas con sus colores, portadas de color, checklists con sus ítems, comentarios con su fecha y el historial (crear, mover, archivar, renombrar, fechas, checklists, adjuntos, miembros).
- **Personas:** se emparejan por usuario, nombre o correo con las cuentas que ya existen. Quien no tiene cuenta no se crea: sus comentarios y movimientos quedan con su nombre "(en Trello)" y sus asignaciones a tarjetas se pierden. Se puede emparejar a mano con `?emparejar=usuarioDeTrello:usuarioDeAca`.
- **No entra (el informe lo cuenta):** los archivos adjuntos subidos a Trello quedan como **enlace a Trello** (no se bajan; si se cierra la cuenta de Trello se pierden), las portadas con foto, los campos personalizados, las pegatinas y los datos de Power-Ups. Trello exporta como mucho los últimos 1.000 movimientos.
- Si el mismo tablero ya se había traído, avisa y pide confirmar antes de crear otro. Tope del archivo: 50 MB. Todo entra en una sola operación: si falla, no queda nada a medias.
- Código: `servidor/importar.ts` (la traducción), `servidor/rutas/importar.ts` (la dirección `POST /api/espacios/:id/importar/trello`), tabla `importaciones` (guarda cada informe). Pruebas: `pruebas/importar.test.ts`.
- **Estado al 26/11/2026:** probado con archivos armados a mano con la forma de la exportación de Trello. **Falta probarlo con una exportación real de un tablero de Emiliano.** Bajar los archivos adjuntos de Trello queda pendiente (necesita una clave de la cuenta de Trello).

## Cómo saber qué versión está publicada
`GET /api/salud` devuelve `version`, `commit` (los primeros 12 caracteres del cambio) y `armada_en`.

## Publicar
Se publica solo: cada cambio que llega a `main` en GitHub dispara un aviso (webhook) a Dokploy, que arma la app con el `Dockerfile` y la reemplaza. Tarda 1 a 3 minutos.

- Dokploy: proyecto `tablero`, aplicación `app`. Origen: Git, `https://github.com/emisalasporta/tablero.git`, rama `main`, Dockerfile. Volumen `tablero-datos` en `/app/data`.
- Los identificadores, la dirección de prueba, la dirección del aviso y la clave de la API de Dokploy están en `PRIVADO.md`.
- Las pruebas corren dentro del armado (`RUN npm test`). Si fallan, el armado falla y sigue funcionando la versión anterior.

### Comprobar que se publicó
Pedir https://meetmydash.emilianosalasporta.cloud/api/salud y comparar `commit` con `git rev-parse --short=12 HEAD`.

### Ver el estado o volver a publicar a mano (API de Dokploy)
Con `DOKPLOY_URL` y `DOKPLOY_API_KEY` de `PRIVADO.md`, encabezado `x-api-key`:
- Estado y últimas publicaciones: `GET /api/deployment.all?applicationId=<id>` (cada una trae `status`, `title` y `logPath`).
- Datos de la app: `GET /api/application.one?applicationId=<id>` (`applicationStatus`).
- Volver a publicar: `POST /api/application.deploy` con `{"applicationId":"<id>"}`.
- El manual completo de la API está en `GET /api/settings.getOpenApiDocument`.

## Datos y migraciones
- Base: `DATA_DIR/tablero.db` (SQLite). Al arrancar se aplican las migraciones pendientes, cada una en una transacción (si falla, no queda nada a medias).
- Archivos subidos: `DATA_DIR/archivos/`. Un respaldo completo es la base **más** esa carpeta. Al arrancar y al borrar un tablero se limpian los adjuntos que quedaron sin tarjeta.
- Antes de aplicar migraciones sobre una base que ya existía se guarda una copia en `DATA_DIR/respaldos/antes-de-NNN-<fecha>.db`.

## Respaldo
**En el servidor (anda solo, sin configurar nada):**
- Todos los días, pasadas las 03:30 de Argentina, la app copia la base a `DATA_DIR/respaldos/diario-AAAA-MM-DD.db` (revisa cada 10 minutos; si la app estuvo apagada a esa hora, lo hace al volver). La copia es consistente y no frena nada (`VACUUM INTO`).
- Se guardan 14 diarias, 8 semanales (las de domingo), las últimas 10 manuales y las últimas 10 previas a migraciones.
- Archivos subidos: en `DATA_DIR/respaldos/archivos/` queda un segundo nombre de cada archivo (enlace duro: no ocupa espacio extra). Si la app borra un original, ese segundo nombre sigue 30 días.
- A mano: Tu cuenta → "Respaldo y servidor" → "Hacer uno ahora", o Alex con la herramienta `respaldo_hacer`. Estado: `GET /api/admin/respaldos` (herramienta `respaldos_ver`).
- Ojo: todo esto vive en el mismo disco que los datos. Protege de errores de la app o de un cambio malo, **no** de perder el servidor.

**Fuera del servidor (hay que encenderlo):** con las cuatro variables `R2_*` cargadas en Dokploy, después de cada respaldo la app sube la base comprimida a `base/<nombre>.gz` y los archivos nuevos a `archivos/…` en un depósito compatible con S3 (Cloudflare R2). Afuera se guardan 30 días de bases; los archivos no se borran. Si la subida falla, el respaldo local se hace igual y el error queda en "Respaldo y servidor" y en `respaldos_ver`. **Estado al 26/11/2026: encendida. Depósito privado `meetmydash-respaldo` en Cloudflare R2, con una clave que solo puede leer y escribir en ese depósito (los datos están en PRIVADO.md y en las variables de Dokploy). Comprobado con un respaldo manual que llegó al depósito. Sin ensayar todavía: restaurar bajando la copia desde afuera y la subida de archivos adjuntos.**

## Ver el servidor (Alex)
- Por la puerta: `servidor_ver` (versión que corre, últimas publicaciones en Dokploy con su estado, últimos errores de la app) y `servidor_publicar` (volver a armar y publicar `main`). Usan `DOKPLOY_URL`, `DOKPLOY_API_KEY` y `DOKPLOY_APP_ID`, cargadas como variables en Dokploy.
- Los errores recientes son una memoria corta (los últimos 100) que se vacía cuando la app arranca.
- Si la app está caída: desde Claude Code con la clave de `PRIVADO.md` (ver "Publicar"), o desde GitHub → Actions → "Volver a publicar" → Run workflow (usa los secretos del repositorio con esos mismos tres nombres; **al 26/11/2026 todavía no están cargados**, así que ese botón aún no funciona).

## Volver atrás
**Código (ensayado el 25/11/2026):**
```bash
git revert --no-edit HEAD
```
```bash
git push
```
Se publica sola la versión anterior en menos de un minuto. Comprobar con `/api/salud`.

Si lo que se subió tenía pruebas rotas no hace falta apurarse: Dokploy no lo publica y sigue la versión anterior (también ensayado). La aplicación figura con estado `error` en Dokploy hasta la siguiente publicación buena.

**Datos (ensayado el 26/11/2026 en una carpeta de prueba, arrancando la app de verdad; no en el servidor publicado):**
1. Elegir el respaldo: `respaldos_ver` o Tu cuenta → "Respaldo y servidor". Sirven los `diario-…`, `manual-…` y `antes-de-…`.
2. En Dokploy, sumar a las variables de la aplicación `RESTAURAR=<nombre exacto del respaldo>` y volver a publicar (`servidor_publicar`, el botón Deploy, o por la API).
3. Al arrancar, la app comprueba que el respaldo esté sano, guarda lo que había en `respaldos/antes-de-restaurar-<fecha>.db` y pone el respaldo en su lugar. Lo hace una sola vez por nombre (queda anotado en `respaldos/.restaurado`), así que dejar la variable puesta no repite nada; conviene quitarla después.
4. Si el nombre no existe o el archivo está dañado, la app no arranca y lo dice en el registro; sigue funcionando la versión anterior. Se corrige la variable y se publica de nuevo.
- Si lo restaurado es de antes de una migración, la migración se vuelve a aplicar sola al arrancar.
- Desde la copia externa: bajar `base/<nombre>.gz` del depósito, descomprimirlo y ponerlo en `DATA_DIR/respaldos/` del volumen; después, los mismos pasos. Los archivos se copian de `archivos/` a `DATA_DIR/archivos/`.
