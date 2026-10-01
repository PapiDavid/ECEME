# Pruebas de carga con k6 y Grafana

Esta campaña mide el API de ECEME con **25, 50, 100, 150, 200 y 250 usuarios virtuales**. Cada nivel se sostiene 60 segundos y queda etiquetado con `usuarios`, por lo que Grafana grafica cada nivel por separado.

Las solicitudes son exclusivamente `GET` a rutas públicas (`/api/home/notas`, `/api/catalogos`, `/api/materias` y, en baja proporción, `/api/blockchain/verificar`). No crea ni modifica datos.

## Preparación

1. Inicie MySQL y el backend desde la raíz del repositorio:

   ```powershell
   npm run start --prefix apps/server
   ```

2. En otra consola, inicie Grafana e InfluxDB:

   ```powershell
   docker compose -f tests/k6/docker-compose.grafana.yml up -d
   ```

3. Espere unos segundos y abra `http://localhost:3000`. Usuario y contraseña iniciales: `admin` / `admin`. El tablero **ECEME - k6 carga escalonada** se importa automáticamente.

## Ejecutar la prueba de 250 usuarios

Con k6 instalado localmente:

```powershell
$env:BASE_URL = "http://localhost:3001"
k6 run --out influxdb=http://localhost:8086/k6 tests/k6/carga-250-usuarios.js
```

Alternativa sin instalar k6 (Docker):

```powershell
docker run --rm -i --add-host=host.docker.internal:host-gateway -e BASE_URL=http://host.docker.internal:3001 -v "${PWD}:/scripts" grafana/k6 run --out influxdb=http://host.docker.internal:8086/k6 /scripts/tests/k6/carga-250-usuarios.js
```

La duración predeterminada es de 6 minutos de carga más 50 segundos de separación entre niveles. Para una pasada breve de validación:

```powershell
$env:DURACION_NIVEL_SEG = "15"
$env:PAUSA_ENTRE_NIVELES_SEG = "3"
k6 run --out influxdb=http://localhost:8086/k6 tests/k6/carga-250-usuarios.js
```

## Lectura del tablero

El primer gráfico compara p95 de latencia por etiqueta `usuarios`; el segundo, solicitudes por segundo; el tercero, porcentaje de errores. La prueba falla automáticamente si hay más de 1% de errores, p95 supera 1.5 s o p99 supera 3 s. Esos valores son objetivos iniciales, no resultados: ajuste los umbrales según el SLA institucional.

## Otras pruebas recomendadas

- **Smoke:** 1 a 5 usuarios durante un minuto antes de cada despliegue; detecta caídas básicas.
- **Carga sostenida:** 250 usuarios durante 30 a 60 minutos; revela fugas de memoria, agotamiento del pool MySQL y degradación gradual.
- **Estrés y punto de quiebre:** aumentos controlados de 300, 400 y 500 usuarios en un entorno de pruebas; establezca el punto donde p95, errores o saturación dejan de cumplir el SLA.
- **Spike:** salto rápido, por ejemplo de 20 a 250 usuarios en 10 segundos; simula la publicación de calificaciones.
- **Soak:** carga moderada por 4 a 8 horas; controle CPU, RAM, conexiones MySQL, latencia y errores.
- **Flujos autenticados:** en una base aislada, genere cuentas de prueba y mida inicio de sesión, consulta de notas y planilla; no use producción porque esos flujos generan auditoría o modifican datos.

Al terminar, puede detener la visualización conservando los datos con `docker compose -f tests/k6/docker-compose.grafana.yml stop`. Para eliminar también los datos de prueba: `docker compose -f tests/k6/docker-compose.grafana.yml down -v`.
