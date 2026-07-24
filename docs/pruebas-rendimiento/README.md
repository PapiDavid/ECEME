# Test de carga y estrés del nodo blockchain

Prueba de rendimiento del backend (el "nodo" de la cadena privada) midiendo la
latencia al **sellar** y **verificar** actas encadenadas por SHA-256 bajo
niveles crecientes de usuarios concurrentes.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `informe.html` | **El informe con los gráficos** — ábrelo en el navegador (doble clic). |
| `informe.pdf` | El mismo informe en PDF tamaño carta, listo para anexar. |
| `informe-completo.png` | Captura de la página entera. |
| `graficos/*.png` | Cada gráfico por separado, en alta resolución, para pegar en el documento de grado. |
| `resultados.json` | Métricas crudas de todas las corridas. |
| `runner.js` | Script que ejecuta la campaña de pruebas (usa autocannon). |
| `graficos.js` · `informe.js` | Construyen el HTML y los SVG a partir de `resultados.json`. |
| `capturar.js` · `servir.js` | Exportan el informe a PNG y PDF (usan Puppeteer). |

## Cómo repetir la prueba

Las dependencias (`autocannon`, `puppeteer`) no están instaladas en el proyecto;
se instalan aparte, en esta carpeta o en una temporal:

```bash
npm init -y
npm install autocannon puppeteer
```

1. **Respaldar la base** antes de empezar (la fase de escritura crea bloques reales):

   ```bash
   mysqldump -u root -p eceme_db bloques auditoria > backup_bloques.sql
   ```

2. **Levantar el backend** (sin `--watch`, para que no se reinicie a mitad de la medición):

   ```bash
   cd apps/server && node index.js
   ```

3. **Correr la campaña** (tarda unos 5 minutos):

   ```bash
   node runner.js          # deja las métricas en resultados.json
   ```

4. **Generar el informe y las imágenes**:

   ```bash
   node informe.js informe.html
   node servir.js &        # sirve el informe en http://localhost:4599
   node capturar.js        # PNGs + PDF
   ```

5. **Restaurar la base** al estado previo:

   ```bash
   mysql -u root -p eceme_db < backup_bloques.sql
   ```

   Y comprobar que ambas cadenas quedaron íntegras:

   ```bash
   curl http://localhost:3001/api/blockchain/verificar
   curl http://localhost:3001/api/admin/auditoria/verificar
   ```

## Fases que ejecuta `runner.js`

1. **Carga y estrés** sobre `GET /api/blockchain/verificar` con 1, 10, 25, 50, 100 y 200
   usuarios simultáneos (20 s por nivel). Es la operación más pesada: recalcula el
   SHA-256 de todos los bloques y comprueba el encadenamiento.
2. **Lectura simple** sobre `GET /api/blockchain` a los mismos niveles, para aislar
   cuánto cuesta la verificación criptográfica frente a sólo leer de MySQL.
3. **Escalabilidad**: sella bloques hasta llegar a 8, 25, 50, 100, 200 y 400 y mide la
   verificación completa en cada tamaño.
4. **Sellado** sobre `POST /api/actas/publicar` con 1, 5 y 10 publicaciones simultáneas
   (100 publicaciones por nivel, porque cada petición crea un bloque real).

Al terminar comprueba el estado de la cadena (índices duplicados y verificación),
que es donde aparece el hallazgo documentado en la sección 6 del informe: el sellado
debe ser secuencial.

## Aviso

La fase 4 **escribe en la base de datos real**: crea cientos de bloques y, con
concurrencia, deja índices duplicados. No ejecutar sin respaldo previo.
