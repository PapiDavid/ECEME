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
1. **Implementar la capa blockchain** (SHA-256 al publicar actas) — es el core.
   Hoy publicar es solo `UPDATE notas SET publicado = 1`.
2. **Hashear contraseñas con bcrypt** (hoy en texto plano).
3. **Botones de PDF** con jsPDF (acta para el comandante, ranking docente).