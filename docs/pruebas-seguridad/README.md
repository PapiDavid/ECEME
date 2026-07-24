# Verificación de la resistencia ante inyección y alteración de datos

Batería de ataques reales contra el sistema para comprobar dos cosas:

1. que los puntos de entrada **rechazan** la inyección SQL, y
2. que la cadena de bloques **detecta** cualquier alteración de una nota ya sellada,
   incluso hecha directamente en MySQL, por fuera de la aplicación.

**Resultado: 16 de 17 pruebas superadas.** Ninguna inyección prosperó y ninguna
alteración pasó inadvertida. El único hallazgo es de control de acceso (la API no
exige token de sesión) y está documentado con su corrección en el informe.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `informe.html` | **El informe** — ábrelo en el navegador (doble clic). |
| `informe.pdf` | El mismo informe en PDF tamaño carta, para anexar. |
| `informe-completo.png`, `marcador.png`, `alteracion-datos.png` | Capturas para pegar en el documento de grado. |
| `resultados.json` | Resultado crudo de las 17 pruebas. |
| `seguridad.js` | La batería de ataques. |
| `informe.js` · `capturar.js` · `servir.js` | Generan el HTML, el PDF y las imágenes. |

## Cómo repetirla

> ⚠️ `seguridad.js` **modifica la base de datos real** (altera y borra bloques y un
> registro de auditoría). Deshace cada cambio dentro de la misma prueba, pero **respalda
> siempre antes**:
>
> ```bash
> mysqldump -u root -p --databases eceme_db > backup.sql
> ```

1. Levantar el backend: `cd apps/server && node index.js`
2. Ejecutar los ataques: `node seguridad.js`
3. Generar el informe:

   ```bash
   node informe.js informe.html
   node servir.js &     # http://localhost:4599
   node capturar.js     # PNG + PDF (necesita puppeteer)
   ```

4. Comprobar que todo quedó íntegro:

   ```bash
   curl http://localhost:3001/api/blockchain/verificar
   curl http://localhost:3001/api/admin/auditoria/verificar
   ```

`seguridad.js` usa `mysql2` (ya está en el proyecto); `capturar.js` necesita
`puppeteer`, que se instala aparte (`npm install puppeteer`).

## Las 17 pruebas

**Inyección SQL (6)** — bypass de login con tautología, anulación de la contraseña con
comentario SQL, tautología y `UNION SELECT` en el buscador de la bitácora, payload
`DROP TABLE` e inyección en un parámetro numérico de la URL.

**Credenciales (3)** — la respuesta del login no expone la contraseña, las 27 claves
están hasheadas con bcrypt, y el mensaje de error no revela si el usuario existe.

**Alteración de datos (7)** — línea base, cambio de una nota sellada por `UPDATE`
directo, falsificación del hash del bloque, borrado de un bloque intermedio, intento de
editar bloques por la API, alteración de la bitácora de auditoría y restauración final.

**Control de acceso (1)** — acceso a una ruta de administración sin credenciales.
Es el único hallazgo.

## El hallazgo

`GET /api/admin/auditoria` responde 200 sin ninguna credencial: la protección de rutas
vive sólo en el frontend. Se corrige emitiendo un token de sesión en el login y
exigiéndolo en un middleware de Express para las rutas sensibles. **No toca la capa
blockchain.**
