# ECEME — Sistema Web con Tecnología Blockchain

Proyecto de grado: gestión segura de calificaciones y evaluación docente para la
Escuela de Comando y Estado Mayor del Ejército (ECEME). Ver `Claude.md` para el
contexto completo (el núcleo del sistema es la cadena de bloques de actas).

## Arquitectura

| Carpeta        | Qué es                    | Puerto |
|----------------|---------------------------|--------|
| `apps/web`     | Frontend React + Vite     | 3000   |
| `apps/server`  | Backend Express + MySQL   | 3001   |

> `apps/pocketbase` está **descartado**, el proyecto es 100% MySQL.

## Requisitos

- Node.js 20+ (probado en v24)
- MySQL 8+ corriendo en `localhost`

## Puesta en marcha (primera vez)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar la conexión a MySQL
Edita `apps/server/.env` con tu usuario y clave de MySQL:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_clave
DB_NAME=eceme_db
PORT=3001
```

### 3. Crear la base de datos y datos de prueba
```bash
mysql -u root -p < apps/server/schema.sql
```
Esto crea la base `eceme_db`, todas las tablas y datos de ejemplo.

### 4. Levantar todo (frontend + backend)
Desde la raíz del proyecto:
```bash
npm run dev
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

## Usuarios de prueba

| Rol      | Usuario              | Contraseña |
|----------|----------------------|------------|
| Admin    | `admin@eceme.mil.bo` | `admin123` |
| Docente  | `DOC-001`            | `123456`   |
| Cursante | `CUR-001`            | `123456`   |
| Cursante | `CUR-002`            | `123456`   |

## Levantar solo el backend
```bash
npm run dev --prefix apps/server
```

## Pendientes conocidos
- Hashear contraseñas con bcrypt (hoy se guardan en texto plano).
- Implementar la capa blockchain (SHA-256) al publicar actas.
- Botones de generación de PDF (jsPDF).
