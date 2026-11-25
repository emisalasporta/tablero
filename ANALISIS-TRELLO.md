# Análisis de Trello

Fecha del análisis: 25/11/2026. Escrito con mis palabras; no se copió código ni textos de Trello.

## Cómo se hizo y qué tan confiable es cada cosa

Cada afirmación de este documento lleva una de estas marcas:

- **[V]** Verificado con evidencia propia en este análisis (lo vi con REA).
- **[A]** Leído en el centro de ayuda público de Trello durante este análisis.
- **[D]** Deducido: razonamiento mío a partir de lo anterior o conocimiento general de Trello. Puede estar desactualizado.

Qué se miró con REA:

1. **La app de Trello para Mac** instalada en esta computadora (versión 2.16.7). Se leyó el paquete sin ejecutarlo.
2. **La web de Trello sin iniciar sesión**, abriendo en un navegador temporal una **plantilla pública** de la galería de Trello (un tablero de ejemplo de Atlassian, "1-on-1 Meeting Agenda") y una de sus tarjetas. Se registró qué datos pide la página y cómo se conecta.

Qué **no** se hizo, a propósito:
- No se abrieron ni tocaron tus tableros reales. No se inició sesión en ningún lado.
- No se probó ninguna acción que escriba (crear, mover, comentar). Por eso, todo lo que es "qué pasa cuando alguien hace X" está marcado [D] o [A], no [V].
- En total fueron 4 visitas a trello.com (una página de plantillas, un pedido a la galería, un tablero, una tarjeta).

Límite importante: como no vi a nadie mover una tarjeta, **el formato exacto de los avisos en vivo de un cambio no está verificado**; sí está verificado el mecanismo (ver punto 3). Si hace falta más precisión, el camino es que crees un tablero de prueba y lo observemos juntos.

---

## 1. La app de Mac: es un marco alrededor de la web

- **[V]** Es una app hecha con Electron (una tecnología que mete una página web dentro de una ventana de escritorio). Adentro carga `trello.com`; no trae la lógica de tableros propia.
- **[V]** Lo que agrega por encima de la web: ventana de "tarjeta nueva rápida", atajos de teclado globales (funcionan aunque la app no esté al frente), ícono en la barra de menú, contador de notificaciones en el ícono, avisos del sistema, menú con tableros favoritos, barra táctil, buscar dentro de la página, ventana de descargas, preferencias, cambio de cuenta, actualización automática y un tipo de enlace propio para abrir Trello desde otras apps.
- **[V]** Pide permiso de micrófono para "captura por voz".
- **Conclusión [D]:** para igualar "la app de escritorio" alcanza con que la nuestra sea instalable (PWA). Lo único que no se puede igualar desde una app web son los atajos globales del sistema.

## 2. Qué datos maneja Trello

Los nombres entre paréntesis son los que usa Trello por dentro; sirven para la importación de la Fase 5.

### 2.1 Las piezas y cómo cuelgan una de otra
**[V]** salvo indicación:

```
Persona (member)
Espacio de trabajo (organization)
 └─ Tablero (board)
     ├─ Miembros del tablero con su rol (memberships)
     ├─ Etiquetas (labels)
     ├─ Campos personalizados (customFields)
     ├─ Power-Ups activados y sus datos (boardPlugins, pluginData)
     └─ Lista (list)
         └─ Tarjeta (card)
             ├─ Miembros, etiquetas
             ├─ Checklists (checklists) → ítems (checkItems)
             ├─ Adjuntos (attachments)
             ├─ Portada (cover)
             ├─ Stickers
             ├─ Valores de campos personalizados (customFieldItems)
             └─ Actividad y comentarios (actions) → reacciones
```

- Cada cosa tiene un identificador largo, y tableros y tarjetas tienen además un **código corto** que va en la dirección web (`/b/XXXXXXXX`, `/c/XXXXXXXX`). Las tarjetas tienen también un **número correlativo dentro del tablero** (idShort).

### 2.2 Espacio de trabajo
**[V]** Datos: nombre, nombre visible, descripción, sitio web, logo, lista de miembros con su tipo (administrador / normal), y estas preferencias:
- Visibilidad del espacio (público o privado).
- Quién puede ser invitado (restricción por dominio de correo).
- Si se permiten invitados externos.
- **Quién puede crear tableros de cada visibilidad** (privado, del espacio, público): cualquier miembro, solo administradores o nadie.
- **Quién puede borrar tableros de cada visibilidad**: igual.
- Restricciones de adjuntos.
- Plan contratado y lista de funciones habilitadas por el plan (ver 2.9).
- Límites: 4.000 miembros por espacio; en el plan gratis, 10 tableros abiertos y 10 colaboradores por espacio.

### 2.3 Tablero
**[V]** Datos: nombre, descripción, cerrado sí/no y fecha de cierre, a qué espacio pertenece, fecha de última actividad, fecha de última vista, si está fijado, si está marcado como favorito, quién lo creó, de qué tablero se copió, y sus preferencias:

| Preferencia | Valores |
|---|---|
| Visibilidad | privado, del espacio de trabajo, de la organización (Enterprise), público |
| Quién comenta | deshabilitado, miembros, observadores, miembros del espacio, cualquiera **[D: lista completa]**; vi "miembros" |
| Quién invita | miembros o solo administradores **[D]**; vi "miembros" |
| Quién vota | igual que comentar **[D]**; vi "deshabilitado" |
| Los miembros del espacio pueden unirse solos | sí/no |
| Mostrar portadas en las tarjetas | sí/no |
| Mostrar el tilde de "completada" | sí/no |
| Mostrar cantidad de tarjetas por lista | sí/no |
| Ocultar votos | sí/no |
| Envejecimiento de tarjetas | normal o "pirata" |
| Es plantilla | sí/no |
| Calendario exportable activado | sí/no |
| Archivado automático | (existe el campo; valores no vistos) |
| Vistas habilitadas | Tablero, Tabla, Calendario, Panel, Cronograma, Mapa: cada una encendida o apagada |
| Fondo | color liso, degradado o imagen; con versión para modo oscuro, varias medidas de la imagen, si se repite en mosaico, y si el fondo es "claro" u "oscuro" (para elegir el color del texto de encima) |

- **[V]** Los nombres de las etiquetas se guardan por color. Colores: verde, amarillo, naranja, rojo, violeta, azul, celeste, lima, rosa y negro, cada uno en tres tonos (claro, normal, oscuro) = 30, más "sin color".
- **[V]** Preferencias **por persona** en cada tablero: mostrar u ocultar el panel lateral y sus secciones, dirección de correo propia para crear tarjetas por mail (con lista y posición de destino), y mostrar tarjetas espejo en forma compacta.

### 2.4 Lista
**[V]** Datos: nombre, posición, cerrada (archivada) sí/no, color, límite de tarjetas (aviso, no bloqueo), si la sigo, y un "tipo" (para listas especiales). Existe también un campo de "fuente de datos / filtro" **[D: listas que se llenan solas]**.

### 2.5 Tarjeta
**[V]** Datos del frente y del dorso:
- Título y descripción (texto con formato; se guarda aparte la lista de emojis usados).
- Lista en la que está, posición, cerrada (archivada) y fecha.
- Miembros asignados, etiquetas.
- Fecha de inicio, fecha de vencimiento, **vencimiento cumplido sí/no**, recordatorio (minutos antes), regla de repetición.
- Portada: puede ser un color, una imagen subida, un adjunto de la tarjeta o una imagen de un Power-Up; tamaño "normal" (franja arriba) o "completa" (toda la tarjeta); tono claro/oscuro para el texto; posición vertical de recorte.
- Ubicación: nombre del lugar, dirección y coordenadas, con imagen de mapa.
- Si es plantilla de tarjeta.
- **Rol especial de tarjeta** (cardRole): es lo que distingue tarjetas normales de separadores, tarjetas-enlace, tarjetas-tablero y tarjetas espejo **[D: lista de roles]**. Para las espejo se guarda cuál es la tarjeta original.
- Enlace de origen (cuando la tarjeta nace de un link, mail o mensaje) con su ícono.
- Dirección de correo propia de la tarjeta (para agregarle comentarios por mail).
- Quiénes votaron.
- Si la sigo.
- Fecha de última actividad (se usa para el envejecimiento).
- Datos de funciones de IA (resúmenes, sugerencias).
- **"Insignias"** (badges): un resumen ya calculado para dibujar el frente sin cargar todo: cantidad de comentarios, de adjuntos, ítems de checklist hechos/total, fecha más próxima de un ítem, si tiene descripción, si tiene ubicación, votos, si la sigo, vencimiento y si está cumplido.

**Checklist [V]:** nombre, posición, tarjeta. **Ítem [D + A]:** texto, hecho sí/no, posición y, en "checklists avanzadas", persona asignada y fecha.

**Adjunto [V]:** nombre, dirección, si es archivo subido o enlace, tipo, tamaño, fecha, quién lo subió, posición, color dominante (para el borde de la portada), vistas previas en varias medidas, y marca de "archivo peligroso".

**Sticker [V]:** imagen, posición horizontal y vertical, rotación y capa.

### 2.6 Persona
**[V]** Datos: nombre completo, iniciales, nombre de usuario, avatar, biografía, correo, si confirmó el correo, formas de ingreso, preferencias (idioma, zona horaria, avisos, modo daltónico, etc. **[D: detalle]**), a qué tableros y espacios pertenece, y avisos ya descartados.

### 2.7 Actividad
**[D]** No pude capturar actividad (la tarjeta pública de ejemplo no tenía). Por la documentación pública de Trello para programadores: cada cambio genera un registro con **tipo** (crear tarjeta, mover, comentar, sumar miembro, etc.), **quién**, **cuándo** y **los datos necesarios para redactar la frase** (nombre de la tarjeta, lista de origen y destino, valor anterior). Los comentarios **son** registros de actividad de tipo "comentario", por eso aparecen mezclados en la misma línea de tiempo. **[V]** Sí vi que la app pide la actividad con sus reacciones incluidas y que el límite es de 900 reacciones por comentario y 17 emojis distintos.

### 2.8 Límites que impone Trello
**[V]** (vienen escritos en los datos del tablero; Trello avisa al 80 %):

| Qué | Máximo |
|---|---|
| Tarjetas abiertas por tablero / por lista | 5.000 / 5.000 |
| Tarjetas totales (con archivadas) por tablero / por lista | 2.000.000 / 1.000.000 |
| Listas abiertas / totales por tablero | 500 / 3.000 |
| Etiquetas por tablero | 1.000 |
| Checklists por tarjeta / por tablero | 500 / 1.800.000 |
| Ítems por checklist | 200 |
| Adjuntos por tarjeta / por tablero | 1.000 / 36.000 |
| Stickers por tarjeta | 70 |
| Campos personalizados por tablero / opciones por campo | 50 / 50 |
| Miembros por tablero | 1.600 |
| Pedidos de acceso por tablero | 4.000 |

Para nosotros estos números sirven como referencia de "hasta dónde tiene que aguantar".

### 2.9 Funciones atadas al plan
**[V]** Trello marca en cada espacio de trabajo qué funciones tiene habilitadas según lo que paga. La lista que vi en un espacio pago incluye: checklists avanzadas, vistas, vistas de espacio de trabajo, listas colapsables, colores de lista, observadores, invitados en varios tableros, fondos y stickers propios, emojis propios, exportación (incluida CSV), plantillas privadas, búsquedas guardadas, tarjetas espejo ampliadas, automatización ampliada, restricciones de visibilidad, superadministradores, adjuntos grandes y funciones de IA. **En nuestra app todo eso va habilitado para todos**: no hay planes.

## 3. Cómo se sincroniza en tiempo real

- **[V]** Al abrir un tablero, la página pide los datos en pocos pedidos grandes: uno con la información del tablero (preferencias, etiquetas, miembros, espacio) y otro con **todas las listas abiertas y todas las tarjetas visibles** con lo necesario para dibujar el frente. Los detalles del dorso (actividad, adjuntos completos, ubicación) se piden recién **al abrir la tarjeta**.
- **[V]** Enseguida abre **conexiones permanentes** con el servidor (WebSocket: una línea que queda abierta en los dos sentidos) y se **suscribe** al tablero y a su espacio de trabajo. El servidor confirma cada suscripción. Cada tanto se manda un "¿seguís ahí?" para detectar cortes.
- **[V]** Por esa línea el servidor manda **solo lo que cambió**, indicando qué campos cambiaron (por ejemplo "cambió el fondo" o "cambiaron las listas"), y eventos puntuales con nombre: lista movida, lista borrada, tarjeta movida, tarjeta borrada, etiqueta borrada, campo personalizado borrado, miembros agregados, miembros quitados, Power-Up quitado.
- **[V]** Trello tiene hoy **dos sistemas de sincronización andando a la vez** (uno viejo y uno nuevo, en transición). Nosotros necesitamos uno solo.
- **[D]** Al hacer un cambio, la pantalla lo muestra al instante sin esperar al servidor ("optimista") y, si el servidor lo rechaza, lo deshace. Al reconectarse después de un corte, vuelve a pedir el tablero para ponerse al día.

**Para nuestra app:** un pedido para cargar el tablero + una línea abierta por tablero + avisos de "qué cambió" a todos los que lo miran + recarga al reconectar.

## 4. Cómo se ordenan listas y tarjetas

- **[V]** Cada lista y cada tarjeta guarda un **número de posición** con decimales. Se ordena de menor a mayor.
- **[V]** Los números no son 1, 2, 3: están muy separados (vi saltos de 4.096 y de 65.536). Para meter algo **entre** dos, se le pone el número del medio: vi tarjetas con 131.071,5 y 196.607,25, que son puntos medios entre vecinas.
- **[D]** Ventaja: mover una tarjeta cambia **un solo dato** (el de esa tarjeta), no hay que renumerar las demás, y dos personas moviendo cosas distintas a la vez no se pisan. Cuando dos números quedan demasiado pegados después de muchas inserciones, se renumera esa lista con separación pareja.
- **[V]** Lo mismo vale para checklists y adjuntos (también tienen posición).
- **[D]** "Arriba de todo" y "abajo de todo" se resuelven con la mitad del menor o el mayor más un salto.

## 5. Permisos

**[V]** estructura; **[A/D]** reglas finas:

- **Tres niveles:** espacio de trabajo → tablero → (persona).
- **En el espacio:** administrador o miembro normal. Los administradores cambian ajustes, suman y sacan gente y ven todos los tableros del espacio. **Invitado** es alguien que está en uno o más tableros del espacio sin ser miembro del espacio.
- **En el tablero:** administrador, miembro normal, **observador** (ve y, según ajuste, comenta y vota; no edita).
- **Visibilidad del tablero:** privado (solo sus miembros), del espacio (todos los miembros del espacio lo ven y, según ajuste, pueden editar o sumarse), público (cualquiera con el enlace lo ve, sin cuenta). **[V]** El tablero público se ve efectivamente sin iniciar sesión.
- **Ajustes por tablero:** quién comenta, quién invita, quién vota, si los miembros del espacio pueden unirse solos.
- **Ajustes por espacio:** quién puede crear y quién puede borrar tableros de cada visibilidad, restricción de invitaciones por dominio, si se admiten invitados.
- **[V]** Existe el "pedido de acceso" a un tablero (alguien sin permiso lo pide y un administrador aprueba).
- **[D]** El servidor revisa el permiso en cada pedido; la pantalla solo esconde lo que no podés hacer.

## 6. Arrastre

**[D]** (no lo observé en acción)
- Se arrastran tarjetas (dentro de la lista y entre listas), listas (reordenar), ítems de checklist, checklists, adjuntos y stickers.
- Mientras se arrastra aparece un hueco donde va a caer; el tablero se desplaza solo al acercarse a los bordes.
- Al soltar se calcula la nueva posición (punto 4) y se envía **un solo cambio**: lista de destino + posición.
- En celular, mantener apretado para levantar la tarjeta.
- También se puede "mover" sin arrastrar, desde un menú, eligiendo tablero, lista y posición.

## 7. Notificaciones

**[D/A]** (requiere sesión; no observado)
- Te avisan cuando: te suman a una tarjeta o tablero, te mencionan con @, comentan o cambian algo en una tarjeta que seguís o en la que estás, se acerca o pasa un vencimiento tuyo, te invitan.
- "Seguir" (tarjeta, lista o tablero) es la llave: recibís avisos de todo lo que pase ahí.
- Canales: campana dentro de la app (con leído/no leído), correo (al instante o resumen periódico), avisos en el celular y en el escritorio.
- **[V]** La app de Mac recibe de la web el número de notificaciones sin leer y lo muestra en el ícono.

## 8. Automatizaciones

**[A/D]** (el detalle de disparadores y acciones está en PARIDAD.md, sección Automatización)
- Cinco tipos: **reglas** (cuando pasa X, hacer Y), **botones de tarjeta**, **botones de tablero**, **programadas** (cada lunes, cada día 1…) y **por vencimiento** (2 días antes de vencer…).
- Cada una es: un disparador + condiciones opcionales + una lista de acciones en orden.
- **[V]** Trello guarda las automatizaciones como datos de un "Power-Up" interno asociado al tablero, y registra qué acciones fueron hechas por automatización.
- Datos que necesitamos: disparador, condiciones, acciones, dueño, activa sí/no, historial de ejecuciones y errores.

## 9. Otras cosas vistas en la web

- **[V]** Hay funciones nuevas con nombre propio que aparecen en los pedidos: **tarjetas espejo**, **Planificador** (eventos de calendario ligados a tarjetas), **Bandeja de entrada** y **captura rápida con IA**.
- **[V]** Trello enciende y apaga funciones por usuario con "interruptores remotos" (para probar novedades con parte de la gente). Por eso dos cuentas pueden ver cosas distintas el mismo día. No lo necesitamos.
- **[V]** La web carga las pantallas por partes (solo baja el código de lo que estás usando) para abrir rápido.
- **[V]** Las plantillas públicas son tableros comunes marcados como plantilla, con una ficha de galería (categoría, autor, descripción corta, cantidad de vistas y de copias).

## 10. Qué nos llevamos para construir

1. Mismo árbol de piezas del punto 2.1, con los mismos datos por pieza (así la importación de la Fase 5 es directa).
2. Posiciones con números separados y punto medio (punto 4).
3. Carga del tablero en un pedido + una línea abierta por tablero con avisos de cambios (punto 3).
4. "Insignias" calculadas para dibujar el frente de las tarjetas sin cargar el dorso.
5. Permisos en tres niveles revisados siempre en el servidor (punto 5).
6. Actividad como registro único del que salen la línea de tiempo, los comentarios y las notificaciones (puntos 2.7 y 7).
7. Todo habilitado para todos: sin planes.

## 11. Lo que quedó sin verificar (y cómo verificarlo si hace falta)

| Tema | Por qué no se verificó | Cómo se podría |
|---|---|---|
| Formato exacto de los avisos al mover/editar | No se hizo ninguna acción de escritura | Tablero de prueba creado por vos + observación |
| Lista completa de tipos de actividad | La tarjeta pública no tenía actividad | Tu exportación JSON de la Fase 5 la trae completa |
| Notificaciones, búsqueda, automatizaciones por dentro | Requieren sesión iniciada | Tablero de prueba, o guiarnos por el centro de ayuda (suficiente para construir) |
| Bandeja de entrada y Planificador por dentro | Requieren sesión | Idem |
