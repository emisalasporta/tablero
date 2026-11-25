# PLAN — meetmydash (carpeta y repositorio: `tablero`)

## Resumen en 5 líneas
1. **Qué es:** una app web de tableros igual a Trello en funciones, con diseño propio, para vos y tus equipos, sin costo por usuario, publicada en tu servidor.
2. **Cómo se construye:** una sola app (un solo "paquete" en Dokploy, como `gastos`), con los datos en un archivo de base de datos dentro de un volumen, y una conexión abierta por tablero para que todo se vea al instante.
3. **Cómo la maneja Alex:** una puerta MCP con acceso de administrador para usar la app, el repositorio público con documentos al día para cambiar el código, publicación automática al subir a `main`, y acceso a Dokploy para ver errores y volver a publicar.
4. **Red de seguridad:** pruebas automáticas que frenan la publicación si fallan, respaldo diario (con copia fuera del servidor) y vuelta atrás documentada y probada.
5. **Lo que NO se puede igualar:** la tienda de Power-Ups de terceros, las integraciones oficiales de Atlassian (Slack, Jira, Teams…), las apps nativas de las tiendas y la IA de Atlassian. El detalle exacto está en PARIDAD.md (399 funciones listadas, 47 marcadas "no se puede" y 18 "parcial").

---

## 1. Con qué se construye (y por qué)

Elegí lo más parecido posible a lo que ya te funciona en `gastos` (lo miré: una app Node, un Dockerfile, un volumen para los datos), porque es el molde que tu Dokploy ya publica bien.

| Pieza | Elección | En criollo |
|---|---|---|
| Servidor | Node 22 + TypeScript | El programa que corre en tu VPS. TypeScript es JavaScript con "corrector ortográfico": atrapa errores antes de publicar. |
| Base de datos | SQLite (un archivo) | Todos los datos en un solo archivo dentro del volumen. Sin un segundo servicio que mantener; respaldar es copiar un archivo. Alcanza de sobra para decenas de personas. |
| Tiempo real | WebSocket | Una "línea telefónica abierta" entre cada pantalla y el servidor. Cuando alguien mueve una tarjeta, el servidor avisa a todos los que miran ese tablero. Es lo mismo que hace Trello (verificado). |
| Pantallas | React + Vite | Las herramientas estándar para armar pantallas interactivas. Mucha documentación: cualquier sesión de Claude las conoce. |
| Arrastre | Propio, con eventos de puntero | Para que arrastrar funcione igual de bien con mouse y con el dedo en iPhone (las librerías comunes fallan en el celular). |
| iPhone | PWA | "App web instalable": se agrega a la pantalla de inicio desde Safari y se abre como una app, con notificaciones. No pasa por la App Store. |
| Adjuntos | Archivos en el volumen | Carpeta `adjuntos/` al lado de la base de datos. El límite lo pone el disco del VPS. |
| Búsqueda | La que trae SQLite (FTS5) | Buscador de texto incluido en la base de datos; no hace falta otro servicio. |
| Puerta de Alex | Servidor MCP dentro de la misma app | Una dirección HTTPS (`/mcp`) que Claude suma como conector. |
| Pruebas | Vitest + Playwright | Vitest prueba las reglas (permisos, orden, etc.). Playwright abre un navegador de mentira y usa la app como una persona (crear tablero, arrastrar tarjeta). |
| Empaquetado | Dockerfile | El mismo tipo de receta que ya usa `gastos`. |

Una sola app, un solo contenedor, un solo volumen. Nada de piezas sueltas.

**Diseño.** Antes de construir pantallas, la primera entrega de la Fase 2 es una **muestra de diseño** (tablero y tarjeta abierta, en claro y oscuro, en computadora y iPhone) para que la apruebes o la cambies. Dirección propuesta: tipografía con carácter, superficies planas con bordes finos en vez de sombras, un solo color de acento, fondos de tablero en tonos propios (no fotos por defecto), tarjetas densas pero aireadas. Íconos, textos y nombre propios; nada tomado de Trello.

## 2. Dónde se guardan los datos

Todo vive en **un volumen de Dokploy** montado en `/app/data` (igual que `gastos-datos`):

```
/app/data/
  tablero.db        ← la base de datos (usuarios, espacios, tableros, listas, tarjetas, actividad…)
  adjuntos/         ← archivos subidos y portadas
  respaldos/        ← copias diarias (ver punto 3)
```

- Los cambios de estructura de la base ("migraciones": cuando una versión nueva necesita una columna nueva) se aplican solos al arrancar, y **antes de cada uno se guarda una copia** automática.
- Contraseñas guardadas cifradas de forma irreversible (nadie, ni yo, puede leerlas).
- Claves y direcciones: en variables de Dokploy o en PRIVADO.md. Nunca en el repositorio.

## 3. Respaldo

| Qué | Cómo | Cada cuánto | Cuánto se guarda |
|---|---|---|---|
| Base de datos | Copia consistente (la app la hace sin frenar nada) a `respaldos/` | Todos los días 03:30 (hora Argentina) y antes de cada migración | 14 diarias + 8 semanales |
| Adjuntos | Copia de los archivos nuevos | Diario | Igual |
| Copia fuera del servidor | Se sube el respaldo a un depósito externo (propuesta: Cloudflare R2, que ya es tu proveedor y tiene un tramo gratis) | Diario | 30 días |
| Prueba de restauración | Una prueba automática restaura el último respaldo en una base vacía y verifica que abre | En cada publicación | — |

- La copia dentro del servidor protege de errores de la app o míos. La copia fuera protege de que se rompa o se pierda el VPS. **Sin la copia externa, si muere el disco se pierde todo**: por eso está en la lista de clics.
- Alex puede pedir un respaldo en el momento y ver el estado del último desde la puerta MCP.
- MANUAL.md va a tener el paso a paso para restaurar.

## 4. Cómo va a manejar Alex el proyecto

### 4.1 Usar la app (puerta MCP)
- Dirección: `https://<subdominio>/mcp`, sobre HTTPS.
- Alex es un **usuario propio** dentro de la app, llamado "Alex", con rol de administrador general. Todo lo que hace queda en la actividad con su nombre, igual que una persona.
- Herramientas: una por cada cosa que la app permite (espacios, tableros, listas, tarjetas, checklists, etiquetas, miembros, invitaciones, permisos, configuración, búsqueda, actividad, automatizaciones, respaldo). Regla del proyecto: **función nueva en la app = herramienta nueva en la puerta, en la misma tanda**, y una prueba automática verifica que no falte ninguna.
- Acceso: con clave propia. **No verificado todavía:** de qué forma exacta el "conector personalizado" de Claude acepta la clave hoy (hay dos formas posibles: el permiso estándar llamado OAuth, donde vos aprobás una vez desde la app; o una clave larga dentro de la dirección). Lo verifico al empezar la Fase 3 y uso la que funcione; la app va a estar preparada para las dos.

### 4.2 Cambiar el código
- Repositorio público `emisalasporta/tablero`. Adentro, siempre al día: `CLAUDE.md` (reglas), `PLAN.md` (este), `PARIDAD.md` (control), `MANUAL.md` (cómo se prueba, publica, respalda y vuelve atrás), `ANALISIS-TRELLO.md`.
- Regla: ninguna tanda se da por terminada sin actualizar PARIDAD.md y MANUAL.md.
- Cualquier sesión de Claude que abra el repositorio puede seguir sola: un solo comando para probar (`npm test`), uno para levantar la app en la Mac.

### 4.3 Publicar solo
- Subir a `main` → GitHub avisa a Dokploy → Dokploy arma y publica.
- **Dato verificado en tu proyecto `gastos`** (archivo DESPLIEGUE.md): con el molde actual la publicación automática **no** se activó sola; hubo que apretar Deploy a mano. Falta conectar el aviso de GitHub a Dokploy (un "webhook": una dirección que GitHub llama cada vez que hay cambios). Está en la lista de clics.
- Las pruebas corren **dentro del armado** (en el Dockerfile). Si una falla, el armado falla y Dokploy deja funcionando la versión anterior. Esto último lo verifico con una publicación rota a propósito en la Fase 4.
- Segunda red: las mismas pruebas corren en GitHub en cada cambio (gratis en repositorios públicos) y dejan una marca verde o roja.

### 4.4 Ver el servidor
- Dokploy tiene una API (una puerta para programas) que se usa con una clave. La clave va en variables de Dokploy y en PRIVADO.md, nunca en el repositorio.
- Tres caminos, para que Alex no quede ciego si la app está caída:
  1. **Desde la puerta MCP** (herramientas "servidor"): estado de la última publicación, leer errores, volver a publicar. Sirve cuando la app anda.
  2. **Desde Claude Code en tu Mac:** lee la clave de PRIVADO.md y habla directo con Dokploy. Sirve aunque la app esté caída.
  3. **Desde GitHub:** una acción manual "volver a publicar" guardada en el repositorio, con la clave como secreto de GitHub.
- **No verificado:** qué versión de Dokploy tenés y qué permite exactamente su API (solo comprobé que el panel responde). Se verifica en la Fase 4 con la clave.

### 4.5 Volver atrás
- Código: se revierte el último cambio en `main` y se publica solo la versión anterior (2-3 minutos).
- Datos: se restaura el respaldo previo a la migración (queda uno automático antes de cada cambio de estructura).
- Todo el procedimiento, con comandos exactos, en MANUAL.md, y probado una vez de verdad en la Fase 4.

## 5. Qué entra en cada tanda

Cada tanda termina con: pruebas en verde, PARIDAD.md actualizada, y una demostración para vos.

### Fase 2 — El corazón
| Tanda | Qué entra |
|---|---|
| 2.0 | Crear el repositorio. Esqueleto de la app con pruebas desde el primer día. **Muestra de diseño para tu ok.** |
| 2.1 | Cuentas e ingreso, espacios de trabajo, miembros, invitados, invitaciones por enlace, permisos y visibilidad de tableros. |
| 2.2 | Tableros, listas y tarjetas: crear, renombrar, ordenar, **arrastrar** (mouse y dedo), archivar, mover, copiar. **Tiempo real** entre pantallas. |
| 2.3 | Tarjeta abierta: descripción con formato, etiquetas, miembros, fechas (inicio, vencimiento, completada), checklists, portadas, adjuntos, comentarios con menciones y reacciones, actividad. |
| 2.4 | Instalable en iPhone (PWA), modo claro/oscuro, fondos de tablero, tableros favoritos y recientes, menú del tablero, elementos archivados. |

### Fase 3 — La puerta de Alex
Servidor MCP con todas las herramientas, usuario "Alex", clave propia, actividad con su nombre, prueba que verifica cobertura total.

### Fase 4 — Publicación
Dokploy con el molde de `gastos` + volumen, dominio con HTTPS, publicación automática, respaldo diario con copia externa, acceso de Alex a Dokploy, MANUAL.md, y ensayo real de "publicación rota" y de "vuelta atrás".

### Fase 5 — Traer tus tableros
Importador de la exportación JSON de Trello: tableros, listas, tarjetas, etiquetas, checklists, fechas, miembros (emparejados por nombre/correo), comentarios, actividad, adjuntos (los archivos se bajan de Trello mientras tu cuenta siga activa), campos personalizados. Se ensaya primero con un tablero chico.

### Fase 6 — El resto, hasta completar PARIDAD.md
| Tanda | Qué entra |
|---|---|
| 6.1 | Notificaciones: campana, avisos en el iPhone, por correo, seguir tarjetas/listas/tableros, recordatorios de vencimiento. |
| 6.2 | Búsqueda global con operadores, filtros del tablero, atajos de teclado, edición rápida. |
| 6.3 | Vistas: tabla, calendario, cronograma, panel, mapa; vistas de espacio de trabajo. |
| 6.4 | Campos personalizados, plantillas (tablero y tarjeta), stickers, votos, envejecimiento, límites y colores de lista, listas colapsables, tarjetas espejo, tarjetas enlace, separadores, tarjetas repetidas. |
| 6.5 | Automatizaciones: reglas, botones de tarjeta y de tablero, programadas, por vencimiento. |
| 6.6 | Bandeja de entrada y Planificador, tarjetas por correo, calendario exportable. |
| 6.7 | Exportar e imprimir, API y avisos salientes para otros programas, ajustes de administración, accesibilidad, idiomas. |

### Fase 7 — Sumar al equipo
Invitaciones reales, guía corta de uso, revisión de permisos.

**Propuesta (necesita tu ok):** adelantar a la tanda 2.0 una **publicación de prueba vacía** en Dokploy. Motivo: en `gastos` la publicación automática falló, y conviene descubrir y resolver eso el día 1 y no en la Fase 4. No cambia el orden de lo demás.

## 6. Lo que vas a tener que hacer vos, una sola vez

Te los voy a pedir de a uno, con los valores exactos, cuando llegue el momento.

| # | Qué | Cuándo | Por qué no puedo yo |
|---|---|---|---|
| 1 | ~~Darle a esta Mac permiso para escribir en GitHub como `emisalasporta`~~ | — | **Resuelto sin clic:** la cuenta ya estaba conectada en esta Mac; el repositorio usa esa cuenta. |
| 2 | ~~En Dokploy: crear la aplicación `tablero`~~ | — | **Resuelto:** la creé por la API de Dokploy. |
| 3 | ~~En Dokploy: crear una clave de API~~ | — | **Resuelto:** la generé desde tu sesión abierta en Chrome, con tu permiso; está en PRIVADO.md. |
| 4 | En Cloudflare: crear el subdominio (propongo `meetmydash.emilianosalasporta.cloud`) apuntando al servidor. Hoy no existe (verificado). | Fase 4 | Es tu cuenta. |
| 5 | En Cloudflare: crear el depósito para la copia externa del respaldo y su clave. | Fase 4 | Es tu cuenta. |
| 6 | En Claude: sumar el conector personalizado con la dirección de la puerta MCP. | Fase 3/4 | Solo vos podés sumar conectores. |
| 7 | En el iPhone: abrir la app en Safari → Compartir → "Agregar a inicio" y aceptar las notificaciones. | Fase 6.1 | Es tu teléfono. |
| 8 | (Opcional) Una cuenta de envío de correos, para invitaciones y avisos por correo. Sin esto todo funciona, pero invitás pasando un enlace y no hay avisos por correo. | Fase 6.1 | Es una cuenta a tu nombre. |

Con el punto 1 resuelto, el aviso de GitHub a Dokploy (publicación automática) lo configuro yo.

## 7. Riesgos concretos

| Riesgo | De qué depende | Qué pasa si falla | Cómo se cubre |
|---|---|---|---|
| La publicación automática no dispara | El aviso de GitHub a Dokploy | Los cambios quedan sin publicar hasta apretar Deploy a mano (ya pasó en `gastos`) | Se configura y se prueba en la primera publicación; camino alternativo por la API de Dokploy. |
| El conector de Claude no acepta la forma de clave elegida | Cómo funcionan hoy los conectores personalizados (no verificado) | Alex no puede entrar a la puerta | La app soporta las dos formas; se verifica al inicio de la Fase 3. |
| Notificaciones en iPhone | iOS solo permite avisos de apps web **instaladas en la pantalla de inicio** (iOS 16.4 o más nuevo) | Sin instalar, no hay avisos en el teléfono | Guía de instalación; campana y correo como respaldo. |
| Pérdida de datos | El volumen de Dokploy y el disco del VPS | Sin volumen, cada publicación borra todo; si muere el disco, se pierde todo | Volumen obligatorio (verificado al publicar), respaldo diario y copia externa. |
| Un cambio automático rompe la app | Calidad de las pruebas | Publicación con errores | Pruebas dentro del armado, copia antes de cada migración, vuelta atrás documentada y ensayada. |
| El arrastre en iPhone no se siente bien | Diferencias de Safari con el dedo | Uso incómodo en el celular | Arrastre hecho a medida y probado en iPhone real en la tanda 2.2; es el punto donde más conviene que pruebes vos. |
| Dos personas editan lo mismo a la vez | Reglas de sincronización | Se pisa un cambio | Regla simple y probada: gana el último por campo; el orden usa posiciones intermedias (como Trello) para que dos movimientos no choquen. |
| La base de datos en un archivo se queda corta | Cantidad de gente escribiendo a la vez | Lentitud con cientos de usuarios simultáneos | Para equipos de decenas sobra. Si algún día hiciera falta, se migra a una base más grande sin cambiar la app por fuera. |
| Importación de Trello incompleta | Lo que trae el JSON de Trello (la exportación gratis trae actividad limitada; los adjuntos son enlaces a Trello) | Falta historial viejo o adjuntos si se cierra la cuenta antes | Importar con la cuenta de Trello activa; informe de qué entró y qué no. |
| El proyecto es largo | Cantidad de funciones de PARIDAD.md | Cansancio, tandas a medias | Tandas cortas con demostración; PARIDAD.md muestra el avance real. |
| La clave de Alex se filtra | Dónde se guarde | Alguien con acceso de administrador | Clave solo en Claude y en variables; se puede anular y regenerar desde la app. |
| Trello cambia | — | Nada: la app no depende de Trello para funcionar | Solo afecta a la importación. |

## 8. Estado
- Fase 1: hecha y aprobada.
- Tanda 2.0: hecha (falta solo el subdominio definitivo). Sigue la tanda 2.1.
