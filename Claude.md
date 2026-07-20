# Contexto del proyecto — LÉEME PRIMERO

Este repositorio es mi Proyecto de Grado (Ingeniería de Sistemas): un
**SISTEMA WEB CON TECNOLOGÍA BLOCKCHAIN** para la gestión segura de
calificaciones y evaluación docente. Caso de estudio: Escuela de Comando
y Estado Mayor del Ejército (ECEME).

## La idea principal es el BLOCKCHAIN
No es una función secundaria: es la razón de ser del proyecto. Todo el
sistema existe para que las notas y las evaluaciones docentes queden
registradas de forma **INMUTABLE, TRAZABLE y AUDITABLE**, imposibles de
alterar. Cuando leas o modifiques código, la capa blockchain
(encadenamiento de bloques por hash e inmutabilidad de las actas) es el
corazón del sistema y siempre debe respetarse. Nunca la trates como algo
decorativo ni la quites para "simplificar".

## Arquitectura (Full Stack)
- **Frontend:** React.js + Tailwind CSS
- **Backend:** Node.js + Express.js (API REST)
- **BD relacional:** MySQL → datos operativos del día a día (usuarios,
  roles, materias, notas mientras se están editando)
- **Blockchain:** cadena **privada/permisionada** implementada en la
  lógica del backend con el módulo nativo `crypto` y **SHA-256**. No es
  Ethereum ni una red pública.
- **Apoyo:** Bcrypt.js (contraseñas), jsPDF/AutoTable (reportes PDF)

## Cómo funciona el blockchain aquí
Las notas se editan normalmente en MySQL. Cuando el administrador
**publica un acta** de calificaciones, ese registro final se empaqueta en
JSON, se le calcula un hash SHA-256 y se guarda como un **bloque encadenado
al anterior** (cada bloque incluye el hash del bloque previo). Desde ese
momento es inmutable: no se edita ni se borra; las correcciones solo se
hacen añadiendo un nuevo bloque de adenda. Cualquier alteración rompe la
cadena y se detecta.

## Roles
- **Administrador:** gestiona cursantes, docentes y materias; publica
  actas; genera PDFs.
- **Docente:** sube notas (Parcial 30%, Final 60%, Trabajos 10%); ve su
  calificación docente (1–5 estrellas).
- **Cursante:** ve sus notas y evalúa a sus docentes (escala 1–5).

## Regla clave para ti (Claude Code)
Mantén siempre la arquitectura híbrida **MySQL + blockchain** y la lógica
de inmutabilidad/encadenamiento. Ante cualquier cambio, pregúntate si
afecta la integridad de la cadena de actas.

---

# Registro de avances — 2026-07-16

> **PocketBase queda descartado por completo. El proyecto es 100% MySQL.**

## Cómo arrancar el proyecto
- Puertos: frontend Vite en **3000**, backend Express en **3001**
  (`apps/web/src/lib/api.js` apunta a `http://localhost:3001/api`).
- Crear/re-crear la BD (una vez):
  `mysql -u root -p < apps/server/schema.sql`
- Levantar todo desde la raíz: `npm run dev` (server + web, sin PocketBase).
- Usuarios de prueba: admin `admin@eceme.mil.bo`/`admin123`,
  docente `DOC-001`/`123456`, cursantes `CUR-001`/`CUR-002` (`123456`).
- Ver `README.md` para el detalle.

## Modelo de datos (MySQL, ver `apps/server/schema.sql`)
- `usuarios` (login), `materias` (con `ciclo`), `estudiantes`, `docentes`,
  `notas`, `criterios_evaluacion`, `evaluaciones_docentes`, `configuracion`,
  `notes`, y `bloques` (base para la cadena blockchain, aún sin lógica).
- `notas.nota_final` es **columna calculada**: `parcial_1*0.30 + parcial_final*0.60 + trabajos*0.10`.
- `docente_materias`: relación N-a-N (un docente dicta varias materias;
  una materia la pueden dictar hasta **3 docentes**).
- `estudiantes.docente_id`: cada cursante pertenece a un docente concreto
  (su "sección"), además de su `materia_id` y `ci`.

## Funcionalidades implementadas hoy
- **Códigos automáticos**: cursantes `CUR-XXX` y docentes `DOC-XXX` se generan
  solos en el backend (no se escriben).
- **Todo en MAYÚSCULAS**: nombres, grados y materias se normalizan a mayúsculas
  al guardar (lo que se ve es lo que se almacena).
- **Carnet de Identidad (CI)**: campo con validación 6–9 dígitos; se ve en las
  páginas de cursante y docente y en el directorio del admin.
- **Materias por ciclo**: al registrar cursante/docente solo se muestran las
  materias del ciclo correspondiente.
- **Evaluación docente**: endpoint `POST /api/estudiantes/evaluar-docente`
  (el cursante evalúa a SU docente 1–5; se refleja en estrellas del docente).
- **Docente ↔ materias (N-a-N)**: un docente puede dictar varias materias y
  elige cuál ver en su portal; una materia admite hasta 3 docentes.
- **Cursante → (materia + docente)**: al asignar cursante se elige la pareja
  materia→docente; cada docente ve solo a SUS cursantes.
- **Admin**: crea/edita/elimina materias, cursantes y docentes; directorio con
  pestañas (cursantes/docentes), buscador (nombre, código, CI, materia, ciclo)
  y paginación de 10.

## Pendiente (lo importante que falta)
(Nada crítico: bcrypt ✓, blockchain ✓, auditoría ✓, reportes PDF ✓.)

---

# Registro de avances — 2026-07-18 · CAPA BLOCKCHAIN (el core)

Ya está implementada la cadena de bloques de actas (SHA-256, cadena privada).

## Archivos
- `apps/server/blockchain.js` — núcleo: `calcularHash()` (SHA-256 sobre
  índice + materia + ciclo + acta canónica + hash_previo), `canonical()`
  (serialización determinista con claves ordenadas para que el hash sea
  reproducible pese al round-trip del JSON en MySQL), `GENESIS_PREV`.
- `apps/server/public/blockchain.html` — página visual de la cadena.
  Se abre en **http://localhost:3001/blockchain.html** (la sirve Express con
  `express.static`). Muestra los bloques como tarjetas unidas por eslabones
  de cadena (CSS); si un enlace no coincide, la cadenita se dibuja ROTA en
  rojo. Botones: «Verificar cadena» y «Reconstruir cadena desde las notas».
  NO tiene botones de manipulación (decisión del usuario: la alteración se
  hace manualmente en MySQL, más creíble para la defensa). Las instrucciones
  SQL de la demo están al pie de la propia página.

## Endpoints nuevos (en `apps/server/index.js`)
- `POST /api/actas/publicar` — empaqueta el acta (de una `materia_id` o
  general), calcula su hash, la encadena al último bloque y marca las notas
  como publicadas. Es el reemplazo "con blockchain" de publicar-lote.
- `GET  /api/blockchain` — bloques crudos.
- `GET  /api/blockchain/verificar` — recorre la cadena y devuelve `valida`,
  `primer_error` (índice + motivo `DATOS_ALTERADOS`/`ENLACE_ROTO`) y por cada
  bloque `hash_intacto`, `enlace_intacto`, `valido`, `hash_recalculado`.
- `POST /api/blockchain/demo-reset` — borra la cadena y vuelve a sellar un
  acta por cada materia con notas (deja todo en verde).
- **Flujo REAL cableado**: el botón "Publicar Tablero" del admin
  (`AdminPage.jsx` → `handlePublishNotes`) llama a `POST /api/actas/publicar`:
  cada publicación sella un bloque nuevo con las notas del momento.
- **No existen endpoints de manipulación** (se quitaron a propósito): la
  alteración para la demo se hace manualmente en MySQL, ver instrucciones abajo.

## Modelo de bloque (tabla `bloques`, ya existía)
`indice`, `materia_id`, `ciclo`, `acta_json` (acta congelada), `hash_previo`,
`hash`, `creado_en`. El bloque 0 usa `hash_previo` = 64 ceros (génesis).
El `sello_tiempo` va DENTRO de `acta_json` (no se usa `creado_en` en el hash,
para no depender del formato de fecha de MySQL).

## Vista de auditoría `v_actas_notas` (en schema.sql)
Desempaqueta `bloques.acta_json` con JSON_TABLE y muestra las notas selladas
como tabla normal. Columnas: `bloque` (= `bloques.indice`), `pos` (posición
0,1,2… del registro dentro del bloque; también se ve en blockchain.html),
`materia`, `codigo`, `estudiante`, `parcial`, `examen_final`, `trabajos`,
`nota_final`. `bloque` y `pos` son los que se usan en el UPDATE de la demo.

---

# Registro de avances — 2026-07-20 · AUTENTICACIÓN SEGURA

Contraseñas hasheadas con **bcryptjs** (salt rounds = 10, versiones síncronas
`hashSync`/`compareSync` por el estilo de callbacks de mysql2). La capa
blockchain NO se tocó.

- **Login** (`POST /api/login`): busca solo por identificador y valida con
  `bcrypt.compareSync`; mensaje 401 genérico (no revela si el usuario existe);
  la respuesta ya NO incluye el campo `password` (helper `usuarioSinPassword`).
- **Hasheo al guardar**: registro de cursantes/docentes y
  `POST /api/usuarios/cambiar-password` guardan el hash, nunca texto plano.
- **Migración**: `apps/server/hashear-passwords.js` (`npm run hash:pwd` en
  apps/server) hashea las claves que no empiecen con `$2`. Idempotente.
  **Ya se corrió el 2026-07-20** (27 usuarios migrados) — las claves de
  siempre (admin123, ECEME2026, 123456) siguen funcionando igual al entrar.
- **Recuperación de credenciales**:
  `POST /api/admin/usuarios/:usuarioId/reset-password` pone la clave genérica
  institucional (`PASSWORD_GENERICA = "ECEME2026"`, hasheada) y `primer_login = 1`
  (obliga a cambiarla al entrar). En el directorio del admin (`AdminPage.jsx`)
  cada fila tiene el botón amarillo de llave 🔑 «Restablecer contraseña», que
  muestra la clave temporal en un toast.
- Probado end-to-end: migración idempotente ✓ · login admin con clave de
  siempre ✓ · registro nuevo queda hasheado (`$2b$10$…`) ✓ · reset →
  `primer_login = 1` y entra con ECEME2026 ✓ · cadena blockchain intacta ✓.

---

# Registro de avances — 2026-07-20 · MÓDULO DE AUDITORÍA (logs)

Rastreo de actividad de usuarios. La blockchain NO se tocó.

- **Tabla `auditoria`** (ya creada en la BD viva con `apps/server/auditoria.sql`;
  la definición también está en `schema.sql` para instalaciones nuevas):
  `usuario_id` (sin FK a propósito: el log sobrevive si el usuario se borra),
  `usuario_nombre`, `rol`, `accion` (código corto), `detalle`, `ip`,
  `dispositivo` ("Chrome en Windows 10/11"), `fecha`.
  **OJO: nunca reejecutar schema.sql sobre la BD real** (hace DROP de todo);
  para BD existente usar `mysql -u root -p eceme_db < auditoria.sql`.
- **Backend** (`index.js`): middleware que arma `req.actor` desde cabeceras
  `X-Usuario-Id/-Nombre/-Rol` + IP (x-forwarded-for → remoteAddress) + user
  agent; `deducirDispositivo(ua)`; `registrarAuditoria(req, accion, detalle,
  actorOverride)` — el INSERT del log jamás hace fallar la acción principal
  (solo console.error). En el login se usa `actorOverride` (aún no hay cabeceras).
- **Acciones auditadas**: INICIO_SESION, CAMBIO_PASSWORD, RESET_PASSWORD,
  CREAR/EDITAR/ELIMINAR_CURSANTE, CREAR/EDITAR/ELIMINAR_DOCENTE,
  CREAR/ELIMINAR_MATERIA, PUBLICAR_ACTA (con # de bloque), PUBLICAR_NOTAS,
  CAMBIO_COMANDANTE, CREAR_CRITERIO.
- **`GET /api/admin/auditoria`**: últimos 200, más reciente primero, filtro
  `?q=` por usuario/acción/rol (parametrizado).
- **Frontend**: `lib/api.js` exporta `setAuditHeaders(user)` (nombre con
  encodeURIComponent porque las cabeceras no admiten acentos); AuthContext las
  pone al login/restaurar sesión y las quita al logout. La auditoría es una
  **PÁGINA propia**: `pages/AuditoriaPage.jsx` en la ruta `/admin/auditoria`
  (protegida, solo admin) con tabla Fecha/Usuario/Rol/Acción/Detalle/IP/
  Dispositivo, buscador con debounce (350 ms, filtra en el backend), botón
  Refrescar y «Volver al panel». Se entra con el botón **«Auditoría»** al
  final de `AdminPage.jsx` (decisión del usuario: página aparte, no sección).
- Nota: la IP sale `::1` cuando se entra desde la misma máquina del servidor
  (normal en pruebas locales). El navegador no puede leer el hostname del
  equipo; lo estándar es IP + navegador + SO, que es lo implementado.
- Probado end-to-end: login/publicar acta/crear cursante quedan registrados
  con IP y dispositivo ✓ · filtro `?q=` ✓ · UTF-8 correcto ✓ · cadena intacta ✓.

## Integridad de la bitácora por hashes (2026-07-20, mismo día)
La auditoría también está **encadenada por SHA-256**, igual que las actas
(pero es una cadena APARTE; blockchain.js no se tocó):
- `apps/server/auditoria-hash.js` — fórmula compartida: SHA-256 de
  usuario_id|usuario_nombre|rol|accion|detalle|ip|dispositivo|fecha ISO|hash_previo.
  El id autoincremental NO entra al hash. Génesis: hash_previo = "0".
  La fecha se fija en el código SIN milisegundos (TIMESTAMP no los conserva)
  y se serializa siempre con toISOString.
- `registrarAuditoria()` sella cada registro nuevo en caliente (busca el hash
  del último y encadena). Si el sellado/INSERT falla, la acción principal
  sigue normal (solo console.error).
- Columnas `hash` y `hash_previo` en `auditoria` (ya aplicadas en la BD viva
  con `apps/server/sellar-auditoria.sql`; también en auditoria.sql y schema.sql).
- Migración `apps/server/sellar-auditoria.js` (`npm run sellar:log`):
  re-encadena TODA la bitácora desde el génesis; determinista, se puede
  repetir. **Ya corrida el 2026-07-20.** OJO: también "re-sella" datos
  alterados, así que solo usarla para inicializar o restaurar a sabiendas.
- `GET /api/admin/auditoria/verificar` → `{integra, longitud, primer_error:
  {id, accion, motivo DATOS_ALTERADOS|ENLACE_ROTO}}`.
- En `AuditoriaPage.jsx`: botón «Verificar integridad» con banner verde
  «BITÁCORA ÍNTEGRA» o rojo «¡BITÁCORA ALTERADA!» (señala registro y motivo),
  y columna Hash (10 primeros caracteres, hash completo en el tooltip).
- Demo manual (igual que las actas): alterar en MySQL
  `UPDATE auditoria SET detalle='...' WHERE id=N;` → verificar sale rojo.
- Probado: íntegra ✓ · registro nuevo encadena en caliente ✓ · detalle
  alterado → DATOS_ALTERADOS en ese registro ✓ · hash falsificado detectado ✓.

---

# Registro de avances — 2026-07-20 · MÓDULO DE REPORTES (PDF oficiales)

Reemplaza el stub `generateNominalPDF`. PDFs tamaño carta con jsPDF +
jspdf-autotable (ya estaban instalados en apps/web). Blockchain intacta.

- **Todos los reportes** llevan el membrete institucional centrado (COMANDO DE
  INSTITUTOS MILITARES / ESCUELA DE COMANDO... / "MCAL. ANDRÉS DE SANTA CRUZ" /
  BOLIVIA) y cierran con el bloque de firma (línea + comandante de la tabla
  `configuracion` + "COMANDANTE DE LA ECEME.").
- **Backend** (solo datos; el PDF se arma en el frontend):
  - `GET /api/reportes/acta/:materiaId` — lista nominal de la materia ordenada
    de mayor a menor por nota_final (orden de mérito) + materia/ciclo/gestión/
    comandante + `sello` {bloque, hash} si la materia ya está sellada en la
    cadena (último bloque con ese materia_id; los de "Publicar Tablero" son
    generales con materia_id NULL, así que el sello suele venir de demo-reset).
  - `GET /api/reportes/desempeno-docente` — por docente y materia el promedio
    de cada criterio REAL del sistema convertido a escala /100 (promedio 1–5
    × 20), TOTAL por materia y promedio_general por docente.
- **Frontend** (`AdminPage.jsx`, en el Consolidado Académico):
  - Selector «MATERIA DEL ACTA...» + botón «Descargar acta oficial» →
    "ACTA OFICIAL DE CALIFICACIONES": tabla N° de mérito/Código/Cursante/Grado/
    1er Parcial 30%/Examen Final 60%/Trabajos 10%/Nota Final, fecha de emisión
    y, si está sellada, la línea "Documento sellado en la cadena, bloque N° X,
    hash: ...".
  - Botón «Reporte de desempeño docente» → "DESEMPEÑO DEL PERSONAL DE DOCENTES
    DE LA ECEME." en 3 partes: I. cuadro de criterios + tabla por docente
    (materias × C1..Cn + TOTAL); II. materias con nota total y PROMEDIO GENERAL
    por docente; III. clasificación EXCELENTE/MUY BUENO/REGULAR con conteo.
    Umbrales como constantes: `UMBRAL_EXCELENTE = 90`, `UMBRAL_MUY_BUENO = 75`.
  - OJO jsPDF: las fuentes estándar son latin-1; NO usar caracteres como ≥
    (se escribió ">=" a propósito).
- Probado: endpoints con datos reales ✓ (acta ordenada desc, sello bloque 0,
  404 materia inexistente, promedios ×20 correctos) · generación PDF con
  autotable validada en Node ✓ · build del frontend ✓.

---

# INSTRUCCIONES PARA PROBAR EL BLOCKCHAIN (demo de la defensa)

## Preparación
1. Levantar el sistema: `npm run dev` desde la raíz (server 3001 + web 3000).
2. Abrir la página de la cadena: **http://localhost:3001/blockchain.html**.
3. Si la cadena está vacía: pulsar «Reconstruir cadena desde las notas»
   (sella un acta por cada materia que tenga notas).
4. Para SQL usar: `mysql -u root -p eceme_db` (CLI en
   `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`) o MySQL Workbench.

## A) Crear bloques REALES (flujo normal del sistema)
1. Entrar como docente (`DOC-001`) y guardar/cambiar notas en la planilla.
2. Entrar como admin (`admin@eceme.mil.bo`) y pulsar **«Publicar Tablero»**
   → se sella un bloque nuevo (el toast dice qué # de bloque se creó).
3. Recargar blockchain.html: aparece el bloque nuevo colgando de la cadenita.
   Cada publicación agrega UN bloque; nunca se pisa lo anterior.

## B) Demostrar la inmutabilidad (alterar la BD a mano y que se detecte)
1. Ver las notas selladas dentro de los bloques (tabla normal, sin JSON):
   ```sql
   SELECT * FROM v_actas_notas;
   ```
2. Elegir un cursante de esa lista y anotar su `bloque` y su `pos`.
   Alterar su nota directo en la BD (ej.: examen final a 95, bloque 0, pos 0):
   ```sql
   UPDATE bloques
   SET acta_json = JSON_REPLACE(acta_json, '$.registros[0].parcial_final', '95.00')
   WHERE indice = 0;
   ```
   Campos alterables: `parcial_1` (parcial), `parcial_final` (examen final),
   `trabajos` (práctica), `nota_final`. Siempre con 2 decimales ('95.00').
3. En blockchain.html pulsar **«Verificar cadena»** → ese bloque sale en rojo
   **ALTERADO** (muestra hash guardado vs. hash real recalculado).
4. (Opcional, el atacante "listo") Falsificar también el hash:
   ```sql
   UPDATE bloques SET hash = SHA2(CONCAT(acta_json, 'x'), 256) WHERE indice = 0;
   ```
   → Verificar de nuevo: la cadenita hacia el bloque siguiente se dibuja ROTA
   (`ENLACE_ROTO`), y el bloque sigue inválido porque el atacante no conoce la
   fórmula exacta del hash (índice + materia + ciclo + acta canónica + hash
   previo). Punto clave: tendría que rehacer TODA la cadena.
5. Restaurar todo a verde: botón «Reconstruir cadena desde las notas»
   (o `POST /api/blockchain/demo-reset`). OJO: reconstruye la cadena desde las
   notas ACTUALES de la tabla `notas` (borra los bloques y los vuelve a sellar).

## Estado: probado end-to-end (2026-07-19)
Flujo real (nota nueva → publicar → bloque #1 encadenado) ✓ · vista
`v_actas_notas` ✓ · alteración manual detectada como `DATOS_ALTERADOS` ✓ ·
hash falsificado detectado como `ENLACE_ROTO` en cascada ✓ · demo-reset ✓.