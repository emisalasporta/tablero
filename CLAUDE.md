# Tablero — mi Trello propio

## Quién soy y cómo hablarme
- Soy Emiliano. No sé programar: dirijo el desarrollo con instrucciones en lenguaje natural. Todo en español.
- Sin jerga. Si un término técnico es inevitable, explicalo en criollo en una línea antes de usarlo.
- Una cosa por vez. Si algo lo tengo que hacer yo, dame UN paso con los valores exactos para copiar y esperá a que diga "listo".
- Antes de pedirme algo, agotá todo lo que puedas hacer vos.
- Verificá antes de afirmar. Si algo no lo pudiste verificar, decilo. No inventes datos.
- Quiero que salga bien y a la primera. Si un problema se estira y entramos en un bucle, avisame: prefiero borrar y empezar de nuevo.

## Qué quiero
- Lo mismo que Trello, nada más y nada menos. Ninguna forma de trabajo mía viene de fábrica: listas, etiquetas, colores, plantillas y reglas se configuran desde la app, como en Trello.
- Usuarios ilimitados sin costo por persona, con los mismos niveles de acceso que Trello (espacios de trabajo, tableros, miembros, invitados, permisos).
- Lo que mueve uno lo ven los demás al instante, sin recargar.
- Que se use muy bien desde el iPhone, instalable en la pantalla de inicio y con notificaciones.
- Que Alex pueda manejar todo el proyecto (ver la sección de abajo).

## Que Alex maneje el proyecto (requisito de base, no un agregado)
Alex es Claude en mi chat y en Cowork. Tiene que poder manejar este proyecto de punta a punta, lo más automático posible y sin depender de mí:
- Usar la app: una puerta MCP con HTTPS, que se suma como conector personalizado en Claude, le da acceso de administrador a TODO lo que la app permite (espacios, tableros, listas, tarjetas, miembros, permisos, configuración), con una clave propia. Cada acción de Alex queda en la actividad con su nombre.
- Cambiar el código: el proyecto vive en un repositorio de GitHub (emisalasporta/tablero). Cualquier sesión de Claude que lo abra tiene que poder entender todo y seguir sola: este CLAUDE.md, PLAN.md, PARIDAD.md y un MANUAL.md (cómo se prueba, cómo se publica, cómo se vuelve atrás) siempre al día.
- Publicar solo: cada cambio que llega a la rama main se publica solo en Dokploy.
- Red de seguridad para que los cambios automáticos no rompan nada: pruebas automáticas que corren al armar la app (si fallan, no se publica), respaldo automático diario de los datos y una forma documentada de volver a la versión anterior.
- Ver el servidor: dejar preparado el acceso de Alex a Dokploy por su API (la clave va en variables, nunca en el repositorio) para ver si se publicó, leer errores y volver a publicar.
- El repositorio es público: nada sensible adentro. Claves, contraseñas y direcciones del servidor van en PRIVADO.md (ignorado por git) o en variables de Dokploy.
- Lo que sí o sí necesite un clic mío (sumar el conector en Claude, dar acceso al repositorio), juntalo en una lista corta para hacerlo una sola vez.

## Diseño
- Más moderno que Trello y con identidad propia: no se copian el logo, los íconos, los textos, el nombre ni la apariencia de Trello.
- Que no parezca hecho con IA: nada de diseños genéricos iguales a todos.
- Limpio, equilibrado, sin amontonamientos ni espacios vacíos. Modo claro y oscuro.

## Cómo se analiza Trello
- Con REA, que ya está instalado en este Claude Code: la web de Trello (trello.com) y, si está instalada, la app de Trello para Mac. Para entender qué datos maneja cada parte, cómo se ordena, cómo se sincroniza en tiempo real, permisos, arrastre, actividad, notificaciones y automatizaciones.
- Para la web de Trello no hace falta Hopper. Si REA lo ofrece, no lo instales.
- Además, el centro de ayuda público de Trello, para no dejar afuera ninguna función.
- Solo mirar: no crear, mover ni borrar nada en mis tableros reales. Si necesitás probar algo, pedime que cree un tablero de prueba.
- No saltees inicios de sesión ni protecciones, y no hagas pedidos masivos a sus servidores.
- Lo que aprendas se escribe con tus palabras y la app se programa de cero: no se copia código de Trello.

## Lista de paridad (el control del proyecto)
- PARIDAD.md lista TODAS las funciones de Trello, agrupadas por tema, cada una con su estado: hecha / pendiente / no se puede (y por qué).
- Se actualiza al terminar cada tanda. Es como yo controlo qué tan cerca estamos de Trello.

## Infraestructura
- Los datos del servidor, el dominio y la forma de publicar están en PRIVADO.md (en esta misma carpeta, ignorado por git). Hay que leer PRIVADO.md antes de tocar cualquier cosa de publicación o servidor.

## Fases
1. Analizar Trello y planificar, sin código. Se frena hasta mi ok.
2. Crear el repositorio en GitHub y armar el corazón: espacios de trabajo, tableros, listas, tarjetas, arrastre, miembros, permisos, etiquetas, portadas, fechas, checklists, comentarios, adjuntos y actividad, en tiempo real. Con las pruebas automáticas desde el primer día.
3. La puerta para Alex (MCP) con acceso de administrador completo.
4. Publicarlo en mi servidor con publicación automática, respaldo diario y acceso de Alex a Dokploy.
5. Traer mis tableros actuales desde la exportación JSON de Trello.
6. El resto de las funciones de Trello, por tandas, hasta completar la lista de paridad (vistas, plantillas, campos personalizados, automatizaciones, etc.).
7. Recién ahí, sumar al equipo.

## Estado actual (lo actualiza Claude al terminar cada tanda)
- Fase 1 hecha y aprobada el 25/11/2026. Emiliano aceptó adelantar una publicación de prueba vacía a la tanda 2.0.
- En curso: tanda 2.0. Hecho: esqueleto con pruebas, repositorio público emisalasporta/tablero, pruebas corriendo en GitHub. Diseño aprobado por Emiliano el 25/11/2026: es diseno/muestra.html (azul y letras de emilianosalasporta.cloud, cada lista con fondo propio que contiene sus tarjetas); todas las pantallas salen de esos colores, letras y piezas. Falta: la publicación de prueba en Dokploy. Ver PLAN.md y MANUAL.md.
- La app se llama **meetmydash**; la carpeta y el repositorio se llaman `tablero`.
